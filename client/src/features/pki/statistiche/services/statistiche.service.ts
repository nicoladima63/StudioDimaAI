import apiClient from '@/api/client';

export interface MaterialiStats {
  conto_nome: string;
  branca_nome: string;
  totale_spesa: number;
  numero_fatture: number;
  spesa_media: number;
  percentuale_sul_totale: number;
  ultimo_acquisto: string;
}

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

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  error?: string;
  periodo?: {
    periodo: string;
    data_inizio: string;
    data_fine: string;
  };
}

const statisticheService = {
  async apiGetMaterialiDentali(periodo: string = 'anno_corrente'): Promise<ApiResponse<MaterialiStats>> {
    const response = await apiClient.get(`/api/statistiche/materiali-dentali?periodo=${periodo}`);
    return response.data;
  },

  async apiGetCollaboratori(periodo: string = 'anno_corrente'): Promise<ApiResponse<CollaboratoreStats>> {
    const response = await apiClient.get(`/api/statistiche/collaboratori?periodo=${periodo}`);
    return response.data;
  },

  async apiGetUtenze(periodo: string = 'anno_corrente'): Promise<ApiResponse<UtenzaStats>> {
    const response = await apiClient.get(`/api/statistiche/utenze?periodo=${periodo}`);
    return response.data;
  }
};

export default statisticheService;