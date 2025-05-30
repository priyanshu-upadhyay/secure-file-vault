from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import File, FileAccessLog

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email']
        read_only_fields = ['id']

class FileAccessLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = FileAccessLog
        fields = ['id', 'user', 'access_time', 'action', 'ip_address', 'user_agent']
        read_only_fields = ['id', 'access_time']

class FileSerializer(serializers.ModelSerializer):
    upload_date = serializers.DateTimeField(source='uploaded_at', read_only=True)
    file_size = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    owner = UserSerializer(read_only=True)
    access_logs = FileAccessLogSerializer(many=True, read_only=True)
    
    class Meta:
        model = File
        fields = [
            'id', 'owner', 'original_filename', 'file_type', 'upload_date',
            'file_size', 'is_encrypted', 'download_url', 'access_logs', 'file_hash'
        ]
        read_only_fields = ['owner', 'size', 'uploaded_at', 'last_accessed']

    def get_file_size(self, obj):
        """Convert size to human-readable format"""
        size = obj.size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} TB"

    def get_download_url(self, obj):
        request = self.context.get('request')
        if request and obj.file:
            return request.build_absolute_uri(f'/api/files/{obj.id}/download/')

    def create(self, validated_data):
        # Set the owner to the current user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data) 