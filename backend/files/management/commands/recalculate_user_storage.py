from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Sum
from files.models import File # Assuming your File model is in the 'files' app

User = get_user_model()

class Command(BaseCommand):
    help = 'Recalculates the used_storage for all users based on their owned File objects.'

    def handle(self, *args, **options):
        self.stdout.write("Starting recalculation of used_storage for all users...")
        
        updated_count = 0
        user_count = User.objects.count()

        for user in User.objects.all():
            # Calculate the sum of sizes of all File records owned by the user
            # Ensure that File model has an 'owner' field pointing to User and a 'size' field
            try:
                actual_used_storage_data = File.objects.filter(owner=user).aggregate(total_size=Sum('size'))
                actual_used_storage = actual_used_storage_data['total_size'] if actual_used_storage_data['total_size'] is not None else 0
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error calculating storage for user {user.username} ({user.id}): {e}"))
                continue # Skip this user if there's an error in calculation

            if user.used_storage != actual_used_storage:
                self.stdout.write(
                    f"Updating user {user.username} (ID: {user.id}): "
                    f"Old storage = {user.used_storage}, New storage = {actual_used_storage}"
                )
                user.used_storage = actual_used_storage
                try:
                    user.save(update_fields=['used_storage'])
                    updated_count += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Error saving user {user.username} ({user.id}) after update: {e}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"User {user.username} (ID: {user.id}) storage is already correct: {user.used_storage}"))

        self.stdout.write(self.style.SUCCESS(
            f"Recalculation complete. {updated_count} out of {user_count} users' storage updated."
        )) 