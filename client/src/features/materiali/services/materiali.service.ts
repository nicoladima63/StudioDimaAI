import apiClient from '@/api/client';
import type { FornitoreItem, Materiale } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
  filters?: {
    contoid: number;
    brancaid?: number;
    sottocontoid?: number;
  };
}

export interface MaterialeIntelligente {
  codice_articolo: string;
  descrizione: string;
  prezzo_unitario: number;
  quantita: number;
  totale_riga: number;
  riga_originale_id: string;
  // Dati fattura per storico prezzi
  data_fattura?: string;
  fattura_id?: string;
  riga_fattura_id?: string;
  classificazione_suggerita: {
    contoid: number | null;
    brancaid: number | null;
    sottocontoid: number | null;
    confidence: number;
    motivo: string;
  };
}

interface MaterialiIntelligentiResponse {
  success: boolean;
  data: MaterialeIntelligente[];
  count: number;
  fornitore_id: string;
  filtri_applicati: {
    esclusi_amministrativi: boolean;
    esclusi_valore_zero: boolean;
    mantenuti_ref: boolean;
    prezzo_minimo: number;
  };
  message?: string;
  error?: string;
}

const materialiService = {
  /**
   * Ottieni fornitori classificati per un conto
   * Supporta filtri opzionali per branca e sottoconto
   */
  async apiGetFornitoriByClassificazione(filters: {
    contoid: number;
    brancaid?: number;
    sottocontoid?: number;
  }): Promise<ApiResponse<FornitoreItem[]>> {
    try {
      const params = new URLSearchParams();
      params.append('contoid', filters.contoid.toString());
      
      if (filters.brancaid) {
        params.append('brancaid', filters.brancaid.toString());
      }
      
      if (filters.sottocontoid) {
        params.append('sottocontoid', filters.sottocontoid.toString());
      }
      
      const response = await apiClient.get(`/api/fornitori/by-classificazione?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Errore apiGetFornitoriByClassificazione:', error);
      throw error;
    }
  },

  /**
   * Ottieni materiali filtrati intelligentemente da un fornitore
   * con classificazioni suggerite automaticamente
   */
  async apiGetMaterialiIntelligenti(
    fornitoreId: string, 
    options?: { show_classified?: boolean }
  ): Promise<MaterialiIntelligentiResponse> {
    try {
      let url = `/api/materiali/fornitori/${fornitoreId}/materiali-intelligenti`;
      if (options?.show_classified) {
        url += '?show_classified=true';
      }
      const response = await apiClient.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Errore apiGetMaterialiIntelligenti:', error);
      throw error;
    }
  },

  /**
   * Salva classificazione di un materiale
   */
  async apiSalvaClassificazioneMateriale(materiale: {
    codice_articolo: string;
    descrizione: string;
    codice_fornitore: string;
    nome_fornitore: string;
    contoid: number;
    contonome?: string;
    brancaid: number | null;
    brancanome?: string;
    sottocontoid: number | null;
    sottocontonome?: string;
    // Dati costo e fattura per storico prezzi
    data_fattura?: string;
    costo_unitario?: number;
    fattura_id?: string;
    riga_fattura_id?: string;
  }): Promise<{success: boolean; message?: string; error?: string}> {
    try {
      const response = await apiClient.post('/api/materiali/create', materiale);
      return response.data;
    } catch (error: any) {
      console.error('Errore apiSalvaClassificazioneMateriale:', error);
      throw error;
    }
  }
};

export default materialiService;