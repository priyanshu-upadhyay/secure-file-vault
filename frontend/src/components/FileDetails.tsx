import React, { useEffect, useState } from 'react';
import { XMarkIcon, DocumentIcon, ClockIcon, UserIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { FileResponse, fileService } from '../services/file.service';

interface FileDetailsProps {
    fileId: string | null;
    onClose: () => void;
    onDownload: (fileId: string, filename: string) => void;
}

interface AccessLog {
    user: {
        username: string;
    };
    action: string;
    access_time: string;
    ip_address: string;
}

const FileDetails: React.FC<FileDetailsProps> = ({ fileId, onClose, onDownload }) => {
    const [file, setFile] = useState<FileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFileDetails = async () => {
            if (!fileId) return;
            
            try {
                setLoading(true);
                const fileDetails = await fileService.getFileDetails(fileId);
                setFile(fileDetails);
                setError(null);
            } catch (err: any) {
                setError('Failed to load file details');
                console.error('Error fetching file details:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFileDetails();
    }, [fileId]);

    if (!fileId) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

            {/* Modal */}
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-500"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>

                    {loading ? (
                        <div className="p-6 text-center">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                            <p className="mt-2 text-gray-600">Loading file details...</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center text-red-600">
                            {error}
                        </div>
                    ) : file && (
                        <>
                            {/* Header */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center">
                                    <DocumentIcon className="h-8 w-8 text-gray-400" />
                                    <div className="ml-3">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {file.original_filename}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {file.file_type}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-4">
                                {/* File Information */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-sm font-medium text-gray-500">Size</p>
                                            <p className="mt-1 text-sm text-gray-900">{file.file_size}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-sm font-medium text-gray-500">Upload Timestamp</p>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {new Date(file.upload_date).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-gray-500">Security</p>
                                        <div className="mt-1 flex items-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                file.is_encrypted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {file.is_encrypted ? 'Encrypted' : 'Not Encrypted'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Access History */}
                                    {file.access_logs && file.access_logs.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h4>
                                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                                                <ul className="divide-y divide-gray-200">
                                                    {file.access_logs.slice(0, 5).map((log: AccessLog, index: number) => (
                                                        <li key={index} className="px-4 py-3">
                                                            <div className="flex items-center text-sm">
                                                                <span className="capitalize font-medium text-gray-900">
                                                                    {log.action}
                                                                </span>
                                                                <span className="mx-2 text-gray-500">by</span>
                                                                <span className="font-medium text-gray-900">
                                                                    {log.user.username}
                                                                </span>
                                                                <span className="ml-auto text-gray-500">
                                                                    {new Date(log.access_time).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => onDownload(file.id, file.original_filename)}
                                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                        Download
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileDetails; 