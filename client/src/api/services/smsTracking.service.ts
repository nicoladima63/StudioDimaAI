// src/api/services/smsTracking.service.ts

import apiClient from '@/api/client';

interface TrackedLink {
  id: number;
  token: string;
  full_link: string;
}

interface TipoMessaggio {
  id: number;
  codice: string;
  nome: string;
  descrizione: string;
}

export async function getTipiMessaggi(): Promise<TipoMessaggio[]> {
  const response = await apiClient.get('/api/v2/tipi-messaggi/');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error('Errore nel recupero dei tipi di messaggio');
}

export async function createTrackedLink(paziente_id: string, tipo_messaggio_id: number, metadata: any = {}): Promise<TrackedLink> {
  const response = await apiClient.post('/api/v2/sms-tracking/', { paziente_id, tipo_messaggio_id, metadata });
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error('Errore nella creazione del link tracciabile');
}