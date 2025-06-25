// src/api/apiClient.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per inserire token in header Authorization
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Opzionale: interceptor per errori globali
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Puoi gestire logout automatico se 401, o mostrare notifiche
    if (error.response?.status === 401) {
      // esempio: cancellare token e forzare logout
      useAuthStore.getState().clearToken();
      // redirect a login o simili
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// Funzioni API di esempio
export async function login({ username, password }: { username: string; password: string }) {
  const response = await apiClient.post('/api/auth/login', { username, password });
  return response.data;
}

export const register = (credentials: { username: string; password: string }) =>
  apiClient.post('/auth/register', credentials)


export async function ping() {
  const response = await apiClient.get('/api/tests/ping');
  return response.data;
}

