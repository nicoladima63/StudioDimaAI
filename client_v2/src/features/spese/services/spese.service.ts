import apiClient from "@/services/api/client";
import type { 
  SpeseFornitioriResponse,
  RiepilogoSpeseFornitioriResponse, 
  DettagliSpesaResponse,
  RicercaArticoliResponse,
  FiltriSpese,
  RiepilogoSpeseFornitoriAnnoResponse,
  AnalisiProduzioneResponse,
  ActiveSuppliersResponse
} from "../types";

// === NUOVE API PER CATEGORIZZAZIONE GESTIONALE ===

export interface CategoriaGestionale {
  codice: string;
  nome: string;
  importo_totale: number;
  iva_totale: number;
  peso: number;
}

export interface RisultatoCategorizzazione {
  categoria: string;
  confidence: number;
  descrizione_input: string;
  fornitore_input: string;
}

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

    if (filtri.conto_id) {
      params.append('conto_id', filtri.conto_id.toString());
    }
    
    if (filtri.page) {
      params.append('page', filtri.page.toString());
    }
    
    if (filtri.limit) {
      params.append('limit', filtri.limit.toString());
    }
    
    const response = await apiClient.get(`/spese-fornitori/?${params.toString()}`);
    return response.data;
  },

  /**
   * Ottieni riepilogo spese per analisi
   */
  async getRiepilogoSpese(filtri: FiltriSpese): Promise<RiepilogoSpeseFornitoriAnnoResponse> {
    const params = new URLSearchParams();
    if (filtri.anno) params.append('anno', filtri.anno.toString());
    if (filtri.conto_id) params.append('conto_id', filtri.conto_id.toString());
    if (filtri.branca_id) params.append('branca_id', filtri.branca_id.toString());
    if (filtri.sottoconto_id) params.append('sottoconto_id', filtri.sottoconto_id.toString());

    const response = await apiClient.get(`/spese-fornitori/riepilogo?${params.toString()}`);
    return response.data;
  },

  /**
   * Ottieni dettagli di una specifica fattura fornitore
   */
  async getDettagliFattura(fatturaId: string): Promise<DettagliSpesaResponse> {
    const response = await apiClient.get(`/spese-fornitori/${fatturaId}/dettagli`);
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
    
    const response = await apiClient.get(`/spese-fornitori/ricerca-articoli?${params.toString()}`);
    return response.data;
  },

  /**
   * Export spese in CSV (implementazione futura)
   */
  async exportSpese(filtri: FiltriSpese): Promise<Blob> {
    // TODO: Implementare export CSV
    throw new Error("Export non ancora implementato");
  },

  // === NUOVI METODI PER CATEGORIZZAZIONE GESTIONALE ===

  /**
   * Ottieni categorie di spesa dal piano dei conti del gestionale
   */
  async getCategorieGestionale(): Promise<{ success: boolean; data: CategoriaGestionale[]; total: number }> {
    const response = await apiClient.get('/spese-fornitori/categorie-gestionale');
    return response.data;
  },

  /**
   * Categorizza automaticamente una spesa
   */
  async categorizzaSpesa(descrizione: string, fornitore?: string): Promise<{ success: boolean; data: RisultatoCategorizzazione }> {
    const response = await apiClient.post('/spese-fornitori/categorizza-spesa', {
      descrizione,
      fornitore: fornitore || ''
    });
    return response.data;
  },

  /**
   * Ottieni analisi produzione clinica per operatore (per ripartizione costi)
   */
  async getAnalisiProduzioneOperatore(
    startDate: string, 
    endDate: string, 
    operatorName?: string
  ): Promise<AnalisiProduzioneResponse> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (operatorName) params.append('operator_name', operatorName);

    const response = await apiClient.get(`/production/analyze-operator?${params.toString()}`);
    return response.data;
  },

  async getProductionYears(): Promise<{ success: boolean; data: number[] }> {
    const response = await apiClient.get('/production/years');
    return response.data;
  },

  /**
   * Ottieni statistiche del gestionale per categorizzazione
   */
  async getStatisticheGestionale() {
    const response = await apiClient.get('/spese-fornitori/statistiche-gestionale');
    return response.data;
  },

  /**
   * Test della categorizzazione con esempi predefiniti
   */
  async testCategorizzazione() {
    const response = await apiClient.get('/spese-fornitori/test-categorizzazione');
    return response.data;
  },

  /**
   * Pulisce la cache dei pattern per ricaricare i miglioramenti
   */
  async clearCategorizzazioneCache() {
    const response = await apiClient.post('/spese-fornitori/clear-cache');
    return response.data;
  },

  /**
   * Analizza le fatture XML SDI per estrarre pattern
   */
  async analyzeXmlFatture() {
    const response = await apiClient.post('/spese-fornitori/analyze-xml-fatture');
    return response.data;
  },

  /**
   * Integra i pattern delle fatture XML nel sistema di categorizzazione
   */
  async integrateXmlPatterns() {
    const response = await apiClient.post('/spese-fornitori/integrate-xml-patterns');
    return response.data;
  },

  async getStats(filtri: FiltriSpese): Promise<{ success: boolean; data: any }> {
    const params = new URLSearchParams();
    if (filtri.anno) params.append('anno', filtri.anno.toString());
    if (filtri.codice_fornitore) params.append('codice_fornitore', filtri.codice_fornitore);
    if (filtri.conto_id) params.append('conto_id', filtri.conto_id.toString());
    if (filtri.branca_id) params.append('branca_id', filtri.branca_id.toString());
    if (filtri.sottoconto_id) params.append('sottoconto_id', filtri.sottoconto_id.toString());
    if (filtri.mese) params.append('mese', filtri.mese.toString());
    
    // Support generic search or specific fields if backend supports them
    if (filtri.numero_documento) params.append('q', filtri.numero_documento);

    const response = await apiClient.get(`/spese-fornitori/stats?${params.toString()}`);
    return response.data;
  },

  async getActiveSuppliers(filtri: FiltriSpese): Promise<ActiveSuppliersResponse> {
    const params = new URLSearchParams();
    if (filtri.anno) params.append('anno', filtri.anno.toString());
    if (filtri.conto_id) params.append('conto_id', filtri.conto_id.toString());
    if (filtri.branca_id) params.append('branca_id', filtri.branca_id.toString());
    if (filtri.sottoconto_id) params.append('sottoconto_id', filtri.sottoconto_id.toString());
    
    const response = await apiClient.get(`/spese-fornitori/active-suppliers?${params.toString()}`);
    return response.data;
  }
};