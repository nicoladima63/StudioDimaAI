import apiClient from '@/services/api/client'
import type { BotStatusResponse, StudioInfoResponse, StudioInfoItem, WaStatusResponse, WaQrResponse, ConversazioniResponse, MessaggiResponse } from '../types/bot.types'

const botService = {
  async apiGetStatus(): Promise<BotStatusResponse> {
    const response = await apiClient.get('/bot/status')
    return response.data
  },

  async apiGetStudioInfo(): Promise<StudioInfoResponse> {
    const response = await apiClient.get('/bot/studio-info')
    return response.data
  },

  async apiUpdateStudioInfo(chiave: string, valore: string): Promise<StudioInfoItem> {
    const response = await apiClient.put(`/bot/studio-info/${encodeURIComponent(chiave)}`, { valore })
    return response.data
  },

  async apiCreateStudioInfo(chiave: string, valore: string): Promise<StudioInfoItem> {
    const response = await apiClient.post('/bot/studio-info', { chiave, valore })
    return response.data
  },

  async apiDeleteStudioInfo(chiave: string): Promise<void> {
    await apiClient.delete(`/bot/studio-info/${encodeURIComponent(chiave)}`)
  },

  async apiGetWaStatus(): Promise<WaStatusResponse> {
    const response = await apiClient.get('/bot/whatsapp/status')
    return response.data
  },

  async apiGetWaQr(): Promise<WaQrResponse> {
    const response = await apiClient.get('/bot/whatsapp/qr')
    return response.data
  },

  async apiLogoutWa(): Promise<void> {
    await apiClient.post('/bot/whatsapp/logout')
  },

  async apiSearchPazienteByPhone(telefono: string): Promise<{ success: boolean; data: { found: boolean; paziente: Record<string, string> | null } }> {
    const response = await apiClient.get('/pazienti/search', { params: { telefono, limit: 1 } })
    const data = response.data
    const pazienti = data?.data?.pazienti ?? []
    return { success: true, data: { found: pazienti.length > 0, paziente: pazienti[0] ?? null } }
  },

  async apiGetConversazioni(page = 1, perPage = 20): Promise<ConversazioniResponse> {
    const response = await apiClient.get('/bot/conversazioni', { params: { page, per_page: perPage } })
    return response.data
  },

  async apiGetMessaggi(convId: number): Promise<MessaggiResponse> {
    const response = await apiClient.get(`/bot/conversazioni/${convId}/messaggi`)
    return response.data
  },

  async apiDeleteConversazione(convId: number): Promise<void> {
    await apiClient.delete(`/bot/conversazioni/${convId}`)
  },
}

export default botService
