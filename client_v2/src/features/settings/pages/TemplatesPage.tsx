import React, { useState, useEffect, useCallback } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormInput,
  CFormTextarea,
  CFormLabel,
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
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPencil, cilTrash, cilReload, cilWarning } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import apiClient from '@/services/api/client'; // Assuming apiClient is configured for /api/v2

interface SmsTemplate {
  id: number;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

const TemplatesPage: React.FC = () => { // Renamed component to TemplatesPage
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
    url: "https://link.it/esempio",
    data_appuntamento: "10/10/2025",
    ora_appuntamento: "15:00",
    tipo_richiamo: "controllo",
    medico: "Dr. Bianchi",
    ora: "15:00" // Aggiunto per compatibilità con vecchi template
  });
  const [previewResult, setPreviewResult] = useState<any>(null);

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

  return (
    <PageLayout>
      <PageLayout.Header
        title='Gestione Template SMS'
        headerAction={
          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={() => handleCreateEditClick()} disabled={loading}>
              <CIcon icon={cilPlus} className='me-1' />
              Nuovo Template
            </CButton>
            <CButton color='info' onClick={loadTemplates} disabled={loading}>
              <CIcon icon={cilReload} className='me-1' />
              Aggiorna Lista
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentBody>
        {error && <CBadge color='danger' className='mb-3 p-2'>{error}</CBadge>}
        {success && <CBadge color='success' className='mb-3 p-2'>{success}</CBadge>}

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
      </PageLayout.ContentBody>

      {/* Modal Creazione/Modifica Template */}
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
                    <p className='border p-2 rounded bg-light'>{previewResult.message}</p>
                    <p className='mb-1'><strong>Caratteri:</strong> {previewResult.length}</p>
                    <p className='mb-0'><strong>Parti SMS stimate:</strong> {previewResult.estimated_sms_parts}</p>
                  </CCardBody>
                </CCard>
              )}

              <h6 className='mt-4'>Placeholder Suggeriti</h6>
              <p className='small text-muted'>
                <code>{'{nome_completo}'}</code>, <code>{'{url}'}</code>, <code>{'{data_appuntamento}'}</code>, <code>{'{ora_appuntamento}'}</code>, <code>{'{tipo_richiamo}'}</code>, <code>{'{medico}'}</code>, ecc.
              </p>
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
