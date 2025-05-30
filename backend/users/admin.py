from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'get_storage_usage_display', 'date_joined', 'is_staff')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'date_joined')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Storage Information', {
            'fields': ('storage_quota', 'used_storage'),
        }),
    )

    def get_storage_usage_display(self, obj):
        quota_gb = obj.storage_quota / (1024 * 1024 * 1024)
        used_mb = obj.used_storage / (1024 * 1024)
        percentage = obj.get_storage_usage_percentage()
        return f"{used_mb:.2f} MB / {quota_gb:.2f} GB ({percentage:.1f}%)"
    
    get_storage_usage_display.short_description = 'Storage Usage'
