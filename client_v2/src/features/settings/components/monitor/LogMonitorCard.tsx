
import React from 'react';
import { CCard, CCardBody, CCardHeader, CBadge } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList } from '@coreui/icons';

interface MonitorLog {
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface LogMonitorCardProps {
  logs: MonitorLog[];
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('it-IT');
};

const getLogBadgeColor = (type: string) => {
  switch (type) {
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    default:
      return 'info';
  }
};

const LogMonitorCard: React.FC<LogMonitorCardProps> = ({ logs }) => {
  return (
    <CCard>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilList} className='me-2' />
          Log Monitor
        </h5>
      </CCardHeader>
      <CCardBody>
        <div 
          style={{ 
            height: '400px',
            overflowY: 'auto', 
            border: '1px solid #dee2e6', 
            borderRadius: '0.375rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
          }}
        >
          {logs.length === 0 ? (
            <div className='text-center text-muted py-4'>
              <p>Nessun log disponibile</p>
              <small>Avvia il monitor per vedere i log in tempo reale</small>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className='mb-2'>
                <div className='d-flex align-items-start'>
                  <CBadge 
                    color={getLogBadgeColor(log.type)} 
                    className='me-2 mt-1'
                    style={{ fontSize: '0.75rem' }}
                  >
                    {log.type.toUpperCase()}
                  </CBadge>
                  <div className='flex-grow-1'>
                    <div className='text-muted small'>{formatTimestamp(log.timestamp)}</div>
                    <div className='mt-1'>{log.message}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CCardBody>
    </CCard>
  );
};

export default LogMonitorCard;
