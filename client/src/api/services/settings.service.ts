// src/api/settings/settingsApi.ts
import { apiClient } from '../client';
import { useEnvStore } from '@/features/auth/store/useAuthStore';
import { triggerModeWarning } from '@/lib/utils';

export async function trySwitchToProd() {
  // Chiede al backend se è possibile passare a prod
  const response = await apiClient.get('/api/settings/check-prod');
  
  if (!response.data.allowed) {
    triggerModeWarning(response.data.message || 'Impossibile passare a produzione.');
    return { success: false, message: response.data.message };
  }
  
  // Se allowed, cambia modalità
  await setApiMode('prod');
  return { success: true };
}

export async function setApiMode(mode: 'dev' | 'prod') {
  const response = await apiClient.post('/api/settings/mode', { mode });
  
  // Se errore, mostra warning
  if (response.data.error) {
    triggerModeWarning(response.data.error);
    return { success: false, message: response.data.error };
  }
  
  return response.data;
}

export async function getApiMode() {
  const response = await apiClient.get('/api/settings/mode');
  return response.data.mode as 'dev' | 'prod';
}

export async function syncModeWithBackend() {
  const mode = await getApiMode();
  useEnvStore.getState().setMode(mode);
}

// Funzione generica per ottenere la modalità
export async function getMode(tipo: 'database' | 'rentri' | 'ricetta'): Promise<'dev' | 'prod' | 'test'> {
  const res = await apiClient.get(`/api/settings/${tipo}-mode`);
  return res.data.mode as 'dev' | 'prod' | 'test';
}

// Funzione generica per impostare la modalità
export async function setMode(tipo: 'database' | 'rentri' | 'ricetta', mode: 'dev' | 'prod' | 'test') {
  const res = await apiClient.post(`/api/settings/${tipo}-mode`, { mode });
  return res.data;
}

export async function ping() {
  const response = await apiClient.get('/api/tests/ping');
  return response.data;
}