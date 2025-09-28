import React, { useState } from 'react';
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
          {/* Esempio di campi, da rendere dinamici in base a selectedAction.parameters */}
          <div className='mb-3'>
            <CFormLabel>Slug della Pagina di Destinazione</CFormLabel>
            <CFormInput 
              value={currentParams?.page_slug || ''}
              onChange={(e) => handleParamChange('page_slug', e.target.value)}
              placeholder='es. promozione'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Chiave del Modello SMS</CFormLabel>
            <CFormInput 
              value={currentParams?.template_key || ''}
              onChange={(e) => handleParamChange('template_key', e.target.value)}
              placeholder='es. promozione_speciale'
            />
          </div>
          <div className='mb-3'>
            <CFormLabel>Mittente SMS (opzionale)</CFormLabel>
            <CFormInput 
              value={currentParams?.sender || ''}
              onChange={(e) => handleParamChange('sender', e.target.value)}
              placeholder='es. StudioDima'
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
              placeholder='{ "codice_paziente": "{DB_APCODP}" }'
            />
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