// src/api/apiClient.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const TOKEN_STORAGE_KEY = 'auth_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const DEFAULT_TIMEOUT = 10000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const { status } = error.response || {};

    if (status === 401) {
      useAuthStore.getState().clearToken();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?sessionExpired=true');
      }
    }

    // Logga solo errori non gestiti
    if (status && status >= 500) {
      console.error('API Error:', error);
    }

    return Promise.reject(error);
  }
);

// API Functions
interface LoginPayload {
  username: string;
  password: string;
}

export async function login(credentials: LoginPayload) {
  const response = await apiClient.post('/api/auth/login', credentials);
  return response.data;
}

export async function register(credentials: LoginPayload) {
  const response = await apiClient.post('/api/auth/register', credentials);
  return response.data;
}

export async function ping() {
  const response = await apiClient.get('/api/tests/ping');
  return response.data;
}

export default apiClient;
