FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Create necessary directories
RUN mkdir -p s3_files staticfiles data

# Set permissions
RUN chmod -R 777 data s3_files staticfiles

# Collect static files
RUN python manage.py collectstatic --noinput

# Make start script executable
COPY start.sh .
RUN chmod +x start.sh

# Add wait-for-it script to wait for MinIO
COPY wait-for-it.sh .
RUN chmod +x wait-for-it.sh

EXPOSE 8000

CMD ["./start.sh"] 