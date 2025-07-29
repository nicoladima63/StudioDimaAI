// src/api/services/pazienti.service.ts
import apiClient from '@/api/client';
import type { 
  ViewType, 
  PriorityFilter, 
  StatusFilter,
  PazientiResponse,
  PazientiStatisticsResponse,
  CittaDataResponse,
  RecallMessageResponse
} from '@/lib/types';
/**
 * Carica tutti i pazienti con filtri opzionali
 */
export async function getPazientiAll(params: {
  view?: ViewType;
  priority?: PriorityFilter;
  status?: StatusFilter;
} = {}): Promise<PazientiResponse> {
  const { view = 'all', priority, status } = params;
  
  try {
    const queryParams = new URLSearchParams();
    if (view !== 'all') queryParams.append('view', view);
    if (priority) queryParams.append('priority', priority);
    if (status) queryParams.append('status', status);
    
    const url = `/api/pazienti/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get<PazientiResponse>(url);
    
    return response.data;
    
  } catch (error) {
    console.error('Errore nel caricamento pazienti:', error);
    throw error;
  }
}
/**
 * Carica statistiche complete
 */
export async function getPazientiStatistics(): Promise<PazientiStatisticsResponse> {
  try {
    const response = await apiClient.get<PazientiStatisticsResponse>('/api/pazienti/statistics');
    return response.data;
  } catch (error) {
    console.error('Errore nel caricamento statistiche:', error);
    throw error;
  }
}
/**
 * Carica dati per città
 */
export async function getCittaData(): Promise<CittaDataResponse> {
  try {
    const response = await apiClient.get<CittaDataResponse>('/api/pazienti/cities');
    return response.data;
  } catch (error) {
    console.error('Errore nel caricamento dati città:', error);
    throw error;
  }
}
/**
 * Carica solo i richiami con filtri
 */
export async function getRichiami(params: {
  priority?: PriorityFilter;
  status?: StatusFilter;
} = {}): Promise<PazientiResponse> {
  const { priority, status } = params;
  
  try {
    const queryParams = new URLSearchParams();
    if (priority) queryParams.append('priority', priority);
    if (status) queryParams.append('status', status);
    
    const url = `/api/pazienti/recalls${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get<PazientiResponse>(url);
    
    return response.data;
  } catch (error) {
    console.error('Errore nel caricamento richiami:', error);
    throw error;
  }
}
/**
 * Ottieni messaggio per richiamo specifico
 */
export async function getRecallMessage(pazienteId: string): Promise<RecallMessageResponse> {
  try {
    const response = await apiClient.get<RecallMessageResponse>(`/api/pazienti/recalls/${pazienteId}/message`);
    return response.data;
  } catch (error) {
    console.error('Errore nel caricamento messaggio richiamo:', error);
    throw error;
  }
}
/**
 * Export dati in vari formati
 */
export async function exportPazienti(params: {
  view?: ViewType;
  priority?: PriorityFilter;
  status?: StatusFilter;
  format?: 'json' | 'csv';
} = {}): Promise<PazientiResponse> {
  const { view = 'all', priority, status, format = 'json' } = params;
  
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('view', view);
    queryParams.append('format', format);
    if (priority) queryParams.append('priority', priority);
    if (status) queryParams.append('status', status);
    
    const response = await apiClient.get<PazientiResponse>(`/api/pazienti/export?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Errore nell\'export:', error);
    throw error;
  }
}

// Funzioni di compatibilità per codice esistente
export async function getPazientiList() {
  const response = await getPazientiAll();
  return response;
}

export async function getPazientiStats() {
  const response = await getPazientiStatistics();
  return response;
}

export async function getPazienteById(id: string) {
  // Semplificato - lascia gestire allo store
  const response = await getPazientiAll();
  return response.data.find(p => p.DB_CODE === id);
}

export async function getPazienteByNome(nome: string) {
  // Semplificato - lascia gestire allo store
  const response = await getPazientiAll();
  const query = nome.toLowerCase();
  return response.data.filter(p => 
    p.nome_completo.toLowerCase().includes(query) ||
    p.DB_PANOME.toLowerCase().includes(query)
  );
}

export async function getPazientiOfComune(comune: string) {
  // Semplificato - lascia gestire allo store
  const response = await getPazientiAll();
  return response.data.filter(p => 
    p.citta_clean.toLowerCase() === comune.toLowerCase()
  );
}