/**
 * Service API per la ricetta elettronica V2
 * Client unificato per tutti gli endpoint del Sistema Tessera Sanitaria
 */
import apiClient from "./client";
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
} from "../../types/ricetta.types";

class RicettaApiService {
  private readonly basePath = "/api/v2/ricetta";

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

  // === Ricerca diagnosi e farmaci ===
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

  async getFarmaciPerDiagnosi(codiceDiagnosi: string): Promise<ApiResponse<Farmaco[]>> {
    try {
      const response = await apiClient.get(`${this.basePath}/farmaci/per-diagnosi/${codiceDiagnosi}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'LOOKUP_FAILED',
        message: error.message || 'Errore caricamento farmaci per diagnosi',
        data: []
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

  // === Invio ricetta ===
  async inviaRicetta(payload: RicettaPayload): Promise<RicettaResponse> {
    try {
      const response = await apiClient.post(`${this.basePath}/invio`, payload);
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      
      return {
        success: false,
        error: errorData?.error || 'INVIO_FAILED',
        message: errorData?.message || error.message || 'Errore durante l\'invio della ricetta',
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
  searchDiagnosi,
  searchFarmaci,
  getFarmaciPerDiagnosi,
  getProtocolli,
  getProtocolloById,
  getPosologieSuggestions,
  getDurateSuggestions,
  getNoteSuggestions,
  inviaRicetta,
  getFarmaciTestSicuri,
  getRicetteTestFunzionanti,
  validateDiagnosi,
  validateFarmaco
} = ricettaApi;