import apiClient from '@/services/api/client';

export interface ClassificazioneMateriale {
  contoid: number;
  brancaid: number | null;
  sottocontoid: number | null;
  tipo_di_costo: number;
}

export interface SalvaClassificazioneMaterialeRequest {
  codice_articolo: string;
  descrizione: string;
  fornitore_id: string;
  nome_fornitore: string;
  contoid: number;
  contonome: string;
  brancaid?: number;
  brancanome?: string;
  sottocontoid?: number;
  sottocontonome?: string;
  fattura_id?: string;
  riga_fattura_id?: string;
  data_fattura?: string;
  costo_unitario?: number;
}

export interface SalvaClassificazioneMaterialeResponse {
  success: boolean;
  data?: {
    id: string;
    codice_articolo: string;
    classificazione: ClassificazioneMateriale;
    created_at: string;
  };
  error?: string;
}

export interface SalvaClassificazioneBulkRequest {
  materiali: SalvaClassificazioneMaterialeRequest[];
}

export interface RisultatoMaterialeBulk {
  indice: number;
  codice_articolo: string;
  descrizione: string;
  fornitore_id: string;
  successo: boolean;
  operazione: 'inserito' | 'aggiornato' | 'errore';
  materiale_id?: number;
  errore?: string;
}

export interface SalvaClassificazioneBulkResponse {
  success: boolean;
  message?: string;
  data?: {
    inseriti: number;
    aggiornati: number;
    errori: number;
    total_processed: number;
    risultati_dettagliati: RisultatoMaterialeBulk[];
    materiali_da_rimuovere: RisultatoMaterialeBulk[];
  };
  error?: string;
}

export interface RicercaArticoliRequest {
  query: string;
  limit?: number;
}

export interface RicercaArticoliResponse {
  success: boolean;
  data?: {
    articoli: Array<{
      codice_articolo: string;
      descrizione: string;
      quantita: number;
      prezzo_unitario: number;
      fattura: {
        id: string;
        numero_documento: string;
        codice_fornitore: string;
        nome_fornitore?: string;
        data_spesa: string;
        costo_totale: number;
      };
    }>;
    total_found: number;
  };
  error?: string;
}

class MaterialiClassificationService {
  /**
   * Salva classificazione per un materiale specifico
   */
  async salvaClassificazioneMateriale(
    request: SalvaClassificazioneMaterialeRequest
  ): Promise<SalvaClassificazioneMaterialeResponse> {
    try {
      const response = await apiClient.post('/materiali/classificazione', request);
      return response.data;
    } catch (error: any) {
      console.error('Errore nel salvataggio classificazione materiale:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Errore sconosciuto'
      };
    }
  }

  /**
   * Salva classificazioni multiple per materiali (bulk)
   */
  async salvaClassificazioneBulk(
    request: SalvaClassificazioneBulkRequest
  ): Promise<SalvaClassificazioneBulkResponse> {
    try {
      const response = await apiClient.post('/materiali/classificazione/bulk', request);
      return response.data;
    } catch (error: any) {
      console.error('Errore nel salvataggio bulk classificazioni materiali:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Errore sconosciuto'
      };
    }
  }

  /**
   * Ricerca articoli nelle fatture fornitori
   */
          async ricercaArticoli(
          request: RicercaArticoliRequest
        ): Promise<RicercaArticoliResponse> {
          try {
            const params = new URLSearchParams();
            params.append('q', request.query);
            
            if (request.limit) {
              params.append('limit', request.limit.toString());
            }
            
            const response = await apiClient.get(`/materiali/ricerca-articoli?${params.toString()}`);
            return response.data;
          } catch (error: any) {
            console.error('Errore nella ricerca articoli:', error);
            return {
              success: false,
              error: error.response?.data?.error || error.message || 'Errore sconosciuto'
            };
          }
        }

  /**
   * Ottieni classificazioni esistenti per un materiale
   */
  async getClassificazioneMateriale(codice_articolo: string, fattura_id: string) {
    try {
      const response = await apiClient.get(`/materiali/classificazione/${codice_articolo}/${fattura_id}`);
      return response.data;
    } catch (error: any) {
      console.error('Errore nel recupero classificazione materiale:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Errore sconosciuto'
      };
    }
  }

  /**
   * Rimuovi classificazione per un materiale
   */
  async rimuoviClassificazioneMateriale(codice_articolo: string, fattura_id: string) {
    try {
      const response = await apiClient.delete(`/materiali/classificazione/${codice_articolo}/${fattura_id}`);
      return response.data;
    } catch (error: any) {
      console.error('Errore nella rimozione classificazione materiale:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Errore sconosciuto'
      };
    }
  }

  /**
   * Ottieni statistiche classificazioni
   */
  async getStatisticheClassificazioni() {
    try {
      const response = await apiClient.get('/materiali/classificazione/statistiche');
      return response.data;
    } catch (error: any) {
      console.error('Errore nel recupero statistiche classificazioni:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Errore sconosciuto'
      };
    }
  }
}

export const materialiClassificationService = new MaterialiClassificationService();
export default materialiClassificationService;
