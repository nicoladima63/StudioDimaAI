import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CTextarea,
  CFormTextarea ,
  CSpinner,
  CAlert,
  CBadge,
  CRow,
  CCol,
  CFormSelect,
  CFormLabel,
  CFormInput,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { 
  cilMediaPlay, 
  cilMediaStop, 
  cilTrash, 
  cilReload,
  cilSettings,
  cilCog,
  cilList,
} from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import { MonitorPrestazioniService } from '@/services/api/monitorPrestazioni';
import PrestazioniSelect from '@/components/selects/PrestazioniSelect';
import { Prestazione, usePrestazioniStore } from '@/store/prestazioni.store';
import regoleMonitoraggioApi, { type CallbackInfo } from '@/features/settings/services/regoleMonitoraggio.service';

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
  const [cbUrlParams, setCbUrlParams] = useState('{"src":"auto"}');
  const [preparedCallbacks, setPreparedCallbacks] = useState<any[]>([]);
  const [selectedCallbackParams, setSelectedCallbackParams] = useState<any | null>(null);

  // Carica stato iniziale
  useEffect(() => {
    loadStatus();
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

  const handleAssocia = async () => {
    if (!selectedPrestazione || !selectedCallback) return;
    try {
      setLoading(true);
      let paramsString: string | undefined;
      if (selectedCallbackParams) {
        try {
          paramsString = JSON.stringify(selectedCallbackParams);
        } catch (jsonError) {
          throw new Error('I parametri della callback non sono in formato JSON valido.');
        }
      }
      const payload = {
        tipo_prestazione_id: selectedPrestazione.id,
        categoria_prestazione: selectedPrestazione.categoria_id,
        nome_prestazione: selectedPrestazione.nome,
        callback_function: selectedCallback,
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
    try {
      await regoleMonitoraggioApi.deleteRegola(id);
      await loadRegole();
    } catch (e) {
      console.error('Errore delete regola', e);
    }
  };


  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('it-IT');
  };

  const getLogBadgeColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'info';
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
            <CCard className='mb-4'>
              <CCardHeader>
                <h5 className='mb-0'>
                  <CIcon icon={cilCog} className='me-2' />
                  Gestione Regole di Monitoraggio
                </h5>
              </CCardHeader>
              <CCardBody>
                <div className='mb-3'>
                  <label className='form-label'>Seleziona Prestazione da Monitorare</label>
                  <div className='d-flex gap-2'>
                  <PrestazioniSelect
                    value={selectedPrestazione?.id || ''}
                      onChange={prestazioneId => {
                      if (prestazioneId) {
                        // Trova la prestazione selezionata
                          const prestazione = usePrestazioniStore
                            .getState()
                            .getPrestazioneById(prestazioneId);
                        setSelectedPrestazione(prestazione);
                      } else {
                        setSelectedPrestazione(null);
                      }
                    }}
                      placeholder='Seleziona prestazione...'
                      className='flex-grow-1'
                  />
                  </div>
                  {selectedPrestazione && (
                    <div className='mt-2 p-2 bg-light rounded'>
                      <small>
                        <strong>{selectedPrestazione.nome}</strong>
                        <br />
                        <span className='text-muted'>
                          {selectedPrestazione.categoria} - {selectedPrestazione.codice_breve}
                        </span>
                      </small>
                    </div>
                  )}
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol md={3}>
            <CCard className='mb-4'>
              <CCardHeader>
              <h5 className='mb-0'>
                  <CIcon icon={cilList} className='me-2' />
                  Callback da associare alla prestazione
                </h5>
              </CCardHeader>
              <CCardBody>
                {callbacks.length === 0 && preparedCallbacks.length === 0 ? (
                  <div className='text-center'>
                    <p className='text-muted mb-2'>Nessuna callback disponibile</p>
                    <CButton color='primary' size='sm' onClick={() => setShowCreateCallback(true)}>Crea callback</CButton>
                  </div>
                ) : (
                  <div className='mb-3'>
                    <label className='form-label'>Seleziona Callback</label>
                    <CFormSelect
                      value={selectedCallback}
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedCallback(val)
                        // se è una prepared callback, carica i suoi parametri
                        const found = preparedCallbacks.find(p => p.id === val)
                        setSelectedCallbackParams(found ? found.params : null)
                      }}
                    >
                      <option value=''>-- Seleziona callback --</option>
                      {/* Prepared (utente) */}
                      {preparedCallbacks.length > 0 && (
                        <optgroup label='Personalizzate'>
                          {preparedCallbacks.map(cb => (
                            <option key={cb.id} value={cb.id}>{cb.label}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Dal registro */}
                      {callbacks.length > 0 && (
                        <optgroup label='Di sistema'>
                          {callbacks.map(cb => (
                            <option key={cb.id} value={cb.id}>{cb.id}</option>
                          ))}
                        </optgroup>
                      )}
                    </CFormSelect>
                    <div className='mt-2'>
                      <CButton color='secondary' size='sm' variant='outline' onClick={() => setShowCreateCallback(true)}>Crea callback</CButton>
                    </div>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol md={1}>
            <CCard className='mb-4'>
              <CCardHeader>
                <h5 className='mb-0'>Associa</h5>
              </CCardHeader>
              <CCardBody>
                <div className='mb-3'>
                  <CButton 
                    color='primary' 
                    disabled={!selectedPrestazione || !selectedCallback || loading}
                    onClick={handleAssocia}
                  >
                    Associa
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
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
                {regole.length === 0 ? (
                  <div className='text-muted'>Nessuna regola presente</div>
                ) : (
                  <div className='table-responsive'>
                    <table className='table table-sm align-middle'>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Prestazione</th>
                          <th>Callback</th>
                          <th>Attiva</th>
                          <th>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regole.map((r: any) => (
                          <tr key={r.id}>
                            <td>{r.id}</td>
                            <td>{r.nome_prestazione}</td>
                            <td>{r.callback_function}</td>
                            <td>
                              <CButton size='sm' color={r.attiva ? 'warning' : 'success'} onClick={() => handleToggleRegola(r.id)}>
                                {r.attiva ? 'Ferma' : 'Avvia'}
                              </CButton>
                            </td>
                            <td>
                              <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteRegola(r.id)}>
                                Elimina
                              </CButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
          <CButton color='primary' onClick={() => {
            // valida JSON
            let params: any = {}
            try { params = cbUrlParams ? JSON.parse(cbUrlParams) : {} } catch { params = {} }
            const id = `send_sms_link:${cbPageSlug}`
            const label = `send_sms_link (${cbPageSlug})`
            const prepared = { id, label, function: 'send_sms_link', params: { page_slug: cbPageSlug, template_key: cbTemplateKey, sender: cbSender || undefined, url_params: params } }
            setPreparedCallbacks(prev => [...prev, prepared])
            setSelectedCallback(prepared.id)
            setSelectedCallbackParams(prepared.params)
            setShowCreateCallback(false)
              // apri preview
              setShowPreview(true)
              // preview lato server (template + url render)
              regoleMonitoraggioApi.previewSendSmsLink(prepared.params, {
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
        <CCard className='mb-4'>
          <CCardHeader>
            <h5 className='mb-0'>
              <CIcon icon={cilSettings} className='me-2' />
              Impostazioni Monitor
            </h5>
          </CCardHeader>
          <CCardBody>
            <CRow>
              {/* Pulsanti di controllo */}
              <CCol md={8}>
                <div className='d-flex align-items-center gap-2'>
                  {status?.is_running ? (
                    <CButton 
                      color='warning'
                      onClick={handleStopMonitor} 
                      disabled={loading}
                      size='sm'
                    >
                      {loading ? (
                        <CSpinner size='sm' className='me-1' />
                      ) : (
                        <CIcon icon={cilMediaStop} className='me-1' />
                      )}
                      Ferma Monitor
                    </CButton>
                  ) : (
                    <CButton 
                      color='success'
                      onClick={handleStartMonitor} 
                      disabled={loading}
                      size='sm'
                    >
                      {loading ? (
                        <CSpinner size='sm' className='me-1' />
                      ) : (
                        <CIcon icon={cilMediaPlay} className='me-1' />
                      )}
                      Avvia Monitor
                    </CButton>
                  )}
                  {/* Stato e statistiche */}
                  {status?.is_running ? (
                    <CBadge color='success' className='fs-6'>
                      <CIcon icon={cilMediaPlay} className='me-1' />
                      Attivo
                    </CBadge>
                  ) : (
                    <CBadge color='secondary' className='fs-6'>
                      <CIcon icon={cilMediaStop} className='me-1' />
                      Fermato
                    </CBadge>
                  )}
                  {status && (
                    <div className='small text-muted'>
                      <div>
                        Cambiamenti: <strong>{status.total_changes}</strong>
                      </div>
                      {status.last_check && (
                        <div>
                          Ultimo: <strong>{formatTimestamp(status.last_check)}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CCol>

              {/* Toast per messaggi */}
              <CCol md={4}>
                {error && (
                  <CAlert
                    color='danger'
                    className='mb-2'
                    onClose={() => setError(null)}
                    dismissible
                  >
                    {error}
                  </CAlert>
                )}

                {success && (
                  <CAlert
                    color='success'
                    className='mb-2'
                    onClose={() => setSuccess(null)}
                    dismissible
                  >
                    {success}
                  </CAlert>
                )}
              </CCol>
            </CRow>
              </CCardBody>
            </CCard>

        {/* Card Log Monitor */}
            <CCard>
              <CCardHeader>
            <h5 className='mb-0'>
              <CIcon icon={cilList} className='me-2' />
                  Log Monitor
                </h5>
              </CCardHeader>
              <CCardBody>
                <div 
                  style={{ 
                height: '400px',
                    overflowY: 'auto', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '0.375rem',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    fontFamily: 'monospace',
                fontSize: '0.875rem',
                  }}
                >
                  {logs.length === 0 ? (
                <div className='text-center text-muted py-4'>
                      <p>Nessun log disponibile</p>
                      <small>Avvia il monitor per vedere i log in tempo reale</small>
                    </div>
                  ) : (
                    logs.map((log, index) => (
                  <div key={index} className='mb-2'>
                    <div className='d-flex align-items-start'>
                          <CBadge 
                            color={getLogBadgeColor(log.type)} 
                        className='me-2 mt-1'
                            style={{ fontSize: '0.75rem' }}
                          >
                            {log.type.toUpperCase()}
                          </CBadge>
                      <div className='flex-grow-1'>
                        <div className='text-muted small'>{formatTimestamp(log.timestamp)}</div>
                        <div className='mt-1'>{log.message}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CCardBody>
            </CCard>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default MonitorPrestazioniStandalonePage;
