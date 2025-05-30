from django.contrib import admin
from .models import File, FileAccessLog

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ('original_filename', 'owner', 'file_type', 'get_size_display', 'uploaded_at', 'is_encrypted')
    list_filter = ('file_type', 'is_encrypted', 'uploaded_at')
    search_fields = ('original_filename', 'owner__username')
    ordering = ('-uploaded_at',)
    readonly_fields = ('id', 'uploaded_at', 'last_accessed')

    def get_size_display(self, obj):
        """Convert size to human-readable format"""
        size_bytes = obj.size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} TB"
    
    get_size_display.short_description = 'Size'

@admin.register(FileAccessLog)
class FileAccessLogAdmin(admin.ModelAdmin):
    list_display = ('file', 'user', 'action', 'access_time', 'ip_address')
    list_filter = ('action', 'access_time')
    search_fields = ('file__original_filename', 'user__username', 'ip_address')
    ordering = ('-access_time',)
    readonly_fields = ('id', 'access_time') 