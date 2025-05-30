from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings
import uuid
import os

def file_upload_path(instance, filename):
    """Generate file path for new file upload"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    # Include user ID in path for better organization
    return os.path.join('uploads', str(instance.owner.id), filename)

class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to=file_upload_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)
    size = models.BigIntegerField()  # File size in bytes
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_accessed = models.DateTimeField(auto_now=True)
    is_encrypted = models.BooleanField(default=False)
    encryption_key_id = models.CharField(max_length=255, null=True, blank=True)
    file_hash = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.original_filename} (uploaded by {self.owner.username})"

    @property
    def file_path(self):
        return self.file.path if self.file else None

    @property
    def stored_filename(self): #A UUID-based filename we generate to safely store the file
        return os.path.basename(self.file.name) if self.file else None

class FileAccessLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.ForeignKey(File, on_delete=models.CASCADE, related_name='access_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    access_time = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=50)  # e.g., 'upload', 'download', 'delete'
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-access_time']

    def __str__(self):
        return f"{self.user.username} {self.action} {self.file.original_filename} at {self.access_time}"
