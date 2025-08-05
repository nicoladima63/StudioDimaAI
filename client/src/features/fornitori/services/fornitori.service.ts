import { apiClient } from '@/api/client';
import type { FornitoriResponse, FatturaFornitore, DettaglioFattura } from '../types';

export const fornitoriService = {
  /**
   * Ottieni lista completa fornitori
   */
  async getFornitori(): Promise<FornitoriResponse> {
    try {
      const response = await apiClient.get('/api/fornitori');
      return response.data;  // Questo dovrebbe essere {count, data, success}
    } catch (error) {
      console.error('Errore getFornitori:', error);
      throw error;
    }
  },

  /**
   * Ottieni fornitore singolo per ID
   */
  async getFornitoreById(id: string): Promise<Fornitore> {
    try {
      const response = await apiClient.get(`/api/fornitori/${id}`);
      return response.data.data; // Estrae i dati dal wrapper {success, data}
    } catch (error) {
      console.error('Errore getFornitoreById:', error);
      throw error;
    }
  },

  /**
   * Ottieni fatture/spese associate a un fornitore con paginazione
   */
  async getFattureFornitore(fornitoreId: string, page: number = 1, limit: number = 10): Promise<{fatture: FatturaFornitore[], total: number}> {
    try {
      // Usa endpoint specifico per fornitore senza filtri temporali
      const response = await apiClient.get(`/api/spese-fornitori/fornitore/${fornitoreId}/all`, {
        params: {
          page,
          limit
        }
      });
      
      if (response.data.success) {
        return {
          fatture: response.data.data || [],
          total: response.data.total || 0
        };
      } else {
        throw new Error('Errore nel recupero delle fatture del fornitore');
      }
    } catch (error) {
      console.error('Errore getFattureFornitore:', error);
      throw error;
    }
  },

  /**
   * Ottieni dettagli/righe di una fattura specifica
   */
  async getDettagliFattura(fatturaId: string): Promise<DettaglioFattura[]> {
    try {
      const response = await apiClient.get(`/api/spese-fornitori/${fatturaId}/dettagli`);
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error('Errore nel recupero dei dettagli della fattura');
      }
    } catch (error) {
      console.error('Errore getDettagliFattura:', error);
      throw error;
    }
  }
};