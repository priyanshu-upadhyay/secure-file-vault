from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import FileViewSet, check_file_hash, create_file_reference
import os

router = DefaultRouter()
router.register(r'', FileViewSet, basename='file')

urlpatterns = [
    path('check_hash/', check_file_hash, name='check_file_hash'),
    path('reference/', create_file_reference, name='create_file_reference'),
] + router.urls