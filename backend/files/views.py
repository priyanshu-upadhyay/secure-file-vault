from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.core.files.storage import default_storage
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

from .models import File, FileAccessLog
from .serializers import FileSerializer

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
        # Store file in /s3/ with no extension, prefix 'ecry::' if encrypted, and use short UUID
        file_storage_dir = os.path.join(settings.MAIN_DIR, 's3')
        os.makedirs(file_storage_dir, exist_ok=True)
        short_uuid = str(uuid.uuid4())[:8]
        if is_encrypted:
            stored_filename = f"ecry::{short_uuid}"
        else:
            stored_filename = short_uuid
        stored_path = os.path.join(file_storage_dir, stored_filename)
        with open(stored_path, 'wb') as f:
            f.write(content_to_store)
        relative_path = os.path.relpath(stored_path, settings.BASE_DIR)
        file_instance = File.objects.create(
            owner=user,
            file=relative_path,
            original_filename=uploaded_file.name,
            file_type=uploaded_file.content_type,
            size=file_size,
            is_encrypted=is_encrypted,
            encryption_key_id=encryption_key_id,
            file_hash=file_hash
        )
        user.used_storage += file_size
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
        user_id = str(file_instance.owner.id)
        try:
            # Only delete the physical file if this is the last reference
            if file_instance.file:
                file_path = os.path.join(settings.BASE_DIR, str(file_instance.file))
                print(f"[DEBUG] Attempting to delete file at: {file_path}")
                # Count references to this file_hash (excluding this instance)
                other_refs = File.objects.filter(file_hash=file_instance.file_hash).exclude(id=file_instance.id).count()
                if other_refs == 0:
                    # Delete the physical file if it exists
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    if default_storage.exists(str(file_instance.file)):
                        default_storage.delete(str(file_instance.file))
        except Exception as e:
            print(f"Error during file/folder cleanup: {e}")
        # Update user's storage usage
        user_to_update = request.user
        user_to_update.used_storage -= file_instance.size
        if user_to_update.used_storage < 0:
            # Log this anomaly, as it indicates a prior miscalculation
            print(f"[WARNING] User {user_to_update.username} used_storage was about to become negative ({user_to_update.used_storage}). Clamping to 0.")
            # This might also be a good place to trigger a full recalculation for this user if anomalies are frequent.
            user_to_update.used_storage = 0
        user_to_update.save()
        # Log the deletion
        FileAccessLog.objects.create(
            file=file_instance,
            user=request.user,
            action='delete',
            ip_address=request.META.get('REMOTE_ADDR', '')
        )
        # Delete the database record
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        file_instance = self.get_object()

        if not file_instance.file:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Resolve the file path manually
            file_path = os.path.join(settings.BASE_DIR, str(file_instance.file))
            if not os.path.exists(file_path):
                return Response(
                    {'error': 'File not found on storage'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Log the download
            FileAccessLog.objects.create(
                file=file_instance,
                user=request.user,
                action='download',
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )

            # Get the encryption key (user-level or from .env)
            user = request.user
            # encryption_key = get_encryption_key(user) # Old method
            derived_aes_key = user.get_derived_aes_key()

            with open(file_path, 'rb') as f:
                file_content = f.read()
            if file_instance.is_encrypted and derived_aes_key:
                iv = file_content[:16]
                cipher = AES.new(derived_aes_key, AES.MODE_CFB, iv=iv)
                decrypted_content = cipher.decrypt(file_content[16:])
                content_to_send = decrypted_content
            else:
                content_to_send = file_content

            # Get the content type
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
