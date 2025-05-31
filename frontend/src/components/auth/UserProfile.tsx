import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as FaIcons from 'react-icons/fa';
import { FaInfoCircle, FaExclamationTriangle } from "react-icons/fa";
import Modal from '../Modal';

const InfoIcon = FaIcons.FaInfoCircle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const WarningIcon = FaExclamationTriangle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const UserCircleIcon = FaIcons.FaUserCircle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const LockIcon = FaIcons.FaLock as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const UnlockIcon = FaIcons.FaUnlock as unknown as React.FC<React.SVGProps<SVGSVGElement>>;

const API_BASE_URL = 'http://localhost:8000';

export function UserProfile() {
    const { user, refreshStorageInfo } = useAuth();
    const [formData, setFormData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        profile_photo: null as File | null,
        old_encryption_key: '',
        new_encryption_key: '',
        confirm_new_encryption_key: '',
    });
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [currentProfilePhotoUrl, setCurrentProfilePhotoUrl] = useState(user?.profile_photo_url || '/images/default-avatar.png');

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                username: user.username || '',
                email: user.email || '',
            }));
            setCurrentProfilePhotoUrl(user.profile_photo_url || '/images/default-avatar.png');
        }
    }, [user]);

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

    const handleOpenKeyModal = () => {
        setMessage({ type: '', text: '' });
        setFormData(prev => ({
            ...prev,
            old_encryption_key: '',
            new_encryption_key: '',
            confirm_new_encryption_key: '',
        }));
        setIsKeyModalOpen(true);
    };

    const handleSubmitKeyAction = () => {
        if (hasEncryptionKey) {
            handleRotateKey();
        } else {
            handleSetInitialKey();
        }
    };

    const handleSetInitialKey = async () => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        if (!formData.new_encryption_key) {
            setMessage({ type: 'error', text: 'Encryption key cannot be empty.' });
            setIsLoading(false);
            return;
        }
        if (formData.new_encryption_key !== formData.confirm_new_encryption_key) {
            setMessage({ type: 'error', text: 'Encryption keys do not match.' });
            setIsLoading(false);
            return;
        }

        const formDataToSend = new FormData();
        formDataToSend.append('encryption_key', formData.new_encryption_key);

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: formDataToSend,
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Encryption key set successfully!' });
                setIsKeyModalOpen(false);
                refreshStorageInfo();
            } else {
                setMessage({ type: 'error', text: data.encryption_key?.join(', ') || data.detail || 'Failed to set encryption key.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred while setting the key.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRotateKey = async () => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        if (formData.new_encryption_key !== formData.confirm_new_encryption_key) {
            setMessage({ type: 'error', text: 'New encryption keys do not match.' });
            setIsLoading(false);
            return;
        }
        if (!formData.new_encryption_key) {
            setMessage({ type: 'error', text: 'New encryption key cannot be empty.' });
            setIsLoading(false);
            return;
        }

        try {
            const payload: { new_encryption_key: string; old_encryption_key?: string } = {
                new_encryption_key: formData.new_encryption_key,
            };
            if (formData.old_encryption_key) {
                payload.old_encryption_key = formData.old_encryption_key;
            }

            const res = await fetch(`${API_BASE_URL}/api/auth/rotate-key/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message || 'Encryption key rotation initiated successfully! Re-encryption of files may take some time.' });
                setFormData(prev => ({
                    ...prev,
                    old_encryption_key: '',
                    new_encryption_key: '',
                    confirm_new_encryption_key: '',
                }));
                setIsKeyModalOpen(false);
                refreshStorageInfo();
            } else {
                setMessage({ 
                    type: 'error', 
                    text: data.error || data.detail || 'Failed to rotate encryption key.'
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred during key rotation.' });
        } finally {
            setIsLoading(false);
        }
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
            if (!hasEncryptionKey && formData.new_encryption_key) {
                formDataToSend.append('encryption_key', formData.new_encryption_key);
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
                setFormData(prev => ({ ...prev, new_encryption_key: '', confirm_new_encryption_key: '', old_encryption_key: '' }));
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
        <div className="container mx-auto p-4 max-w-2xl">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">User Profile</h1>

            {message.text && (
                <div className={`p-4 mb-6 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white shadow-xl rounded-lg p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="relative">
                        <img
                            src={currentProfilePhotoUrl}
                            alt="Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
                            onError={() => {
                                if (currentProfilePhotoUrl !== '/images/default-avatar.jpg') {
                                    setCurrentProfilePhotoUrl('/images/default-avatar.jpg');
                                }
                            }}
                        />
                        {formData.profile_photo && (
                            <button
                                onClick={handleRemovePhoto}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
                                title="Remove selected photo"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                    <input
                        type="file"
                        id="profile_photo"
                        name="profile_photo"
                        onChange={handleFileChange}
                        className="mt-4 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        accept="image/*"
                    />
                    {!formData.profile_photo && profilePhotoUrl && (
                         <p className="mt-2 text-xs text-gray-500">Current photo will be kept if no new photo is selected.</p>
                    )}
                </div>

                <div className="space-y-6">
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

                    {/* Encryption Key Section - Simplified to a button opening a modal */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium">Encryption Key</h3>
                                {hasEncryptionKey ? (
                                    <span className="flex items-center text-xs text-green-600 py-0.5 px-2 bg-green-50 rounded-full" title="Encryption key is set."><LockIcon className="mr-1" /> Set</span>
                                ) : (
                                    <span className="flex items-center text-xs text-gray-500 py-0.5 px-2 bg-gray-100 rounded-full" title="No encryption key set."><UnlockIcon className="mr-1" /> Not Set</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenKeyModal}
                                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                                {hasEncryptionKey ? 'Manage Encryption Key' : 'Set Encryption Key'}
                            </button>
                        </div>
                        <p className="text-sm text-gray-600">
                            Your unique encryption key secures your files. 
                            {hasEncryptionKey ? 'You can rotate it if needed.' : 'Set one now for enhanced security.'}
                        </p>
                    </div>

                    {isKeyModalOpen && (
                        <Modal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} title={hasEncryptionKey ? "Rotate Encryption Key" : "Set Your Encryption Key"}>
                            <div className="p-2 space-y-4">
                                {/* Enhanced Educational Box */}
                                <div className={`p-4 rounded-md border ${hasEncryptionKey ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-blue-50 border-blue-300 text-blue-700'}`}>
                                    <div className="flex items-start">
                                        <WarningIcon className={`h-6 w-6 mr-3 ${hasEncryptionKey ? 'text-yellow-500' : 'text-blue-500'}`} />
                                        <div>
                                            <h4 className="font-semibold mb-1">Important Considerations:</h4>
                                            {hasEncryptionKey ? (
                                                <ul className="list-disc list-inside text-sm space-y-1">
                                                    <li>Rotating your key will re-encrypt all currently encrypted files with the new key.</li>
                                                    <li>This process can take time depending on file quantity and size.</li>
                                                    <li>Ensure your new key is strong and stored securely.</li>
                                                    <li>If the old key is required for verification, have it ready.</li>
                                                </ul>
                                            ) : (
                                                <ul className="list-disc list-inside text-sm space-y-1">
                                                    <li>This key is vital for accessing your encrypted files.</li>
                                                    <li className="font-semibold">We do not store this key. If you lose it, you will permanently lose access to your encrypted files.</li>
                                                    <li>There is no recovery process for a lost key.</li>
                                                    <li>Store your key in a password manager or a secure physical location.</li>
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Form Fields */}
                                {hasEncryptionKey && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Current Encryption Key</label>
                                        <input type="password" name="old_encryption_key" value={formData.old_encryption_key} onChange={handleChange} placeholder="Enter current key if rotating" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                        <p className="mt-1 text-xs text-gray-500">Optional: Provide your current key for verification if you are rotating it.</p>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{hasEncryptionKey ? 'New Encryption Key' : 'Encryption Key'}</label>
                                    <input type="password" name="new_encryption_key" value={formData.new_encryption_key} onChange={handleChange} placeholder={hasEncryptionKey ? "Enter new strong key" : "Enter your desired key"} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Confirm {hasEncryptionKey ? 'New ' : ''}Encryption Key</label>
                                    <input type="password" name="confirm_new_encryption_key" value={formData.confirm_new_encryption_key} onChange={handleChange} placeholder="Confirm your key" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                </div>

                                {/* Modal-specific message area */}
                                {message.text && (
                                    <div className={`p-3 rounded-md text-sm ${ message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700' }`}>
                                        {message.text}
                                    </div>
                                )}

                                <div className="flex items-center justify-end space-x-3 pt-3">
                                    <button type="button" onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                        Cancel
                                    </button>
                                    <button type="button" onClick={handleSubmitKeyAction} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                                        {isLoading ? 'Processing...' : (hasEncryptionKey ? 'Rotate Key & Re-encrypt' : 'Set & Save Key')}
                                    </button>
                                </div>
                            </div>
                        </Modal>
                    )}

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
                            {isLoading ? 'Saving Profile...' : 'Save Profile Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}