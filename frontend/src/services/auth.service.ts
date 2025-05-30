import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface RegisterData extends LoginCredentials {
    email: string;
    password2: string;
}

export interface AuthTokens {
    access: string;
    refresh: string;
}

export interface UserProfile {
    id: string;
    username: string;
    email: string;
    storage_quota: number;
    used_storage: number;
    storage_usage_percentage: number;
    date_joined: string;
    last_login: string | null;
    profile_photo?: string;
    has_encryption_key?: boolean;
    profile_photo_url?: string;
}

class AuthService {
    private refreshPromise: Promise<AuthTokens> | null = null;

    constructor() {
        // Add response interceptor for token refresh
        axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // If error is 401 and we haven't tried to refresh the token yet
                if (error.response?.status === 401 && !originalRequest._retry) {
                    if (!this.refreshPromise) {
                        this.refreshPromise = this.refreshToken();
                    }

                    try {
                        const tokens = await this.refreshPromise;
                        // Update the failed request's authorization header
                        originalRequest.headers['Authorization'] = `Bearer ${tokens.access}`;
                        // Retry the original request
                        return axios(originalRequest);
                    } catch (refreshError) {
                        // If refresh token fails, logout the user
                        this.logout();
                        return Promise.reject(refreshError);
                    } finally {
                        this.refreshPromise = null;
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    async login(credentials: LoginCredentials): Promise<AuthTokens> {
        const response = await axios.post(`${API_URL}/auth/token/`, credentials);
        if (response.data.access) {
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
        }
        return response.data;
    }

    async refreshToken(): Promise<AuthTokens> {
        const refresh_token = localStorage.getItem('refresh_token');
        if (!refresh_token) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
                refresh: refresh_token
            });
            
            const tokens = response.data;
            localStorage.setItem('access_token', tokens.access);
            if (tokens.refresh) {
                localStorage.setItem('refresh_token', tokens.refresh);
            }
            
            return tokens;
        } catch (error) {
            this.logout();
            throw error;
        }
    }

    async register(data: RegisterData): Promise<UserProfile> {
        const response = await axios.post(`${API_URL}/auth/register/`, data);
        return response.data;
    }

    async getProfile(): Promise<UserProfile> {
        const response = await axios.get(`${API_URL}/auth/profile/`, {
            headers: this.authHeader()
        });
        return response.data;
    }

    async getStorageInfo(): Promise<{
        storage_quota: number;
        used_storage: number;
        usage_percentage: number;
        available_storage: number;
    }> {
        const response = await axios.get(`${API_URL}/auth/storage/`, {
            headers: this.authHeader()
        });
        return response.data;
    }

    logout(): void {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

    getCurrentToken(): string | null {
        return localStorage.getItem('access_token');
    }

    private authHeader() {
        const token = this.getCurrentToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
}

export const authService = new AuthService(); 