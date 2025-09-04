import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormSwitch,
  CFormLabel,
  CRow,
  CCol,
  CButton,
  CFormSelect,
  CAlert,
  CSpinner,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalendar, cilSettings, cilSync, cilTrash } from '@coreui/icons';
import { environmentApi } from '@/services/api/environment.service';
import PageLayout from '@/components/layout/PageLayout';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const CalendarSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [log, setLog] = useState<
    { message: string; type: 'info' | 'success' | 'error'; timestamp: Date }[]
  >([]);

  // Stati per azioni rapide
  const [clearingAll, setClearingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Stati per le modal di conferma
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const addLog = (
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ) => {
    setLog((prev) =>
      [{ message, type, timestamp: new Date() }, ...prev].slice(0, 10)
    );
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    addLog('Caricamento impostazioni calendario...', 'info');
    try {
      // TODO: Implementare chiamata API per ottenere settings calendar
      // Per ora usiamo valori di default
      setEnabled(true);
      setHour(21);
      setMinute(0);
      addLog('Impostazioni calendario caricate con successo', 'success');
    } catch (err: any) {
      const errorMsg = 'Errore nel recupero delle impostazioni';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnabledChange = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    addLog(
      `${
        newEnabled ? 'Attivazione' : 'Disattivazione'
      } automazione calendario...`,
      'info'
    );
    try {
      // TODO: Implementare chiamata API per salvare settings
      addLog(
        `Automazione calendario ${
          newEnabled ? 'attivata' : 'disattivata'
        } con successo`,
        'success'
      );
    } catch (err: any) {
      const errorMsg = 'Errore nel salvataggio dello stato';
      setError(errorMsg);
      addLog(errorMsg, 'error');
      // Ripristina lo stato precedente in caso di errore
      setEnabled(!newEnabled);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    addLog('Salvataggio orario sincronizzazione...', 'info');
    try {
      // TODO: Implementare chiamata API per salvare settings
      setSuccess('Orario sincronizzazione salvato con successo!');
      addLog('Orario sincronizzazione salvato con successo', 'success');
    } catch (err: any) {
      const errorMsg = 'Errore nel salvataggio dell\'orario';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    setClearingAll(true);
    addLog('Cancellazione di tutti i calendari...', 'info');
    try {
      // TODO: Implementare chiamata API per cancellare calendari
      const successMsg = 'Cancellati 0 eventi totali.';
      addLog(successMsg, 'success');
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = 'Errore nella cancellazione dei calendari';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setClearingAll(false);
    }
  };

  const handleSyncAll = async () => {
    setShowSyncConfirm(false);
    setSyncingAll(true);
    addLog('Sincronizzazione di tutti i calendari...', 'info');
    try {
      // TODO: Implementare chiamata API per sincronizzare calendari
      const successMsg = 'Sincronizzati 0 appuntamenti.';
      addLog(successMsg, 'success');
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = 'Errore nella sincronizzazione dei calendari';
      setError(errorMsg);
      addLog(errorMsg, 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header 
        title={
          <div className="d-flex align-items-center">
            <CIcon icon={cilCalendar} className="me-2" />
            Impostazioni Calendario
          </div>
        }
      >
        <p className="text-muted mb-0">
          Configura l'automazione di sincronizzazione con Google Calendar
        </p>
      </PageLayout.Header>

      <PageLayout.ContentBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        {success && <CAlert color="success">{success}</CAlert>}

        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
            <div className="mt-2">Caricamento impostazioni...</div>
          </div>
        ) : (
          <>
            {/* Configurazione principale */}
            <CCard className="mb-4">
              <CCardHeader>
                <h5 className="mb-0">
                  <CIcon icon={cilSettings} className="me-2" />
                  Configurazione Automazione
                </h5>
              </CCardHeader>
              <CCardBody>
                <CRow className="align-items-center mb-3">
                  <CCol md={4} className="mb-2 mb-md-0">
                    <CFormLabel htmlFor="calendar-sync-switch">
                      Automazione attiva
                    </CFormLabel>
                    <CFormSwitch
                      id="calendar-sync-switch"
                      checked={enabled}
                      onChange={(e) => handleEnabledChange(e.target.checked)}
                      label={enabled ? 'Attiva' : 'Disattiva'}
                      className={enabled ? 'toggle-success' : 'toggle-secondary'}
                    />
                  </CCol>
                  <CCol md={4} className="mb-2 mb-md-0">
                    <CFormLabel>Orario sincronizzazione</CFormLabel>
                    <div className="d-flex gap-2 align-items-center">
                      <CFormSelect
                        value={hour}
                        onChange={(e) => setHour(Number(e.target.value))}
                        style={{ width: 80 }}
                        disabled={!enabled}
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </CFormSelect>
                      <span>:</span>
                      <CFormSelect
                        value={minute}
                        onChange={(e) => setMinute(Number(e.target.value))}
                        style={{ width: 80 }}
                        disabled={!enabled}
                      >
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>
                            {m.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </CFormSelect>
                    </div>
                  </CCol>
                  <CCol
                    md={4}
                    className="d-flex align-items-end justify-content-end"
                  >
                    <CButton
                      color="primary"
                      onClick={handleSave}
                      disabled={saving || loading}
                    >
                      {saving ? <CSpinner size="sm" /> : 'Salva Orario'}
                    </CButton>
                  </CCol>
                </CRow>

                <div className="text-muted small mt-3">
                  L'automazione sincronizza ogni giorno alle{' '}
                  {hour.toString().padStart(2, '0')}:
                  {minute.toString().padStart(2, '0')} gli appuntamenti di entrambi
                  gli studi sui rispettivi calendari Google (esclusi sabato e
                  domenica). Sincronizza il mese corrente e il prossimo mese.
                </div>
              </CCardBody>
            </CCard>

            {/* Azioni rapide */}
            <CCard className="mb-4">
              <CCardHeader>
                <h5 className="mb-0">
                  <CIcon icon={cilSync} className="me-2" />
                  Azioni Rapide
                </h5>
              </CCardHeader>
              <CCardBody>
                <CRow>
                  <CCol md={6}>
                    <CButton
                      color="success"
                      size="lg"
                      onClick={() => setShowSyncConfirm(true)}
                      disabled={syncingAll || clearingAll}
                      className="w-100 mb-2"
                    >
                      {syncingAll ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Sincronizzando...
                        </>
                      ) : (
                        <>
                          <CIcon icon={cilSync} className="me-2" />
                          Sincronizza Tutti i Calendari
                        </>
                      )}
                    </CButton>
                  </CCol>
                  <CCol md={6}>
                    <CButton
                      color="danger"
                      size="lg"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={syncingAll || clearingAll}
                      className="w-100 mb-2"
                    >
                      {clearingAll ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          Cancellando...
                        </>
                      ) : (
                        <>
                          <CIcon icon={cilTrash} className="me-2" />
                          Cancella Tutti i Calendari
                        </>
                      )}
                    </CButton>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Log delle azioni */}
            <CCard>
              <CCardHeader>
                <h5 className="mb-0">Log Azioni</h5>
              </CCardHeader>
              <CCardBody style={{ maxHeight: 300, overflowY: 'auto' }}>
                <ul className="mb-0" style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {log.length === 0 && (
                    <li className="text-muted">Nessuna azione recente</li>
                  )}
                  {log.map((entry, idx) => (
                    <li
                      key={idx}
                      className={
                        entry.type === 'success'
                          ? 'text-success'
                          : entry.type === 'error'
                          ? 'text-danger'
                          : 'text-secondary'
                      }
                    >
                      <span style={{ fontSize: '0.85em', marginRight: 6 }}>
                        [{entry.timestamp.toLocaleTimeString()}]
                      </span>
                      {entry.message}
                    </li>
                  ))}
                </ul>
              </CCardBody>
            </CCard>
          </>
        )}
      </PageLayout.ContentBody>

      {/* Modal di conferma sincronizzazione */}
      <CModal
        visible={showSyncConfirm}
        onClose={() => setShowSyncConfirm(false)}
        size="lg"
      >
        <CModalHeader>
          <h5>
            <CIcon icon={cilSync} className="me-2" />
            Conferma Sincronizzazione
          </h5>
        </CModalHeader>
        <CModalBody>
          <p>
            Sincronizzare <strong>tutti i calendari</strong> con gli
            appuntamenti del mese corrente?
          </p>
          <p>Questa operazione aggiornerà:</p>
          <ul>
            <li>
              <strong>📘 Studio Blu</strong> - Calendario aziendale
            </li>
            <li>
              <strong>📒 Studio Giallo</strong> - Calendario principale
            </li>
          </ul>
          <p className="text-muted">
            Gli appuntamenti verranno sincronizzati automaticamente sui
            rispettivi calendari Google.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowSyncConfirm(false)}>
            Annulla
          </CButton>
          <CButton
            color="success"
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            {syncingAll ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Sincronizzando...
              </>
            ) : (
              'Conferma Sincronizzazione'
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal di conferma cancellazione */}
      <CModal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="lg"
      >
        <CModalHeader>
          <h5>
            <CIcon icon={cilTrash} className="me-2" />
            Conferma Cancellazione
          </h5>
        </CModalHeader>
        <CModalBody>
          <CAlert color="danger">
            <strong>⚠️ ATTENZIONE:</strong> Questa operazione non può essere
            annullata!
          </CAlert>
          <p>
            Sei sicuro di voler cancellare <strong>TUTTI gli eventi</strong> da
            entrambi i calendari?
          </p>
          <p>Verranno eliminati gli eventi da:</p>
          <ul>
            <li>
              <strong>📘 Studio Blu</strong> - Tutti gli eventi presenti
            </li>
            <li>
              <strong>📒 Studio Giallo</strong> - Tutti gli eventi presenti
            </li>
          </ul>
          <p className="text-danger fw-semibold">
            Questa azione eliminerà definitivamente tutti gli appuntamenti dai
            calendari Google.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowClearConfirm(false)}>
            Annulla
          </CButton>
          <CButton
            color="danger"
            onClick={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Cancellando...
              </>
            ) : (
              'Conferma Cancellazione'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </PageLayout>
  );
};

export default CalendarSettings;
