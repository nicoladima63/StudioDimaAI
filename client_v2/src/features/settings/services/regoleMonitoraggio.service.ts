import apiClient from '@/services/api/client';
import type { ApiResponse, ApiSuccessResponse } from '@/types';

export interface CallbackInfo {
  id: string;
  name: string;
  function: string;
  description: string;
  params_schema: any;
}

export interface PreparedCallback {
  id: number;
  nome: string;
  descrizione?: string;
  callback_function: string;
  parametri: Record<string, any>;
}

export interface RegolaDto {
  tipo_prestazione_id: string
  categoria_prestazione?: number | null
  nome_prestazione?: string
  callback_function: string
  parametri_callback?: string
  priorita?: number
  attiva?: boolean
  descrizione?: string
}

export interface RegolaItem {
  id: number
  tipo_prestazione_id: string
  nome_prestazione?: string
  callback_function: string
  attiva: number | boolean
  priorita: number
  last_executed?: string | null
}

export const regoleMonitoraggioApi = {

  async createRegola(payload: RegolaDto): Promise<RegolaItem> {
    const res = await apiClient.post('/regole', payload)
    return res.data.data
  },

  async getRegole(params?: Record<string, any>): Promise<RegolaItem[]> {
    const res = await apiClient.get('/regole', { params })
    return res.data.data || []
  },

  async deleteRegola(id: number): Promise<void> {
    await apiClient.delete(`/regole/${id}`)
  },

  async toggleRegola(id: number): Promise<{ id: number; attiva: boolean }> {
    const res = await apiClient.post(`/regole/${id}/toggle`)
    return res.data.data
  },


  async previewSendSmsLink(parametri: any, context_data: any = {}): Promise<{ url: string; message: string }> {
    const response = await apiClient.post('/regole/preview/send-sms-link', { parametri, context_data });
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Errore preview');
    }
  },

  async getCallbacks(): Promise<CallbackInfo[]> {
    const res = await apiClient.get('/regole/callbacks')
    return res.data.data || []
  },


  // --- Prepared Callbacks ---
  getPreparedCallbacks: async (): Promise<PreparedCallback[]> => {
    const response = await apiClient.get<ApiSuccessResponse<PreparedCallback[]>>('/callbacks/');
    return response.data.data;
  },

  createPreparedCallback: async (payload: Omit<PreparedCallback, 'id' | 'descrizione' | 'parametri'> & { parametri: Record<string, any> }): Promise<PreparedCallback> => {
    const response = await apiClient.post<ApiSuccessResponse<PreparedCallback>>('/callbacks/', payload);
    return response.data.data;
  },

  deletePreparedCallback: async (id: number): Promise<void> => {
    const response = await apiClient.delete<ApiResponse>(`/callbacks/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Errore eliminazione callback preparata');
    }
  },
}

export default regoleMonitoraggioApi
