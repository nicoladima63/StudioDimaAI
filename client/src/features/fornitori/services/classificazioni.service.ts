import apiClient from '@/api/client';
import type { 
  ClassificazioneResponse, 
  ClassificazioneRequest, 
  ClassificazioneCompletaRequest,
  ClassificazioneCosto,
  StatisticheClassificazioni
} from '../types';

interface ListaClassificazioniResponse {
  success: boolean;
  data: ClassificazioneCosto[];
  count: number;
  error?: string;
}

interface StatisticheResponse {
  success: boolean;
  data: StatisticheClassificazioni;
  error?: string;
}

const classificazioniService = {
  // Classificazione fornitori
  classificaFornitore: async (fornitoreId: string, request: ClassificazioneRequest): Promise<ClassificazioneResponse> => {
    const response = await apiClient.put(`/api/classificazioni/fornitore/${fornitoreId}`, request);
    return response.data;
  },

  getClassificazioneFornitore: async (fornitoreId: string): Promise<ClassificazioneResponse> => {
    const response = await apiClient.get(`/api/classificazioni/fornitore/${fornitoreId}`);
    return response.data;
  },

  rimuoviClassificazioneFornitore: async (fornitoreId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.delete(`/api/classificazioni/fornitore/${fornitoreId}`);
    return response.data;
  },

  // Metodo per classificazione completa (usa stesso endpoint unificato)
  salvaClassificazioneFornitoreCompleta: async (fornitoreId: string, request: ClassificazioneCompletaRequest): Promise<ClassificazioneResponse> => {
    const response = await apiClient.put(`/api/classificazioni/fornitore/${fornitoreId}`, request);
    return response.data;
  },

  // Classificazione spese (fallback)
  classificaSpesa: async (spesaId: string, request: ClassificazioneRequest): Promise<ClassificazioneResponse> => {
    const response = await apiClient.put(`/api/classificazioni/spesa/${spesaId}`, request);
    return response.data;
  },

  getClassificazioneSpesa: async (spesaId: string): Promise<ClassificazioneResponse> => {
    const response = await apiClient.get(`/api/classificazioni/spesa/${spesaId}`);
    return response.data;
  },

  rimuoviClassificazioneSpesa: async (spesaId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.delete(`/api/classificazioni/spesa/${spesaId}`);
    return response.data;
  },

  // Liste
  getFornitoriClassificati: async (): Promise<ListaClassificazioniResponse> => {
    const response = await apiClient.get('/api/classificazioni/fornitori');
    return response.data;
  },

  getSpeseClassificate: async (): Promise<ListaClassificazioniResponse> => {
    const response = await apiClient.get('/api/classificazioni/spese');
    return response.data;
  },

  // Statistiche
  getStatistiche: async (): Promise<StatisticheResponse> => {
    const response = await apiClient.get('/api/classificazioni/statistiche');
    return response.data;
  },

  // Categorie di spesa da CONTI.DBF
  getCategorieSpesa: async (): Promise<{ success: boolean; data: Array<{codice_conto: string, descrizione: string}>; count: number; error?: string }> => {
    const response = await apiClient.get('/api/classificazioni/categorie-spesa');
    return response.data;
  },

  // Suggestion automatica categoria per fornitore
  suggestCategoriaFornitore: async (fornitoreId: string): Promise<{
    success: boolean;
    data?: {
      categoria_suggerita: string | null;
      confidence: number;
      motivo: string;
      algoritmo: string;
    };
    error?: string;
  }> => {
    const response = await apiClient.get(`/api/classificazioni/fornitore/${fornitoreId}/suggest-categoria`);
    return response.data;
  }
};

export default classificazioniService;