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
import apiClient from '@/services/api/client';

interface SmsTemplate {
  id: number;
  name: string;
  description: string;
}

interface CallbackCardProps {
  actions: Action[];
  selectedActionId: number | null;
  onActionChange: (value: number | null) => void;
  onParamsChange: (params: any) => void;
  initialParams: any;
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
    setCurrentParams(initialParams || {});
    setShowActionParamsModal(true);
  };

  const handleSave = () => {
    onParamsChange(currentParams);
    setShowActionParamsModal(false);
  };

  const handleParamChange = (field: string, value: any) => {
    setCurrentParams(prev => ({ ...prev, [field]: value }));
  };

  const renderParamInput = (param: ActionParameter) => {
    const paramValue = currentParams[param.name];

    switch (param.name) {
      case 'template_id':
        return (
          <div className='mb-3' key={param.name}>
            <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
            <CFormSelect
              id={param.name}
              value={paramValue || ''}
              onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
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
      case 'url_params':
        return (
          <div className='mb-3' key={param.name}>
            <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
            <CFormTextarea
              rows={3}
              id={param.name}
              value={paramValue ? JSON.stringify(paramValue, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                  handleParamChange(param.name, parsed);
                } catch (jsonError) {
                  console.error("Invalid JSON for url_params", jsonError);
                }
              }}
              placeholder={param.placeholder}
            />
            {param.description && <small className='text-muted'>{param.description}</small>}
          </div>
        );
      default:
        return (
          <div className='mb-3' key={param.name}>
            <CFormLabel htmlFor={param.name}>{param.label}</CFormLabel>
            <CFormInput
              type={param.type === 'number' ? 'number' : 'text'}
              id={param.name}
              value={paramValue || ''}
              onChange={(e) => handleParamChange(param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
              placeholder={param.placeholder}
              required={param.required}
            />
            {param.description && <small className='text-muted'>{param.description}</small>}
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
            Azione da associare
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

      <CModal visible={showActionParamsModal} onClose={() => setShowActionParamsModal(false)} backdrop='static'>
        <CModalHeader>Configura Parametri Azione: {selectedAction?.name}</CModalHeader>
        <CModalBody>
          {selectedAction?.parameters?.map(param => renderParamInput(param))}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowActionParamsModal(false)}>Annulla</CButton>
          <CButton color='primary' onClick={handleSave}>Salva Parametri</CButton>
        </CModalFooter>
      </CModal>
    </>)
  };

  export default CallbackCard;