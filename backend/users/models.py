from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
from django.conf import settings
from cryptography.fernet import Fernet
import base64
import os

class User(AbstractUser):
    """Custom user model for future extensibility"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    encryption_key = models.CharField(max_length=255, null=True, blank=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)

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

    def set_encryption_key(self, key):
        """Encrypt and store the encryption key"""
        if not key:
            self.encryption_key = None
            return
        
        # Get or create encryption key for the application
        app_key = settings.ENCRYPTION_KEY
        if not app_key:
            app_key = Fernet.generate_key()
            settings.ENCRYPTION_KEY = app_key
        
        # Encrypt the user's encryption key
        f = Fernet(app_key)
        encrypted_key = f.encrypt(key.encode())
        self.encryption_key = base64.b64encode(encrypted_key).decode()

    def get_encryption_key(self):
        """Decrypt and return the encryption key"""
        if not self.encryption_key:
            return None
        
        try:
            # Get application encryption key
            app_key = settings.ENCRYPTION_KEY
            if not app_key:
                return None
            
            # Decrypt the user's encryption key
            f = Fernet(app_key)
            encrypted_key = base64.b64decode(self.encryption_key.encode())
            decrypted_key = f.decrypt(encrypted_key)
            return decrypted_key.decode()
        except Exception:
            return None

    def has_encryption_key(self):
        """Check if user has an encryption key set"""
        return bool(self.encryption_key)
