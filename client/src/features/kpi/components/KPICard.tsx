import React from 'react';
import { CCard, CCardBody } from '@coreui/react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  color = 'primary',
  icon,
  children
}) => {
  return (
    <CCard className={`border-start border-start-4 border-start-${color} py-1`}>
      <CCardBody className="pb-0 d-flex justify-content-between align-items-start">
        <div>
          <div className="fs-4 fw-semibold">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {subtitle && <span className="fs-6 ms-2 fw-normal text-medium-emphasis">{subtitle}</span>}
          </div>
          <div className="text-medium-emphasis text-uppercase fw-semibold small">{title}</div>
        </div>
        {icon && <div className={`text-${color} opacity-50`}>{icon}</div>}
      </CCardBody>
      {children && <CCardBody className="pt-0">{children}</CCardBody>}
    </CCard>
  );
};

export default KPICard;