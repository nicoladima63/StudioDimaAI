import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormInput,
  CFormTextarea,
  CFormLabel,
  CFormSelect,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CTabContent,
  CTabPane,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPencil, cilTrash, cilReload, cilWarning } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import apiClient from '@/services/api/client';
import SmsSettingsCard from '../components/SmsSettingsCard';
import { marketingService, type MarketingTemplate } from '@/features/pazienti/services/marketing.service';

interface SmsTemplate {
  id: number;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

const PLACEHOLDERS = [
  '{nome_completo}',
  '{url}',
  '{data_appuntamento}',
  '{ora_appuntamento}',
  '{tipo_richiamo}',
  '{medico}',
  '{tempo_richiamo}',
];

const TemplatesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sms' | 'marketing'>('sms');

  // ── SMS templates ──────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stato per il modal di creazione/modifica
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<SmsTemplate>>({});

  // Stato per l'anteprima
  const [previewData, setPreviewData] = useState<any>({
    nome_completo: "Mario Rossi",
    url: "https://studiodimartino.eu",
    data_appuntamento: "10/10/2025",
    ora_appuntamento: "15:00",
    tipo_richiamo: "controllo",
    medico: "Dr. Bianchi",
    ora: "15:00", // Aggiunto per compatibilità con vecchi template
    tempo_richiamo: "6 mesi"
  });
  const [previewResult, setPreviewResult] = useState<any>(null);

  // Ref al textarea del contenuto per inserire il segnaposto alla posizione del cursore
  const templateContentRef = useRef<HTMLTextAreaElement | null>(null);

