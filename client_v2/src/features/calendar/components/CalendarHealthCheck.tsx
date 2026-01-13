import { useEffect } from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilReload,
  cilWarning,
  cilCheckCircle,
  cilXCircle,
  cilTrash,
  cilCalendar
} from '@coreui/icons'
import { CCol, CRow, CSpinner } from '@coreui/react'
import { useCalendarHealth } from '../hook/useCalendarHealth'
import PageLayout from '@/components/layout/PageLayout'

export function CalendarHealthCheck() {
  const { health, isLoading, isResetting, checkHealth, resetSyncState } = useCalendarHealth()

  // Check health on mount
  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <PageLayout>
      <PageLayout.Header
        title={
          <div className='d-flex align-items-center'>
            <CIcon icon={cilCalendar} className='me-2' />
            Stato Sincronizzazione
          </div>
        }
      ></PageLayout.Header>
      <PageLayout.ContentBody>
        {isLoading && !health ? (
          <div className="flex items-center justify-center py-8">
            <CSpinner color="secondary" />
          </div>
        ) : health ? (
          <>
            {/* ROW 1 */}
            <CRow className="mb-4">
              {/* 1. Google Calendar Connection */}
              <CCol md={4}>
                <div className="h-full p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CIcon icon={cilCalendar} className="text-gray-500" size="lg" />
                    <h6 className="m-0 font-semibold text-gray-700">Connessione Google</h6>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm text-gray-600">Stato:</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${health.google_calendar_connected ? 'text-success' : 'text-danger'}`}>
                        {health.google_calendar_connected ? 'Connesso' : 'Disconnesso'}
                      </span>
                      <CIcon
                        icon={health.google_calendar_connected ? cilCheckCircle : cilXCircle}
                        className={health.google_calendar_connected ? 'text-success' : 'text-danger'}
                      />
                    </div>
                  </div>
                </div>
              </CCol>

              {/* 2. Token OAuth */}
              <CCol md={4}>
                <div className="h-full p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CIcon icon={cilCheckCircle} className="text-gray-500" size="lg" />
                    <h6 className="m-0 font-semibold text-gray-700">Token OAuth</h6>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm text-gray-600">Validità:</span>
                    <CIcon
                      icon={health.token_exists ? cilCheckCircle : cilXCircle}
                      size="xl"
                      className={health.token_exists ? 'text-success' : 'text-danger'}
                    />
                  </div>
                </div>
              </CCol>

              {/* 3. Credentials */}
              <CCol md={4}>
                <div className="h-full p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CIcon icon={cilCheckCircle} className="text-gray-500" size="lg" />
                    <h6 className="m-0 font-semibold text-gray-700">Credenziali App</h6>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm text-gray-600">Configurazione:</span>
                    <CIcon
                      icon={health.credentials_exists ? cilCheckCircle : cilXCircle}
                      size="xl"
                      className={health.credentials_exists ? 'text-success' : 'text-danger'}
                    />
                  </div>
                </div>
              </CCol>
            </CRow>

            {/* ROW 2 */}
            <CRow>
              {/* 4. Eventi Sincronizzati */}
              <CCol md={4}>
                <div className="h-full p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CIcon icon={cilReload} className="text-gray-500" size="lg" />
                    <h6 className="m-0 font-semibold text-gray-700">Sincronizzazione</h6>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm text-gray-600">Eventi nel DB:</span>
                    <span className="text-xl font-bold text-primary">
                      {health.sync_state_entries}
                    </span>
                  </div>
                </div>
              </CCol>

              {/* 5. Stato Errori */}
              <CCol md={4}>
                <div className={`h-full p-4 rounded-lg border border-gray-100 flex flex-col gap-3 ${health.google_error ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <CIcon icon={cilWarning} className={health.google_error ? 'text-danger' : 'text-gray-500'} size="lg" />
                    <h6 className={`m-0 font-semibold ${health.google_error ? 'text-danger' : 'text-gray-700'}`}>Stato Errori</h6>
                  </div>
                  <div className="mt-auto">
                    {health.google_error ? (
                      <p className="text-sm text-danger font-medium leading-tight mb-0">
                        {health.google_error}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 text-success">
                        <CIcon icon={cilCheckCircle} />
                        <span className="text-sm font-medium">Nessun errore rilevato</span>
                      </div>
                    )}
                  </div>
                </div>
              </CCol>

              {/* 6. Azioni */}
              <CCol md={4}>
                <div className="h-full p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CIcon icon={cilReload} className="text-gray-500" size="lg" />
                    <h6 className="m-0 font-semibold text-gray-700">Azioni</h6>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={checkHealth}
                      disabled={isLoading}
                      className="flex-1 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      title="Ricarica Stato"
                    >
                      <CIcon icon={cilReload} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={resetSyncState}
                      disabled={isResetting || !health.google_calendar_connected}
                      className="flex-3 px-3 py-2 text-xs font-bold text-white bg-danger rounded hover:bg-danger-dark disabled:opacity-50 transition-colors w-full"
                    >
                      {isResetting ? 'Reset...' : 'Reset Sync'}
                    </button>
                  </div>
                </div>
              </CCol>
            </CRow>
          </>
        ) : null}
      </PageLayout.ContentBody>
      <PageLayout.Footer>
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

      </PageLayout.Footer>
    </PageLayout>
  )
}
