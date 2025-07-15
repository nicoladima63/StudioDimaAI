// src/api/services/fatture.service.ts
import { apiClient } from '../client';

export async function getAllFatture() {
  const response = await apiClient.get('/api/fatture/all');
  return response.data; // { fatture: [...], last_update: ... }
}

export async function getAnniFatture(): Promise<number[]> {
  const res = await apiClient.get('/api/fatture/anni');
  return res.data;
}