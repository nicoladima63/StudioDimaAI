import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CFormLabel, CFormSelect, CSpinner } from '@coreui/react';
import automationApi from '@/features/settings/services/automation.service';

interface TipiAppuntamentoSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const TipiAppuntamentoSelect: React.FC<TipiAppuntamentoSelectProps> = ({ value, onChange, disabled }) => {
  const [tipiAppuntamento, setTipiAppuntamento] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTipiAppuntamento = async () => {
      try {
        setLoading(true);
        const response = await automationApi.getAvailableTriggers();
        // CORREZIONE: La risposta ora è direttamente l'oggetto che contiene appuntamento_tipo
        if (response?.appuntamento_tipo) {
          setTipiAppuntamento(response.appuntamento_tipo);
        }
      } catch (error) {
        console.error("Errore nel caricamento dei tipi di appuntamento", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTipiAppuntamento();
  }, []);

  return (
    <CCard className="mb-3">
      <CCardBody>
        <div className="mb-0">
          <CFormLabel htmlFor="tipi-appuntamento-select">Tipo Appuntamento</CFormLabel>
          <CFormSelect
            id="tipi-appuntamento-select"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
            disabled={disabled || loading}
          >
            {loading ? (
              <option>Caricamento...</option>
            ) : (
              <>
                <option value="">Seleziona un tipo...</option>
                {Object.entries(tipiAppuntamento).map(([key, description]) => (
                  <option key={key} value={key}>
                    {description} ({key})
                  </option>
                ))}
              </>
            )}
          </CFormSelect>
        </div>
      </CCardBody>
    </CCard>
  );
};

export default TipiAppuntamentoSelect;