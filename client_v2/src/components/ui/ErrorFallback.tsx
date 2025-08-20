import React from 'react'
import { CCard, CCardBody, CCardHeader, CButton, CAlert } from '@coreui/react'
import { cilWarning, cilReload } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

interface Props {
  error: Error
  resetErrorBoundary: () => void
}

const ErrorFallback: React.FC<Props> = ({ error, resetErrorBoundary }) => {
  const isDev = import.meta.env.DEV

  return (
    <div className='d-flex justify-content-center align-items-center min-vh-100 bg-light'>
      <CCard style={{ maxWidth: '600px', width: '100%' }}>
        <CCardHeader>
          <div className='d-flex align-items-center'>
            <CIcon icon={cilWarning} className='text-danger me-2' />
            <h5 className='mb-0'>Oops! Qualcosa è andato storto</h5>
          </div>
        </CCardHeader>
        <CCardBody>
          <CAlert color='danger' className='mb-3'>
            <strong>Errore nell'applicazione</strong>
            <p className='mt-2 mb-0'>
              Si è verificato un errore imprevisto. Prova a ricaricare la pagina o contatta il
              supporto se il problema persiste.
            </p>
          </CAlert>

          {isDev && (
            <CAlert color='warning'>
              <strong>Dettagli errore (solo in sviluppo):</strong>
              <pre className='mt-2 mb-0 small'>{error.message}</pre>
              {error.stack && (
                <details className='mt-2'>
                  <summary className='mb-2'>Stack trace</summary>
                  <pre className='small'>{error.stack}</pre>
                </details>
              )}
            </CAlert>
          )}

          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={resetErrorBoundary}>
              <CIcon icon={cilReload} className='me-1' />
              Riprova
            </CButton>
            <CButton
              color='secondary'
              variant='outline'
              onClick={() => window.location.reload()}
            >
              Ricarica pagina
            </CButton>
          </div>
        </CCardBody>
      </CCard>
    </div>
  )
}

export default ErrorFallback