import React, { useState, useEffect } from 'react';
import { CAlert, CButton, CToast, CToastBody, CToaster, CRow, CCol, CFormInput, CSpinner } from '@coreui/react';
import { cilReload, cilCloudDownload, cilCheck } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import DashboardCard from '@/components/DashboardCard';
import RecallsStatistics from './RecallsStatistics';
import RecallsTable from './RecallsTable';
import { recallsService } from '@/api/services/recalls.service';
import type { Richiamo, RichiamoStatistics, RichiamoFilters } from '@/api/apiTypes';
import MessageModal from '../../components/MessageModal';
import { getRecallMessage, saveRecallMessage, sendRecallSMS, testRecallSMS } from '@/api/apiClient';

const RecallsPage: React.FC = () => {
  const [richiami, setRichiami] = useState<Richiamo[]>([]);
  const [statistics, setStatistics] = useState<RichiamoStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [filters, setFilters] = useState<RichiamoFilters>({ days_threshold: 90 });
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    color: 'success' | 'danger' | 'warning';
  }>({ visible: false, message: '', color: 'success' });
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [messageId, setMessageId] = useState<number | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  // Carica i dati iniziali
  useEffect(() => {
    loadData();
  }, [filters]);

  // Carica il messaggio di richiamo all'avvio
  useEffect(() => {
    setLoadingMsg(true);
    getRecallMessage('richiamo')
      .then(data => {
        if (data.success && data.data.length > 0) {
          setMessage(data.data[0][3]); // testo
          setMessageId(data.data[0][0]); // id
        }
      })
      .catch(() => setAlert('Errore nel caricamento del messaggio'))
      .finally(() => setLoadingMsg(false));
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setStatisticsLoading(true);

      // Carica richiami e statistiche in parallelo
      const [richiamiResponse, statisticsResponse] = await Promise.all([
        recallsService.getRecalls(filters),
        recallsService.getStatistics(filters.days_threshold || 90)
      ]);

      if (richiamiResponse.success) {
        setRichiami(richiamiResponse.data);
      }

      if (statisticsResponse.success) {
        setStatistics(statisticsResponse.data);
      }

    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      showToast('Errore nel caricamento dei dati', 'danger');
    } finally {
      setLoading(false);
      setStatisticsLoading(false);
    }
  };

  const handleSendSMS = async (richiamoId: string) => {
    try {
      const result = await recallsService.sendSMS(richiamoId);
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast('Errore nell\'invio SMS', 'danger');
      }
    } catch (error) {
      console.error('Errore nell\'invio SMS:', error);
      showToast('Errore nell\'invio SMS', 'danger');
    }
  };

  const handleViewMessage = async (richiamoId: string) => {
    try {
      const response = await recallsService.getRecallMessage(richiamoId);
      if (response.success) {
        // Il messaggio viene gestito dal componente RecallsTable
        console.log('Messaggio caricato:', response.data);
      }
    } catch (error) {
      console.error('Errore nel caricamento messaggio:', error);
      showToast('Errore nel caricamento del messaggio', 'danger');
    }
  };

  const handleMarkHandled = async (richiamoId: string) => {
    try {
      const result = await recallsService.markAsHandled(richiamoId);
      if (result.success) {
        showToast(result.message, 'success');
        // Ricarica i dati per aggiornare la lista
        loadData();
      } else {
        showToast('Errore nella marcatura del richiamo', 'danger');
      }
    } catch (error) {
      console.error('Errore nella marcatura richiamo:', error);
      showToast('Errore nella marcatura del richiamo', 'danger');
    }
  };

  const handleUpdateDates = async () => {
    try {
      const result = await recallsService.updateRecallDates();
      if (result.success) {
        showToast(result.message, 'success');
        // Ricarica i dati per aggiornare le date
        loadData();
      } else {
        showToast('Errore nell\'aggiornamento delle date', 'danger');
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento date:', error);
      showToast('Errore nell\'aggiornamento delle date', 'danger');
    }
  };

  const handleExport = async () => {
    try {
      const response = await recallsService.exportRecalls(filters.days_threshold || 90);
      if (response.success) {
        // Per ora mostra solo un messaggio, in futuro si può implementare il download
        showToast(`Esportati ${response.count} richiami`, 'success');
        
        // Simula il download di un file JSON
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `richiami_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Errore nell\'export:', error);
      showToast('Errore nell\'esportazione', 'danger');
    }
  };

  const handleTestService = async () => {
    try {
      const response = await recallsService.testService();
      if (response.success) {
        showToast(response.message, 'success');
      } else {
        showToast('Test fallito', 'danger');
      }
    } catch (error) {
      console.error('Errore nel test:', error);
      showToast('Errore nel test del servizio', 'danger');
    }
  };

  // Salva il messaggio modificato
  const handleSaveMessage = (testo: string) => {
    setSavingMsg(true);
    saveRecallMessage({ id: messageId !== null ? messageId : undefined, tipo: 'richiamo', testo })
      .then(data => {
        if (data.success) {
          setMessage(testo);
          showTimedAlert('Messaggio salvato con successo');
          setShowModal(false);
        } else {
          showTimedAlert('Errore nel salvataggio');
        }
      })
      .catch(() => showTimedAlert('Errore nel salvataggio'))
      .finally(() => setSavingMsg(false));
  };

  // Invio reale SMS (da tabella)
  const handleSendSMSReal = (recall: Richiamo) => {
    sendRecallSMS({
      id_paziente: recall.id_paziente,
      telefono: recall.telefono,
      testo: message,
      tipo: 'richiamo'
    })
      .then(data => {
        if (data.success) showTimedAlert('SMS inviato con successo');
        else showTimedAlert('Errore invio SMS');
      })
      .catch(() => showTimedAlert('Errore invio SMS'));
  };

  // Test SMS
  const handleTestSMS = () => {
    setTestLoading(true);
    setTestResult(null);
    testRecallSMS({ telefono: testNumber, testo: message })
      .then(data => {
        if (data.success) showTimedTestResult('SMS di test inviato!');
        else showTimedTestResult('Errore invio SMS di test');
      })
      .catch(() => showTimedTestResult('Errore invio SMS di test'))
      .finally(() => setTestLoading(false));
  };

  const showToast = (message: string, color: 'success' | 'danger' | 'warning') => {
    setToast({ visible: true, message, color });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const showTimedAlert = (msg: string) => {
    setAlert(msg);
    setTimeout(() => setAlert(null), 5000);
  };

  const showTimedTestResult = (msg: string) => {
    setTestResult(msg);
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="recalls-page">
      <DashboardCard
        title="Gestione Richiami"
        headerAction={
          <div className="d-flex gap-2">
            <CButton
              color="info"
              size="sm"
              onClick={handleTestService}
              title="Test servizio"
            >
              <CIcon icon={cilCheck} className="me-1" />
              Test
            </CButton>
            <CButton
              color="warning"
              size="sm"
              onClick={handleUpdateDates}
              title="Aggiorna date"
            >
              <CIcon icon={cilReload} className="me-1" />
              Aggiorna Date
            </CButton>
            <CButton
              color="success"
              size="sm"
              onClick={handleExport}
              title="Esporta richiami"
            >
              <CIcon icon={cilCloudDownload} className="me-1" />
              Esporta
            </CButton>
            <CButton
              color="primary"
              size="sm"
              onClick={loadData}
              title="Ricarica dati"
            >
              <CIcon icon={cilReload} className="me-1" />
              Ricarica
            </CButton>
          </div>
        }
      >
        {/* Filtri globali */}
        <div className="mb-4">
          <div className="row">
            <div className="col-md-3">
              <label className="form-label">Soglia giorni</label>
              <select
                className="form-select"
                value={filters.days_threshold || 90}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  days_threshold: parseInt(e.target.value) 
                }))}
              >
                <option value={30}>30 giorni</option>
                <option value={60}>60 giorni</option>
                <option value={90}>90 giorni</option>
                <option value={180}>180 giorni</option>
                <option value={365}>1 anno</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Stato</label>
              <select
                className="form-select"
                value={filters.status || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  status: e.target.value as 'scaduto' | 'in_scadenza' | 'futuro' | undefined 
                }))}
              >
                <option value="">Tutti gli stati</option>
                <option value="scaduto">Scaduti</option>
                <option value="in_scadenza">In Scadenza</option>
                <option value="futuro">Futuri</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistiche */}
        {statistics && (
          <RecallsStatistics 
            statistics={statistics} 
            loading={statisticsLoading} 
          />
        )}

        {/* Tabella richiami */}
        <div className="mt-4">
          <h5>Lista Richiami</h5>
          <RecallsTable
            richiami={richiami}
            loading={loading}
            onSendSMS={handleSendSMSReal}
            onViewMessage={handleViewMessage}
            onMarkHandled={handleMarkHandled}
          />
        </div>

        {/* Messaggio se non ci sono richiami */}
        {!loading && richiami.length === 0 && (
          <CAlert color="info" className="mt-4">
            <h6>Nessun richiamo trovato</h6>
            <p className="mb-0">
              Non ci sono richiami che corrispondono ai filtri selezionati. 
              Prova a modificare i filtri o la soglia dei giorni.
            </p>
          </CAlert>
        )}

        <CRow className="mb-3">
          <CCol>
            <CButton color="info" onClick={() => setShowModal(true)} disabled={loadingMsg}>
              {loadingMsg ? <CSpinner size="sm" /> : 'Modifica messaggio'}
            </CButton>
          </CCol>
        </CRow>
        <MessageModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSaveMessage}
          tipo="richiamo"
          messaggio={message}
          loading={savingMsg}
        />
        {alert && <CAlert color="info" dismissible onClose={() => setAlert(null)}>{alert}</CAlert>}

        {/* Esempio: <RecallsTable onSendSMS={handleSendSMS} ... /> */}
        {/* Sezione test SMS */}
        <div className="mt-4 p-3 border rounded bg-light">
          <h6>Test invio SMS</h6>
          <CRow className="align-items-end">
            <CCol xs={12} md={6} lg={4}>
              <CFormInput
                label="Numero di telefono"
                placeholder="Esempio: +393401234567"
                value={testNumber}
                onChange={e => setTestNumber(e.target.value)}
              />
            </CCol>
            <CCol xs="auto">
              <CButton color="primary" onClick={handleTestSMS} disabled={testLoading || !testNumber}>
                {testLoading ? <CSpinner size="sm" /> : 'Invia test'}
              </CButton>
            </CCol>
            <CCol>{testResult && <CAlert color="success">{testResult}</CAlert>}</CCol>
          </CRow>
        </div>
      </DashboardCard>

      {/* Toast per le notifiche */}
      <CToaster placement="top-end">
        {toast.visible && (
          <CToast
            visible={toast.visible}
            color={toast.color}
            className="text-white align-items-center"
          >
            <CToastBody>
              {toast.message}
            </CToastBody>
          </CToast>
        )}
      </CToaster>
    </div>
  );
};

export default RecallsPage; 