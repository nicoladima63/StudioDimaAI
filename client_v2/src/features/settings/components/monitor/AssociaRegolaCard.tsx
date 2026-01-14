import React from 'react';
import { CCard, CCardBody, CCardHeader, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalculator } from '@coreui/icons';

interface AssociaRegolaCardProps {
  onAssocia: (e: React.MouseEvent) => void;
  disabled: boolean;
}

const AssociaRegolaCard: React.FC<AssociaRegolaCardProps> = ({ onAssocia, disabled }) => {
  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0 text-center'>Associa</h5>
      </CCardHeader>
      <CCardBody>
        <div className='mb-3 text-center'>
          <CButton
            color='primary'
            disabled={disabled}
            onClick={onAssocia}
          >
            <CIcon icon={cilCalculator} />
          </CButton>
        </div>
      </CCardBody>
    </CCard>
  );
};

export default AssociaRegolaCard;