  const insertPlaceholder = (placeholder: string) => {
    const textarea = templateContentRef.current;
    const content = currentTemplate.content || '';

    if (!textarea || textarea.selectionStart === null || textarea.selectionEnd === null) {
      // Fallback: aggiungi in coda
      setCurrentTemplate(prev => ({ ...prev, content: (prev.content || '') + placeholder }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const next = before + placeholder + after;

    setCurrentTemplate(prev => ({ ...prev, content: next }));

    // Riposiziona il cursore subito dopo il segnaposto inserito
    requestAnimationFrame(() => {
      try {
        const pos = start + placeholder.length;
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
      } catch {
        // ignora eventuali errori di timing del ref
      }
    });
  };

  const handlePreviewTemplate = async () => {
    setLoading(true);
    setError(null);
    setPreviewResult(null);
    try {
      const payload = {
        name: currentTemplate.name, // Se è un template esistente
        custom_content: currentTemplate.content, // Contenuto attuale nella modal
        preview_data: previewData, // Dati di esempio
      };
      const response = await apiClient.post(`${API_BASE_URL}/preview`, payload);
      if (response.data.success) {
        setPreviewResult(response.data);
      } else {
        setError(response.data.message || 'Errore nella generazione dell\'anteprima.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Errore di rete nella generazione dell\'anteprima.');
    } finally {
      setLoading(false);
    }
  };


  // Stato per il modal di conferma eliminazione
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SmsTemplate | null>(null);

  const API_BASE_URL = '/sms-templates'; // Corrisponde a /api/v2/templates/sms

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(API_BASE_URL);
      if (response.data.success) {
        setTemplates(response.data.data);
      } else {
        setError(response.data.message || 'Errore nel caricamento dei template.');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di rete nel caricamento dei template.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateEditClick = (template?: SmsTemplate) => {
    setIsEditing(!!template);
    setCurrentTemplate(template || {});
    setShowModal(true);
  };

  const handleSaveTemplate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let response;
      if (isEditing && currentTemplate.name) {
        response = await apiClient.put(`${API_BASE_URL}/${currentTemplate.name}`, currentTemplate);
      } else {
        response = await apiClient.post(API_BASE_URL, currentTemplate);
      }

      if (response.data.success) {
        setSuccess(response.data.message);
        setShowModal(false);
        loadTemplates();
      } else {
        setError(response.data.message || 'Errore nel salvataggio del template.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Errore di rete nel salvataggio.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (template: SmsTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete?.name) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiClient.delete(`${API_BASE_URL}/${templateToDelete.name}`);
      if (response.data.success) {
        setSuccess(response.data.message);
        setShowDeleteModal(false);
        setTemplateToDelete(null);
        loadTemplates();
      } else {
        setError(response.data.message || 'Errore nell\'eliminazione del template.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Errore di rete nell\'eliminazione.');
    } finally {
      setLoading(false);
    }
  };

  // ── Marketing templates ────────────────────────────────────────────────
  const [mktTemplates, setMktTemplates] = useState<MarketingTemplate[]>([]);
  const [mktLoading, setMktLoading] = useState(false);
  const [mktError, setMktError] = useState<string | null>(null);
  const [mktSuccess, setMktSuccess] = useState<string | null>(null);
  const [mktShowModal, setMktShowModal] = useState(false);
  const [mktEditing, setMktEditing] = useState(false);
  const [mktCurrent, setMktCurrent] = useState<Partial<MarketingTemplate>>({});
  const [mktDeleteTarget, setMktDeleteTarget] = useState<MarketingTemplate | null>(null);

  const loadMktTemplates = useCallback(async () => {
    setMktLoading(true);
    setMktError(null);
    try {
      const data = await marketingService.apiGetTemplates();
      setMktTemplates(data);
    } catch {
      setMktError('Errore caricamento template marketing');
    } finally {
      setMktLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'marketing') loadMktTemplates();
  }, [activeTab, loadMktTemplates]);

  const handleMktSave = async () => {
    setMktLoading(true);
    setMktError(null);
    setMktSuccess(null);
    try {
      if (mktEditing && mktCurrent.id) {
        await marketingService.apiUpdateTemplate(mktCurrent.id, mktCurrent);
      } else {
        await marketingService.apiCreateTemplate({
          nome: mktCurrent.nome || '',
          testo: mktCurrent.testo || '',
          note: mktCurrent.note || '',
          canale: mktCurrent.canale || 'whatsapp',
        });
      }
      setMktSuccess(mktEditing ? 'Template aggiornato' : 'Template creato');
      setMktShowModal(false);
      loadMktTemplates();
    } catch {
      setMktError('Errore salvataggio template');
    } finally {
      setMktLoading(false);
    }
  };

  const handleMktDelete = async () => {
    if (!mktDeleteTarget) return;
    setMktLoading(true);
    try {
      await marketingService.apiDeleteTemplate(mktDeleteTarget.id);
      setMktSuccess('Template eliminato');
      setMktDeleteTarget(null);
      loadMktTemplates();
    } catch {
      setMktError('Errore eliminazione template');
    } finally {
      setMktLoading(false);
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header
        title='Gestione Template'
        headerAction={
          <div className='d-flex gap-2'>
            {activeTab === 'sms' && (
              <>
                <CButton color='primary' onClick={() => handleCreateEditClick()} disabled={loading}>
                  <CIcon icon={cilPlus} className='me-1' />Nuovo Template SMS
                </CButton>
                <CButton color='info' onClick={loadTemplates} disabled={loading}>
                  <CIcon icon={cilReload} className='me-1' />Aggiorna
                </CButton>
              </>
            )}
            {activeTab === 'marketing' && (
              <>
                <CButton color='primary' onClick={() => { setMktEditing(false); setMktCurrent({ canale: 'whatsapp' }); setMktShowModal(true); }} disabled={mktLoading}>
                  <CIcon icon={cilPlus} className='me-1' />Nuovo Template Marketing
                </CButton>
                <CButton color='info' onClick={loadMktTemplates} disabled={mktLoading}>
                  <CIcon icon={cilReload} className='me-1' />Aggiorna
                </CButton>
              </>
            )}
          </div>
        }
      />

      <PageLayout.ContentBody>
        <CNav variant='tabs' className='mb-3'>
          <CNavItem>
            <CNavLink active={activeTab === 'sms'} onClick={() => setActiveTab('sms')} style={{ cursor: 'pointer' }}>
              Template SMS Reminder
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} style={{ cursor: 'pointer' }}>
              Template Marketing WhatsApp
            </CNavLink>
          </CNavItem>
        </CNav>

        <CTabContent>
        <CTabPane visible={activeTab === 'sms'}>
        {error && <CBadge color='danger' className='mb-3 p-2'>{error}</CBadge>}
        {success && <CBadge color='success' className='mb-3 p-2'>{success}</CBadge>}

        <SmsSettingsCard />

        <CCard className='mb-4'>
          <CCardHeader>
            <h5 className='mb-0'>Lista Template SMS</h5>
          </CCardHeader>
          <CCardBody>
            {loading && <p>Caricamento template...</p>}
            {!loading && templates.length === 0 && <p>Nessun template SMS trovato.</p>}
            {!loading && templates.length > 0 && (
              <CTable hover responsive striped>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Nome</CTableHeaderCell>
                    <CTableHeaderCell>Contenuto</CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {templates.map((template) => (
                    <CTableRow key={template.id}>
                      <CTableDataCell>{template.name}</CTableDataCell>
                      <CTableDataCell className='text-truncate' style={{ maxWidth: '300px' }}>{template.content}</CTableDataCell>
                      <CTableDataCell>{template.description || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <CButton color='info' size='sm' className='me-2' onClick={() => handleCreateEditClick(template)}>
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton color='danger' size='sm' onClick={() => handleDeleteClick(template)}>
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
        </CTabPane>

        {/* ── Tab Marketing ── */}
        <CTabPane visible={activeTab === 'marketing'}>
          {mktError && <CBadge color='danger' className='mb-3 p-2'>{mktError}</CBadge>}
          {mktSuccess && <CBadge color='success' className='mb-3 p-2'>{mktSuccess}</CBadge>}
          <CCard>
            <CCardHeader><h5 className='mb-0'>Template Marketing WhatsApp</h5></CCardHeader>
            <CCardBody>
              {mktLoading && <p>Caricamento...</p>}
              {!mktLoading && mktTemplates.length === 0 && <p>Nessun template marketing. Creane uno con il pulsante in alto.</p>}
              {!mktLoading && mktTemplates.length > 0 && (
                <CTable hover responsive striped>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Nome</CTableHeaderCell>
                      <CTableHeaderCell>Testo</CTableHeaderCell>
                      <CTableHeaderCell>Note</CTableHeaderCell>
                      <CTableHeaderCell>Azioni</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {mktTemplates.map((t) => (
                      <CTableRow key={t.id}>
                        <CTableDataCell>{t.nome}</CTableDataCell>
                        <CTableDataCell className='text-truncate' style={{ maxWidth: 320 }}>{t.testo}</CTableDataCell>
                        <CTableDataCell>{t.note || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CButton color='info' size='sm' className='me-2' onClick={() => { setMktEditing(true); setMktCurrent(t); setMktShowModal(true); }}>
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton color='danger' size='sm' onClick={() => setMktDeleteTarget(t)}>
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
          <p className='text-muted small mt-2'>
            Variabili disponibili nel testo: <code>{'{nome}'}</code> (primo nome del paziente)
          </p>
        </CTabPane>
        </CTabContent>

      </PageLayout.ContentBody>

      {/* Modal Creazione/Modifica Template Marketing */}
      <CModal visible={mktShowModal} onClose={() => setMktShowModal(false)} backdrop='static' size='lg'>
        <CModalHeader>{mktEditing ? 'Modifica Template Marketing' : 'Nuovo Template Marketing'}</CModalHeader>
        <CModalBody>
          <CRow className='mb-3'>
            <CCol>
              <CFormLabel>Nome template</CFormLabel>
              <CFormInput value={mktCurrent.nome || ''} onChange={(e) => setMktCurrent({ ...mktCurrent, nome: e.target.value })} placeholder='Es. 8 Marzo - Festa della donna' />
            </CCol>
          </CRow>
          <CRow className='mb-3'>
            <CCol>
              <CFormLabel>Testo messaggio <small className='text-muted'>({'{nome}'} = nome paziente)</small></CFormLabel>
              <CFormTextarea rows={6} value={mktCurrent.testo || ''} onChange={(e) => setMktCurrent({ ...mktCurrent, testo: e.target.value })} placeholder='Ciao {nome}, in occasione dell&apos;8 marzo...' />
              <small className='text-muted'>{(mktCurrent.testo || '').length} caratteri</small>
            </CCol>
          </CRow>
          <CRow className='mb-3'>
            <CCol md={6}>
              <CFormLabel>Note interne</CFormLabel>
              <CFormInput value={mktCurrent.note || ''} onChange={(e) => setMktCurrent({ ...mktCurrent, note: e.target.value })} placeholder='Uso previsto, target...' />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Canale</CFormLabel>
              <CFormSelect value={mktCurrent.canale || 'whatsapp'} onChange={(e) => setMktCurrent({ ...mktCurrent, canale: e.target.value })}>
                <option value='whatsapp'>WhatsApp</option>
              </CFormSelect>
            </CCol>
          </CRow>
          {mktCurrent.testo && (
            <div className='p-3 rounded bg-body-tertiary text-body border border-secondary-subtle'>
              <small className='text-body-secondary fw-semibold d-block mb-1'>Anteprima</small>
              <span style={{ whiteSpace: 'pre-wrap' }}>{(mktCurrent.testo || '').replace('{nome}', 'Mario')}</span>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setMktShowModal(false)} disabled={mktLoading}>Annulla</CButton>
          <CButton color='primary' onClick={handleMktSave} disabled={mktLoading || !mktCurrent.nome || !mktCurrent.testo}>
            {mktEditing ? 'Salva modifiche' : 'Crea template'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Conferma eliminazione template marketing */}
      <CModal visible={!!mktDeleteTarget} onClose={() => setMktDeleteTarget(null)} backdrop='static'>
        <CModalHeader>Conferma eliminazione</CModalHeader>
        <CModalBody>Eliminare il template <strong>{mktDeleteTarget?.nome}</strong>?</CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setMktDeleteTarget(null)}>Annulla</CButton>
          <CButton color='danger' onClick={handleMktDelete} disabled={mktLoading}>
            <CIcon icon={cilTrash} className='me-1' />Elimina
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal Creazione/Modifica Template SMS */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} backdrop='static' size='xl'>
        <CModalHeader>Modifica Template SMS</CModalHeader>
        <CModalBody>
          <CRow> {/* Contenitore principale a due colonne */}
            <CCol md={6}> {/* Colonna sinistra: Campi di compilazione */}
              <CRow className='mb-3'>
                <CCol>
                  <CFormLabel htmlFor='templateName'>Nome Template</CFormLabel>
                  <CFormInput
                    id='templateName'
                    value={currentTemplate.name || ''}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                    disabled={isEditing} // Non si può modificare il nome di un template esistente
                  />
                </CCol>
              </CRow>
              <CRow className='mb-3'>
                <CCol>
                  <CFormLabel htmlFor='templateContent'>Contenuto Template</CFormLabel>
                  <CFormTextarea
                    id='templateContent'
                    value={currentTemplate.content || ''}
                    ref={templateContentRef}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, content: e.target.value })}
                    rows={5}
                  ></CFormTextarea>
                </CCol>
              </CRow>
              <CRow className='mb-3'>
                <CCol>
                  <CFormLabel htmlFor='templateDescription'>Descrizione</CFormLabel>
                  <CFormInput
                    id='templateDescription'
                    value={currentTemplate.description || ''}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                  />
                </CCol>
              </CRow>
            </CCol> {/* Fine Colonna sinistra */}

            <CCol md={6}> {/* Colonna destra: Anteprima e Placeholder */}
              <h6>Anteprima Messaggio SMS</h6>
              <CFormTextarea
                id='previewData'
                value={JSON.stringify(previewData, null, 2)}
                onChange={(e) => {
                  try {
                    setPreviewData(JSON.parse(e.target.value));
                  } catch {
                    // Ignora errori di parsing JSON temporanei
                  }
                }}
                rows={4}
                placeholder={`Inserisci dati di esempio JSON per l'anteprima (es: {"nome_completo": "Mario Rossi", "url": "https://link.it"})`}
              ></CFormTextarea>
              <CButton color="info" size="sm" className="mt-2" onClick={handlePreviewTemplate} disabled={loading}>
                <CIcon icon={cilReload} className='me-1' /> Genera Anteprima
              </CButton>

              {previewResult && (
                <CCard className='mt-3'>
                  <CCardBody>
                    <p className='mb-1'><strong>Messaggio Renderizzato:</strong></p>
                    <pre className='border p-2 rounded bg-light' style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                      {previewResult.message}
                    </pre>
                    <p className='mb-1 mt-2'><strong>Caratteri:</strong> {previewResult.length}</p>
                    <p className='mb-0'><strong>Parti SMS stimate:</strong> {previewResult.estimated_sms_parts}</p>
                  </CCardBody>
                </CCard>
              )}

              <h6 className='mt-4'>Inserisci Segnaposto</h6>
              <div className='d-flex flex-wrap gap-2'>
                {PLACEHOLDERS.map((placeholder) => (
                  <CButton
                    key={placeholder}
                    color='secondary'
                    variant='outline'
                    size='sm'
                    onClick={() => insertPlaceholder(placeholder)}
                  >
                    {placeholder}
                  </CButton>
                ))}
              </div>
            </CCol> {/* Fine Colonna destra */}
          </CRow> {/* Fine Contenitore principale */}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setShowModal(false)} disabled={loading}>Annulla</CButton>
          <CButton color='primary' onClick={handleSaveTemplate} disabled={loading}>
            {isEditing ? 'Salva Modifiche' : 'Crea Template'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal Conferma Eliminazione */}
      <CModal visible={showDeleteModal} onClose={() => setShowModal(false)} backdrop='static'>
        <CModalHeader>Conferma Eliminazione</CModalHeader>
        <CModalBody>
          <p>Sei sicuro di voler eliminare il template SMS "{templateToDelete?.name}"?</p>
          <p className='text-danger'><CIcon icon={cilWarning} className='me-1' /> Attenzione: Se il template è in uso da regole di automazione, l\'eliminazione verrà bloccata.</p>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={() => setShowModal(false)} disabled={loading}>Annulla</CButton>
          <CButton color='danger' onClick={confirmDeleteTemplate} disabled={loading}>
            <CIcon icon={cilTrash} className='me-1' /> Elimina
          </CButton>
        </CModalFooter>
      </CModal>
    </PageLayout>
  );
};

export default TemplatesPage;
