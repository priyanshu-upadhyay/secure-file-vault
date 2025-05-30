import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as FaIcons from 'react-icons/fa';
import { FaInfoCircle } from "react-icons/fa";

const InfoIcon = FaIcons.FaInfoCircle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const UserCircleIcon = FaIcons.FaUserCircle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const LockIcon = FaIcons.FaLock as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const UnlockIcon = FaIcons.FaUnlock as unknown as React.FC<React.SVGProps<SVGSVGElement>>;

const API_BASE_URL = 'http://localhost:8000';

export function UserProfile() {
    const { user, refreshStorageInfo } = useAuth();
    const [formData, setFormData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        encryption_key: '',
        profile_photo: null as File | null
    });
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [showKeyInput, setShowKeyInput] = useState(false);

    // Helper for fallback avatar
    const profilePhotoUrl = user?.profile_photo_url || '';
    const hasEncryptionKey = user?.has_encryption_key;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({
                ...prev,
                profile_photo: e.target.files![0]
            }));
        }
    };

    const handleRemovePhoto = () => {
        setFormData(prev => ({ ...prev, profile_photo: null }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const formDataToSend = new FormData();
            if (formData.username !== user?.username) {
                formDataToSend.append('username', formData.username);
            }
            if (formData.email !== user?.email) {
                formDataToSend.append('email', formData.email);
            }
            if (formData.encryption_key) {
                formDataToSend.append('encryption_key', formData.encryption_key);
            }
            if (formData.profile_photo) {
                formDataToSend.append('profile_photo', formData.profile_photo);
            }

            const res = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: formDataToSend,
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                setFormData(prev => ({ ...prev, encryption_key: '' }));
                refreshStorageInfo();
            } else {
                const data = await res.json();
                setMessage({ 
                    type: 'error', 
                    text: Object.values(data).flat().join(', ') || 'Failed to update profile.'
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred while updating profile.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/change_password/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({ 
                    old_password: oldPassword, 
                    new_password: newPassword 
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Password changed successfully!' });
                setOldPassword('');
                setNewPassword('');
            } else {
                setMessage({ 
                    type: 'error', 
                    text: data.detail || 'Failed to change password.'
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred while changing password.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>

            {message.text && (
                <div className={`p-4 mb-6 rounded-md ${
                    message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-6">
                {/* Profile Photo */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                        Profile Photo
                        <span className="text-gray-400" title="This photo will be shown on your account."><InfoIcon /></span>
                    </h3>
                    <div className="flex items-center space-x-4">
                        {profilePhotoUrl ? (
                            <img
                                src={profilePhotoUrl}
                                alt="Profile"
                                className="w-20 h-20 rounded-full object-cover border"
                            />
                        ) : (
                            <UserCircleIcon className="w-20 h-20 text-gray-300" />
                        )}
                        <div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-md file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-indigo-50 file:text-indigo-700
                                    hover:file:bg-indigo-100"
                            />
                            {formData.profile_photo && (
                                <button
                                    type="button"
                                    onClick={handleRemovePhoto}
                                    className="mt-2 text-xs text-red-500 hover:underline"
                                >
                                    Remove selected photo
                                </button>
                            )}
                            <p className="mt-1 text-sm text-gray-500">
                                JPG, PNG or GIF (max. 2MB)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Basic Information */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Username
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Encryption Key */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center mb-4 gap-2">
                        <h3 className="text-lg font-medium">Encryption Key</h3>
                        {hasEncryptionKey ? (
                            <span className="flex items-center text-green-600" title="Encryption key is set."><LockIcon className="mr-1" /> Set</span>
                        ) : (
                            <span className="flex items-center text-gray-400" title="No encryption key set."><UnlockIcon className="mr-1" /> Not Set</span>
                        )}
                        <span className="text-gray-400 ml-2" title="Your encryption key is used to encrypt your files. Keep it safe!"><InfoIcon /></span>
                    </div>
                    <div>
                        {!showKeyInput ? (
                            <button
                                type="button"
                                onClick={() => setShowKeyInput(true)}
                                className="text-indigo-600 hover:underline text-sm mb-2"
                            >
                                {hasEncryptionKey ? 'Change Encryption Key' : 'Set Encryption Key'}
                            </button>
                        ) : (
                            <div>
                                <input
                                    type="password"
                                    name="encryption_key"
                                    value={formData.encryption_key}
                                    onChange={handleChange}
                                    placeholder={hasEncryptionKey ? "Enter new encryption key" : "Set your encryption key"}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKeyInput(false)}
                                    className="text-xs text-gray-500 hover:underline mt-1 mr-2"
                                >Cancel</button>
                                <span className="text-xs text-gray-400 ml-2">Leave empty to clear key</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Change Password */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium mb-4">Change Password</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                        <button
                            onClick={handleChangePassword}
                            disabled={isLoading || !oldPassword || !newPassword}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isLoading ? 'Changing Password...' : 'Change Password'}
                        </button>
                    </div>
                </div>

                {/* Save Changes Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}