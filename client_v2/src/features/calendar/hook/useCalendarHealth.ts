import { useState } from 'react'
import toast from 'react-hot-toast'
import { calendarHealthService, type CalendarHealthStatus } from '../services/calendarHealthCheck'

export function useCalendarHealth() {
  const [health, setHealth] = useState<CalendarHealthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const checkHealth = async () => {
    setIsLoading(true)
    try {
      const status = await calendarHealthService.checkHealth()
      setHealth(status)
      
      if (status.google_calendar_connected) {
        toast.success('Google Calendar connesso correttamente')
      } else {
        toast.error('Google Calendar non connesso')
      }
      
      return status
    } catch (error: any) {
      toast.error(error.message || 'Errore nel controllo dello stato')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const resetSyncState = async () => {
    if (!confirm('Questo resetterà lo stato di sincronizzazione. La prossima sync ricreerà tutti gli eventi. Continuare?')) {
      return
    }

    setIsResetting(true)
    try {
      // Prima controlla che Google Calendar sia connesso
      const status = await calendarHealthService.checkHealth()
      
      if (!status.google_calendar_connected) {
        toast.error('Google Calendar non connesso. Ri-autenticare prima di resettare lo stato.')
        return
      }

      // Procedi con il reset
      const result = await calendarHealthService.resetSyncState()
      toast.success(result.message)
      
      // Ricontrolla lo stato dopo il reset
      await checkHealth()
      
      return result
    } catch (error: any) {
      toast.error(error.message || 'Errore durante il reset')
      throw error
    } finally {
      setIsResetting(false)
    }
  }

  return {
    health,
    isLoading,
    isResetting,
    checkHealth,
    resetSyncState,
  }
}