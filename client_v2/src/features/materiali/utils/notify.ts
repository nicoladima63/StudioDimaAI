import toast from 'react-hot-toast'
import type { StatoRisposta } from '../types/catalogo'

/** Toast a tre stati: verde = success, arancione = warning, rosso = error. */
export function notify(state: StatoRisposta, message: string): void {
  if (state === 'success') {
    toast.success(message)
  } else if (state === 'warning') {
    toast(message, { icon: '!', style: { background: '#f59e0b', color: '#fff' } })
  } else {
    toast.error(message)
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  const axiosMessage = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return axiosMessage?.error || axiosMessage?.message || (error instanceof Error ? error.message : fallback)
}
