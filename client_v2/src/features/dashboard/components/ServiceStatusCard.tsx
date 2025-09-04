import React from 'react';
import { CCard, CCardBody, CBadge, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilCheckCircle,
  cilXCircle,
  cilWarning,
  cilInfo,
  cilSettings,
  cilPowerStandby,
} from '@coreui/icons';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  environment?: string;
  lastCheck?: string;
  details?: string;
  icon?: string;
}

interface Props {
  service: ServiceStatus;
  color?: string;
  onToggleService?: (serviceKey: string, enabled: boolean) => void;
  onOpenSettings?: (serviceKey: string) => void;
}

const ServiceStatusCard: React.FC<Props> = ({
  service,
  color = '#3399ff',
  onToggleService,
  onOpenSettings,
}) => {
  const getStatusIcon = () => {
    switch (service.status) {
      case 'healthy':
        return <CIcon icon={cilCheckCircle} size='lg' style={{ color: '#4be38a' }} />;
      case 'unhealthy':
        return <CIcon icon={cilXCircle} size='lg' style={{ color: '#ff7676' }} />;
      case 'degraded':
        return <CIcon icon={cilWarning} size='lg' style={{ color: '#ffa726' }} />;
      default:
        return <CIcon icon={cilInfo} size='lg' style={{ color: '#8884d8' }} />;
    }
  };

  const getStatusBadge = () => {
    const statusColors = {
      healthy: 'success',
      unhealthy: 'danger',
      degraded: 'warning',
      unknown: 'secondary',
    };

    const statusLabels = {
      healthy: 'Operativo',
      unhealthy: 'Errore',
      degraded: 'Degradato',
      unknown: 'Sconosciuto',
    };

    return <CBadge color={statusColors[service.status]}>{statusLabels[service.status]}</CBadge>;
  };

  const getActionButton = () => {
    const serviceKey = service.name.toLowerCase().replace(/\s+/g, '_');

    // Servizi con toggle on/off
    const toggleServices = ['database', 'api_server', 'database_connection'];
    if (toggleServices.includes(serviceKey) && onToggleService) {
      const isEnabled = service.status === 'healthy';
      return (
        <CButton
          size='sm'
          color={isEnabled ? 'success' : 'secondary'}
          onClick={() => onToggleService(serviceKey, !isEnabled)}
          className='w-100'
        >
          <CIcon icon={cilPowerStandby} size='sm' className='me-1' />
          {isEnabled ? 'Disattiva' : 'Attiva'}
        </CButton>
      );
    }

    // Servizi con settings
    const settingsServices = ['sms', 'rentri', 'ricetta_elettronica', 'calendar'];
    if (settingsServices.includes(serviceKey) && onOpenSettings) {
      return (
        <CButton
          size='sm'
          color='primary'
          onClick={() => onOpenSettings(serviceKey)}
          className='w-100'
        >
          <CIcon icon={cilSettings} size='sm' className='me-1' />
          Impostazioni
        </CButton>
      );
    }

    return null;
  };

  return (
    <CCard
      className='mb-3'
      style={{
        background: '#fff',
        border: `2px solid ${color}`,
        minWidth: 220,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <CCardBody style={{ position: 'relative', padding: '1rem' }}>
        <div className='d-flex align-items-center justify-content-between mb-2'>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>{service.name}</div>
          {getStatusIcon()}
        </div>

        <div className='mb-2'>{getStatusBadge()}</div>

        {service.environment && (
          <div
            style={{
              fontSize: 14,
              color: '#666',
              marginBottom: '0.5rem',
            }}
          >
            Ambiente: <strong>{service.environment}</strong>
          </div>
        )}

        {service.lastCheck && (
          <div
            style={{
              fontSize: 12,
              color: '#999',
              marginBottom: '0.5rem',
            }}
          >
            Ultimo controllo: {new Date(service.lastCheck).toLocaleString('it-IT')}
          </div>
        )}

        {service.details && (
          <div
            style={{
              fontSize: 13,
              color: '#666',
              fontStyle: 'italic',
              marginBottom: '0.5rem',
            }}
          >
            {service.details}
          </div>
        )}

        {/* Pulsanti azione */}
        <div className='mt-2'>{getActionButton()}</div>
      </CCardBody>
    </CCard>
  );
};

export default ServiceStatusCard;
