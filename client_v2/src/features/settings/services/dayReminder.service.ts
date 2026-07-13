import apiClient from '@/services/api/client'

export interface StudioOpeningHours {
  day_of_week: number // 1=Lun, ..., 7=Dom
  name: string
  enabled: number
  continuous_hours: number
  morning_start: string | null
  morning_end: string | null
  afternoon_start: string | null
  afternoon_end: string | null
  fascia_unica_start: string | null
  fascia_unica_end: string | null
  updated_at?: string
}

export const dayReminderService = {
  /**
   * Legge configurazione orari studio per tutti i 7 giorni.
   */
  async getSchedule(): Promise<StudioOpeningHours[]> {
    try {
      const response = await apiClient.get('/settings/reminder-schedule')
      const items = response.data?.data?.items || []
      return items as StudioOpeningHours[]
    } catch (err: any) {
      throw new Error(err.message || 'Errore caricamento configurazione orari studio')
    }
  },

  /**
   * Aggiorna configurazione orari per un singolo giorno.
   * 
   * @param day_of_week 1-7
   * @param updates Campi da aggiornare
   */
  async updateDay(day_of_week: number, updates: Partial<StudioOpeningHours>): Promise<StudioOpeningHours> {
    try {
      const response = await apiClient.put(
        `/settings/reminder-schedule/${day_of_week}`,
        updates
      )
      return response.data?.data || response.data as StudioOpeningHours
    } catch (err: any) {
      throw new Error(err.message || `Errore salvataggio configurazione giorno ${day_of_week}`)
    }
  },

  /**
   * Helper per formattare orari per la visualizzazione.
   */
  formatTimeRange(start: string | null, end: string | null): string {
    if (!start || !end) return '-'
    return `${start}-${end}`
  },

  /**
   * Helper per determinare il label della modalità dispatch.
   */
  getDispatchModeLabel(continuous: number): string {
    return continuous === 1 ? 'Continuo' : 'Split (Mattina/Pomeriggio)'
  },
}

export default dayReminderService
