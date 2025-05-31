#!/bin/bash

# Wait for MinIO to be ready
./wait-for-it.sh http://minio:9000 -- echo "MinIO is ready"

# Run migrations
python manage.py migrate

# Start Django
python manage.py runserver 0.0.0.0:8000 