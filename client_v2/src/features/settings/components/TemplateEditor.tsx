import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormTextarea,
  CButton,
  CSpinner,
  CBadge,
  CAlert,
  CRow,
  CCol,
  CFormLabel,
  CListGroup,
  CListGroupItem,
  CToast,
  CToastBody,
  CToaster
} from '@coreui/react';
import templatesService, { 
  type Template, 
  type TemplateValidation,
  type TemplatePreviewResult 
} from '../services/templates.service';

interface TemplateEditorProps {
  tipo: 'richiamo' | 'promemoria';
  title: string;
  defaultVariables: string[];
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ 
  tipo, 
  title, 
  defaultVariables 
}) => {
  // State management
  const [template, setTemplate] = useState<Template | null>(null);
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState('');
  const [validation, setValidation] = useState<TemplateValidation | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  
  // UI states
  const [hasChanges, setHasChanges] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');

  // Load template on mount
  useEffect(() => {
    loadTemplate();
  }, [tipo]);

  // Track changes
  useEffect(() => {
    if (template) {
      setHasChanges(
        content !== template.content || 
        description !== template.description
      );
    }
  }, [content, description, template]);

  // Auto-preview on content change
  useEffect(() => {
    if (content && content.length > 0) {
      const timeoutId = setTimeout(() => {
        generatePreview();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [content]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const result = await templatesService.apiGetTemplate(tipo);
      
      if (result.success && result.data) {
        const templateData = result.data.template;
        setTemplate(templateData);
        setContent(templateData.content);
        setDescription(templateData.description || '');
      } else {
        showToastMessage(result.error || 'Errore caricamento template', 'danger');
      }
    } catch (error) {
      console.error('Errore caricamento template:', error);
      showToastMessage('Errore caricamento template', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      const result = await templatesService.apiUpdateTemplate(tipo, content, description);
      
      if (result.success && result.data) {
        setTemplate(result.data.template);
        setValidation(result.data.validation);
        setHasChanges(false);
        
        const state = result.state || 'success';
        if (state === 'warning') {
          showToastMessage('Template salvato con avvisi', 'warning');
        } else {
          showToastMessage('Template salvato con successo!', 'success');
        }
      } else {
        showToastMessage(result.error || 'Errore salvataggio template', 'danger');
      }
    } catch (error) {
      console.error('Errore salvataggio template:', error);
      showToastMessage('Errore salvataggio template', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = async () => {
    if (!confirm('Sei sicuro di voler ripristinare il template ai valori di default?')) {
      return;
    }

    try {
      setSaving(true);
      const result = await templatesService.apiResetTemplate(tipo);
      
      if (result.success && result.data) {
        const resetTemplate = result.data.template;
        setTemplate(resetTemplate);
        setContent(resetTemplate.content);
        setDescription(resetTemplate.description || '');
        setHasChanges(false);
        showToastMessage('Template ripristinato ai valori di default', 'success');
      } else {
        showToastMessage(result.error || 'Errore ripristino template', 'danger');
      }
    } catch (error) {
      console.error('Errore reset template:', error);
      showToastMessage('Errore ripristino template', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const generatePreview = async () => {
    try {
      setPreviewing(true);
      const result = await templatesService.apiPreviewTemplate(tipo, content);
      
      if (result.success && result.data) {
        setPreview(result.data.preview || ''); // Accedi direttamente a preview
        setValidation(result.data.validation || null); // Accedi direttamente a validation
      }
    } catch (error) {
      console.error('Errore generazione preview:', error);
    } finally {
      setPreviewing(false);
    }
  };

  const showToastMessage = (message: string, color: 'success' | 'danger' | 'warning') => {
    setToastMessage(message);
    setToastColor(color);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById(`template-content-${tipo}`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + `{${variable}}` + content.substring(end);
      setContent(newContent);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
      }, 0);
    }
  };

  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center py-4">
          <CSpinner color="primary" />
          <p className="mt-2">Caricamento template...</p>
        </CCardBody>
      </CCard>
    );
  }

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{title}</h5>
          <div className="d-flex gap-2">
            <CButton
              color="secondary"
              size="sm"
              disabled={saving}
              onClick={resetTemplate}
            >
              Reset Default
            </CButton>
            <CButton
              color="primary"
              size="sm"
              disabled={!hasChanges || saving}
              onClick={saveTemplate}
            >
              {saving ? <CSpinner size="sm" /> : 'Salva'}
            </CButton>
          </div>
        </div>
      </CCardHeader>

      <CCardBody>
        <CRow>
          {/* Editor Column */}
          <CCol md={8}>
            <div className="mb-3">
              <CFormLabel htmlFor={`template-content-${tipo}`}>
                Contenuto Template
              </CFormLabel>
              <CFormTextarea
                id={`template-content-${tipo}`}
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Inserisci il contenuto del template..."
              />
              
              {/* Stats */}
              <div className="mt-2 d-flex gap-3">
                <small className="text-muted">
                  Lunghezza: {content.length} caratteri
                </small>
                {content.length > 160 && (
                  <small className="text-warning">
                    SMS multipli: ~{Math.ceil(content.length / 160)} parti
                  </small>
                )}
              </div>
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor={`template-description-${tipo}`}>
                Descrizione
              </CFormLabel>
              <CFormTextarea
                id={`template-description-${tipo}`}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione del template..."
              />
            </div>

            {/* Validation Alerts */}
            {validation && (
              <div className="mb-3">
                {validation.warnings && validation.warnings.length > 0 && (
                  <CAlert color="warning">
                    <strong>Attenzione:</strong>
                    <ul className="mb-0 mt-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </CAlert>
                )}
                
                {validation.errors && validation.errors.length > 0 && (
                  <CAlert color="danger">
                    <strong>Errori:</strong>
                    <ul className="mb-0 mt-1">
                      {validation.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </CAlert>
                )}
              </div>
            )}
          </CCol>

          {/* Sidebar Column */}
          <CCol md={4}>
            {/* Variables */}
            <div className="mb-4">
              <h6>Variabili Disponibili</h6>
              <CListGroup flush>
                {defaultVariables.map((variable) => (
                  <CListGroupItem
                    key={variable}
                    as="button"
                    onClick={() => insertVariable(variable)}
                    className="d-flex justify-content-between align-items-center py-2"
                  >
                    <code>{`{${variable}}`}</code>
                    <CButton size="sm" color="outline-primary">
                      Inserisci
                    </CButton>
                  </CListGroupItem>
                ))}
              </CListGroup>
            </div>

            {/* Preview */}
            <div>
              <h6 className="d-flex align-items-center gap-2">
                Anteprima
                {previewing && <CSpinner size="sm" />}
              </h6>
              <CCard color="light">
                <CCardBody>
                  <small>qui il messaggio</small>
                  {preview ? (
                    <div className="small">
                      <div className="mb-2">
                        <CBadge color="info">
                          📱 {preview.length} caratteri
                        </CBadge>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {preview}
                      </div>
                    </div>
                  ) : (
                    <small className="text-muted">
                      L'anteprima apparirà qui mentre scrivi...
                    </small>
                  )}
                </CCardBody>
              </CCard>
            </div>
          </CCol>
        </CRow>
      </CCardBody>

      {/* Toast Notifications */}
      <CToaster placement="top-end">
        {showToast && (
          <CToast autohide visible color={toastColor}>
            <CToastBody>{toastMessage}</CToastBody>
          </CToast>
        )}
      </CToaster>
    </CCard>
  );
};

export default TemplateEditor;