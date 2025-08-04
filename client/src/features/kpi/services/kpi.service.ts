import apiClient from '@/api/client';

// Tipi per i KPI
export interface KPIMarginalita {
  tipo_codice: string;
  tipo_nome: string;
  ricavo_totale: number;
  numero_prestazioni: number;
  ricavo_medio: number;
}

export interface KPIProduttivita {
  periodo: {
    anno: number;
    mese?: number;
    data_inizio?: string;
    data_fine?: string;
  };
  kpi_generali: {
    ricavo_totale: number;
    appuntamenti_totali: number;
    giorni_lavorativi: number;
    ricavo_medio_giorno: number;
    appuntamenti_medio_giorno: number;
    ricavo_medio_appuntamento: number;
  };
  fasce_orarie: Array<{
    ora: string;
    ricavo: number;
    appuntamenti: number;
    ricavo_medio: number;
  }>;
  medici: Array<{
    medico: string;
    ricavo_totale: number;
    appuntamenti: number;
    ricavo_medio: number;
  }>;
  top_ore_produttive: Array<{
    ora: string;
    ricavo: number;
    appuntamenti: number;
    ricavo_medio: number;
  }>;
}

export interface KPITrend {
  trend: Array<{
    periodo: string;
    anno: number;
    mese?: number;
    trimestre?: number;
    ricavo: number;
    num_fatture: number;
    crescita_percentuale?: number;
  }>;
  statistiche: {
    ricavo_totale: number;
    ricavo_medio: number;
    ricavo_max: number;
    ricavo_min: number;
    crescita_media: number;
    periodi_analizzati: number;
  };
}

export interface KPIRicorrenza {
  periodo: {
    anno: number;
    data_inizio?: string;
    data_fine?: string;
  };
  totali: {
    pazienti_unici: number;
    visite_totali: number;
    visite_per_paziente: number;
  };
  ricorrenza: {
    pazienti_nuovi: number;
    pazienti_ricorrenti: number;
    percentuale_nuovi: number;
    percentuale_ricorrenti: number;
  };
  fidelizzazione: {
    pazienti_controllo_igiene: number;
    percentuale_controlli: number;
  };
  pazienti_persi: {
    numero: number;
    soglia_mesi: number;
    percentuale_persi: number;
  };
}

export interface KPIDashboard {
  fatturato_anno: number;
  pazienti_attivi: number;
  margine_medio: number;
  produttivita_oraria: number;
}

// Servizio KPI
export const kpiService = {
  // Test connessione
  async ping() {
    const response = await apiClient.get('/api/kpi/ping');
    return response.data;
  },

  // Dashboard overview
  async getDashboard(anno?: number): Promise<{ success: boolean; data: KPIDashboard }> {
    const params = anno ? { anno } : {};
    const response = await apiClient.get('/api/kpi/dashboard', { params });
    return response.data;
  },

  // Marginalità prestazioni v1 (legacy)
  async getMarginalita(params?: { 
    anno?: number; 
    data_inizio?: string; 
    data_fine?: string; 
  }): Promise<{ 
    success: boolean; 
    data: KPIMarginalita[]; 
    period: any; 
    total_revenue: number; 
    total_prestazioni: number; 
  }> {
    const response = await apiClient.get('/api/kpi/marginalita', { params });
    return response.data;
  },

  // Marginalità prestazioni v2 (ottimizzata con istruzioni raw data)
  async getMarginalitaV2(params?: { 
    anni?: string; // "2022,2023,2024"
  }): Promise<{
    success: boolean;
    message: string;
    instructions: {
      step1: string;
      step2: string;
      step3: string;
      step4: string;
    };
    benefits: string[];
    sample_client_logic: {
      javascript: string;
    };
  }> {
    const response = await apiClient.get('/api/kpi/marginalita-v2', { params });
    return response.data;
  },

  // Produttività
  async getProduttivita(params?: { 
    anno?: number; 
    mese?: number; 
    data_inizio?: string; 
    data_fine?: string; 
  }): Promise<{ success: boolean; data: KPIProduttivita }> {
    const response = await apiClient.get('/api/kpi/produttivita', { params });
    return response.data;
  },

  // Trend temporali
  async getTrend(params?: { 
    anni?: number; 
    tipo?: 'mensile' | 'trimestrale' | 'annuale'; 
  }): Promise<{ 
    success: boolean; 
    data: KPITrend; 
    parametri: any; 
  }> {
    const response = await apiClient.get('/api/kpi/trend', { params });
    return response.data;
  },

  // Ricorrenza pazienti
  async getRicorrenza(params?: { 
    anno?: number; 
    data_inizio?: string; 
    data_fine?: string; 
    mesi_perdita?: number; 
  }): Promise<{ success: boolean; data: KPIRicorrenza }> {
    const response = await apiClient.get('/api/kpi/ricorrenza-pazienti', { params });
    return response.data;
  },

  // === RAW DATA ENDPOINTS PER PKI V2 ===
  
  // Dati fatture raw per calcoli client-side
  async getFattureRaw(params?: { 
    anni?: string; // "2022,2023,2024"
  }) {
    const response = await apiClient.get('/api/fatture/raw', { params });
    return response.data;
  },

  // Dati appuntamenti raw per calcoli client-side  
  async getCalendarRaw(params?: { 
    anni?: string; // "2022,2023,2024"
  }) {
    const response = await apiClient.get('/api/calendar/raw', { params });
    return response.data;
  }
};