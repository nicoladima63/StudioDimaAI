import apiClient from "@/api/client";
import type { 
  SpeseFornitioriResponse, 
  RiepilogoSpeseFornitioriResponse, 
  DettagliSpesaResponse,
  RicercaArticoliResponse,
  FiltriSpese 
} from "../types";

export const speseFornitioriService = {
  /**
   * Ottieni lista spese fornitori con filtri
   */
  async getSpeseFornitori(filtri: FiltriSpese): Promise<SpeseFornitioriResponse> {
    const params = new URLSearchParams();
    
    params.append('anno', filtri.anno.toString());
    
    if (filtri.mese) {
      params.append('mese', filtri.mese.toString());
    }
    
    if (filtri.data_inizio) {
      params.append('data_inizio', filtri.data_inizio);
    }
    
    if (filtri.data_fine) {
      params.append('data_fine', filtri.data_fine);
    }
    
    if (filtri.codice_fornitore) {
      params.append('codice_fornitore', filtri.codice_fornitore);
    }
    
    if (filtri.numero_documento) {
      params.append('numero_documento', filtri.numero_documento);
    }
    
    if (filtri.fattura_id) {
      params.append('fattura_id', filtri.fattura_id);
    }
    
    if (filtri.page) {
      params.append('page', filtri.page.toString());
    }
    
    if (filtri.limit) {
      params.append('limit', filtri.limit.toString());
    }
    
    const response = await apiClient.get(`/api/spese-fornitori?${params.toString()}`);
    return response.data;
  },

  /**
   * Ottieni riepilogo spese per analisi
   */
  async getRiepilogoSpese(anno: number): Promise<RiepilogoSpeseFornitioriResponse> {
    const response = await apiClient.get(`/api/spese-fornitori/riepilogo?anno=${anno}`);
    return response.data;
  },

  /**
   * Ottieni dettagli di una specifica fattura fornitore
   */
  async getDettagliFattura(fatturaId: string): Promise<DettagliSpesaResponse> {
    const response = await apiClient.get(`/api/spese-fornitori/${fatturaId}/dettagli`);
    return response.data;
  },

  /**
   * Ricerca articoli nei dettagli fatture
   */
  async ricercaArticoli(query: string, limit?: number): Promise<RicercaArticoliResponse> {
    const params = new URLSearchParams();
    params.append('q', query);
    
    if (limit) {
      params.append('limit', limit.toString());
    }
    
    const response = await apiClient.get(`/api/spese-fornitori/ricerca-articoli?${params.toString()}`);
    return response.data;
  },

  /**
   * Export spese in CSV (implementazione futura)
   */
  async exportSpese(filtri: FiltriSpese): Promise<Blob> {
    // TODO: Implementare export CSV
    throw new Error("Export non ancora implementato");
  }
};