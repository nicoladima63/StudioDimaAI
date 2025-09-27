
import React from 'react';
import { CCard, CCardBody, CCardHeader, CButton } from '@coreui/react';

interface AssociaRegolaCardProps {
  onAssocia: (e: React.MouseEvent) => void;
  disabled: boolean;
}

const AssociaRegolaCard: React.FC<AssociaRegolaCardProps> = ({ onAssocia, disabled }) => {
  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0'>Associa</h5>
      </CCardHeader>
      <CCardBody>
        <div className='mb-3'>
          <CButton 
            color='primary' 
            disabled={disabled} 
            onClick={onAssocia}
          >
            Associa
          </CButton>
        </div>
      </CCardBody>
    </CCard>
  );
};

export default AssociaRegolaCard;
