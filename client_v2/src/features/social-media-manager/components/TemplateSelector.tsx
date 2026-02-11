import React, { useState, useEffect } from 'react';
import {
  CFormSelect,
  CButton,
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
   * ID categoria per filtrare i template (opzionale)
   * Se fornito, mostra solo template della categoria + template generici
   */
  categoryId?: number | null;

  /**
   * Callback quando un template viene selezionato e applicato
   */
  onTemplateApply: (templateContent: string, templateName: string) => void;

  /**
   * Mostra pulsante reload (default: false)
   */
  showReload?: boolean;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templateType = 'social',
  categoryId,
  onTemplateApply,
  showReload = false,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Carica templates filtrati per type e category_id
  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({ type: templateType });
      if (categoryId !== null && categoryId !== undefined) {
        params.append('category_id', categoryId.toString());
      }

      const response = await apiClient.get(`/sms-templates?${params.toString()}`);

      if (response.data.success) {
        setTemplates(response.data.data || []);
        if (response.data.data.length === 0) {
          toast('Nessun template trovato per questa categoria', { icon: 'ℹ️' });
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

  // Carica templates al mount e quando cambia category_id
  useEffect(() => {
    loadTemplates();
  }, [templateType, categoryId]);

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

  return (
    <div className="d-flex gap-2">
      <CFormSelect
        id="templateSelect"
        value={selectedTemplateId || ''}
        onChange={handleSelectChange}
        disabled={loading || templates.length === 0}
        className="flex-grow-1"
      >
        <option value="">-- seleziona --</option>
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
        Applica
      </CButton>

      {/* Info quando non ci sono templates */}
      {!loading && templates.length === 0 && (
        <p className="text-muted small position-absolute" style={{ top: '100%', marginTop: '4px' }}>
          Nessun template di tipo "{templateType}" disponibile.
        </p>
      )}
    </div>
  );
};

export default TemplateSelector;
