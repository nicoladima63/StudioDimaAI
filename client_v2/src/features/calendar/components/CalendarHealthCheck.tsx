import { useEffect } from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilReload,
  cilWarning,
  cilCheckCircle,
  cilXCircle,
  cilTrash
} from '@coreui/icons'
import { CSpinner } from '@coreui/react'
import { useCalendarHealth } from '../hook/useCalendarHealth'

export function CalendarHealthCheck() {
  const { health, isLoading, isResetting, checkHealth, resetSyncState } = useCalendarHealth()

  // Check health on mount
  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CIcon icon={cilWarning} size="lg" className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            Stato Sincronizzazione
          </h3>
        </div>
        
        <button
          onClick={checkHealth}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <CSpinner size="sm" />
          ) : (
            <CIcon icon={cilReload} size="sm" />
          )}
          {isLoading ? 'Controllo...' : 'Controlla Stato'}
        </button>
      </div>

      {/* Status Display */}
      {health && (
        <div className="space-y-3">
          {/* Google Calendar Connection */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <div className="flex items-center gap-2">
              <CIcon 
                icon={health.google_calendar_connected ? cilCheckCircle : cilXCircle}
                size="lg"
                className={health.google_calendar_connected ? 'text-success' : 'text-danger'}
              />
              <span className="text-sm font-medium text-gray-700">
                Google Calendar
              </span>
            </div>
            <span className={`text-sm font-semibold ${
              health.google_calendar_connected ? 'text-success' : 'text-danger'
            }`}>
              {health.google_calendar_connected ? 'Connesso' : 'Non Connesso'}
            </span>
          </div>

          {/* Google Error (if any) */}
          {health.google_error && (
            <div className="p-3 bg-danger bg-opacity-10 border border-danger rounded-md">
              <p className="text-sm text-danger">
                <strong>Errore:</strong> {health.google_error}
              </p>
            </div>
          )}

          {/* Sync State Info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-medium text-gray-700">
              Eventi Sincronizzati
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {health.sync_state_entries}
            </span>
          </div>

          {/* Token Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
              <CIcon 
                icon={health.token_exists ? cilCheckCircle : cilXCircle}
                className={health.token_exists ? 'text-success' : 'text-danger'}
              />
              <span className="text-sm text-gray-700">Token OAuth</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
              <CIcon 
                icon={health.credentials_exists ? cilCheckCircle : cilXCircle}
                className={health.credentials_exists ? 'text-success' : 'text-danger'}
              />
              <span className="text-sm text-gray-700">Credentials</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t">
            <button
              onClick={resetSyncState}
              disabled={isResetting || !health.google_calendar_connected}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-danger rounded-md hover:bg-danger-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResetting ? (
                <CSpinner size="sm" />
              ) : (
                <CIcon icon={cilTrash} size="sm" />
              )}
              {isResetting ? 'Reset in corso...' : 'Reset Stato Sincronizzazione'}
            </button>
            
            {!health.google_calendar_connected && (
              <p className="mt-2 text-xs text-gray-500 text-center">
                Ri-autenticare Google Calendar prima di resettare lo stato
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !health && (
        <div className="flex items-center justify-center py-8">
          <CSpinner color="secondary" />
        </div>
      )}

      {/* Help Text */}
      <div className="pt-3 border-t">
        <p className="text-xs text-gray-500">
          <strong>Quando usare "Reset Stato":</strong> Se gli eventi non si sincronizzano 
          correttamente o se vedi duplicati, il reset forzerà la ricreazione di tutti gli eventi 
          alla prossima sincronizzazione.
        </p>
      </div>
    </div>
  )
}
