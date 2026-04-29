import apiClient from '@/services/api/client'

export interface ReminderSettings {
  appointment_reminder_24h_enabled: boolean
  appointment_reminder_2h_enabled: boolean
  appointment_followup_enabled: boolean
  appointment_followup_hours_before: number
}

export interface ReminderLogEntry {
  timestamp: string
  type: string
  sent_wa: number
  sent_sms: number
  skipped_fisso: number
  no_phone: number
  errors: Array<{ patient: string; error: string }>
}

export interface TriggerResult {
  sent_wa: number
  sent_sms: number
  skipped_fisso: unknown[]
  errors: unknown[]
  dry_run: boolean
}

export interface CommunicationItem {
  id: number
  patient_id: string
  patient_name: string
  phone: string
  channel: 'whatsapp' | 'sms'
  tipo: string
  stato: string
  testo: string
  scheduled_at: string | null
  sent_at: string | null
  response: string | null
  communication_id: string | null
  created_at: string
}

export interface ReminderReply {
  id: number
  patient_name: string
  phone: string
  channel: 'whatsapp' | 'sms'
  reminder_type: '24h' | '2h' | 'followup'
  appointment_date: string
  appointment_time: string
  stato: string
  created_at: string
  response: 'confirmed' | 'cancelled' | null
  response_at: string | null
}

const remindersService = {
  async apiGetSettings(): Promise<ReminderSettings> {
    const res = await apiClient.get('/reminders/settings')
    return res.data.data
  },

  async apiUpdateSettings(settings: Partial<ReminderSettings>): Promise<ReminderSettings> {
    const res = await apiClient.put('/reminders/settings', settings)
    return res.data.data
  },

  async apiGetStatus(): Promise<{ log_entries: ReminderLogEntry[] }> {
    const res = await apiClient.get('/reminders/status')
    return res.data.data
  },

  async apiTrigger24h(dryRun: boolean, patientId?: string): Promise<TriggerResult> {
    const res = await apiClient.post('/reminders/trigger-24h', {
      dry_run: dryRun,
      ...(patientId ? { patient_id: patientId } : {}),
    })
    return res.data.data
  },

  async apiTrigger2h(dryRun: boolean, patientId?: string): Promise<TriggerResult> {
    const res = await apiClient.post('/reminders/trigger-2h', {
      dry_run: dryRun,
      ...(patientId ? { patient_id: patientId } : {}),
    })
    return res.data.data
  },

  async apiTriggerFollowup(dryRun: boolean, hoursBefore = 3): Promise<TriggerResult> {
    const res = await apiClient.post('/reminders/trigger-followup', {
      dry_run: dryRun,
      hours_before: hoursBefore,
    })
    return res.data.data
  },

  async apiGetReplies(days = 7, date?: string): Promise<{ items: ReminderReply[]; total: number }> {
    const params: Record<string, string | number> = { days }
    if (date) params.date = date
    const res = await apiClient.get('/reminders/replies', { params })
    return res.data.data
  },

  async apiGetCommunications(page = 1, perPage = 20): Promise<{ items: CommunicationItem[]; total: number; pages: number }> {
    const res = await apiClient.get('/reminders/communications', { params: { page, per_page: perPage } })
    return res.data.data
  },
}

export { remindersService }
