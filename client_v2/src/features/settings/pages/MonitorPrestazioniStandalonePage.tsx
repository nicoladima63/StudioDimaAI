import React, { useState, useEffect } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormTextarea ,
  CRow,
  CCol,
  CFormSelect,
  CFormLabel,
  CFormInput,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilTrash,
  cilReload,
  cilSettings,
  cilList,
} from '@coreui/icons-react';import PageLayout from '@/components/layout/PageLayout';
import { MonitorPrestazioniService } from '@/services/api/monitorPrestazioni';
import PrestazioniSelect from '@/components/selects/PrestazioniSelect';
import { Prestazione, usePrestazioniStore } from '@/store/prestazioni.store'
import regoleMonitoraggioApi, { type CallbackInfo, type PreparedCallback } from '@/features/settings/services/regoleMonitoraggio.service';
import ListaRegole from '@/features/settings/components/monitor/ListaRegole';
import StatoMonitorCard from '@/features/settings/components/monitor/StatoMonitorCard';
import LogMonitorCard from '@/features/settings/components/monitor/LogMonitorCard';
import GestioneRegoleCard from '@/features/settings/components/monitor/GestioneRegoleCard';
import CallbackCard from '@/features/settings/components/monitor/CallbackCard';
import AssociaRegolaCard from '@/features/settings/components/monitor/AssociaRegolaCard';

interface MonitorStatus {
  is_running: boolean;
  path: string;
  last_check?: string;
  total_changes: number;
}

interface MonitorLog {
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

const MonitorPrestazioniStandalonePage: React.FC = () => {
  // Stati principali
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Stati per selezione prestazioni
  const [selectedPrestazione, setSelectedPrestazione] = useState<Prestazione | null>(null);
  const [callbacks, setCallbacks] = useState<CallbackInfo[]>([]);
  const [selectedCallback, setSelectedCallback] = useState<string>('');
  const [regole, setRegole] = useState<any[]>([]);
  // Callback config modal state
  const [showCreateCallback, setShowCreateCallback] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string; message: string } | null>(null);
  const [cbPageSlug, setCbPageSlug] = useState('istruzioni-ortodonzia');
  const [cbTemplateKey, setCbTemplateKey] = useState('send_link');
  const [cbSender, setCbSender] = useState('');
  const [cbNome, setCbNome] = useState('');
  const [cbUrlParams, setCbUrlParams] = useState('{"src":"auto"}');
  const [preparedCallbacks, setPreparedCallbacks] = useState<PreparedCallback[]>([]);
  const [selectedCallbackParams, setSelectedCallbackParams] = useState<any | null>(null);

