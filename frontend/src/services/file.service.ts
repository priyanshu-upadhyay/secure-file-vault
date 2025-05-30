import axios from 'axios';
import { authService } from './auth.service';

const API_URL = '/files';

interface AccessLog {
    user: {
        username: string;
    };
    action: string;
    access_time: string;
    ip_address: string;
    user_agent?: string;
}

export interface FileResponse {
    id: string;
    original_filename: string;
    file_type: string;
    upload_date: string;
    file_size: string;
    is_encrypted: boolean;
    download_url: string;
    access_logs: AccessLog[];
}

class FileService {
    private getHeaders() {
        const token = authService.getCurrentToken();
        return {
            'Authorization': `Bearer ${token}`,
        };
    }

    // Calculate SHA-256 hash of a file
    async calculateFileHash(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Check for duplicate hash via backend
    async checkDuplicateHash(hash: string): Promise<boolean> {
        const response = await axios.get(`/files/check_hash/?hash=${hash}`, {
            headers: this.getHeaders(),
        });
        return response.data.exists;
    }

    // Create a reference to an existing file by hash
    async createFileReference(hash: string, file: File): Promise<FileResponse> {
        const response = await axios.post('/files/reference/', {
            hash,
            original_filename: file.name,
            file_type: file.type,
        }, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async uploadFile(file: File): Promise<FileResponse> {
        // Calculate hash and check for duplicate before uploading
        const hash = await this.calculateFileHash(file);
        const isDuplicate = await this.checkDuplicateHash(hash);
        if (isDuplicate) {
            // Instead of error, create a reference
            return await this.createFileReference(hash, file);
        }
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(API_URL + '/', formData, {
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    async getFiles(): Promise<FileResponse[]> {
        const response = await axios.get(API_URL + '/', {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async getFileDetails(fileId: string): Promise<FileResponse> {
        const response = await axios.get(`${API_URL}/${fileId}/`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async deleteFile(fileId: string): Promise<void> {
        await axios.delete(`${API_URL}/${fileId}/`, {
            headers: this.getHeaders(),
        });
    }

    async downloadFile(fileId: string): Promise<Blob> {
        const response = await axios.get(`${API_URL}/${fileId}/download/`, {
            headers: this.getHeaders(),
            responseType: 'blob',
        });
        
        // Check if the response is an error (JSON) instead of a file
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const reader = new FileReader();
            const textResult = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
                reader.readAsText(response.data);
            });
            const error = JSON.parse(textResult as string);
            throw new Error(error.error || 'Failed to download file');
        }
        
        return response.data;
    }
}

export const fileService = new FileService(); 