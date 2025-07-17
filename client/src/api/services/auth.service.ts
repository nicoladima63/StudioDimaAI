// src/services/auth.service.ts
import apiClient from '@/api/client';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { LoginPayload, RegisterPayload } from '@/lib/types';

export async function login(credentials: LoginPayload) {
  const response = await apiClient.post('/api/auth/login', credentials);
  const { access_token, refresh_token, username } = response.data;
  
  if (access_token && refresh_token && username) {
    useAuthStore.getState().setToken(access_token, refresh_token, username);
  }
  
  return response.data;
}

export async function register(credentials: RegisterPayload) {
  const response = await apiClient.post('/api/auth/register', credentials);
  return response.data;
}
