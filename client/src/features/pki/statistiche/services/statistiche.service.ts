import apiClient from '@/api/client';

export interface FornitoreStats {
  codice_riferimento: string;
  fornitore_nome: string;
  spesa_totale: number;
  numero_fatture: number;
  spesa_media: number;
  percentuale_sul_totale: number;
  ultimo_acquisto: string | null;
  classificazione: {
    contoid: number | null;
    brancaid: number | null;
    sottocontoid: number | null;
    branca_nome: string | null;
  };
}

export interface StatisticheFilters {
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  periodo?: string;
  anni?: number[];        // 🆕 Array di anni per multi-anno
  data_inizio?: string;
  data_fine?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  error?: string;
  total_fornitori?: number;
  totale_generale?: number;
  periodo?: {
    periodo: string;
    data_inizio: string;
    data_fine: string;
  };
  filters_applied?: {
    contoid: number | null;
    brancaid: number | null;
    sottocontoid: number | null;
    fornitori_classificati_trovati: number;
  };
  warning?: string;
}

// Legacy interfaces per compatibilità (deprecate dopo migrazione)
export interface CollaboratoreStats {
  nome: string;
  cognome: string;
  ruolo: string;
  spese_totali: number;
  numero_fatture: number;
  spesa_media: number;
  percentuale_sul_totale: number;
  ultimo_acquisto: string;
  categorie_principali: string[];
}

export interface UtenzaStats {
  tipo_utenza: string;
  fornitore: string;
  spesa_totale: number;
  numero_fatture: number;
  spesa_media_mensile: number;
  variazione_percentuale: number;
  percentuale_sul_totale: number;
  ultimo_pagamento: string;
  consumo_medio: number;
  unita_misura: string;
}

const statisticheService = {
  /**
   * Nuovo endpoint flessibile per statistiche fornitori
   * Sostituisce tutti gli altri endpoint hardcoded
   */
  async apiGetStatisticheFornitori(filters: StatisticheFilters = {}): Promise<ApiResponse<FornitoreStats>> {
    const params = new URLSearchParams();
    
    if (filters.contoid) params.append('contoid', filters.contoid.toString());
    if (filters.brancaid) params.append('brancaid', filters.brancaid.toString());
    if (filters.sottocontoid) params.append('sottocontoid', filters.sottocontoid.toString());
    if (filters.periodo) params.append('periodo', filters.periodo);
    
    // 🆕 Supporto array di anni (converti in stringa comma-separated)
    if (filters.anni && filters.anni.length > 0) {
      params.append('anni', filters.anni.join(','));
    }
    
    if (filters.data_inizio) params.append('data_inizio', filters.data_inizio);
    if (filters.data_fine) params.append('data_fine', filters.data_fine);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/api/fornitori/statistiche${queryString}`);
    return response.data;
  },

  // ==================== LEGACY METHODS (DEPRECATED) ====================
  // Mantenuti per compatibilità temporanea, saranno rimossi dopo migrazione
  
  async apiGetCollaboratori(periodo: string = 'anno_corrente'): Promise<ApiResponse<FornitoreStats>> {
    console.warn('⚠️ apiGetCollaboratori è deprecated. Usa apiGetStatisticheFornitori con filters');
    // TODO: Recupera contoid per "COLLABORATORI" dal store
    return this.apiGetStatisticheFornitori({ periodo });
  },

  async apiGetUtenze(periodo: string = 'anno_corrente'): Promise<ApiResponse<FornitoreStats>> {
    console.warn('⚠️ apiGetUtenze è deprecated. Usa apiGetStatisticheFornitori con filters');
    // TODO: Recupera contoid per "UTENZE" dal store
    return this.apiGetStatisticheFornitori({ periodo });
  }
};

export default statisticheService;