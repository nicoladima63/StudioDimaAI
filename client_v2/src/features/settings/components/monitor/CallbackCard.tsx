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
import { Action } from '@/features/settings/services/automation.service';
import apiClient from '@/services/api/client'; // Import apiClient

interface SmsTemplate {
  key: string;
  description: string;
}

interface CallbackCardProps {
  actions: Action[];
  selectedActionId: number | null;
  onActionChange: (value: number | null) => void;
  onParamsChange: (params: any) => void; // Nuova prop per comunicare i dati al genitore
  initialParams: any; // Parametri iniziali per pre-popolare il form
}

const CallbackCard: React.FC<CallbackCardProps> = ({
  actions,
  selectedActionId,
  onActionChange,
  onParamsChange,
  initialParams,
}) => {
  const [showActionParamsModal, setShowActionParamsModal] = useState(false);
  const [currentParams, setCurrentParams] = useState(initialParams || {});
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);

  useEffect(() => {
    const fetchSmsTemplates = async () => {
      try {
        const response = await apiClient.get('/sms-templates');
        if (response.data.success) {
          setSmsTemplates(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch SMS templates", error);
      }
    };
    fetchSmsTemplates();
  }, []);

  const selectedAction = actions.find(action => action.id === selectedActionId);
  const requiresParams = selectedAction && selectedAction.parameters && selectedAction.parameters.length > 0;

  const handleOpenModal = () => {
    setCurrentParams(initialParams || {}); // Resetta i parametri quando apri
    setShowActionParamsModal(true);
  };

  const handleSave = () => {
    onParamsChange(currentParams);
    setShowActionParamsModal(false);
  };

  const handleParamChange = (field: string, value: any) => {
    setCurrentParams(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <CCard className='mb-4'>
        <CCardHeader>
          <h5 className='mb-0'>
            <CIcon icon={cilList} className='me-2' />
            Azione da associare
          </h5>
        </CCardHeader>
        <CCardBody>
          {actions.length === 0 ? (
            <p className='text-muted'>Nessuna azione disponibile</p>
          ) : (
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
              {selectedActionId && requiresParams && (
                <div className='mt-2'>
                  <CButton color='info' size='sm' variant='outline' onClick={handleOpenModal}>
                    <CIcon icon={cilSettings} className='me-1' />
                    Configura Parametri
                  </CButton>
                </div>
              )}
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* La modale ora vive qui */}
      <CModal visible={showActionParamsModal} onClose={() => setShowActionParamsModal(false)} backdrop='static'>
        <CModalHeader>Configura Parametri Azione: {selectedAction?.name}</CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel>Nome Pagina nel Link (Slug)</CFormLabel>
            <CFormInput 
              value={currentParams?.page_slug || ''}
              onChange={(e) => handleParamChange('page_slug', e.target.value)}
              placeholder='es. promozione-estiva'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Modello SMS da Inviare</CFormLabel>
            <CFormSelect
              value={currentParams?.template_key || ''}
              onChange={(e) => handleParamChange('template_key', e.target.value)}
            >
              <option value=''>-- Seleziona modello --</option>
              {smsTemplates.map(template => (
                <option key={template.key} value={template.key}>{template.description}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel>Mittente SMS (opzionale)</CFormLabel>
            <CFormInput 
              value={currentParams?.sender || 'StudioDima'}
              onChange={(e) => handleParamChange('sender', e.target.value)}
              placeholder='StudioDima'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Parametri URL Aggiuntivi (JSON)</CFormLabel>
            <CFormTextarea 
              rows={3} 
              value={currentParams?.url_params ? JSON.stringify(currentParams.url_params, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                  handleParamChange('url_params', parsed);
                } catch (jsonError) {
                  console.error("Invalid JSON for url_params", jsonError);
                }
              }}
              placeholder='{\n  "source": "promo_sms",\n  "id_paziente": "{DB_PANOME}"\n}'
            />
            <small className='text-muted'>
              Inserire un oggetto JSON. Le chiavi e i valori verranno aggiunti al link (es. `?source=promo_sms`). Puoi usare placeholder come "DB_PANOME" che verranno sostituiti con i dati del paziente.
            </small>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowActionParamsModal(false)}>Annulla</CButton>
          <CButton color='primary' onClick={handleSave}>Salva Parametri</CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default CallbackCard;