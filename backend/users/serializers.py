from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework.validators import UniqueValidator

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    storage_usage_percentage = serializers.SerializerMethodField()
    has_encryption_key = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'storage_quota', 'used_storage', 
                 'storage_usage_percentage', 'date_joined', 'last_login',
                 'has_encryption_key', 'profile_photo_url')
        read_only_fields = ('id', 'date_joined', 'last_login', 'storage_quota', 
                          'used_storage', 'storage_usage_percentage', 'has_encryption_key',
                          'profile_photo_url')

    def get_storage_usage_percentage(self, obj):
        return obj.get_storage_usage_percentage()

    def get_has_encryption_key(self, obj):
        return obj.has_encryption_key()

    def get_profile_photo_url(self, obj):
        if obj.profile_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_photo.url)
            return obj.profile_photo.url
        return None

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=False,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    username = serializers.CharField(
        required=False,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    encryption_key = serializers.CharField(write_only=True, required=False)
    profile_photo = serializers.ImageField(required=False)

    class Meta:
        model = User
        fields = ('username', 'email', 'encryption_key', 'profile_photo')
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False}
        }

    def update(self, instance, validated_data):
        # Handle encryption key separately
        encryption_key_str = validated_data.pop('encryption_key', None)
        if encryption_key_str is not None:  # Allow empty string to clear the key
            instance.set_raw_key(encryption_key_str)

        # Handle profile photo separately
        profile_photo = validated_data.pop('profile_photo', None)
        if profile_photo:
            # Delete old profile photo if it exists
            if instance.profile_photo:
                instance.profile_photo.delete(save=False)
            instance.profile_photo = profile_photo

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

class RotateKeySerializer(serializers.Serializer):
    old_encryption_key = serializers.CharField(max_length=255, required=False, allow_blank=True, help_text="Optional: User's current raw encryption key for verification.")
    new_encryption_key = serializers.CharField(max_length=255, required=True, allow_blank=False, help_text="User's new raw encryption key.")

    def validate_new_encryption_key(self, value):
        if not value: # Should be caught by allow_blank=False, but double check
            raise serializers.ValidationError("New encryption key cannot be empty.")
        # Add any other complexity/strength requirements for the key if desired
        return value

class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'password2', 'email')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user 