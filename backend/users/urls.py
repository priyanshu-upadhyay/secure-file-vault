from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, UserProfileView, UserStorageView, RotateEncryptionKeyView, ServeProfilePhoto

app_name = 'users'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('storage/', UserStorageView.as_view(), name='storage'),
    path('rotate-key/', RotateEncryptionKeyView.as_view(), name='rotate_key'),
    path('profile_photos/<str:filename>', ServeProfilePhoto.as_view(), name='serve_profile_photo')
] 