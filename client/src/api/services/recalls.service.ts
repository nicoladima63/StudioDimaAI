import apiClient from '../apiClient';
import type {
  RichiamiResponse,
  RichiamiStatisticsResponse,
  RichiamoMessageResponse,
  RichiamiExportResponse,
  RichiamiTestResponse,
  RichiamoFilters
} from '../apiTypes';

/**
 * Servizio API per la gestione dei richiami pazienti
 */
export class RecallsService {
  private baseUrl = '/api/recalls';

  /**
   * Ottiene tutti i richiami con filtri opzionali
   */
  async getRecalls(filters?: RichiamoFilters): Promise<RichiamiResponse> {
    const params = new URLSearchParams();
    
    if (filters?.days_threshold) {
      params.append('days', filters.days_threshold.toString());
    }
    if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.tipo) {
      params.append('tipo', filters.tipo);
    }

    const response = await apiClient.get<RichiamiResponse>(
      `${this.baseUrl}/?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Ottiene le statistiche sui richiami
   */
  async getStatistics(daysThreshold: number = 90): Promise<RichiamiStatisticsResponse> {
    const response = await apiClient.get<RichiamiStatisticsResponse>(
      `${this.baseUrl}/statistics?days=${daysThreshold}`
    );
    return response.data;
  }

  /**
   * Ottiene il messaggio preparato per un richiamo specifico
   */
  async getRecallMessage(richiamoId: string): Promise<RichiamoMessageResponse> {
    const response = await apiClient.get<RichiamoMessageResponse>(
      `${this.baseUrl}/${richiamoId}/message`
    );
    return response.data;
  }

  /**
   * Aggiorna le date dei richiami basandosi sull'ultima visita
   */
  async updateRecallDates(): Promise<{ success: boolean; data: Record<string, unknown>; message: string }> {
    const response = await apiClient.post(`${this.baseUrl}/update-dates`);
    return response.data;
  }

  /**
   * Esporta i richiami
   */
  async exportRecalls(daysThreshold: number = 90): Promise<RichiamiExportResponse> {
    const response = await apiClient.get<RichiamiExportResponse>(
      `${this.baseUrl}/export?days=${daysThreshold}`
    );
    return response.data;
  }

  /**
   * Test del servizio richiami
   */
  async testService(): Promise<RichiamiTestResponse> {
    const response = await apiClient.get<RichiamiTestResponse>(
      `${this.baseUrl}/test`
    );
    return response.data;
  }

  /**
   * Invia SMS per un richiamo (per implementazione futura)
   */
  async sendSMS(richiamoId: string): Promise<{ success: boolean; message: string }> {
    // Per ora restituisce un mock, in futuro si integrerà con Twilio
    return {
      success: true,
      message: `SMS inviato con successo per il richiamo ${richiamoId}`
    };
  }

  /**
   * Marca un richiamo come gestito
   */
  async markAsHandled(richiamoId: string): Promise<{ success: boolean; message: string }> {
    // Per ora restituisce un mock, in futuro si aggiornerà il DBF
    return {
      success: true,
      message: `Richiamo ${richiamoId} marcato come gestito`
    };
  }
}

// Esporta un'istanza singleton del servizio
export const recallsService = new RecallsService(); 