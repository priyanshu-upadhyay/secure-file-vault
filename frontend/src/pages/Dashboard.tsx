import React, { useRef } from 'react';
import FileUpload from '../components/FileUpload';
import FileList, { FileListHandle } from '../components/FileList';

const Dashboard: React.FC = () => {
    const fileListRef = useRef<FileListHandle>(null);

    const handleUploadSuccess = () => {
        // Refresh the file list when upload is successful
        fileListRef.current?.fetchFiles();
    };

    return (
        <div className="container mx-auto py-8">
            <div className="space-y-8">
                <FileUpload onUploadSuccess={handleUploadSuccess} />
                <FileList ref={fileListRef} />
            </div>
        </div>
    );
};

export default Dashboard; 