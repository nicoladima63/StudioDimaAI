import apiClient from '@/services/api/client'

export interface DaysReminder {
  days: number[]
}

const normalizeDays = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      .sort((a, b) => a - b)
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 7 ? [value] : []
  }

  return []
}

export const dayReminderService = {
  async getDays(): Promise<number[]> {
    try {
      const response = await apiClient.get('settings/day-reminder')
      return normalizeDays(response.data?.days)
    } catch (err: any) {
      throw new Error(err.message || 'Errore caricamento lista giorni')
    }
  },

  async updateDays(days: number[]): Promise<number[]> {
    try {
      const response = await apiClient.put('settings/day-reminder', { days })
      return normalizeDays(response.data?.days ?? days)
    } catch (err: any) {
      throw new Error(err.message || 'Errore salvataggio lista giorni')
    }
  },
}

export default dayReminderService
