// src/api/apiClient.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

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
  // Recupera il token direttamente dallo store Zustand
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
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, {
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

// API Functions
interface LoginPayload {
  username: string;
  password: string;
}

export async function login(credentials: LoginPayload) {
  const response = await apiClient.post('/api/auth/login', credentials);
  // La risposta ora contiene access_token, username, e role
  const { access_token, refresh_token, username } = response.data;
  if (access_token && refresh_token && username) {
    // Salviamo entrambi i token e l'username
    useAuthStore.getState().setToken(access_token, refresh_token, username);
  }
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

// Ottiene i calendari disponibili
export async function getCalendars() {
  const response = await apiClient.get('/api/calendar/list');
  return response.data;
}

// Sincronizza gli appuntamenti su un calendario per un intervallo di date
export async function syncAppointmentsToCalendar(calendarId: string, start: Date, end: Date) {
  const response = await apiClient.post('/api/calendar/sync', {
    calendarId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });
  return response.data;
}

// Cancella tutti gli eventi del calendario selezionato
export async function clearCalendarEvents(calendarId: string) {
  const encodedCalendarId = encodeURIComponent(calendarId);
  // Aumenta il timeout solo per questa chiamata, che può essere molto lunga
  const response = await apiClient.delete(`/api/calendar/clear/${encodedCalendarId}`, {
    timeout: 300000, // 5 minuti di timeout per gestire calendari molto grandi
  });
  return response.data;
}

export default apiClient;
