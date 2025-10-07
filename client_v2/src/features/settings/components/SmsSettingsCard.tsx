import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CFormLabel,
  CFormInput,
  CRow,
  CCol,
  CSpinner,
  CAlert,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave, cilSettings } from '@coreui/icons';
import apiClient from '@/services/api/client'; // Assumendo che apiClient sia configurato

const SmsSettingsCard: React.FC = () => {
  const [senderProd, setSenderProd] = useState('');
  const [senderTest, setSenderTest] = useState('');
  const [currentEnv, setCurrentEnv] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/sms/settings');
        if (response.data?.success) {
          const { sender_prod, sender_test, current_env } = response.data.data;
          setSenderProd(sender_prod);
          setSenderTest(sender_test);
          setCurrentEnv(current_env);
        } else {
          setError('Impossibile caricare le impostazioni SMS.');
        }
      } catch (err: any) {
        setError(err.message || 'Errore di rete.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = { sender_prod: senderProd, sender_test: senderTest };
      const response = await apiClient.put('/sms/settings', payload);

      if (response.data?.success) {
        setSuccess('Impostazioni salvate. Riavvia il server per applicare le modifiche.');
      } else {
        setError(response.data?.error || 'Salvataggio fallito.');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <h5 className="mb-0">
          <CIcon icon={cilSettings} className="me-2" />
          Impostazioni Mittente SMS
        </h5>
      </CCardHeader>
      <CCardBody>
        {loading ? (
          <CSpinner />
        ) : error ? (
          <CAlert color="danger">{error}</CAlert>
        ) : (
          <>
            {success && <CAlert color="success">{success}</CAlert>}
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel htmlFor="sender_prod">Mittente in Produzione</CFormLabel>
                <CFormInput
                  id="sender_prod"
                  value={senderProd}
                  onChange={(e) => setSenderProd(e.target.value)}
                  disabled={saving}
                />
                 <small className="text-muted">
                  Usato quando l'ambiente SMS è 'prod'.
                </small>
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="sender_test">Mittente in Test</CFormLabel>
                <CFormInput
                  id="sender_test"
                  value={senderTest}
                  onChange={(e) => setSenderTest(e.target.value)}
                  disabled={saving}
                />
                <small className="text-muted">
                  Usato quando l'ambiente SMS è 'test'. Ambiente attuale: <strong>{currentEnv}</strong>
                </small>
              </CCol>
            </CRow>
            <div className="d-flex justify-content-end mt-3">
              <CButton color="primary" onClick={handleSave} disabled={saving}>
                {saving ? <CSpinner size="sm" /> : <CIcon icon={cilSave} className="me-2" />}
                Salva Impostazioni
              </CButton>
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  );
};

export default SmsSettingsCard;
