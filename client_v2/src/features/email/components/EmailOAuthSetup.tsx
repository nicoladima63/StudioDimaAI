import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardHeader,
  CCardBody,
  CButton,
  CBadge,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilXCircle, cilReload } from '@coreui/icons'
import { emailService } from '../services/emailService'
import { useEmailStore } from '../store/email.store'

const EmailOAuthSetup: React.FC = () => {
  const { authenticated, checkAuth } = useEmailStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await emailService.apiGetOAuthUrl()
      if (result.success && result.data?.auth_url) {
        window.open(result.data.auth_url, '_blank', 'width=600,height=700')
        // Poll for auth status
        const interval = setInterval(async () => {
          await checkAuth()
          const store = useEmailStore.getState()
          if (store.authenticated) {
            clearInterval(interval)
            setLoading(false)
          }
        }, 3000)
        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(interval)
          setLoading(false)
        }, 120000)
      } else {
        setError(result.error || 'Errore generazione URL autenticazione')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Errore connessione Gmail')
      setLoading(false)
    }
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Connessione Gmail</strong>
        <CBadge color={authenticated ? 'success' : 'danger'}>
          <CIcon icon={authenticated ? cilCheckCircle : cilXCircle} className="me-1" />
          {authenticated ? 'Connesso' : 'Non connesso'}
        </CBadge>
      </CCardHeader>
      <CCardBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        {authenticated ? (
          <div>
            <p className="text-success mb-2">
              Account Gmail connesso e funzionante.
            </p>
            <CButton
              color="outline-primary"
              size="sm"
              onClick={handleConnect}
              disabled={loading}
            >
              <CIcon icon={cilReload} className="me-1" />
              Riconnetti
            </CButton>
          </div>
        ) : (
          <div>
            <p className="mb-3">
              Connetti il tuo account Gmail per abilitare la lettura e il filtro delle email.
              Verra' richiesto l'accesso in sola lettura.
            </p>
            <CButton
              color="primary"
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Connessione in corso...
                </>
              ) : (
                'Connetti Gmail'
              )}
            </CButton>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default EmailOAuthSetup
