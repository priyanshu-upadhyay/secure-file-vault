#!/bin/bash

# Wait for MinIO to be ready
until curl -s http://minio:9000/minio/health/live; do
  echo "Waiting for MinIO to be ready..."
  sleep 1
done

# Create bucket if it doesn't exist
mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}
mc mb myminio/${MINIO_BUCKET_NAME} --ignore-existing

echo "MinIO initialization completed!" 