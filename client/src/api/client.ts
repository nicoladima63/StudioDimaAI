// src/api/client.ts
import axios from 'axios';
import { useAuthStore, useEnvStore } from '@/features/auth/store/useAuthStore';
import { triggerModeWarning } from '@/lib/utils';

const API_BASE_URL = 'http://localhost:5000';

function getBaseUrl() {
  return API_BASE_URL;
}

const DEFAULT_TIMEOUT = 10000;

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Aggiorna dinamicamente la baseURL quando cambia la modalità
type Mode = 'dev' | 'prod';
let currentMode: Mode = useEnvStore.getState().mode;
useEnvStore.subscribe((state) => {
  if (state.mode !== currentMode) {
    apiClient.defaults.baseURL = getBaseUrl();
    currentMode = state.mode;
  }
});

// Request interceptor per aggiungere il token di autenticazione
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Flag per evitare loop di refresh
let isRefreshing = false;
// Coda per le richieste in attesa di un nuovo token
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor per gestire il refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const { status } = error.response || {};
    const authStore = useAuthStore.getState();

    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = authStore.refreshToken;
      if (!refreshToken) {
        authStore.clearToken();
        window.location.assign('/login?sessionExpired=true');
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${getBaseUrl()}/api/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        });
        
        const newAccessToken = data.access_token;
        authStore.setAccessToken(newAccessToken);
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        
        return apiClient(originalRequest);

      } catch (refreshError) {
        authStore.clearToken();
        window.location.assign('/login?sessionExpired=true');
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (status && status >= 500) {
      console.error('API Error:', error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;