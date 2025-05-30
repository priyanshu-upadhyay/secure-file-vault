import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import * as FaIcons from 'react-icons/fa'; // Import all as FaIcons
import { fileService, FileResponse } from '../services/file.service';
import { useAuth } from '../contexts/AuthContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import FileDetails from './FileDetails';

// Define typed icons from FaIcons
const IconFilePdf = FaIcons.FaFilePdf as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFileCsv = FaIcons.FaFileCsv as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFileImage = FaIcons.FaFileImage as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFileAlt = FaIcons.FaFileAlt as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFile = FaIcons.FaFile as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFileWord = FaIcons.FaFileWord as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFileExcel = FaIcons.FaFileExcel as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFilePowerpoint = FaIcons.FaFilePowerpoint as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFileArchive = FaIcons.FaFileArchive as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconFilm = FaIcons.FaFilm as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const IconMusic = FaIcons.FaMusic as unknown as React.FC<React.SVGProps<SVGSVGElement>>;

export interface FileListHandle {
    fetchFiles: () => Promise<void>;
}

// Helper function to get icon based on MIME type
const getIconForMimeType = (mimeType: string): JSX.Element => {
    if (!mimeType) return <IconFile className="h-6 w-6 text-gray-400" />;

    if (mimeType.startsWith('image/')) {
        return <IconFileImage className="h-6 w-6 text-blue-500" />;
    }
    if (mimeType.startsWith('video/')) {
        return <IconFilm className="h-6 w-6 text-purple-500" />;
    }
    if (mimeType.startsWith('audio/')) {
        return <IconMusic className="h-6 w-6 text-pink-500" />;
    }

    switch (mimeType) {
        case 'application/pdf':
            return <IconFilePdf className="h-6 w-6 text-red-500" />;
        case 'text/csv':
            return <IconFileCsv className="h-6 w-6 text-green-600" />;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return <IconFileWord className="h-6 w-6 text-blue-700" />;
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            return <IconFileExcel className="h-6 w-6 text-green-700" />;
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            return <IconFilePowerpoint className="h-6 w-6 text-orange-500" />;
        case 'application/zip':
        case 'application/x-rar-compressed':
        case 'application/x-tar':
        case 'application/x-7z-compressed':
            return <IconFileArchive className="h-6 w-6 text-yellow-500" />;
        case 'text/plain':
            return <IconFileAlt className="h-6 w-6 text-gray-500" />;
        default:
            return <IconFile className="h-6 w-6 text-gray-400" />;
    }
};

const FileList = forwardRef<FileListHandle>((_, ref) => {
    const [files, setFiles] = useState<FileResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { refreshStorageInfo } = useAuth();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileResponse | null>(null);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

    const fetchFiles = async () => {
        try {
            const response = await fileService.getFiles();
            setFiles(response);
            setError(null);
        } catch (err: any) {
            setError('Failed to fetch files');
            console.error('Error fetching files:', err);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        fetchFiles
    }));

    const handleDeleteClick = (file: FileResponse) => {
        setFileToDelete(file);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!fileToDelete) return;

        try {
            await fileService.deleteFile(fileToDelete.id);
            await fetchFiles();
            await refreshStorageInfo();
            setDeleteModalOpen(false);
            setFileToDelete(null);
        } catch (err: any) {
            setError('Failed to delete file');
            console.error('Error deleting file:', err);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setFileToDelete(null);
    };

    const handleDownload = async (fileId: string, filename: string) => {
        try {
            const blob = await fileService.downloadFile(fileId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            setError('Failed to download file');
            console.error('Error downloading file:', err);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    if (loading) {
        return (
            <div className="text-center py-4">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading files...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <h2 className="text-xl font-semibold mb-4">Your Files</h2>
            
            {error && (
                <div className="mb-4 text-center text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                </div>
            )}

            {files.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                    No files uploaded yet
                </div>
            ) :
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200">
                        {files.map((file) => (
                            <li 
                                key={file.id} 
                                className="p-4 hover:bg-gray-50 cursor-pointer"
                                onClick={() => setSelectedFileId(file.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        {getIconForMimeType(file.file_type)}
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-gray-900">
                                                {file.original_filename}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {file.file_size} • {new Date(file.upload_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(file.id, file.original_filename);
                                            }}
                                            className="text-sm text-blue-600 hover:text-blue-800"
                                        >
                                            Download
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(file);
                                            }}
                                            className="text-sm text-red-600 hover:text-red-800"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            }

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                filename={fileToDelete?.original_filename || ''}
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />

            <FileDetails
                fileId={selectedFileId}
                onClose={() => setSelectedFileId(null)}
                onDownload={handleDownload}
            />
        </div>
    );
});

FileList.displayName = 'FileList';

export default FileList; 