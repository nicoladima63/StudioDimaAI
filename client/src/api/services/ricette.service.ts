// src/api/ricette/ricetteApi.ts
import apiClient from '@/api/client';

export interface RicettaPayload {
  paziente: {
    id: string;
    nome: string;
    cognome: string;
    codiceFiscale?: string;
    indirizzo?: string;
  };
  diagnosi: {
    codice: string;
    descrizione: string;
  };
  farmaco: {
    codice: string;
    principio_attivo: string;
    descrizione: string;
  };
  posologia: string;
  durata: string;
  note: string;
}

export async function searchDiagnosi(q: string) {
  const response = await apiClient.get('/api/diagnosi', { params: { q } });
  return response.data;
}

export async function searchFarmaci(q: string) {
  const response = await apiClient.get('/api/farmaci', { params: { q } });
  return response.data;
}

export async function inviaRicetta(payload: RicettaPayload) {
  const response = await apiClient.post('/api/ricetta/send', payload);
  return response.data;
}