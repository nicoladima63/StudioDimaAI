import React from 'react';
import { CCard, CCardBody, CProgress } from '@coreui/react';

interface BreakEvenIndicatorProps {
  produzioneMedia: number;
  breakEven: number;
}

const BreakEvenIndicator: React.FC<BreakEvenIndicatorProps> = ({ produzioneMedia, breakEven }) => {
  if (breakEven <= 0) return null;

  const percentuale = Math.min(100, (produzioneMedia / breakEven) * 100);
  const surplus = produzioneMedia - breakEven;
  const isAbove = surplus >= 0;

  return (
    <CCard className="mb-4">
      <CCardBody>
        <div className="d-flex justify-content-between mb-2">
          <strong>Break-Even Mensile</strong>
          <span className={isAbove ? 'text-success fw-bold' : 'text-danger fw-bold'}>
            {isAbove ? '+' : ''}{surplus.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} EUR
          </span>
        </div>
        <CProgress
          value={percentuale}
          color={percentuale >= 100 ? 'success' : percentuale >= 80 ? 'warning' : 'danger'}
          className="mb-2"
        />
        <div className="d-flex justify-content-between text-body-secondary small">
          <span>0</span>
          <span>Break-Even: {breakEven.toLocaleString('it-IT', { maximumFractionDigits: 0 })} EUR</span>
          <span>{(breakEven * 1.5).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
        </div>
      </CCardBody>
    </CCard>
  );
};

export default BreakEvenIndicator;
