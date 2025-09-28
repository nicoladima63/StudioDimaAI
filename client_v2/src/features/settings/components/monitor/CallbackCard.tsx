import React from 'react';
import { CCard, CCardBody, CCardHeader, CButton, CFormSelect } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilSettings } from '@coreui/icons'; // Added cilSettings for configure button
import { Action } from '@/features/settings/services/automation.service';

interface CallbackCardProps { // Renamed to ActionCardProps conceptually, but keeping for now
  actions: Action[];
  selectedActionId: number | null;
  onActionChange: (value: number | null) => void;
  onConfigureActionParams: () => void;
}

const CallbackCard: React.FC<CallbackCardProps> = ({
  actions,
  selectedActionId,
  onActionChange,
  onConfigureActionParams,
}) => {
  const selectedAction = actions.find(action => action.id === selectedActionId);
  const requiresParams = selectedAction && selectedAction.parameters && selectedAction.parameters.length > 0;

  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilList} className='me-2' />
          Azione da associare
        </h5>
      </CCardHeader>
      <CCardBody>
        {actions.length === 0 ? (
          <div className='text-center'>
            <p className='text-muted mb-2'>Nessuna azione disponibile</p>
          </div>
        ) : (
          <div className='mb-3'>
            <label className='form-label'>Seleziona Azione</label>
            <CFormSelect
              value={selectedActionId || ''}
              onChange={(e) => onActionChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value=''>-- Seleziona azione --</option>
              {actions.map(action => (
                <option key={action.id} value={action.id}>{action.name} ({action.description})</option>
              ))}
            </CFormSelect>
            {selectedActionId && requiresParams && (
              <div className='mt-2'>
                <CButton color='info' size='sm' variant='outline' onClick={onConfigureActionParams}>
                  <CIcon icon={cilSettings} className='me-1' />
                  Configura Parametri
                </CButton>
              </div>
            )}
          </div>
        )}
      </CCardBody>
    </CCard>
  );
};

export default CallbackCard;