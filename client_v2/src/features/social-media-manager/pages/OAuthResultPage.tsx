/**
 * OAuthResultPage - Phase 2
 * Pagina di risultato OAuth mostrata dopo autorizzazione social media
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CCard, CCardBody, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilXCircle } from '@coreui/icons';
import toast from 'react-hot-toast';

const OAuthResultPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [closing, setClosing] = useState(false);

  const success = searchParams.get('success') === 'true';
  const platform = searchParams.get('platform');
  const error = searchParams.get('error');

  useEffect(() => {
    // Show toast notification
    if (success) {
      toast.success(`${platform} connesso con successo!`);
    } else {
      toast.error(`Errore connessione: ${error || 'Errore sconosciuto'}`);
    }

    // Auto-close window after 2 seconds
    setClosing(true);
    const timer = setTimeout(() => {
      window.close();
    }, 2000);

    return () => clearTimeout(timer);
  }, [success, platform, error]);

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <CCard style={{ maxWidth: '500px', width: '100%' }}>
        <CCardBody className="text-center p-5">
          {success ? (
            <>
              <div className="mb-3">
                <CIcon
                  icon={cilCheckCircle}
                  size="4xl"
                  className="text-success"
                />
              </div>
              <h3 className="mb-3">Connessione riuscita!</h3>
              <p className="text-muted mb-3">
                Account <strong>{platform}</strong> connesso con successo.
              </p>
            </>
          ) : (
            <>
              <div className="mb-3">
                <CIcon
                  icon={cilXCircle}
                  size="4xl"
                  className="text-danger"
                />
              </div>
              <h3 className="mb-3">Errore di connessione</h3>
              <p className="text-danger mb-3">
                {error || 'Si è verificato un errore durante la connessione.'}
              </p>
            </>
          )}

          {closing && (
            <div className="d-flex align-items-center justify-content-center gap-2 mt-4">
              <CSpinner size="sm" />
              <small className="text-muted">Chiusura automatica...</small>
            </div>
          )}

          <div className="mt-4">
            <small className="text-muted">
              Puoi chiudere questa finestra manualmente se non si chiude automaticamente.
            </small>
          </div>
        </CCardBody>
      </CCard>
    </div>
  );
};

export default OAuthResultPage;
