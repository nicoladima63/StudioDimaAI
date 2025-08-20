import React, { useState } from 'react';
import { 
  CFormSwitch, 
  CButton, 
  CBadge, 
  CSpinner,
  CTooltip 
} from '@coreui/react';
import type { 
  EnvironmentSwitchProps, 
  Environment, 
  ServiceType,
  ENVIRONMENT_DISPLAY_NAMES,
  ENVIRONMENT_COLORS 
} from '../../../types/environment.types';
import { useEnvironmentSwitch } from '../../../store/environment.store';

/**
 * Componente riusabile per switch ambiente singolo servizio
 * Switch CoreUI con gestione stato, validazione e test
 */
const EnvironmentSwitch: React.FC<EnvironmentSwitchProps> = ({
  service,
  label,
  icon,
  onModeChange,
  validation,
  size = 'md',
  disabled = false,
  showLabel = true,
  color = 'primary'
}) => {
  const {
    currentEnvironment,
    availableEnvironments,
    isLoading,
    isValid,
    switch: switchEnvironment
  } = useEnvironmentSwitch(service);

  const [isSwitching, setIsSwitching] = useState(false);

  // Determina prossimo ambiente nel ciclo
  const getNextEnvironment = (): Environment => {
    const currentIndex = availableEnvironments.indexOf(currentEnvironment);
    const nextIndex = (currentIndex + 1) % availableEnvironments.length;
    return availableEnvironments[nextIndex];
  };

  const handleSwitch = async () => {
    if (disabled || isSwitching) return;

    const nextEnvironment = getNextEnvironment();

    // Validazione personalizzata se fornita
    if (validation) {
      try {
        const isValidChange = await validation(nextEnvironment);
        if (!isValidChange) return;
      } catch (error) {
        console.error('Errore validazione:', error);
        return;
      }
    }

    setIsSwitching(true);

    try {
      const success = await switchEnvironment(nextEnvironment);
      
      if (success && onModeChange) {
        onModeChange(nextEnvironment);
      }
    } catch (error) {
      console.error('Errore switch ambiente:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Configurazione switch basata su ambienti disponibili
  const getSwitchConfig = () => {
    if (availableEnvironments.length === 2) {
      // Switch binario (es. dev/prod o test/prod)
      const isFirstEnv = currentEnvironment === availableEnvironments[0];
      return {
        checked: !isFirstEnv,
        label: showLabel ? `${availableEnvironments[0]} / ${availableEnvironments[1]}` : undefined
      };
    } else {
      // Switch multiplo - mostra ambiente corrente
      return {
        checked: currentEnvironment !== availableEnvironments[0],
        label: showLabel ? ENVIRONMENT_DISPLAY_NAMES[currentEnvironment] : undefined
      };
    }
  };

  const switchConfig = getSwitchConfig();

  const getBadgeColor = () => {
    return ENVIRONMENT_COLORS[currentEnvironment] || 'secondary';
  };

  const getSizeClass = () => {
    const sizeMap = {
      sm: 'form-switch-sm',
      md: '',
      lg: 'form-switch-lg'
    };
    return sizeMap[size];
  };

  return (
    <div className="d-flex align-items-center gap-2">
      {icon && <span className="text-muted">{icon}</span>}
      
      {label && (
        <span className="fw-semibold text-nowrap">
          {label}
        </span>
      )}

      <CBadge 
        color={getBadgeColor()}
        className="text-uppercase"
        title={`Ambiente corrente: ${ENVIRONMENT_DISPLAY_NAMES[currentEnvironment]}`}
      >
        {currentEnvironment}
      </CBadge>

      <CTooltip
        content={`Click per passare a ${ENVIRONMENT_DISPLAY_NAMES[getNextEnvironment()]}`}
        placement="top"
      >
        <CFormSwitch
          id={`environment-switch-${service}`}
          className={getSizeClass()}
          checked={switchConfig.checked}
          onChange={handleSwitch}
          disabled={disabled || isSwitching || isLoading}
          color={color}
          label={switchConfig.label}
        />
      </CTooltip>

      {(isSwitching || isLoading) && (
        <CSpinner size="sm" variant="border" className="text-muted" />
      )}

      {!isValid && (
        <CBadge color="warning" title="Configurazione non valida">
          ⚠️
        </CBadge>
      )}
    </div>
  );
};

export default EnvironmentSwitch;