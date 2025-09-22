/**
 * Service API per la ricetta elettronica V2
 * Client unificato per tutti gli endpoint del Sistema Tessera Sanitaria
 */
import apiClient from "./api/client";
import type {
  ApiResponse,
  DiagnosiSearchResponse,
  FarmaciSearchResponse,
  RicettaPayload,
  RicettaResponse,
  ProtocolloTerapeutico,
  ConnectionTestResult,
  EnvironmentConfig,
  Diagnosi,
  Farmaco,
  FarmacoTestSicuro,
  RicettaTestFunzionante
} from "@/types/ricetta.types";

// Tipi compatibilità V1
export interface FarmacoProtocollo {
  codice: string;
  nome: string;
  principio_attivo: string;
  classe: string;
  posologia_default: string;
  durata_default: string;
  note_default: string;
  posologie_alternative: any[];
}

class RicettaApiService {
  private readonly basePath = "/ricetta";

  // === Health e configurazione ===
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.basePath}/health`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'HEALTH_CHECK_FAILED',
        message: error.message || 'Errore health check ricetta'
      };
    }
  }

  async testConnection(): Promise<ApiResponse<ConnectionTestResult>> {
    try {
      const response = await apiClient.get(`${this.basePath}/test-connection`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'CONNECTION_TEST_FAILED',
        message: error.message || 'Errore test connessione',
        data: {
          success: false,
          environment: 'test',
          endpoint: '',
          message: error.message || 'Test fallito',
          error: error.response?.data?.error
        } as ConnectionTestResult
      };
    }
  }

  async getEnvironmentInfo(): Promise<ApiResponse<EnvironmentConfig>> {
    try {
      const response = await apiClient.get(`${this.basePath}/environment`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'ENVIRONMENT_INFO_FAILED',
        message: error.message || 'Errore informazioni ambiente'
      };
    }
  }

  // === Database locale - Dati per composizione ricetta ===
  async getDiagnosiDisponibili(): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiClient.get('/ricetta/diagnosi-all');
      return {
        success: true,
        data: response.data.data.diagnosi || [],
        message: 'Diagnosi caricate'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'DIAGNOSI_LOAD_FAILED',
        message: error.message || 'Errore caricamento diagnosi',
        data: []
      };
    }
  }

  async getFarmaciPerDiagnosi(diagnosiId: number): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiClient.get(`/ricetta/protocolli-per-diagnosi/${diagnosiId}`);
      const protocolli = response.data.data.protocolli || [];
      
      // Mappa ProtocolloTerapeutico[] a FarmacoProtocollo[] come in V1
      const farmaci = protocolli.map((p: any) => ({
        codice: `${p.farmaco_id}`,
        nome: p.nomi_commerciali,
        principio_attivo: p.principio_attivo,
        classe: p.categoria,
        posologia_default: p.posologia_custom || p.posologia_standard,
        durata_default: p.durata_custom || 'Non specificata',
        note_default: p.note_custom || '',
        posologie_alternative: []
      }));
      
      return {
        success: true,
        data: farmaci,
        message: 'Farmaci caricati'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'FARMACI_LOAD_FAILED',
        message: error.message || 'Errore caricamento farmaci per diagnosi',
        data: []
      };
    }
  }

  async getDurateStandard(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get('/ricetta/suggestions/durate');
      return {
        success: true,
        data: response.data.data || [],
        message: 'Durate caricate'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'DURATE_LOAD_FAILED',
        message: error.message || 'Errore caricamento durate',
        data: []
      };
    }
  }

  async getNoteFrequenti(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get('/ricetta/suggestions/note');
      return {
        success: true,
        data: response.data.data || [],
        message: 'Note caricate'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'NOTE_LOAD_FAILED',
        message: error.message || 'Errore caricamento note',
        data: []
      };
    }
  }

  // === Sistema TS - Ricerca diagnosi e farmaci ===
  async searchDiagnosi(query: string, limit: number = 20): Promise<DiagnosiSearchResponse> {
    try {
      const response = await apiClient.get(`${this.basePath}/diagnosi`, {
        params: { q: query, limit }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'SEARCH_FAILED',
        message: error.message || 'Errore ricerca diagnosi',
        data: [],
        count: 0,
        query
      };
    }
  }

  async searchFarmaci(query: string, limit: number = 20): Promise<FarmaciSearchResponse> {
    try {
      const response = await apiClient.get(`${this.basePath}/farmaci`, {
        params: { q: query, limit }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'SEARCH_FAILED',
        message: error.message || 'Errore ricerca farmaci',
        data: [],
        count: 0,
        query
      };
    }
  }


  // === Protocolli terapeutici ===
  async getProtocolli(): Promise<ApiResponse<ProtocolloTerapeutico[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/protocolli`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'PROTOCOLS_FAILED',
        message: error.message || 'Errore caricamento protocolli',
        data: []
      };
    }
  }

  async getProtocolloById(protocolloId: string): Promise<ApiResponse<ProtocolloTerapeutico>> {
    try {
      const response = await apiClient.get(`${this.basePath}/protocolli/${protocolloId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'PROTOCOL_NOT_FOUND',
        message: error.message || `Protocollo ${protocolloId} non trovato`
      };
    }
  }

  // === Suggerimenti ===
  async getPosologieSuggestions(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/suggestions/posologie`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'SUGGESTIONS_FAILED',
        message: error.message || 'Errore caricamento posologie',
        data: []
      };
    }
  }

  async getDurateSuggestions(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/suggestions/durate`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'SUGGESTIONS_FAILED',
        message: error.message || 'Errore caricamento durate',
        data: []
      };
    }
  }

  async getNoteSuggestions(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/suggestions/note`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'SUGGESTIONS_FAILED',
        message: error.message || 'Errore caricamento note',
        data: []
      };
    }
  }

  // === Salvataggio ricetta nel database locale ===
  async saveRicetta(ricettaData: {
    nre: string;
    codice_pin: string;
    cf_medico: string;
    medico_cognome: string;
    medico_nome: string;
    specializzazione: string;
    nr_iscrizione_albo: string;
    cf_assistito: string;
    paziente_cognome: string;
    paziente_nome: string;
    data_compilazione: string;
    codice_diagnosi: string;
    descrizione_diagnosi: string;
    gruppo_equivalenza_farmaco: string;
    prodotto_aic: string;
    codice_farmaco: string;
    denominazione_farmaco: string;
    principio_attivo: string;
    posologia: string;
    durata_trattamento: string;
    response_xml: string;
    note?: string;
    protocollo_transazione?: string;
    pdf_base64?: string;
  }): Promise<ApiResponse<{ ricetta_id: number; nre: string; cf_assistito: string }>> {
    try {
      const response = await apiClient.post('/ricetta/db/save', ricettaData);
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      
      return {
        success: false,
        error: errorData?.error || 'SAVE_FAILED',
        message: errorData?.message || error.message || 'Errore durante il salvataggio della ricetta',
        data: { ricetta_id: 0, nre: '', cf_assistito: '' }
      };
    }
  }

  // === Invio ricetta ===
  async inviaRicetta(payload: RicettaInvioPayload): Promise<RicettaResponse> {
    try {
      const response = await apiClient.post(`${this.basePath}/invio`, payload);
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      
      return {
        success: false,
        error: errorData?.error || 'INVIO_FAILED',
        message: errorData?.message || error.message || 'Errore durante l\'invio della ricetta',
        data: errorData?.data,
        details: errorData?.details,  // Includi details per debug
        response_xml: errorData?.response_xml || errorData?.details?.response_xml  // Includi XML per debug da entrambe le posizioni
      };
    }
  }

  async inviaRicettaEmail(emailPayload: {
    email_paziente: string;
    nome_paziente: string;
    ricetta_data: any;
    pdf_base64: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post(`${this.basePath}/invio/email`, emailPayload);
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      
      return {
        success: false,
        error: errorData?.error || 'EMAIL_FAILED',
        message: errorData?.message || error.message || 'Errore durante l\'invio dell\'email',
        data: errorData?.data
      };
    }
  }

  // === Test e sviluppo ===
  async getFarmaciTestSicuri(): Promise<ApiResponse<FarmacoTestSicuro[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/test/farmaci-sicuri`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'TEST_DATA_FAILED',
        message: error.message || 'Errore caricamento farmaci test',
        data: []
      };
    }
  }

  async getRicetteTestFunzionanti(): Promise<ApiResponse<RicettaTestFunzionante[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/test/ricette-funzionanti`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'TEST_DATA_FAILED',
        message: error.message || 'Errore caricamento ricette test',
        data: []
      };
    }
  }

  // === Visualizza ricetta dal Sistema TS ===
  async getRicetta(cf_paziente: string, nrbe?: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.basePath}/ricetta`, {
        params: {
          cf_assistito: cf_paziente,
          nre: nrbe
        }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'GET_RICETTA_FAILED',
        message: error.response?.data?.message || error.message || 'Errore durante la visualizzazione della ricetta'
      };
    }
  }

  // === Lista ricette database locale (compatibilità V1) ===
  async getAllRicette(params?: {
    data_da?: string;
    data_a?: string;
    cf_assistito?: string;
    force_local?: boolean;
  }): Promise<ApiResponse<any[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.data_da) queryParams.append('data_da', params.data_da);
      if (params?.data_a) queryParams.append('data_a', params.data_a);
      if (params?.cf_assistito) queryParams.append('cf_assistito', params.cf_assistito);
      if (params?.force_local) queryParams.append('force_local', 'true');
      
      const url = `/api/ricetta/db/list${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'DATABASE_LIST_FAILED',
        message: error.message || 'Errore caricamento ricette database',
        data: []
      };
    }
  }

  // === Lista ricette - endpoint separati V2 ===
  
  // Recupera ricette dal Sistema TS (endpoint dedicato)
  async getRicetteFromTS(params?: {
    data_da?: string;
    data_a?: string;
    cf_assistito?: string;
    limit?: number;
    nre?: string;  // Per ricerca specifica
    cf_medico_reale?: string;  // CF medico reale per test
    use_production?: boolean;  // Flag per usare produzione
    test_ricerca_specifica?: boolean;  // Flag test
    id_sessione?: string;  // ID-SESSIONE personalizzato
  }): Promise<ApiResponse<any[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.data_da) queryParams.append('data_da', params.data_da);
      if (params?.data_a) queryParams.append('data_a', params.data_a);
      if (params?.cf_assistito) queryParams.append('cf_assistito', params.cf_assistito);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      // Parametri speciali per test ricerca specifica
      if (params?.nre) queryParams.append('nre', params.nre);
      if (params?.cf_medico_reale) queryParams.append('cf_medico_reale', params.cf_medico_reale);
      if (params?.use_production) queryParams.append('use_production', 'true');
      if (params?.test_ricerca_specifica) queryParams.append('test_ricerca_specifica', 'true');
      if (params?.id_sessione) queryParams.append('id_sessione', params.id_sessione);
      
      const queryString = queryParams.toString();
      const url = `/ricetta/ts/list${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get(url);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'TS_LIST_FAILED',
        message: error.response?.data?.message || error.message || 'Errore caricamento ricette Sistema TS',
        data: []
      };
    }
  }

  // === Download PDF ===
  async downloadRicettaPDFByNre(nre: string): Promise<Blob> {
    try {
      const response = await apiClient.get(`${this.basePath}/ts/download/${nre}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Errore download PDF');
    }
  }

  // === Lista ricette legacy (mantenuto per compatibilità) ===
  async getRicetteTest(params?: {
    data_da?: string;
    data_a?: string;
    cf_assistito?: string;
  }): Promise<ApiResponse<any[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.data_da) queryParams.append('data_da', params.data_da);
      if (params?.data_a) queryParams.append('data_a', params.data_a);
      if (params?.cf_assistito) queryParams.append('cf_assistito', params.cf_assistito);
      
      const queryString = queryParams.toString();
      const url = `${this.basePath}/database/list${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get(url);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'LIST_FAILED',
        message: error.message || 'Errore caricamento lista ricette',
        data: []
      };
    }
  }

  // === Utilities ===
  async validateDiagnosi(codiceDiagnosi: string): Promise<boolean> {
    try {
      const response = await this.searchDiagnosi(codiceDiagnosi, 1);
      return response.success && 
             response.data.some(d => d.codice === codiceDiagnosi);
    } catch {
      return false;
    }
  }

  async validateFarmaco(codiceFarmaco: string): Promise<boolean> {
    try {
      const response = await this.searchFarmaci(codiceFarmaco, 1);
      return response.success && 
             response.data.some(f => f.codice === codiceFarmaco);
    } catch {
      return false;
    }
  }

  // === Error handling helpers ===
  private handleApiError(error: any, defaultMessage: string) {
    const errorData = error.response?.data;
    
    return {
      success: false,
      error: errorData?.error || 'API_ERROR',
      message: errorData?.message || error.message || defaultMessage,
      error_code: errorData?.error_code
    };
  }

  // === Batch operations ===
  async searchBatch(queries: { diagnosi?: string; farmaci?: string }) {
    const promises: Promise<any>[] = [];
    
    if (queries.diagnosi) {
      promises.push(this.searchDiagnosi(queries.diagnosi));
    }
    
    if (queries.farmaci) {
      promises.push(this.searchFarmaci(queries.farmaci));
    }
    
    try {
      const results = await Promise.all(promises);
      
      return {
        success: true,
        data: {
          diagnosi: queries.diagnosi ? results[0]?.data || [] : [],
          farmaci: queries.farmaci ? results[queries.diagnosi ? 1 : 0]?.data || [] : []
        }
      };
    } catch (error: any) {
      return this.handleApiError(error, 'Errore ricerca batch');
    }
  }

  // === Cache management ===
  clearCache() {
    // Se implementiamo cache locale, qui la cancelliamo
    // Per ora è gestita dallo store Zustand
  }
}

// Instance singleton
export const ricettaApi = new RicettaApiService();

// Export default per compatibilità
export default ricettaApi;

// Named exports per funzioni specifiche
export const {
  healthCheck,
  testConnection,
  getEnvironmentInfo,
  getDiagnosiDisponibili,
  getFarmaciPerDiagnosi,
  getDurateStandard,
  getNoteFrequenti,
  saveRicetta,
  getRicetta,
  getAllRicette,
  searchDiagnosi,
  searchFarmaci,
  getProtocolli,
  getProtocolloById,
  getPosologieSuggestions,
  getDurateSuggestions,
  getNoteSuggestions,
  inviaRicetta,
  inviaRicettaEmail,
  getFarmaciTestSicuri,
  getRicetteTestFunzionanti,
  getRicetteFromTS,
  downloadRicettaPDFByNre,
  validateDiagnosi,
  validateFarmaco
} = ricettaApi;

// Export diretto per il nuovo metodo
export const getRicetteTest = (params?: {
  data_da?: string;
  data_a?: string;
  cf_assistito?: string;
}) => ricettaApi.getRicetteTest(params);