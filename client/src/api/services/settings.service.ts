// @/api/services/settings.service.ts

import apiClient from '@/api/client';

export interface ModeResponse {
  mode:  'test' | 'prod';
  success?: boolean;
  error?: string;
  message?: string;
}

export interface SMSStatusResponse {
  mode:  'test' | 'prod';
  enabled: boolean;
  sender: string;
  api_configured?: boolean;
}

export interface SMSTestResponse {
  success: boolean;
  message: string;
  mode: string;
  error?: string;
}

export const getMode = async (tipo: 'database' | 'rentri' | 'ricetta' | 'sms'): Promise<'dev' | 'test' | 'prod'> => {
  const response = await apiClient.get<ModeResponse>(`/api/settings/${tipo}-mode`);
  return response.data.mode;
};

export const setMode = async (
  tipo: 'database' | 'rentri' | 'ricetta' | 'sms', 
  mode: 'dev' | 'test' | 'prod'
): Promise<ModeResponse> => {
  const response = await apiClient.post<ModeResponse>(`/api/settings/${tipo}-mode`, { mode });
  return response.data;
};

// Nuove funzioni specifiche per SMS
export const getSMSStatus = async (): Promise<SMSStatusResponse> => {
  const response = await apiClient.get<SMSStatusResponse>('/api/settings/sms/status');
  return response.data;
};

export const testSMSConnection = async (): Promise<SMSTestResponse> => {
  const response = await apiClient.post<SMSTestResponse>('/api/settings/sms/test');
  return response.data;
};

// Funzione ping esistente 
export const ping = async () => {
  const response = await apiClient.get('/api/ping');
  return response.data;
};