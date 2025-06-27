// src/api/services/auth.service.ts
import { apiClient } from '../apiClient';
import type { LoginPayload, AuthResponse, RegisterPayload, UserProfile } from '../apiTypes';

export const AuthService = {
  login: async (credentials: LoginPayload) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response;
  },

  register: async (credentials: RegisterPayload) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', credentials);
    return response;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post<AuthResponse>('/auth/refresh', { refreshToken });
    return response;
  },

  getProfile: async () => {
    const response = await apiClient.get<UserProfile>('/auth/me');
    return response;
  }
};