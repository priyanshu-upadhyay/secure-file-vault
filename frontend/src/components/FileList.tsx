import React, { useEffect, useState, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { TrashIcon, LockClosedIcon } from '@heroicons/react/24/outline';
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
    fetchFiles: (filters?: Record<string, string>) => Promise<void>;
}

// Debounce utility (can be outside component or memoized)
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const debounced = (...args: Parameters<F>) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), waitFor);
    };
    const cancel = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    return { debounced, cancel };
};

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

    // Filter states
    const [filename, setFilename] = useState('');
    const [fileType, setFileType] = useState('');
    const [sizeMin, setSizeMin] = useState('');
    const [sizeMax, setSizeMax] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Core fetching logic, memoized
    const fetchFilesLogic = useCallback(async (filters: Record<string, string>) => {
        setLoading(true);
        try {
            const activeFilters = Object.fromEntries(
                Object.entries(filters).filter(([_, value]) => value !== null && value !== '' && value !== undefined)
            );
            const response = await fileService.getFiles(activeFilters);
            setFiles(response);
            setError(null);
        } catch (err: any) {
            setError('Failed to fetch files');
            console.error('Error fetching files:', err);
        } finally {
            setLoading(false);
        }
    }, []); // Empty dependency array: fetchFilesLogic is stable

    // useRef to hold the stable debounced function and its cancel method
    const debouncedFetchRef = useRef(
        debounce((filters: Record<string, string>) => fetchFilesLogic(filters), 500)
    );

    // useEffect for triggering search when filter states change
    useEffect(() => {
        const currentFilters = {
            filename,
            file_type: fileType,
            size_min: sizeMin,
            size_max: sizeMax,
            date_from: dateFrom,
            date_to: dateTo,
        };
        // Call the debounced function from the ref
        debouncedFetchRef.current.debounced(currentFilters);

        // Cleanup: cancel any pending debounced call when dependencies change or component unmounts
        return () => {
            debouncedFetchRef.current.cancel();
        };
    }, [filename, fileType, sizeMin, sizeMax, dateFrom, dateTo]); // Re-run when any filter state changes

    // Initial fetch on component mount
    useEffect(() => {
        // Fetch with empty filters initially or default filters
        fetchFilesLogic({});
    }, [fetchFilesLogic]); // Depends on stable fetchFilesLogic

    useImperativeHandle(ref, () => ({
        fetchFiles: async (filters?: Record<string, string>) => {
            const currentFilters = filters || {
                filename,
                file_type: fileType,
                size_min: sizeMin,
                size_max: sizeMax,
                date_from: dateFrom,
                date_to: dateTo,
            };
            await fetchFilesLogic(currentFilters);
        }
    }));

    const handleDeleteClick = (file: FileResponse) => {
        setFileToDelete(file);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!fileToDelete) return;
        try {
            await fileService.deleteFile(fileToDelete.id);
            // Refetch with current filters after delete
            const currentFilters = { filename, file_type: fileType, size_min: sizeMin, size_max: sizeMax, date_from: dateFrom, date_to: dateTo };
            await fetchFilesLogic(currentFilters);
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

    const handleClearFilters = () => {
        setFilename('');
        setFileType('');
        setSizeMin('');
        setSizeMax('');
        setDateFrom('');
        setDateTo('');
        // The useEffect listening to filter states will automatically trigger a debounced refetch
    };

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
            
            {/* Filter Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="filename" className="block text-sm font-medium text-gray-700">Filename</label>
                        <input
                            type="text"
                            name="filename"
                            id="filename"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="fileType" className="block text-sm font-medium text-gray-700">File Type (e.g., image/jpeg, pdf)</label>
                        <input
                            type="text"
                            name="fileType"
                            id="fileType"
                            value={fileType}
                            onChange={(e) => setFileType(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="sizeMin" className="block text-sm font-medium text-gray-700">Min Size (bytes)</label>
                        <input
                            type="number"
                            name="sizeMin"
                            id="sizeMin"
                            value={sizeMin}
                            onChange={(e) => setSizeMin(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="sizeMax" className="block text-sm font-medium text-gray-700">Max Size (bytes)</label>
                        <input
                            type="number"
                            name="sizeMax"
                            id="sizeMax"
                            value={sizeMax}
                            onChange={(e) => setSizeMax(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">Uploaded After</label>
                        <input
                            type="date"
                            name="dateFrom"
                            id="dateFrom"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700">Uploaded Before</label>
                        <input
                            type="date"
                            name="dateTo"
                            id="dateTo"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

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
                                            <p className="text-sm font-medium text-gray-900 flex items-center">
                                                {file.original_filename}
                                                {file.is_encrypted && (
                                                    <span title="This file is encrypted and securely stored.">
                                                        <LockClosedIcon className="h-5 w-5 ml-2 text-green-600" />
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {file.file_size} • {new Date(file.upload_date).toLocaleDateString()}
                                            </p>
                                            {/* Optional: Keep text or remove if icon is enough */}
                                            {/* {file.is_encrypted && (
                                                <p className="text-xs text-green-600 font-semibold">
                                                    Security - Encrypted
                                                </p>
                                            )} */}
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