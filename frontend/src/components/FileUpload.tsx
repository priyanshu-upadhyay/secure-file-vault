import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fileService } from '../services/file.service';
import { useAuth } from '../contexts/AuthContext';
import { formatBytes } from './StorageUsage';

interface FileUploadProps {
    onUploadSuccess?: () => void;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ERROR_TIMEOUT = 4000; // 4 seconds

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { refreshStorageInfo } = useAuth();

    // Auto-dismiss error after timeout
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, ERROR_TIMEOUT);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
        setError(null);

        // Handle rejected files first
        if (rejectedFiles.length > 0) {
            const oversizedFiles = rejectedFiles
                .filter(file => file.file.size > MAX_FILE_SIZE)
                .map(file => `${file.file.name} (${formatBytes(file.file.size)})`);
            
            if (oversizedFiles.length > 0) {
                setError(`The following files exceed the 100MB limit:\n${oversizedFiles.join('\n')}`);
                return;
            }
        }

        if (acceptedFiles.length === 0) return;

        setUploading(true);

        try {
            for (const file of acceptedFiles) {
                await fileService.uploadFile(file);
            }
            // Refresh storage info after successful upload
            await refreshStorageInfo();
            // Notify parent component
            onUploadSuccess?.();
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || 'Failed to upload file';
            setError(errorMessage);
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    }, [refreshStorageInfo, onUploadSuccess]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: true,
        maxSize: MAX_FILE_SIZE,
        onDropRejected: (rejectedFiles) => {
            const oversizedFiles = rejectedFiles
                .filter(file => file.file.size > MAX_FILE_SIZE)
                .map(file => `${file.file.name} (${formatBytes(file.file.size)})`);
            
            if (oversizedFiles.length > 0) {
                setError(`The following files exceed the 100MB limit:\n${oversizedFiles.join('\n')}`);
            }
        }
    });

    return (
        <div className="w-full max-w-xl mx-auto p-4">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
            >
                <input {...getInputProps()} />
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                    {isDragActive
                        ? "Drop the files here..."
                        : "Drag 'n' drop files here, or click to select files"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                    Maximum file size: {formatBytes(MAX_FILE_SIZE)}
                </p>
            </div>

            {uploading && (
                <div className="mt-4 text-center text-sm text-gray-600">
                    Uploading files...
                </div>
            )}

            {error && (
                <div className="mt-4 relative">
                    <div className="text-sm text-red-600 bg-red-50 p-4 pr-10 rounded whitespace-pre-wrap">
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors"
                            aria-label="Close error message"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUpload; 