import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CFormSelect,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CFormInput,
  CFormTextarea
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilSettings } from '@coreui/icons';
import { Action, ActionParameter } from '@/features/settings/services/automation.service';
import templatesService, { SmsTemplate } from '@/features/settings/services/templates.service';
import worksService, { Work } from '@/services/api/works.service';
import toast from 'react-hot-toast';
interface CallbackCardProps {
  actions: Action[];
  selectedActionId: number | null;
  onActionChange: (value: number | null) => void;
  onParamsChange: (params: any) => void;
  initialParams: any;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  onDirectSave?: (params: any) => Promise<void>; // Callback opzionale per salvare direttamente in edit mode
}

const CallbackCard: React.FC<CallbackCardProps> = ({
  actions,
  selectedActionId,
  onActionChange,
  onParamsChange,
  initialParams,
  isModalOpen,
  setIsModalOpen,
  onDirectSave,
}) => {
  const [currentParams, setCurrentParams] = useState<Record<string, any>>(initialParams || {});
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSmsTemplates = async () => {
      try {
        const templates = await templatesService.getSmsTemplates();
        setSmsTemplates(templates);
      } catch (error) {
        console.error("Failed to fetch SMS templates", error);
      }
    };
    fetchSmsTemplates();

    const fetchWorks = async () => {
      try {
        const data = await worksService.apiGetAll();
        setWorks(data || []);
      } catch (error) {
        console.error("Failed to fetch works", error);
        toast.error('Errore caricamento work templates');
      }
    };
    fetchWorks();
  }, []);

  // Sincronizza i parametri quando si apre il modale o cambiano gli input dal parent
  useEffect(() => {
    if (isModalOpen) {
      setCurrentParams(initialParams || {});
    }
  }, [isModalOpen, initialParams, selectedActionId]);

  const selectedAction = actions.find(action => action.id === selectedActionId);
  const requiresParams = !!(selectedAction?.parameters?.length);

  const handleOpenModal = () => {
    setCurrentParams(initialParams || {});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    // Se esiste onDirectSave (modalità edit), salva direttamente al DB
    if (onDirectSave) {
      try {
        setSaving(true);
        await onDirectSave(currentParams);
        setIsModalOpen(false);
      } catch (error) {
        // L'errore viene gestito dal parent
        console.error('Error saving params:', error);
      } finally {
        setSaving(false);
      }
    } else {
      // Altrimenti, aggiorna solo lo stato locale (modalità create)
      onParamsChange(currentParams);
      setIsModalOpen(false);
    }
  };

  const handleParamChange = (field: string, value: any) => {
    setCurrentParams(prev => ({ ...prev, [field]: value }));
  };

  const renderParamInput = (param: ActionParameter) => {
    const paramValue = currentParams[param.name];

    // Eccezione speciale per 'template_id' per mostrare una dropdown di template SMS.
    if (param.name === 'template_id') {
      return (
        <div className='mb-3' key={param.name}>
          <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
          <CFormSelect
            id={param.name}
            value={paramValue ?? ''}
            onChange={(e) => handleParamChange(param.name, e.target.value === '' ? null : Number(e.target.value))}
            required={param.required}
          >
            <option value=''>-- Seleziona template --</option>
            {smsTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.description})
              </option>
            ))}
          </CFormSelect>
        </div>
      );
    }

    // Eccezione speciale per 'work_id' per mostrare una dropdown di work templates.
    if (param.name === 'work_id') {
      return (
        <div className='mb-3' key={param.name}>
          <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
          <CFormSelect
            id={param.name}
            value={paramValue ?? ''}
            onChange={(e) => handleParamChange(param.name, e.target.value === '' ? null : Number(e.target.value))}
            required={param.required}
          >
            <option value=''>-- Seleziona work template --</option>
            {works.map(work => (
              <option key={work.id} value={work.id}>
                {work.name}
              </option>
            ))}
          </CFormSelect>
        </div>
      );
    }

    // Logica generica basata sul TIPO del parametro
    switch (param.type) {
      case 'json':
        return (
          <div className='mb-3' key={param.name}>
            <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
            <CFormTextarea
              rows={5}
              id={param.name}
              value={paramValue ? JSON.stringify(paramValue, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                  handleParamChange(param.name, parsed);
                } catch (jsonError) {
                  // Non fare nulla mentre l'utente sta scrivendo JSON non valido
                }
              }}
              placeholder={param.placeholder || 'Inserisci un oggetto JSON valido'}
            />
            {/* description non presente nel tipo ActionParameter */}
          </div>
        );

      case 'number':
        return (
          <div className='mb-3' key={param.name}>
            <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
            <CFormInput
              type='number'
              id={param.name}
              value={paramValue ?? ''}
              onChange={(e) => handleParamChange(param.name, e.target.value === '' ? null : Number(e.target.value))}
              placeholder={param.placeholder}
              required={param.required}
            />
            {/* description non presente nel tipo ActionParameter */}
          </div>
        );

      case 'string':
      default:
        return (
          <div className='mb-3' key={param.name}>
            <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
            <CFormInput
              type='text'
              id={param.name}
              value={paramValue || ''}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
              placeholder={param.placeholder}
              required={param.required}
            />
            {/* description non presente nel tipo ActionParameter */}
          </div>
        );
    }
  };

  return (
    <>
      <CCard className='mb-4'>
        <CCardHeader>
          <h5 className='mb-0'>
            <CIcon icon={cilList} className='me-2' />
            Azione da associare callbackcard
          </h5>
        </CCardHeader>
        <CCardBody>
          {actions.length === 0 ? (
            <p className='text-muted'>Nessuna azione disponibile</p>
          ) : (
            <>
              <div className='mb-3'>
                <CFormLabel>Seleziona Azione</CFormLabel>
                <CFormSelect
                  value={selectedActionId || ''}
                  onChange={(e) => onActionChange(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value=''>-- Seleziona azione --</option>
                  {actions.map(action => (
                    <option key={action.id} value={action.id}>{action.name}</option>
                  ))}
                </CFormSelect>
              </div>
              {selectedActionId && requiresParams && (
                <div className='mt-2'>
                  <CButton color='info' size='sm' variant='outline' onClick={handleOpenModal}>
                    <CIcon icon={cilSettings} className='me-1' />
                    Configura Parametri
                  </CButton>
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={isModalOpen} onClose={() => setIsModalOpen(false)} backdrop='static'>
        <CModalHeader>Configura Parametri Azione: {selectedAction?.name}</CModalHeader>
        <CModalBody>
          {selectedAction?.parameters?.map(param => renderParamInput(param))}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setIsModalOpen(false)} disabled={saving}>Annulla</CButton>
          <CButton color='primary' onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva Parametri'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>)
};

export default CallbackCard;