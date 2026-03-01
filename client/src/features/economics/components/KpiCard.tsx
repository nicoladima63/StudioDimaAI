import React from 'react';
import { CCard, CCardBody } from '@coreui/react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  prefix?: string;
  suffix?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, color = '#321fdb', prefix = '', suffix = '' }) => {
  return (
    <CCard className="mb-3 h-100">
      <CCardBody className="text-center py-3">
        <div className="text-body-secondary small text-uppercase fw-semibold mb-1">{title}</div>
        <div className="fs-4 fw-bold" style={{ color }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value}{suffix}
        </div>
        {subtitle && <div className="text-body-secondary small mt-1">{subtitle}</div>}
      </CCardBody>
    </CCard>
  );
};

export default KpiCard;
