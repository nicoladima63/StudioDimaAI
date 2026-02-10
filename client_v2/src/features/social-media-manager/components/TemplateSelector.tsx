import React, { useState, useEffect } from 'react';
import {
  CFormSelect,
  CFormLabel,
  CButton,
  CCard,
  CCardBody,
  CBadge,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilReload, cilCloudDownload } from '@coreui/icons';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';

interface Template {
  id: number;
  name: string;
  content: string;
  description?: string;
  type: string;
  created_at: string;
  updated_at: string;
}

interface TemplateSelectorProps {
  /**
   * Tipo di template da caricare (default: 'social')
   */
  templateType?: string;

  /**
   * Callback quando un template viene selezionato e applicato
   */
  onTemplateApply: (templateContent: string, templateName: string) => void;

  /**
   * Label personalizzata (default: 'Seleziona Template')
   */
  label?: string;

  /**
   * Mostra pulsante reload (default: true)
   */
  showReload?: boolean;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templateType = 'social',
  onTemplateApply,
  label = 'Seleziona Template',
  showReload = true,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Carica templates filtrati per type
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/sms-templates?type=${templateType}`);

      if (response.data.success) {
        setTemplates(response.data.data || []);
        if (response.data.data.length === 0) {
          toast('Nessun template trovato per questo tipo', { icon: 'ℹ️' });
        }
      } else {
        toast.error(response.data.message || 'Errore nel caricamento dei template');
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast.error(error.response?.data?.message || 'Errore di rete nel caricamento template');
    } finally {
      setLoading(false);
    }
  };

  // Carica templates al mount
  useEffect(() => {
    loadTemplates();
  }, [templateType]);

  // Gestisci selezione template
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value ? Number(e.target.value) : null;
    setSelectedTemplateId(templateId);
  };

  // Applica template selezionato
  const handleApplyTemplate = () => {
    if (!selectedTemplateId) {
      toast.error('Seleziona prima un template');
      return;
    }

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) {
      toast.error('Template non trovato');
      return;
    }

    onTemplateApply(selectedTemplate.content, selectedTemplate.name);
    toast.success(`Template "${selectedTemplate.name}" applicato!`);
  };

  // Template selezionato corrente
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="template-selector">
      <CFormLabel htmlFor="templateSelect">{label}</CFormLabel>

      <div className="d-flex gap-2 mb-3">
        <CFormSelect
          id="templateSelect"
          value={selectedTemplateId || ''}
          onChange={handleSelectChange}
          disabled={loading || templates.length === 0}
          className="flex-grow-1"
        >
          <option value="">-- Seleziona un template --</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} {template.description ? `- ${template.description}` : ''}
            </option>
          ))}
        </CFormSelect>

        {showReload && (
          <CButton
            color="secondary"
            variant="outline"
            onClick={loadTemplates}
            disabled={loading}
            title="Ricarica template"
          >
            {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
          </CButton>
        )}

        <CButton
          color="primary"
          onClick={handleApplyTemplate}
          disabled={!selectedTemplateId || loading}
        >
          <CIcon icon={cilCloudDownload} className="me-1" />
          Applica
        </CButton>
      </div>

      {/* Anteprima template selezionato */}
      {selectedTemplate && (
        <CCard className="mb-3">
          <CCardBody>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <h6 className="mb-0">{selectedTemplate.name}</h6>
              <CBadge color="info">{selectedTemplate.type}</CBadge>
            </div>

            {selectedTemplate.description && (
              <p className="text-muted small mb-2">{selectedTemplate.description}</p>
            )}

            <div className="border rounded p-2 bg-light">
              <strong>Anteprima:</strong>
              <pre className="mb-0 mt-1" style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {selectedTemplate.content}
              </pre>
            </div>

            {/* Estrai e mostra variabili disponibili */}
            {extractVariables(selectedTemplate.content).length > 0 && (
              <div className="mt-2">
                <small className="text-muted">
                  <strong>Variabili:</strong>{' '}
                  {extractVariables(selectedTemplate.content).map((variable, idx) => (
                    <CBadge key={idx} color="secondary" className="me-1">
                      {variable}
                    </CBadge>
                  ))}
                </small>
              </div>
            )}
          </CCardBody>
        </CCard>
      )}

      {/* Info quando non ci sono templates */}
      {!loading && templates.length === 0 && (
        <p className="text-muted small">
          Nessun template di tipo "{templateType}" disponibile.
          Crea il primo template dalla sezione Impostazioni.
        </p>
      )}
    </div>
  );
};

/**
 * Estrae variabili dal contenuto template (formato {variabile})
 */
function extractVariables(content: string): string[] {
  const regex = /\{(\w+)\}/g;
  const matches = content.matchAll(regex);
  const variables = Array.from(matches, m => `{${m[1]}}`);
  return [...new Set(variables)]; // Rimuovi duplicati
}

export default TemplateSelector;
