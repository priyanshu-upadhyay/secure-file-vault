from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .logging import log_exception
import sys

class BaseAPIView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        """Add request ID to response headers"""
        response = super().finalize_response(request, response, *args, **kwargs)
        if hasattr(request, 'request_id'):
            response['X-Response-ID'] = request.request_id
        return response

    def handle_exception(self, exc):
        """Log exceptions with request context"""
        log_exception(self.request, sys.exc_info())
        return super().handle_exception(exc) 