
import React from 'react';
import { CCard, CCardBody, CCardHeader, CButton, CFormSelect } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilTrash } from '@coreui/icons';
import { CallbackInfo, PreparedCallback } from '@/features/settings/services/regoleMonitoraggio.service';

interface CallbackCardProps {
  callbacks: CallbackInfo[];
  preparedCallbacks: PreparedCallback[];
  selectedCallback: string;
  onCallbackChange: (value: string) => void;
  onDeletePreparedCallback: (id: number) => void;
  onShowCreateCallback: () => void;
}

const CallbackCard: React.FC<CallbackCardProps> = ({ 
  callbacks, 
  preparedCallbacks, 
  selectedCallback, 
  onCallbackChange,
  onDeletePreparedCallback,
  onShowCreateCallback
}) => {
  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilList} className='me-2' />
          Callback da associare
        </h5>
      </CCardHeader>
      <CCardBody>
        {callbacks.length === 0 && preparedCallbacks.length === 0 ? (
          <div className='text-center'>
            <p className='text-muted mb-2'>Nessuna callback disponibile</p>
            <CButton color='primary' size='sm' onClick={onShowCreateCallback}>Crea callback</CButton>
          </div>
        ) : (
          <div className='mb-3'>
            <label className='form-label'>Seleziona Callback</label>
            <CFormSelect
              value={selectedCallback}
              onChange={(e) => onCallbackChange(e.target.value)}
            >
              <option value=''>-- Seleziona callback --</option>
              {preparedCallbacks.length > 0 && (
                <optgroup label='Personalizzate'>
                  {preparedCallbacks.map(cb => (
                    <option key={cb.id} value={String(cb.id)}>{cb.nome}</option>
                  ))}
                </optgroup>
              )}
              {callbacks.length > 0 && (
                <optgroup label='Di sistema'>
                  {callbacks.map(cb => (
                    <option key={cb.id} value={cb.id}>{cb.id}</option>
                  ))}
                </optgroup>
              )}
            </CFormSelect>
            <div className='mt-2'>
              <CButton color='secondary' size='sm' variant='outline' onClick={onShowCreateCallback}>
                Crea callback
              </CButton>
            </div>
            <div className='mt-3'>
              {preparedCallbacks.map(cb => (
                <div key={cb.id} className='d-flex justify-content-between align-items-center small mb-1'>
                  <span>{cb.nome}</span>
                  <CButton size='sm' color='danger' variant='ghost' onClick={() => onDeletePreparedCallback(cb.id)}>
                    <CIcon icon={cilTrash} />
                  </CButton>
                </div>
              ))}
            </div>
          </div>
        )}
      </CCardBody>
    </CCard>
  );
};

export default CallbackCard;
