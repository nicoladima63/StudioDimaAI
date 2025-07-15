// src/api/services/recalls.service.ts

import { apiClient } from '../client';
import type {
  RichiamiResponse,
  RichiamiStatisticsResponse,
  RichiamoMessageResponse,
  RichiamiExportResponse,
  RichiamiTestResponse,
  RichiamoFilters
} from '../apiTypes';

/**
 * Ottiene tutti i richiami con filtri opzionali (giorni, stato, tipo)
 */
export async function getRecalls(filters?: RichiamoFilters): Promise<RichiamiResponse> {
  const params = new URLSearchParams();

  if (filters?.days_threshold) {
    params.append('days', filters.days_threshold.toString());
  }
  if (filters?.status) {
    params.append('status', filters.status);
  }
  if (filters?.tipo) {
    params.append('tipo', filters.tipo);
  }

  const response = await apiClient.get<RichiamiResponse>(`/api/recalls/?${params.toString()}`);
  return response.data;
}

/**
 * Ottiene le statistiche sui richiami
 */
export async function getRecallStatistics(daysThreshold: number = 90): Promise<RichiamiStatisticsResponse> {
  const response = await apiClient.get<RichiamiStatisticsResponse>(
    `/api/recalls/statistics?days=${daysThreshold}`
  );
  return response.data;
}

/**
 * Ottiene il messaggio associato a un richiamo specifico
 */
export async function getRecallMessageById(richiamoId: string): Promise<RichiamoMessageResponse> {
  const response = await apiClient.get<RichiamoMessageResponse>(`/api/recalls/${richiamoId}/message`);
  return response.data;
}

/**
 * Aggiorna le date dei richiami in base all’ultima visita
 */
export async function updateRecallDates(): Promise<{ success: boolean; data: Record<string, unknown>; message: string }> {
  const response = await apiClient.post(`/api/recalls/update-dates`);
  return response.data;
}

/**
 * Esporta i richiami in formato CSV o altro
 */
export async function exportRecalls(daysThreshold: number = 90): Promise<RichiamiExportResponse> {
  const response = await apiClient.get<RichiamiExportResponse>(`/api/recalls/export?days=${daysThreshold}`);
  return response.data;
}

/**
 * Esegue un test del servizio richiami (healthcheck o simile)
 */
export async function testRecallsService(): Promise<RichiamiTestResponse> {
  const response = await apiClient.get<RichiamiTestResponse>(`/api/recalls/test`);
  return response.data;
}

/**
 * Marca un richiamo come gestito (mock temporaneo)
 */
export async function markRecallAsHandled(richiamoId: string): Promise<{ success: boolean; message: string }> {
  // In futuro andrà fatto via PATCH/PUT al backend
  return {
    success: true,
    message: `Richiamo ${richiamoId} marcato come gestito`
  };
}
