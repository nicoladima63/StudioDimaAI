// src/api/rentri/rentriApi.ts
import apiClient from '@/api/client';

/**
 * API per la gestione dei rentri (controlli/visite di controllo)
 * 
 * Logica da implementare:
 * - getAllRentri() - recupera tutti i rentri
 * - getRentriByPaziente(pazienteId) - rentri per paziente
 * - getRentriByDate(start: string, end: string) - rentri per periodo
 * - createRentri(data) - crea nuovo rentri
 * - updateRentri(id, data) - aggiorna rentri
 * - deleteRentri(id) - elimina rentri
 * - getRentriStats() - statistiche rentri
 * - getRentriScaduti() - rentri scaduti
 * - getRentriInScadenza(days: number) - rentri in scadenza
 * - scheduleRentri(pazienteId, date) - programma rentri
 */

// Placeholder functions - da implementare
export async function getAllRentri() {
  const response = await apiClient.get('/api/rentri/all');
  return response.data;
}

export async function getRentriByPaziente(pazienteId: string) {
  const response = await apiClient.get(`/api/rentri/paziente/${pazienteId}`);
  return response.data;
}

export async function getRentriByDate(start: string, end: string) {
  const response = await apiClient.get('/api/rentri/by-date', {
    params: { start, end }
  });
  return response.data;
}

export async function createRentri(data: any) {
  const response = await apiClient.post('/api/rentri', data);
  return response.data;
}

export async function updateRentri(id: string, data: any) {
  const response = await apiClient.put(`/api/rentri/${id}`, data);
  return response.data;
}

export async function deleteRentri(id: string) {
  const response = await apiClient.delete(`/api/rentri/${id}`);
  return response.data;
}

export async function getRentriStats() {
  const response = await apiClient.get('/api/rentri/stats');
  return response.data;
}

export async function getRentriScaduti() {
  const response = await apiClient.get('/api/rentri/scaduti');
  return response.data;
}

export async function getRentriInScadenza(days: number = 30) {
  const response = await apiClient.get('/api/rentri/in-scadenza', {
    params: { days }
  });
  return response.data;
}

export async function scheduleRentri(pazienteId: string, date: string) {
  const response = await apiClient.post('/api/rentri/schedule', {
    pazienteId,
    date
  });
  return response.data;
}