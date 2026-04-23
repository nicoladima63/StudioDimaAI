export interface BotService {
  id: string
  name: string
  url: string
  online: boolean
}

export interface StudioInfoItem {
  chiave: string
  valore: string
}

export type WaState = 'open' | 'close' | 'connecting' | 'unknown'

export interface WaStatusResponse {
  success: boolean
  data: { state: WaState }
}

export interface WaQrResponse {
  success: boolean
  data: { qr: string }
}

export interface BotStatusResponse {
  success: boolean
  data: {
    services: BotService[]
  }
}

export interface StudioInfoResponse {
  success: boolean
  data: {
    items: StudioInfoItem[]
  }
}

export interface Conversazione {
  id: number
  iniziata_at: string
  ultima_attivita: string
  aperta: boolean
  escalata_at: string | null
  motivo_escalation: string | null
  wa_nome: string
  wa_jid: string
  db_panome: string | null
}

export interface Messaggio {
  id: number
  ruolo: 'user' | 'assistant'
  contenuto: string
  classificazione: string | null
  created_at: string
}

export interface ConversazioniResponse {
  success: boolean
  data: {
    conversazioni: Conversazione[]
    total: number
    page: number
    per_page: number
  }
}

export interface MessaggiResponse {
  success: boolean
  data: { messaggi: Messaggio[] }
}
