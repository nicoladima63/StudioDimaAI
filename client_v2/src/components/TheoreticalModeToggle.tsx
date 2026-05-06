import React, { useState, useEffect } from 'react';
import { CFormSwitch, CSpinner, CTooltip } from '@coreui/react';
import { getAutomationSettings, setAutomationSettings } from '@/services/api/automation-settings.service';
import toast from 'react-hot-toast';

const TheoreticalModeToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await getAutomationSettings();
      if (response.success && response.data) {
        setEnabled(!!(response.data as any).theoretical_mode_enabled);
      }
    } catch (error) {
      console.error('Error loading automation settings:', error);
    }
  };

  const handleToggle = async () => {
    const newValue = !enabled;
    setLoading(true);
    try {
      const response = await setAutomationSettings({ theoretical_mode_enabled: newValue } as any);
      if (response.success) {
        setEnabled(newValue);
        toast.success(newValue ? 'Modalità Teorica ATTIVATA' : 'Modalità Teorica DISATTIVATA', {
          icon: newValue ? '🔬' : '🚀',
        });
        // Reload to update UI if needed
        if (window.location.hash.includes('/simulation') && !newValue) {
           // Maybe redirect away if we are on simulation page and disable it? 
           // Or just stay.
        }
      } else {
        toast.error('Errore durante l\'aggiornamento della modalità');
      }
    } catch (error) {
      console.error('Error toggling theoretical mode:', error);
      toast.error('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center me-3 border-end pe-3">
      <CTooltip content={enabled ? "Il sistema NON invia messaggi reali" : "Il sistema esegue azioni REALI"}>
        <span className="d-flex align-items-center">
          <span className={`me-2 small fw-bold ${enabled ? 'text-warning' : 'text-success'}`}>
            {enabled ? 'MODO TEORICO' : 'MODO REALE'}
          </span>
          {loading ? (
            <CSpinner size="sm" color="secondary" />
          ) : (
            <CFormSwitch
              id="theoreticalModeToggle"
              label=""
              checked={enabled}
              onChange={handleToggle}
            />
          )}
        </span>
      </CTooltip>
    </div>
  );
};

export default TheoreticalModeToggle;
