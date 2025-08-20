import React from 'react';
import { CBadge, CTooltip } from '@coreui/react';
import type { 
  EnvironmentStatusProps,
  ENVIRONMENT_DISPLAY_NAMES,
  ENVIRONMENT_COLORS,
  SERVICE_DISPLAY_NAMES
} from '../../../types/environment.types';
import { useEnvironmentSwitch, useEnvironmentTest } from '../../../store/environment.store';

/**
 * Badge di stato compatto per servizio
 * Mostra ambiente corrente e stato connessione
 */
const EnvironmentStatus: React.FC<EnvironmentStatusProps> = ({
  service,
  size = 'md',
  showText = true,
  interactive = false,
  onClick
}) => {
  const {
    currentEnvironment,
    isValid
  } = useEnvironmentSwitch(service);

  const {
    isConnected
  } = useEnvironmentTest();

  const getSizeClass = () => {
    const sizeMap = {
      sm: 'badge-sm',
      md: '',
      lg: 'badge-lg'
    };
    return sizeMap[size];
  };

  const getStatusInfo = () => {
    const isServiceConnected = isConnected(service);
    
    if (isServiceConnected && isValid) {
      return {
        color: 'success',
        icon: '🟢',
        status: 'Operativo',
        description: `${SERVICE_DISPLAY_NAMES[service]} funzionante in ambiente ${ENVIRONMENT_DISPLAY_NAMES[currentEnvironment]}`
      };
    }
    
    if (!isValid) {
      return {
        color: 'danger',
        icon: '🔴',
        status: 'Non valido',
        description: `Configurazione ${SERVICE_DISPLAY_NAMES[service]} non valida per ambiente ${ENVIRONMENT_DISPLAY_NAMES[currentEnvironment]}`
      };
    }
    
    return {
      color: 'warning',
      icon: '🟡',
      status: 'Non testato',
      description: `${SERVICE_DISPLAY_NAMES[service]} configurato ma non testato in ambiente ${ENVIRONMENT_DISPLAY_NAMES[currentEnvironment]}`
    };
  };

  const statusInfo = getStatusInfo();

  const getBadgeContent = () => {
    if (!showText) {
      return statusInfo.icon;
    }

    if (size === 'sm') {
      return (
        <span className="d-flex align-items-center gap-1">
          <span style={{ fontSize: '10px' }}>{statusInfo.icon}</span>
          <span className="text-uppercase">{currentEnvironment}</span>
        </span>
      );
    }

    return (
      <span className="d-flex align-items-center gap-1">
        <span>{statusInfo.icon}</span>
        <span>{SERVICE_DISPLAY_NAMES[service]}</span>
        <span className="text-uppercase">({currentEnvironment})</span>
      </span>
    );
  };

  const badgeElement = (
    <CBadge
      color={statusInfo.color}
      className={`${getSizeClass()} ${interactive ? 'cursor-pointer' : ''}`}
      onClick={interactive && onClick ? onClick : undefined}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        transition: interactive ? 'all 0.2s ease' : 'none'
      }}
    >
      {getBadgeContent()}
    </CBadge>
  );

  // Avvolgi in tooltip se non è interattivo o se non ha onClick
  if (!interactive || !onClick) {
    return (
      <CTooltip
        content={statusInfo.description}
        placement="top"
      >
        {badgeElement}
      </CTooltip>
    );
  }

  return badgeElement;
};

export default EnvironmentStatus;