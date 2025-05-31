from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings
from django.http import FileResponse, HttpResponse
import os
import uuid
import shutil
import mimetypes
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import hashlib
from datetime import datetime, timedelta
import logging

from .models import File, FileAccessLog
from .serializers import FileSerializer

# Get logger for this module
logger = logging.getLogger(__name__)

# Maximum file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# Create your views here.

class FileViewSet(viewsets.ModelViewSet):
    serializer_class = FileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = File.objects.filter(owner=self.request.user)
        
        filename = self.request.query_params.get('filename', None)
        file_type = self.request.query_params.get('file_type', None)
        size_min = self.request.query_params.get('size_min', None)
        size_max = self.request.query_params.get('size_max', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if filename:
            queryset = queryset.filter(original_filename__icontains=filename)
        if file_type:
            queryset = queryset.filter(file_type__icontains=file_type)
        if size_min:
            queryset = queryset.filter(size__gte=size_min)
        if size_max:
            queryset = queryset.filter(size__lte=size_max)
        if date_from:
            queryset = queryset.filter(uploaded_at__gte=date_from)
        if date_to:
            # Add 1 day to date_to to include files uploaded on that day
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date() + timedelta(days=1)
                queryset = queryset.filter(uploaded_at__lt=date_to_obj)
            except ValueError:
                # Handle invalid date format if necessary, or log an error
                pass
            
        return queryset
    
    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check file size
        file_size = uploaded_file.size
        if file_size > MAX_FILE_SIZE:
            return Response({
                'error': f'File size ({file_size / (1024*1024):.2f}MB) exceeds maximum allowed size (100MB)'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # Check file size against user's remaining quota
        user = request.user
        if user.used_storage + file_size > user.storage_quota:
            available_space = user.storage_quota - user.used_storage
            return Response({
                'error': f'Storage quota exceeded. Available space: {available_space / (1024*1024):.2f}MB'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Read file content for hashing and encryption
        file_content = uploaded_file.read()
        file_hash = hashlib.sha256(file_content).hexdigest()

        # Check for duplicate by hash
        existing_file = File.objects.filter(file_hash=file_hash).first()
        if existing_file:
            # Just add a reference (new File object, same file_hash, no new storage)
            file_instance = File.objects.create(
                owner=user,
                file=existing_file.file,  # reference existing file
                original_filename=uploaded_file.name,
                file_type=uploaded_file.content_type,
                size=existing_file.size,
                is_encrypted=existing_file.is_encrypted,
                encryption_key_id=existing_file.encryption_key_id,
                file_hash=file_hash
            )
            user.used_storage += existing_file.size
            user.save()
            FileAccessLog.objects.create(
                file=file_instance,
                user=user,
                action='upload',
                ip_address=request.META.get('REMOTE_ADDR', '')
            )
            serializer = self.get_serializer(file_instance)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # Get encryption key (user-level or from .env)
        # encryption_key = get_encryption_key(user) # Old method
        derived_aes_key = user.get_derived_aes_key()

        # Encrypt file content if key is present, else store as plain
        if derived_aes_key:
            iv = get_random_bytes(16)
            cipher = AES.new(derived_aes_key, AES.MODE_CFB, iv=iv)
            encrypted_content = iv + cipher.encrypt(file_content)
            content_to_store = encrypted_content
            is_encrypted = True
            encryption_key_id = str(user.id) if getattr(user, 'encryption_key', None) else 'default'
        else:
            content_to_store = file_content
            is_encrypted = False
            encryption_key_id = None

        # Generate the custom filename for storage
        short_uuid = str(uuid.uuid4())[:8]
        if is_encrypted:
            stored_filename_stem = f"ecry::{short_uuid}"
        else:
            stored_filename_stem = short_uuid
        
        storage_path = stored_filename_stem

        # Save the file using Django's default storage system
        try:
            actual_stored_path = default_storage.save(storage_path, ContentFile(content_to_store))
        except Exception as e:
            # Log the exception
            logger.error(f"Failed to save file to storage: {e}", exc_info=True)
            return Response({'error': 'Failed to save file to storage.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Create the File model instance
        file_instance = File.objects.create(
            owner=user,
            file=actual_stored_path, # Store the path returned by the storage system
            original_filename=uploaded_file.name,
            file_type=uploaded_file.content_type,
            size=len(content_to_store), # Use length of content_to_store, as file_size was from original
            is_encrypted=is_encrypted,
            encryption_key_id=encryption_key_id, # This might still be relevant for user-level key id
            file_hash=file_hash
        )
        
        user.used_storage += len(content_to_store) # Ensure this uses the size of the content actually stored
        user.save()
        
        FileAccessLog.objects.create(
            file=file_instance,
            user=user,
            action='upload',
            ip_address=request.META.get('REMOTE_ADDR', '')
        )
        serializer = self.get_serializer(file_instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    def destroy(self, request, *args, **kwargs):
        file_instance = self.get_object()
        
        # Attempt to delete from storage only if this is the last reference to the physical file.
        # The File model's `file` field stores the path.
        # The logic for `other_refs` using `file_hash` is for deduplication of *content*.
        # The actual file on storage corresponds to `file_instance.file.name` (the path).
        
        can_delete_physical_file = False
        if file_instance.file and file_instance.file.name:
            # Count how many File objects point to this exact file path/name
            # This assumes that if file_hash is the same, existing_file.file is reused.
            # If create_file_reference directly copies existing_file.file (the path string), this is fine.
            # If a new file is saved even for references (it shouldn't be), this logic needs adjustment.
            
            # Let's refine: the critical part is if other File records use the *same file_hash*
            # and we assume that means they point to the same physical data.
            # The physical deletion should happen if no other File record shares this file_hash.
            
            other_hash_refs = File.objects.filter(file_hash=file_instance.file_hash).exclude(id=file_instance.id).count()
            if other_hash_refs == 0:
                can_delete_physical_file = True

        if can_delete_physical_file:
            try:
                if default_storage.exists(file_instance.file.name):
                    default_storage.delete(file_instance.file.name)
                    logger.info(f"Deleted physical file from storage: {file_instance.file.name}")
            except Exception as e:
                logger.error(f"Error deleting physical file {file_instance.file.name} from storage: {e}", exc_info=True)
        else:
            if file_instance.file and file_instance.file.name:
                logger.info(f"Physical file {file_instance.file.name} not deleted from storage due to other references (hash-based).")
            else:
                logger.info("No physical file associated with this record or path is empty.")


        # Update user's storage usage (this part seems okay)
        user_to_update = request.user
        original_file_size = file_instance.size # Size stored in DB
        user_to_update.used_storage -= original_file_size
        if user_to_update.used_storage < 0:
            logger.warning(f"User {user_to_update.username} used_storage was about to become negative ({user_to_update.used_storage}) due to subtracting {original_file_size}. Clamping to 0.")
            user_to_update.used_storage = 0
        user_to_update.save()
        
        FileAccessLog.objects.create(
            file=file_instance,
            user=request.user,
            action='delete',
            ip_address=request.META.get('REMOTE_ADDR', '')
        )
        # Delete the database record for the File instance
        file_instance_id_for_log = file_instance.id
        file_original_name_for_log = file_instance.original_filename
        response = super().destroy(request, *args, **kwargs) # This deletes the DB record
        logger.info(f"Deleted File DB record ID: {file_instance_id_for_log}, Original Name: {file_original_name_for_log}")
        return response

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        file_instance = self.get_object()

        if not file_instance.file or not file_instance.file.name: # Check .name for actual path
            return Response(
                {'error': 'File not found or path is missing'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Use default_storage to open the file
            if not default_storage.exists(file_instance.file.name):
                return Response(
                    {'error': 'File not found on storage backend'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Open the file from storage
            with default_storage.open(file_instance.file.name, 'rb') as f:
                file_content_from_storage = f.read()

            # Log the download
            FileAccessLog.objects.create(
                file=file_instance,
                user=request.user,
                action='download',
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )

            user = request.user
            derived_aes_key = user.get_derived_aes_key()
            
            content_to_send = file_content_from_storage
            if file_instance.is_encrypted:
                if derived_aes_key:
                    iv = file_content_from_storage[:16]
                    ciphertext = file_content_from_storage[16:]
                    cipher = AES.new(derived_aes_key, AES.MODE_CFB, iv=iv)
                    try:
                        content_to_send = cipher.decrypt(ciphertext)
                    except ValueError as e: # Possible padding error or incorrect key
                        print(f"[ERROR] Decryption failed for file {file_instance.original_filename}: {e}")
                        return Response({'error': 'Decryption failed. Key might be incorrect or file corrupted.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                else: # File is encrypted, but user has no key or it's invalid
                    return Response({'error': 'File is encrypted, but a valid decryption key is not available.'}, status=status.HTTP_403_FORBIDDEN)
            
            content_type, _ = mimetypes.guess_type(file_instance.original_filename)
            if not content_type:
                content_type = 'application/octet-stream'

            response = HttpResponse(
                content_to_send,
                content_type=content_type
            )
            response['Content-Disposition'] = f'attachment; filename="{file_instance.original_filename}"'
            return response

        except Exception as e:
            print(f"[ERROR] Failed to download file {file_instance.original_filename}: {str(e)}")
            return Response(
                {'error': f'Failed to download file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_file_hash(request):
    file_hash = request.GET.get('hash')
    if not file_hash:
        return Response({'exists': False, 'error': 'No hash provided'}, status=400)
    exists = File.objects.filter(file_hash=file_hash).exists()
    # print("Hello")
    return Response({'exists': exists})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_file_reference(request):
    file_hash = request.data.get('hash')
    original_filename = request.data.get('original_filename')
    file_type = request.data.get('file_type')
    user = request.user

    if not file_hash or not original_filename or not file_type:
        return Response({'error': 'Missing required fields.'}, status=400)

    existing_file = File.objects.filter(file_hash=file_hash).first()
    if not existing_file:
        return Response({'error': 'No file with this hash exists.'}, status=404)

    file_instance = File.objects.create(
        owner=user,
        file=existing_file.file,
        original_filename=original_filename,
        file_type=file_type,
        size=existing_file.size,
        is_encrypted=existing_file.is_encrypted,
        encryption_key_id=existing_file.encryption_key_id,
        file_hash=file_hash
    )
    # Update user's storage
    user.used_storage += existing_file.size
    user.save()

    FileAccessLog.objects.create(
        file=file_instance,
        user=user,
        action='reference',
        ip_address=request.META.get('REMOTE_ADDR', '')
    )
    serializer = FileSerializer(file_instance, context={'request': request})
    return Response(serializer.data, status=201)

# def get_encryption_key(user): # This function is now obsolete due to model methods
#     encryption_key = getattr(user, 'encryption_key', None)
#     if not encryption_key:
#         return None
#     if isinstance(encryption_key, str):
#         encryption_key = encryption_key.encode()
#     return hashlib.sha256(encryption_key).digest()[:32]  # AES-256
