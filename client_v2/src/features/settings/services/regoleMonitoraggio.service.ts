import apiClient from '@/services/api/client'

export interface CallbackInfo {
  id: string
  name: string
  function: string
  description?: string
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
  async getCallbacks(): Promise<CallbackInfo[]> {
    const res = await apiClient.get(`/callbacks`)
    return res.data.data || []
  },

  async createRegola(payload: RegolaDto): Promise<RegolaItem> {
    const res = await apiClient.post(`/regole`, payload)
    return res.data.data
  },

  async getRegole(params?: Record<string, any>): Promise<RegolaItem[]> {
    const res = await apiClient.get(`/regole`, { params })
    return res.data.data || []
  },

  async toggleRegola(id: number): Promise<{ id: number; attiva: boolean }> {
    const res = await apiClient.post(`/regole/${id}/toggle`)
    return res.data.data
  },

  async deleteRegola(id: number): Promise<void> {
    await apiClient.delete(`/regole/${id}`)
  },

  async previewSendSmsLink(parametri: any, context_data: any = {}): Promise<{ url: string; message: string }> {
    const res = await apiClient.post(`/preview/send-sms-link`, { parametri, context_data })
    return res.data.data
  },
}

export default regoleMonitoraggioApi


