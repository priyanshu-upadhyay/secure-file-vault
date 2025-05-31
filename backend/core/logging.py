import logging
import uuid
import time
from django.db import connection
from django.conf import settings
import json
from datetime import datetime
import traceback

class JsonFormatter(logging.Formatter):
    """Custom formatter that handles both structured and unstructured logs"""
    def format(self, record):
        # Create base log record
        log_record = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
        }

        # Add log_data if it exists
        if hasattr(record, 'log_data'):
            log_record['data'] = record.log_data
        else:
            # For unstructured logs, create a basic data structure
            log_record['data'] = {
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno,
            }

        # Add exception info if it exists
        if record.exc_info:
            log_record['data']['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': self.formatException(record.exc_info)
            }

        return json.dumps(log_record)

# Configure logging
logger = logging.getLogger('django')

class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.request_id = request_id

        # Start timer
        start_time = time.time()

        # Process the request
        response = self.get_response(request)

        # Calculate request duration
        duration = time.time() - start_time

        # Add request ID to response headers
        response['X-Response-ID'] = request_id

        # Log request details
        log_data = {
            'request_id': request_id,
            'timestamp': datetime.utcnow().isoformat(),
            'method': request.method,
            'path': request.path,
            'status_code': response.status_code,
            'duration': f"{duration:.3f}s",
            'user': str(request.user) if request.user.is_authenticated else 'anonymous',
            'ip': self.get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        }

        # Add request body for non-GET requests
        if request.method != 'GET':
            try:
                body = json.loads(request.body) if request.body else {}
                # Mask sensitive data
                if 'password' in body:
                    body['password'] = '******'
                if 'encryption_key' in body:
                    body['encryption_key'] = '******'
                log_data['request_body'] = body
            except:
                pass

        # Log the request
        logger.info('API Request', extra={'log_data': log_data})

        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class SQLLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Reset query log
        connection.queries_log.clear()
        
        # Process the request
        response = self.get_response(request)

        # Log SQL queries if debug is enabled
        if settings.DEBUG:
            queries = connection.queries
            if queries:
                log_data = {
                    'request_id': getattr(request, 'request_id', 'unknown'),
                    'timestamp': datetime.utcnow().isoformat(),
                    'queries': [
                        {
                            'sql': query['sql'],
                            'time': query['time'],
                        }
                        for query in queries
                    ],
                    'total_queries': len(queries),
                    'total_time': sum(float(q['time']) for q in queries),
                }
                logger.debug('SQL Queries', extra={'log_data': log_data})

        return response

def log_exception(request, exc_info):
    """Log exception details with request context"""
    formatted_traceback = "".join(traceback.format_tb(exc_info[2]))
    log_data = {
        'request_id': getattr(request, 'request_id', 'unknown'),
        'timestamp': datetime.utcnow().isoformat(),
        'method': request.method,
        'path': request.path,
        'user': str(request.user) if request.user.is_authenticated else 'anonymous',
        'ip': RequestLogMiddleware.get_client_ip(None, request),
        'exception': str(exc_info[1]),
        'traceback': formatted_traceback,
    }
    logger.error('Exception occurred', extra={'log_data': log_data}, exc_info=exc_info) 