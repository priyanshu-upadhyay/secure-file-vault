from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, RegisterSerializer, UserProfileUpdateSerializer, RotateKeySerializer
from core.views import BaseAPIView
from files.models import File # For accessing user's files
from Crypto.Cipher import AES # For AES operations
from Crypto.Random import get_random_bytes # For generating IVs
import os # For file path operations
from django.conf import settings # For BASE_DIR
import hashlib # For SHA256 hashing

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class UserProfileView(generics.RetrieveUpdateAPIView, BaseAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserProfileUpdateSerializer
        return UserSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        # Return updated user data with profile photo URL
        return Response(UserSerializer(instance, context={'request': request}).data)

class UserStorageView(BaseAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        # Safely calculate available storage
        available_storage = max(0, user.storage_quota - user.used_storage)
        usage_percentage = 0
        if user.storage_quota > 0:
            # Ensure used_storage isn't negative for percentage calculation
            usage_percentage = (max(0, user.used_storage) / user.storage_quota) * 100
        else: # Avoid division by zero if quota is 0
            usage_percentage = 100 if user.used_storage > 0 else 0
        
        return Response({
            'storage_quota': user.storage_quota,
            'used_storage': user.used_storage, # This will reflect the actual value, even if negative from past issues
            'usage_percentage': usage_percentage,
            'available_storage': available_storage
        })

class RotateEncryptionKeyView(BaseAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    # serializer_class = RotateKeySerializer # Keep for reference or remove if not used by DRF's generic mechanisms

    def post(self, request, *args, **kwargs):
        serializer = RotateKeySerializer(data=request.data) # Instantiate directly
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        new_raw_key_string = serializer.validated_data['new_encryption_key']
        old_raw_key_string_verify = serializer.validated_data.get('old_encryption_key') # Optional for verification

        # 1. Get old AES key for decryption
        old_aes_key = user.get_derived_aes_key()
        if not old_aes_key:
            # This case implies user had no key or it was invalid. 
            # If they are setting a new key for the first time, this might be okay,
            # but then there are no files to re-encrypt.
            # If they had files encrypted with a lost key, this is an issue.
            # For now, assume if no old_aes_key, no re-encryption is needed or possible with old key.
            user.set_raw_key(new_raw_key_string)
            user.save()
            return Response({"message": "New encryption key set. No files to re-encrypt or old key not found."}, status=status.HTTP_200_OK)

        # Optional: Verify old key if provided by user
        if old_raw_key_string_verify:
            derived_old_verify_key = hashlib.sha256(old_raw_key_string_verify.encode()).digest()
            if derived_old_verify_key != old_aes_key:
                return Response({"error": "Old encryption key verification failed."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Derive new AES key for encryption
        new_aes_key = hashlib.sha256(new_raw_key_string.encode()).digest()

        # 3. Identify files to re-encrypt
        files_to_reencrypt = File.objects.filter(owner=user, is_encrypted=True)
        if not files_to_reencrypt.exists():
            user.set_raw_key(new_raw_key_string)
            user.save()
            return Response({"message": "Encryption key updated. No encrypted files found to re-encrypt."}, status=status.HTTP_200_OK)

        # --- Re-encryption Logic (Synchronous for now) ---
        # WARNING: This will block the request and can be very slow for many/large files.
        # This section should be replaced with a background task system (e.g., Celery).
        failed_files = []
        successful_files_count = 0

        # self.stdout.write(f"Starting re-encryption for user {user.username}...") # Placeholder for logging
        print(f"[INFO] Starting re-encryption for user {user.username}...")

        for file_obj in files_to_reencrypt:
            try:
                file_path = os.path.join(settings.BASE_DIR, str(file_obj.file))
                if not os.path.exists(file_path):
                    # self.stderr.write(f"File not found at path: {file_path} for file ID {file_obj.id}")
                    print(f"[ERROR] File not found at path: {file_path} for file ID {file_obj.id}")
                    failed_files.append({"id": str(file_obj.id), "name": file_obj.original_filename, "error": "File not found on disk"})
                    continue

                with open(file_path, 'rb') as f:
                    encrypted_content_with_iv = f.read()
                
                old_iv = encrypted_content_with_iv[:16]
                old_ciphertext = encrypted_content_with_iv[16:]

                # Decrypt with old key
                decrypt_cipher = AES.new(old_aes_key, AES.MODE_CFB, iv=old_iv)
                decrypted_content = decrypt_cipher.decrypt(old_ciphertext)

                # Encrypt with new key
                new_iv = get_random_bytes(16)
                encrypt_cipher = AES.new(new_aes_key, AES.MODE_CFB, iv=new_iv)
                new_ciphertext = encrypt_cipher.encrypt(decrypted_content)
                new_encrypted_content_with_iv = new_iv + new_ciphertext

                with open(file_path, 'wb') as f:
                    f.write(new_encrypted_content_with_iv)
                
                successful_files_count += 1
                # self.stdout.write(f"Successfully re-encrypted: {file_obj.original_filename}") # Placeholder
                print(f"[INFO] Successfully re-encrypted: {file_obj.original_filename}")

            except Exception as e:
                # self.stderr.write(f"Failed to re-encrypt file {file_obj.original_filename} (ID: {file_obj.id}): {e}")
                print(f"[ERROR] Failed to re-encrypt file {file_obj.original_filename} (ID: {file_obj.id}): {e}")
                failed_files.append({"id": str(file_obj.id), "name": file_obj.original_filename, "error": str(e)})
        
        # --- End of Synchronous Re-encryption --- 

        if not failed_files:
            user.set_raw_key(new_raw_key_string)
            user.save()
            return Response({
                "message": f"Successfully re-encrypted {successful_files_count} file(s) and updated encryption key."
            }, status=status.HTTP_200_OK)
        else:
            # IMPORTANT: If any file fails, the user's key IS NOT UPDATED in this synchronous example.
            # A robust system would need retry logic for failed files or a way to manage partial success.
            return Response({
                "error": "Key rotation partially failed. Some files could not be re-encrypted. Encryption key not updated.",
                "failed_files": failed_files,
                "successful_count": successful_files_count
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
