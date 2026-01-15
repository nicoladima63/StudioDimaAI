import apiClient from '@/services/api/client';
import type { 
  ClassificazioneResponse, 
  ClassificazioneRequest, 
  ClassificazioneCompletaRequest,
  ClassificazioneCosto
} from '../types';

interface ListaClassificazioniResponse {
  success: boolean;
  data: ClassificazioneCosto[];
  count: number;
  error?: string;
}

const classificazioniService = {
  // CREATE/UPDATE - Classificazione base fornitore
  classificaFornitore: async (fornitoreId: string, request: ClassificazioneRequest): Promise<ClassificazioneResponse> => {
    const response = await apiClient.put(`/classificazioni/fornitore/${fornitoreId}`, request);
    return response.data;
  },

  // CREATE/UPDATE - Classificazione completa fornitore (gerarchia)
  salvaClassificazioneFornitoreCompleta: async (fornitoreId: string, request: ClassificazioneCompletaRequest): Promise<ClassificazioneResponse> => {
    try {
      const response = await apiClient.put(`/classificazioni/fornitore/${fornitoreId}`, request);
      return response.data;
    } catch (error: any) {
      // Se l'errore è del service worker ma la risposta è 200, ignora l'errore
      if (error.response && error.response.status === 200) {
        return error.response.data;
      }
      
      throw error;
    }
  },

  // READ - Singola classificazione fornitore
  getClassificazioneFornitore: async (fornitoreId: string): Promise<ClassificazioneResponse> => {
    const response = await apiClient.get(`/classificazioni/fornitore/${fornitoreId}`);
    return response.data;
  },

  // READ - Lista fornitori classificati
  getFornitoriClassificati: async (): Promise<ListaClassificazioniResponse> => {
    const response = await apiClient.get('/classificazioni/fornitori');
    return response.data;
  },

  // DELETE - Rimuovi classificazione fornitore
  rimuoviClassificazioneFornitore: async (fornitoreId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await apiClient.delete(`/classificazioni/fornitore/${fornitoreId}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 200) {
        return error.response.data;
      }
      throw error;
    }
  },

  // READ - Lista conti
  getConti: async (): Promise<any> => {
    const response = await apiClient.get('/classificazioni/conti');
    return response.data;
  },

  // READ - Lista branche per conto
  getBranche: async (contoId: number | string): Promise<any> => {
    const response = await apiClient.get(`/classificazioni/branche?conto_id=${contoId}`);
    return response.data;
  },

  // READ - Lista sottoconti per branca
  getSottoconti: async (brancaId: number | string): Promise<any> => {
    const response = await apiClient.get(`/classificazioni/sottoconti?branca_id=${brancaId}`);
    return response.data;
  }
};

export default classificazioniService;