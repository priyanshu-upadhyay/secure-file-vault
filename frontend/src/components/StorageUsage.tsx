import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const StorageUsage: React.FC = () => {
    const { storageInfo } = useAuth();

    if (!storageInfo) {
        return null;
    }

    const { used, quota, percentage } = storageInfo;

    return (
        <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-600">
                {formatBytes(used)} / {formatBytes(quota)}
            </div>
            <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                    className={`h-2 rounded-full ${
                        percentage > 90
                            ? 'bg-red-600'
                            : percentage > 70
                            ? 'bg-yellow-400'
                            : 'bg-green-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export default StorageUsage; 