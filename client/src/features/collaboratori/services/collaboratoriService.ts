import type { AxiosResponse } from 'axios';
import apiClient from '@/api/client';

export interface Collaboratore {
  id?: number;
  codice_fornitore: string;
  nome: string;
  tipo: string;
  attivo: boolean;
  confermato_da_utente?: boolean;
  pre_selezionato?: boolean;
  is_confermato?: boolean;
  score?: number;
  criteri?: string[];
  is_nuovo_candidato?: boolean;
}

export interface CollaboratoriResponse {
  collaboratori_confermati: Collaboratore[];
  nuovi_candidati: Collaboratore[];
  tutti_collaboratori: Collaboratore[];
  totale_confermati: number;
  totale_nuovi: number;
}

export interface Statistiche {
  totale_attivi: number;
  totale_confermati: number;
  totale_automatici: number;
  chirurgia: number;
  ortodonzia: number;
  igienista: number;
  per_tipo: Record<string, number>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface SalvaSelezioneRequest {
  codici_selezionati: string[];
  tipi_assegnati: Record<string, string>;
}

const collaboratoriService = {
  /**
   * Recupera tutti i collaboratori per l'interfaccia principale
   */
  getCollaboratori: async (): Promise<ApiResponse<CollaboratoriResponse>> => {
    const response: AxiosResponse<ApiResponse<CollaboratoriResponse>> = 
      await apiClient.get('/api/collaboratori/');
    return response.data;
  },

  /**
   * Recupera solo i collaboratori confermati
   */
  getCollaboratoriConfermati: async (): Promise<ApiResponse<Collaboratore[]>> => {
    const response: AxiosResponse<ApiResponse<Collaboratore[]>> = 
      await apiClient.get('/api/collaboratori/confermati');
    return response.data;
  },

  /**
   * Recupera solo i nuovi candidati automatici
   */
  getNuoviCandidati: async (): Promise<ApiResponse<Collaboratore[]>> => {
    const response: AxiosResponse<ApiResponse<Collaboratore[]>> = 
      await apiClient.get('/api/collaboratori/candidati');
    return response.data;
  },

  /**
   * Salva la selezione dell'utente
   */
  salvaSelezione: async (data: SalvaSelezioneRequest): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = 
      await apiClient.post('/api/collaboratori/salva-selezione', data);
    return response.data;
  },

  /**
   * Recupera statistiche collaboratori
   */
  getStatistiche: async (): Promise<ApiResponse<Statistiche>> => {
    const response: AxiosResponse<ApiResponse<Statistiche>> = 
      await apiClient.get('/api/collaboratori/statistiche');
    return response.data;
  },

  /**
   * Rimuove (disattiva) un collaboratore
   */
  rimuoviCollaboratore: async (codiceFornitore: string): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = 
      await apiClient.delete(`/api/collaboratori/rimuovi/${codiceFornitore}`);
    return response.data;
  },

  /**
   * Aggiorna il tipo di un collaboratore
   */
  aggiornaTipo: async (codiceFornitore: string, tipo: string): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = 
      await apiClient.put(`/api/collaboratori/aggiorna-tipo/${codiceFornitore}`, { tipo });
    return response.data;
  }
};

export default collaboratoriService;