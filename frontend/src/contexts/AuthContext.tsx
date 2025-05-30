import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, UserProfile, LoginCredentials, RegisterData } from '../services/auth.service';

interface AuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    token: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => void;
    storageInfo: {
        quota: number;
        used: number;
        percentage: number;
        available: number;
    } | null;
    refreshStorageInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [storageInfo, setStorageInfo] = useState<AuthContextType['storageInfo']>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            if (authService.getCurrentToken()) {
                const userData = await authService.getProfile();
                setUser(userData);
                await refreshStorageInfo();
                setToken(authService.getCurrentToken());
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            authService.logout();
        } finally {
            setIsLoading(false);
        }
    };

    const refreshStorageInfo = async () => {
        try {
            const info = await authService.getStorageInfo();
            setStorageInfo({
                quota: info.storage_quota,
                used: info.used_storage,
                percentage: info.usage_percentage,
                available: info.available_storage,
            });
        } catch (error) {
            console.error('Failed to fetch storage info:', error);
        }
    };

    const login = async (credentials: LoginCredentials) => {
        await authService.login(credentials);
        await checkAuth();
    };

    const register = async (data: RegisterData) => {
        await authService.register(data);
        await login({ username: data.username, password: data.password });
    };

    const logout = () => {
        authService.logout();
        setUser(null);
        setStorageInfo(null);
        setToken(null);
    };

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        token,
        login,
        register,
        logout,
        storageInfo,
        refreshStorageInfo,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
} 