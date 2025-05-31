import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StorageUsage from '../StorageUsage';
import * as FaIcons from 'react-icons/fa'; // Import all as FaIcons

// Define typed icons from FaIcons
const UserCircleIcon = FaIcons.FaUserCircle as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
const ChevronDownIcon = FaIcons.FaChevronDown as unknown as React.FC<React.SVGProps<SVGSVGElement>>; // For dropdown indicator

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    // State for the profile image URL in the nav
    const [navProfilePhotoUrl, setNavProfilePhotoUrl] = useState(user?.profile_photo_url || '/images/default-avatar.jpg');

    useEffect(() => {
        // Update the nav profile photo URL when the user object or its photo URL changes
        setNavProfilePhotoUrl(user?.profile_photo_url || '/images/default-avatar.jpg');
    }, [user?.profile_photo_url]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleProfileClick = () => {
        navigate('/profile');
    };

    // Enhanced link/button style
    const navButtonStyle = "flex items-center text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out";
    const logoutButtonStyle = "flex items-center bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navigation */}
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <Link to="/" className="flex-shrink-0 flex items-center">
                                <h1 className="text-xl font-bold text-gray-800">
                                    Abnormal Security - File Hub
                                </h1>
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <StorageUsage />
                            {user && (
                                <div className="relative">
                                    <button
                                        onClick={handleProfileClick}
                                        className={`${navButtonStyle}`}
                                    >
                                        {user.profile_photo_url && navProfilePhotoUrl !== '/images/default-avatar.jpg' ? (
                                            <img 
                                                src={navProfilePhotoUrl} 
                                                alt={user.username} 
                                                className="w-6 h-6 rounded-full mr-2 object-cover border border-gray-300"
                                                onError={() => {
                                                    if (navProfilePhotoUrl !== '/images/default-avatar.jpg') {
                                                        setNavProfilePhotoUrl('/images/default-avatar.jpg');
                                                    }
                                                }}
                                            />
                                        ) : user.profile_photo_url && navProfilePhotoUrl === '/images/default-avatar.jpg' ? (
                                            // Attempting to load default avatar, if this also errors, icon will show next
                                            <img 
                                                src={navProfilePhotoUrl} // Which is /images/default-avatar.jpg
                                                alt={user.username} 
                                                className="w-6 h-6 rounded-full mr-2 object-cover border border-gray-300"
                                                onError={() => {
                                                    // If default avatar itself fails, effectively hide img and let icon show
                                                    setNavProfilePhotoUrl(''); // Set to empty to trigger icon fallback
                                                }}
                                            />
                                        ) : (
                                            <UserCircleIcon className="w-6 h-6 mr-2 text-gray-500" />
                                        )}
                                        <span>{user.username}</span>
                                        <ChevronDownIcon className="w-4 h-4 ml-1 text-gray-500" />
                                    </button>
                                    {/* Dropdown menu can be added here in the future */}
                                </div>
                            )}
                            <button
                                onClick={handleLogout}
                                className={`${logoutButtonStyle}`}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main content */}
            <main className="flex-grow max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t mt-auto">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-500">
                        © {new Date().getFullYear()} File Hub. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}; 