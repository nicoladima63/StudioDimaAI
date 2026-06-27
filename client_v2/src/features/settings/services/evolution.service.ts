import apiClient from '@/services/api/client'

export interface RecentComm {
  id: number
  patient_name: string
  phone: string
  channel: 'whatsapp' | 'sms'
  type: '24h' | '2h' | 'followup'
  stato: 'sent' | 'failed' | 'confirmed' | 'cancelled'
  appointment_date: string
  appointment_time: string
  created_at: string
}

export interface EvolutionStatus {
  docker_daemon_running: boolean
  docker_running: boolean
  evolution_reachable: boolean
  wa_state: 'open' | 'close' | 'connecting' | 'unknown'
  instance_exists: boolean
  webhook_url: string
  webhook_configured: boolean
  reminder_24h_enabled: boolean
  reminder_2h_enabled: boolean
  followup_enabled: boolean
  recent_communications: RecentComm[]
}

const evolutionService = {
  async apiGetStatus(): Promise<EvolutionStatus> {
    const { data } = await apiClient.get('/bot/evolution/status')
    return data.data
  },

  async apiCreateInstance(): Promise<{ created: boolean; already_exists: boolean; qr?: string | null }> {
    const { data } = await apiClient.post('/bot/evolution/create-instance')
    return data.data
  },

  async apiGetQr(): Promise<{ qr: string | null; not_ready: boolean }> {
    const { data } = await apiClient.get('/bot/whatsapp/qr')
    return data.data
  },

  async apiGetWaStatus(): Promise<{ state: string }> {
    const { data } = await apiClient.get('/bot/whatsapp/status')
    return data.data
  },

  async apiStartDockerDesktop(): Promise<{ launched: boolean; path: string }> {
    const { data } = await apiClient.post('/bot/evolution/start-docker-desktop')
    return data.data
  },

  async apiStart(): Promise<{ output: string }> {
    const { data } = await apiClient.post('/bot/evolution/start')
    return data.data
  },

  async apiStop(): Promise<{ output: string }> {
    const { data } = await apiClient.post('/bot/evolution/stop')
    return data.data
  },

  async apiLogoutInstance(): Promise<void> {
    await apiClient.post('/bot/whatsapp/logout')
  },

  async apiDeleteInstance(): Promise<void> {
    await apiClient.delete('/bot/whatsapp/instance')
  },
}

export default evolutionService
