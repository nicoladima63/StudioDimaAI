import React from 'react';
import { CCard, CCardBody } from '@coreui/react';

interface Props {
  title: string;
  value: number;
  crescita: number;
  color?: string;
}

const AppuntamentiCoreUICard: React.FC<Props> = ({ 
  title, 
  value, 
  crescita, 
  color = '#3399ff' 
}) => {
  const isPositive = crescita >= 0;

  return (
    <CCard className="mb-4" style={{ background: color, color: '#fff', minWidth: 220, border: 'none' }}>
      <CCardBody style={{ position: 'relative', paddingBottom: 0, minHeight: 80 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          {value}{' '}
          <span style={{ 
            fontSize: 16, 
            color: isPositive ? '#4be38a' : '#ff7676', 
            fontWeight: 500 
          }}>
            ({isPositive ? '+' : ''}{crescita}% {isPositive ? '↑' : '↓'})
          </span>
        </div>
        <div style={{ 
          fontSize: 15, 
          opacity: 0.9, 
          marginTop: 2, 
          marginBottom: 8 
        }}>
          {title}
        </div>
      </CCardBody>
    </CCard>
  );
};

export default AppuntamentiCoreUICard 