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
    const response = await apiClient.put(`/classificazioni/fornitore/${fornitoreId}`, request);
    return response.data;
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
    const response = await apiClient.delete(`/classificazioni/fornitore/${fornitoreId}`);
    return response.data;
  }
};

export default classificazioniService;