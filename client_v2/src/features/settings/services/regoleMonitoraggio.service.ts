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

const base = '/regole-monitoraggio'

export const regoleMonitoraggioApi = {
  async getCallbacks(): Promise<CallbackInfo[]> {
    const res = await apiClient.get(`${base}/callbacks`)
    return res.data.data || []
  },

  async createRegola(payload: RegolaDto): Promise<RegolaItem> {
    const res = await apiClient.post(`${base}/regole`, payload)
    return res.data.data
  },

  async getRegole(params?: Record<string, any>): Promise<RegolaItem[]> {
    const res = await apiClient.get(`${base}/regole`, { params })
    return res.data.data || []
  },

  async toggleRegola(id: number): Promise<{ id: number; attiva: boolean }> {
    const res = await apiClient.post(`${base}/regole/${id}/toggle`)
    return res.data.data
  },

  async deleteRegola(id: number): Promise<void> {
    await apiClient.delete(`${base}/regole/${id}`)
  },

  async previewSendSmsLink(parametri: any, context_data: any = {}): Promise<{ url: string; message: string }> {
    const res = await apiClient.post(`${base}/preview/send-sms-link`, { parametri, context_data })
    return res.data.data
  },
}

export default regoleMonitoraggioApi


