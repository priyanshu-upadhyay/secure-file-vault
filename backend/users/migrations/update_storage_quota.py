from django.db import migrations

def update_storage_quota(apps, schema_editor):
    User = apps.get_model('users', 'User')
    # 1GB in bytes
    ONE_GB = 1 * 1024 * 1024 * 1024
    User.objects.all().update(storage_quota=ONE_GB)

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(update_storage_quota),
    ] 