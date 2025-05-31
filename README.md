# Secure File Vault

A secure file storage and management system built with Django, React, and MinIO. This application provides a secure way to store, encrypt, and manage files with user authentication and role-based access control.

## Features

- 🔐 Secure file storage with encryption
- 👤 User authentication and authorization
- 📁 File upload, download, and management
- 🔄 File versioning and history
- 🔍 Search and filter capabilities
- 📊 Storage usage tracking
- 🛡️ Role-based access control
- 🔒 End-to-end encryption support

## Tech Stack

- **Backend**: Django, Django REST Framework
- **Frontend**: React, TypeScript, Tailwind CSS
- **Storage**: MinIO (S3-compatible object storage)
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: SQLite (development) / PostgreSQL (production)
- **Containerization**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/secure-file-vault.git
   cd secure-file-vault
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your configuration:
   ```env
    # Django settings
    DJANGO_DEBUG=True
    DJANGO_SECRET_KEY=wjbe4n=2&jfny^u4o!=)*bsv&53a$7aa(&wyk-qlk6g6brkv)6
    DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

    # Database settings
    DB_ENGINE=django.db.backends.sqlite3
    DB_NAME=db.sqlite3

    # MinIO settings
    MINIO_ROOT_USER=minioadmin
    MINIO_ROOT_PASSWORD=minioadmin123
    MINIO_BUCKET_NAME=secure-file-vault
    MINIO_ENDPOINT_URL=http://minio:9000
    MINIO_REGION=us-east-1

    # Frontend settings
    REACT_APP_API_URL=http://localhost:8000/api

    # Encryption settings
    ENCRYPTION_KEY=a-y9AZNVRZsdeag-1VtQkIfkVzcJxyBUAmN4TVFgZZw=

    # CORS settings
    CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

    STORAGE_BACKEND=s3
   ```

4. Start the application:
   ```bash
   docker-compose up --build
   ```

5. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/api
   - MinIO Console: http://localhost:9001
   - MinIO API: http://localhost:9000

## Development Setup

### Backend Development

1. Create and activate virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   .\venv\Scripts\activate  # Windows
   ```

2. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Run migrations:
   ```bash
   python manage.py migrate
   ```

4. Start development server:
   ```bash
   python manage.py runserver
   ```

### Frontend Development

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start development server:
   ```bash
   npm start
   ```

## Production Deployment

1. Update environment variables:
   - Set `DJANGO_DEBUG=False`
   - Use strong secret keys
   - Configure proper CORS settings
   - Set up a production database

2. Build and deploy:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build
   ```

## API Documentation

The API documentation is available at `/api/docs/` when running the backend server.

### Key Endpoints

- `POST /api/auth/login/` - User login
- `POST /api/auth/register/` - User registration
- `GET /api/files/` - List files
- `POST /api/files/` - Upload file
- `GET /api/files/{id}/download/` - Download file
- `DELETE /api/files/{id}/` - Delete file

## Security Features

- JWT-based authentication
- File encryption at rest
- Role-based access control
- Secure file transfer
- Input validation and sanitization
- CORS protection
- Rate limiting

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@example.com or open an issue in the repository.

# Project Submission Instructions

## Preparing Your Submission

1. Before creating your submission zip file, ensure:
   - All features are implemented and working as expected
   - All tests are passing
   - The application runs successfully locally
   - Remove any unnecessary files or dependencies
   - Clean up any debug/console logs

2. Create the submission zip file:
   ```bash
   # Activate your backend virtual environment first
   cd backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Run the submission script from the project root
   cd ..
   python create_submission_zip.py
   ```

   The script will:
   - Create a zip file named `username_YYYYMMDD.zip` (e.g., `johndoe_20240224.zip`)
   - Respect .gitignore rules to exclude unnecessary files
   - Preserve file timestamps
   - Show you a list of included files and total size
   - Warn you if the zip is unusually large

3. Verify your submission zip file:
   - Extract the zip file to a new directory
   - Ensure all necessary files are included
   - Verify that no unnecessary files (like node_modules, __pycache__, etc.) are included
   - Test the application from the extracted files to ensure everything works

## Video Documentation Requirement

**Video Guidance** - Record a screen share demonstrating:
- How you leveraged Gen AI to help build the features
- Your prompting techniques and strategies
- Any challenges you faced and how you overcame them
- Your thought process in using AI effectively

**IMPORTANT**: Please do not provide a demo of the application functionality. Focus only on your Gen AI usage and approach.

## Submission Process

1. Submit your project through this Google Form:
   [Project Submission Form](https://forms.gle/nr6DZAX3nv6r7bru9)

2. The form will require:
   - Your project zip file (named `username_YYYYMMDD.zip`)
   - Your video documentation
   - Any additional notes or comments about your implementation

Make sure to test the zip file and video before submitting to ensure they are complete and working as expected.

