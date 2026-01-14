import React, { useState, useEffect } from 'react';
import { CFormSelect, CFormLabel } from '@coreui/react';
import GestioneRegoleCard from './GestioneRegoleCard';
import TipiAppuntamentoSelect from './TipiAppuntamentoSelect';
import { Prestazione } from '@/store/prestazioni.store';

export interface Trigger {
  type: string;
  id: string;
  name: string;
}

interface TriggerSourceSelectorProps {
  onChange: (trigger: Trigger | null) => void;
  disabled?: boolean;
}

const TriggerSourceSelector: React.FC<TriggerSourceSelectorProps> = ({ onChange, disabled }) => {
  const [source, setSource] = useState('prestazione');
  const [selectedPrestazione, setSelectedPrestazione] = useState<Prestazione | null>(null);
  const [selectedTipoApp, setSelectedTipoApp] = useState('');

  useEffect(() => {
    if (source === 'prestazione') {
      if (selectedPrestazione) {
        onChange({
          type: 'prestazione',
          id: String(selectedPrestazione.id),
          name: selectedPrestazione.nome
        });
      } else {
        onChange(null);
      }
    } else if (source === 'appuntamento_tipo') {
      if (selectedTipoApp) {
        onChange({ type: 'appuntamento_tipo', id: selectedTipoApp, name: `Tipo App: ${selectedTipoApp}` });
      } else {
        onChange(null);
      }
    }
  }, [source, selectedPrestazione, selectedTipoApp, onChange]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSource = e.target.value;
    setSource(newSource);
    // Reset selections when source changes
    setSelectedPrestazione(null);
    setSelectedTipoApp('');
    onChange(null);
  };

  return (
    <div>
      <div className="mb-3">
        <CFormLabel htmlFor="trigger-source-select">Tipo di Trigger</CFormLabel>
        <CFormSelect
          id="trigger-source-select"
          value={source}
          onChange={handleSourceChange}
          disabled={disabled}
        >
          <option value="prestazione">Prestazione</option>
          <option value="appuntamento_tipo">Appuntamento</option>
        </CFormSelect>
      </div>

      {source === 'prestazione' && (
        <GestioneRegoleCard
          selectedPrestazione={selectedPrestazione}
          onPrestazioneChange={setSelectedPrestazione}
          disabled={disabled}
        />
      )}

      {source === 'appuntamento_tipo' && (
        <TipiAppuntamentoSelect
          value={selectedTipoApp}
          onChange={setSelectedTipoApp}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export default TriggerSourceSelector;
