#!/bin/sh

# Wait for MinIO to be ready
until curl -s http://minio:9000/minio/health/live; do
  echo "Waiting for MinIO to be ready..."
  sleep 1
done

# Get current date in ISO format
DATE=$(date -u +'%Y%m%dT%H%M%SZ')
DATE_SHORT=$(date -u +'%Y%m%d')

# Create bucket using MinIO API with all required headers
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
  -H "x-amz-date: ${DATE}" \
  -H "Authorization: AWS4-HMAC-SHA256 Credential=${MINIO_ROOT_USER}/${DATE_SHORT}/us-east-1/s3/aws4_request" \
  -H "x-amz-acl: private" \
  -H "x-amz-meta-bucket-name: ${MINIO_BUCKET_NAME}" \
  -d "{}" \
  "http://minio:9000/${MINIO_BUCKET_NAME}"

echo "MinIO initialization completed!" 