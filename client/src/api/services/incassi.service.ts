// src/api/incassi/incassiApi.ts
import apiClient from '@/api/client';

/**
 * API per la gestione degli incassi
 * 
 * Logica da implementare:
 * - getAllIncassi() - recupera tutti gli incassi
 * - getIncassiByDate(start: string, end: string) - incassi per periodo
 * - getIncassiStats() - statistiche incassi
 * - createIncasso(data) - crea nuovo incasso
 * - updateIncasso(id, data) - aggiorna incasso
 * - deleteIncasso(id) - elimina incasso
 * - getIncassiByPaziente(pazienteId) - incassi per paziente
 * - getIncassiByMetodo(metodo: 'contanti' | 'carta' | 'bonifico') - incassi per metodo pagamento
 */

// Placeholder functions - da implementare
export async function getAllIncassi() {
  const response = await apiClient.get('/api/incassi/all');
  return response.data;
}

export const getIncassiByDate = (anno: string, mese?: string) => {
  const params: any = { anno };
  if (mese) params.mese = mese;
  return apiClient.get('/api/incassi/by_date', { params });
};

export const getIncassiByPeriodo = (anno: string, tipo: string, numero: string) => {
  return apiClient.get('/api/incassi/by_periodo', {
    params: { anno, tipo, numero },
  });
};

export async function getIncassiStats() {
  const response = await apiClient.get('/api/incassi/stats');
  return response.data;
}

export async function createIncasso(data: any) {
  const response = await apiClient.post('/api/incassi', data);
  return response.data;
}

export async function updateIncasso(id: string, data: any) {
  const response = await apiClient.put(`/api/incassi/${id}`, data);
  return response.data;
}

export async function deleteIncasso(id: string) {
  const response = await apiClient.delete(`/api/incassi/${id}`);
  return response.data;
}