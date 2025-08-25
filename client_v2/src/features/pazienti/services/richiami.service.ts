import apiClient from '@/services/api/client';

interface RichiamoStatusRequest {
  paziente_id: string;
  da_richiamare: string; // S, N, R
  data_richiamo?: string; // ISO date string
}

interface TipoRichiamoRequest {
  paziente_id: string;
  tipo_richiamo: string; // es: "21" = igiene(2) + generico(1)
  tempo_richiamo: number; // mesi
}

interface RichiamoEffettuatoRequest {
  paziente_id: string;
  data_richiamo: string; // ISO date string
  tipo: 'primo' | 'secondo'; // quale campo aggiornare
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  state?: 'success' | 'warning' | 'error';
}

const richiami = {
  // Salva stato richiamo (S=da richiamare, N=non richiamare, R=richiamato)
  apiSalvaStatoRichiamo: async (request: RichiamoStatusRequest): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.put(`/pazienti/${request.paziente_id}/richiamo/status`, {
        da_richiamare: request.da_richiamare,
        data_richiamo: request.data_richiamo
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore salvataggio stato richiamo',
        state: 'error'
      };
    }
  },

  // Aggiorna tipo e tempo richiamo
  apiAggiornaTipoRichiamo: async (request: TipoRichiamoRequest): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.put(`/pazienti/${request.paziente_id}/richiamo/tipo`, {
        tipo_richiamo: request.tipo_richiamo,
        tempo_richiamo: request.tempo_richiamo
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore aggiornamento tipo richiamo',
        state: 'error'
      };
    }
  },

  // Registra richiamo effettuato
  apiRegistraRichiamoEffettuato: async (request: RichiamoEffettuatoRequest): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.put(`/pazienti/${request.paziente_id}/richiamo/effettuato`, {
        data_richiamo: request.data_richiamo,
        tipo: request.tipo
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore registrazione richiamo effettuato',
        state: 'error'
      };
    }
  },

  // Ottieni statistiche richiami
  apiGetStatisticheRichiami: async (): Promise<ApiResponse<{
    da_fare: number;
    scaduti: number;
    completati: number;
    totale: number;
  }>> => {
    try {
      const response = await apiClient.get('/richiami/statistiche');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore caricamento statistiche richiami',
        state: 'error'
      };
    }
  },

  // Ottieni lista pazienti da richiamare
  apiGetPazientiDaRichiamare: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await apiClient.get('/richiami/da-fare');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore caricamento pazienti da richiamare',
        state: 'error'
      };
    }
  },

  // Migra dati richiami esistenti dal gestionale DBF alla tabella SQLite
  apiMigrateRichiamiFromDbf: async (): Promise<ApiResponse<{
    migrated: number;
    skipped: number;
    errors: number;
    total_processed: number;
    message: string;
  }>> => {
    try {
      const response = await apiClient.post('/richiami/migrate-from-dbf');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore migrazione dati richiami',
        state: 'error'
      };
    }
  }
};

export default richiami;