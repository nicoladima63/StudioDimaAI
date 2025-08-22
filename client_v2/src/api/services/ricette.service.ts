/**
 * Service API per la ricetta elettronica V2 - Compatibilità con V1
 * Replica le funzioni di V1 usando i nuovi endpoint separati
 */
import apiClient from "@/services/api/client";

// Replica interfacce da V1
export interface RicettaPaziente {
  id: number;
  nre: string;
  codice_pin: string;
  protocollo_transazione?: string;
  stato: 'inviata' | 'annullata' | 'erogata';
  paziente_nome: string;
  paziente_cognome: string;
  cf_assistito: string;
  data_compilazione: string;
  denominazione_farmaco: string;
  posologia: string;
  durata_trattamento: string;
  note?: string;
  pdf_base64?: string;
  created_at: string;
}

// Test SOLO Sistema TS - chiamata diretta senza dipendenze circolari
export async function getAllRicette(params?: {
  data_da?: string;  // YYYY-MM-DD
  data_a?: string;   // YYYY-MM-DD
  cf_assistito?: string;
}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.data_da) queryParams.append('data_da', params.data_da);
    if (params?.data_a) queryParams.append('data_a', params.data_a);
    if (params?.cf_assistito) queryParams.append('cf_assistito', params.cf_assistito);
    queryParams.append('limit', '50');
    
    const queryString = queryParams.toString();
    const url = `/ricetta/ts/list${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'TS_LIST_FAILED',
      message: error.response?.data?.message || error.message || 'Errore caricamento ricette Sistema TS',
      data: []
    };
  }
}

// Replica altre funzioni necessarie per compatibilità V1
export async function annullaRicetta(nre: string, pin: string, motivazione?: string) {
  const response = await apiClient.post('/ricetta/annulla', {
    nre,
    pin,
    motivazione: motivazione || 'Annullamento ricetta'
  });
  return response.data;
}

export async function verificaStatoRicetta(nre: string) {
  const response = await apiClient.get(`/ricetta/stato/${nre}`);
  return response.data;
}

export async function downloadRicettaPDFByNre(nre: string): Promise<Blob> {
  const response = await apiClient.get(`/ricetta/download/${nre}`, {
    responseType: 'blob'
  });
  return response.data;
}