  // Carica stato iniziale
  useEffect(() => {
    loadStatus();
    // loadStatus();
    loadLogs();
    loadCallbacks();
    loadRegole();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await MonitorPrestazioniService.getStatus();
      if (response.success && response.data) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Errore nel caricamento dello stato:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await MonitorPrestazioniService.getLogs();
      if (response.success && response.data) {
        // Il backend restituisce { logs: MonitorLog[] }
        setLogs(response.data.logs || []);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei log:', error);
    }
  };

  const handleStartMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.startMonitor();
      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus();
        await loadLogs();
      } else {
        setError(response.message || "Errore nell'avvio del monitor");
      }
    } catch (error) {
      setError("Errore nell'avvio del monitor");
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.stopMonitor();
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus();
        await loadLogs();
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
      }
    } catch (error) {
      setError('Errore nella fermata del monitor');
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestMonitor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await MonitorPrestazioniService.testMonitor();
      if (response.success) {
        setSuccess('Test monitor completato');
        await loadLogs();
      } else {
        setError(response.message || 'Errore nel test del monitor');
      }
    } catch (error) {
      setError('Errore nel test del monitor');
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      setError(null);
      
      const response = await MonitorPrestazioniService.clearLogs();
      if (response.success) {
        setSuccess('Log puliti con successo');
        await loadLogs();
      } else {
        setError(response.message || 'Errore nella pulizia dei log');
      }
    } catch (error) {
      setError('Errore nella pulizia dei log');
      console.error('Errore:', error);
    }
  };

  const refreshLogs = () => {
    loadLogs();
  };

  const loadCallbacks = async () => {
    try {
      const data = await regoleMonitoraggioApi.getCallbacks();
      setCallbacks(data);
      await loadPreparedCallbacks();
    } catch (e) {
      console.error('Errore caricamento callbacks', e);
    }
  };

  const loadRegole = async () => {
    try {
      const data = await regoleMonitoraggioApi.getRegole();
      setRegole(data);
    } catch (e) {
      console.error('Errore caricamento regole', e);
    }
  };

  const loadPreparedCallbacks = async () => {
    try {
      const data = await regoleMonitoraggioApi.getPreparedCallbacks();
      setPreparedCallbacks(data);
    } catch (e) {
      console.error('Errore caricamento callback preparate', e);
    }
  };

  const handleAssocia = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedPrestazione || !selectedCallback) return;

    // Determina la funzione di callback e i parametri corretti
    const preparedCb = preparedCallbacks.find(p => p.id === Number(selectedCallback));
    const callbackFunction = preparedCb ? preparedCb.callback_function : selectedCallback;
    const callbackParams = preparedCb ? preparedCb.parametri : selectedCallbackParams;

    try {
      setLoading(true);
      let paramsString: string | undefined;
      if (callbackParams) {
        try {
          paramsString = JSON.stringify(callbackParams);
        } catch (jsonError) {
          throw new Error('I parametri della callback non sono in formato JSON valido.');
        }
      }
      const payload = {
        tipo_prestazione_id: selectedPrestazione.id,
        categoria_prestazione: selectedPrestazione.categoria_id,
        nome_prestazione: selectedPrestazione.nome,
        callback_function: callbackFunction,
        parametri_callback: paramsString,
        attiva: false,
        preview_only: true,
      };
      await regoleMonitoraggioApi.createRegola(payload);
      setSuccess('Associazione creata');
      setSelectedCallback('');
      setSelectedCallbackParams(null);
      await loadRegole();
    } catch (e: any) {
      setError(e?.message || 'Errore associazione');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRegola = async (id: number) => {
    try {
      await regoleMonitoraggioApi.toggleRegola(id);
      await loadRegole();
    } catch (e) {
      console.error('Errore toggle regola', e);
    }
  };

  const handleDeleteRegola = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa regola?')) return;
    try {
      await regoleMonitoraggioApi.deleteRegola(id);
      await loadRegole();
    } catch (e) {
      console.error('Errore delete regola', e);
    }
  };

  const handleDeletePreparedCallback = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa callback personalizzata?')) return;
    try {
      await regoleMonitoraggioApi.deletePreparedCallback(id);
      await loadPreparedCallbacks();
    } catch (e) {
      console.error('Errore eliminazione callback preparata', e);
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header 
        title='Monitor Prestazioni DBF'
        subtitle='Gestione regole di monitoraggio e controllo prestazioni in tempo reale'
        headerAction={
          <div className='d-flex gap-2'>
            <CButton color='info' onClick={refreshLogs} disabled={loading} size='sm'>
              <CIcon icon={cilReload} className='me-1' />
              Aggiorna Log
            </CButton>
            <CButton color='warning' onClick={handleTestMonitor} disabled={loading} size='sm'>
              <CIcon icon={cilSettings} className='me-1' />
              Test
            </CButton>
            <CButton color='danger' onClick={clearLogs} disabled={loading} size='sm'>
              <CIcon icon={cilTrash} className='me-1' />
              Pulisci Log
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <CRow>
          <CCol md={3}>
            <GestioneRegoleCard 
              selectedPrestazione={selectedPrestazione}
              onPrestazioneChange={setSelectedPrestazione}
            />
          </CCol>
          <CCol md={3}>
            <CallbackCard 
              callbacks={callbacks}
              preparedCallbacks={preparedCallbacks}
              selectedCallback={selectedCallback}
              onCallbackChange={(value) => {
                setSelectedCallback(value);
                const found = preparedCallbacks.find(p => p.id === value)
                setSelectedCallbackParams(found ? found.params : null)
              }}
              onDeletePreparedCallback={handleDeletePreparedCallback}
              onShowCreateCallback={() => {
                setCbNome('');
                setShowCreateCallback(true);
              }}
            />
          </CCol>
          <CCol md={1}>
            <AssociaRegolaCard 
              onAssocia={handleAssocia}
              disabled={!selectedPrestazione || !selectedCallback || loading}
            />
          </CCol>
          <CCol md={4}>
            <CCard className='mb-4'>
              <CCardHeader>
                <h5 className='mb-0'>
                  <CIcon icon={cilList} className='me-2' />
                  Regole già create
                </h5>
              </CCardHeader>
              <CCardBody>
                <ListaRegole 
                  regole={regole}
                  onToggle={handleToggleRegola}
                  onDelete={handleDeleteRegola}
                  loading={loading}
                />
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </PageLayout.ContentHeader>

      {/* Modal crea callback */}
      <CModal visible={showCreateCallback} onClose={() => setShowCreateCallback(false)} backdrop='static'>
        <CModalHeader>Nuova Callback (SMS con link)</CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel>Tipo callback</CFormLabel>
            <CFormSelect value={'send_sms_link'} disabled>
              <option value='send_sms_link'>send_sms_link</option>
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel>Nome Descrittivo *</CFormLabel>
            <CFormInput value={cbNome} onChange={(e) => setCbNome(e.target.value)} placeholder='es. SMS Istruzioni Ortodonzia' />
          </div>
          <div className='mb-3'>
            <CFormLabel>Pagina (slug)</CFormLabel>
            <CFormInput value={cbPageSlug} onChange={(e) => setCbPageSlug(e.target.value)} placeholder='es. istruzioni-ortodonzia' />
          </div>
          <div className='mb-3'>
            <CFormLabel>Template</CFormLabel>
            <CFormSelect value={cbTemplateKey} onChange={(e) => setCbTemplateKey(e.target.value)}>
              <option value='send_link'>send_link</option>
              <option value='richiamo'>richiamo</option>
              <option value='promemoria'>promemoria</option>
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel>Mittente (opzionale)</CFormLabel>
            <CFormInput value={cbSender} onChange={(e) => setCbSender(e.target.value)} placeholder='es. StudioDima' />
          </div>
          <div className='mb-3'>
            <CFormLabel>URL params (JSON)</CFormLabel>
            <CFormTextarea rows={3} value={cbUrlParams} onChange={(e) => setCbUrlParams(e.target.value)} />
            <small className='text-muted'>Puoi usare placeholder come {'{{tipo_prestazione}}'} che verranno sostituiti dai dati del contesto.</small>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowCreateCallback(false)}>Annulla</CButton>
          <CButton color='primary' onClick={async (e) => {
            e.preventDefault();
            if (!cbNome) {
              alert('Il nome descrittivo è obbligatorio.');
              return;
            }
            let params: any = {};
            try { params = cbUrlParams ? JSON.parse(cbUrlParams) : {} } catch { params = {} }
            
            const payload = {
              nome: cbNome,
              callback_function: 'send_sms_link',
              parametri: { page_slug: cbPageSlug, template_key: cbTemplateKey, sender: cbSender || undefined, url_params: params }
            };
            
            const newPreparedCallback = await regoleMonitoraggioApi.createPreparedCallback(payload);
            await loadPreparedCallbacks();

            setShowCreateCallback(false)
            setShowPreview(true)
            regoleMonitoraggioApi.previewSendSmsLink(newPreparedCallback.parametri, {
                phone: '+390000000000',
                nome_completo: 'Mario Rossi',
                tipo_prestazione: selectedPrestazione?.nome || 'Prestazione',
                prestazione_nome: selectedPrestazione?.nome || '',
                prestazione_codice: selectedPrestazione?.codice_breve || '',
                tipo_prestazione_id: selectedPrestazione?.id || '',
              })
                .then(data => setPreviewData(data))
                .catch(() => setPreviewData({ url: `https://studiodimartino.eu/${cbPageSlug}`, message: '' }))
          }}>Salva</CButton>
        </CModalFooter>
      </CModal>

      {/* Modal preview messaggio */}
      <CModal visible={showPreview} onClose={() => setShowPreview(false)}>
        <CModalHeader>Anteprima SMS</CModalHeader>
        <CModalBody>
          {previewData ? (
            <>
              <div className='mb-2'><strong>URL</strong><br />{previewData.url}</div>
              <div className='mb-2'><strong>Messaggio</strong><br />
                {(previewData.message && previewData.message.length > 0) ? previewData.message : `Ciao {nome}, informazioni utili: ${previewData.url}`}
              </div>
              <small className='text-muted'>Il messaggio effettivo userà il template scelto e i dati reali del paziente.</small>
            </>
          ) : 'Caricamento...'}
        </CModalBody>
        <CModalFooter>
          <CButton color='primary' onClick={() => setShowPreview(false)}>Ok</CButton>
        </CModalFooter>
      </CModal>

      <PageLayout.ContentBody>
        {/* Card Impostazioni Monitor */}
        <StatoMonitorCard 
          status={status}
          loading={loading}
          error={error}
          success={success}
          onStart={handleStartMonitor}
          onStop={handleStopMonitor}
          onTest={handleTestMonitor}
          onClearError={() => setError(null)}
          onClearSuccess={() => setSuccess(null)}
        />

        <LogMonitorCard logs={logs} />
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default MonitorPrestazioniStandalonePage;
