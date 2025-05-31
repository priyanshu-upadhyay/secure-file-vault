from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
from django.conf import settings
from cryptography.fernet import Fernet
import base64
import os
import hashlib

class User(AbstractUser):
    """Custom user model for future extensibility"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    encryption_key = models.CharField(max_length=255, null=True, blank=True)
    profile_photo = models.ImageField(upload_to='profile_image/', null=True, blank=True)

    # Additional fields can be added here
    storage_quota = models.BigIntegerField(default=1 * 1024 * 1024 * 1024)  # 1GB default
    used_storage = models.BigIntegerField(default=0)

    class Meta:
        ordering = ['-date_joined']

    def __str__(self):
        return self.username

    def get_storage_usage_percentage(self):
        """Calculate storage usage percentage"""
        if self.storage_quota == 0:
            return 100
        return (self.used_storage / self.storage_quota) * 100

    def can_upload_file(self, file_size):
        """Check if user can upload a file of given size"""
        return (self.used_storage + file_size) <= self.storage_quota

    def set_raw_key(self, raw_key_string: str):
        """Encrypt and store the user's raw encryption key string"""
        if not raw_key_string:
            self.encryption_key = None
            return
        
        app_key_setting = getattr(settings, 'ENCRYPTION_KEY', None)
        if not app_key_setting:
            # This is a fallback and not ideal for production. 
            # settings.ENCRYPTION_KEY should be consistently defined.
            # print("[Warning] settings.ENCRYPTION_KEY not set, using a generated key for this session for user key encryption.")
            app_key = Fernet.generate_key()
        else:
            app_key = app_key_setting.encode() if isinstance(app_key_setting, str) else app_key_setting

        f = Fernet(app_key)
        encrypted_user_key = f.encrypt(raw_key_string.encode())
        self.encryption_key = base64.b64encode(encrypted_user_key).decode()

    def get_raw_key(self) -> str | None:
        """Decrypt and return the user's raw encryption key string"""
        if not self.encryption_key:
            return None
        
        try:
            app_key_setting = getattr(settings, 'ENCRYPTION_KEY', None)
            if not app_key_setting:
                # print("[Error] settings.ENCRYPTION_KEY not set. Cannot decrypt user key.")
                return None
            
            app_key = app_key_setting.encode() if isinstance(app_key_setting, str) else app_key_setting
            
            f = Fernet(app_key)
            encrypted_user_key_b64 = base64.b64decode(self.encryption_key.encode())
            decrypted_user_key = f.decrypt(encrypted_user_key_b64)
            return decrypted_user_key.decode()
        except Exception as e:
            # print(f"[Error] Failed to decrypt user key: {e}")
            return None

    def get_derived_aes_key(self) -> bytes | None:
        """Derive the 32-byte AES encryption key from the user's raw key."""
        raw_key = self.get_raw_key()
        if not raw_key:
            return None
        # Use SHA-256 to derive a 32-byte key suitable for AES-256
        return hashlib.sha256(raw_key.encode()).digest()

    def has_encryption_key(self):
        """Check if user has an encryption key set (i.e., self.encryption_key field is not null/empty)"""
        return bool(self.encryption_key)
