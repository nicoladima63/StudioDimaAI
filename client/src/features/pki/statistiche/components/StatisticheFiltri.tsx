import React, { useState } from 'react';
import { CForm, CRow, CCol, CButton } from '@coreui/react';
import Select from 'react-select';
import CIcon from '@coreui/icons-react';
import { cilReload, cilCalendar, cilXCircle, cilChart } from '@coreui/icons';

export interface StatisticheFiltriState {
  anni: number[];
}

interface StatisticheFiltriProps {
  onFiltersChange: (filters: StatisticheFiltriState) => void;
  loading?: boolean;
  anniDisponibili?: number[];
}

const StatisticheFiltri: React.FC<StatisticheFiltriProps> = ({
  onFiltersChange,
  loading = false,
  anniDisponibili = []
}) => {
  const [anni, setAnni] = useState<number[]>([new Date().getFullYear()]);

  // Genera anni disponibili se non forniti (dal 2020 ad oggi + 1)
  const currentYear = new Date().getFullYear();
  const defaultAnni = anniDisponibili.length > 0 
    ? anniDisponibili 
    : Array.from({ length: currentYear - 2019 + 2 }, (_, i) => currentYear - i + 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (anni.length > 0) {
      onFiltersChange({ anni });
    }
  };

  const resetFilters = () => {
    const currentYear = new Date().getFullYear();
    setAnni([currentYear]);
    onFiltersChange({ anni: [currentYear] });
  };

  const handleAnniChange = (selectedOptions: any) => {
    const newAnni = selectedOptions ? selectedOptions.map((o: any) => o.value) : [];
    setAnni(newAnni);
    
    // Auto-aggiorna quando cambiano gli anni (pattern KPI)
    if (newAnni.length > 0) {
      onFiltersChange({ anni: newAnni });
    }
  };

  const getAnniLabel = () => {
    if (anni.length === 0) return '';
    if (anni.length === 1) return `Anno ${anni[0]}`;
    if (anni.length === 2) return `${Math.min(...anni)}-${Math.max(...anni)}`;
    return `${Math.min(...anni)}-${Math.max(...anni)} (${anni.length} anni)`;
  };

  return (
    <CForm onSubmit={handleSubmit} className="mb-4 p-3 border rounded bg-light">
      <CRow className="g-3 align-items-end">
        {/* Multi-select anni */}
        <CCol xs={12} md={8}>
          <label className="form-label fw-semibold">
            <CIcon icon={cilCalendar} className="me-1" />
            Periodo di Analisi {getAnniLabel() && <span className="text-primary">({getAnniLabel()})</span>}
          </label>
          <Select
            isMulti
            options={defaultAnni
              .slice()
              .sort((a, b) => b - a)  // Ordine decrescente (anni recenti prima)
              .map(a => ({ value: a, label: a }))}
            value={anni.map(a => ({ value: a, label: a }))}
            onChange={handleAnniChange}
            placeholder="Seleziona anni..."
            closeMenuOnSelect={false}
            isDisabled={loading}
            styles={{
              control: base => ({ 
                ...base, 
                minHeight: 38, 
                fontSize: 16,
                borderColor: '#b0b0b0'
              }),
              multiValue: base => ({ 
                ...base, 
                fontSize: 15,
                backgroundColor: '#e3f2fd'
              }),
              multiValueLabel: base => ({
                ...base,
                color: '#1976d2',
                fontWeight: 500
              }),
              multiValueRemove: base => ({
                ...base,
                color: '#1976d2',
                ':hover': {
                  backgroundColor: '#1976d2',
                  color: 'white',
                },
              }),
            }}
            noOptionsMessage={() => 'Nessun anno disponibile'}
          />
          <small className="text-muted">
            Seleziona uno o più anni per analisi comparativa
          </small>
        </CCol>

        {/* Azioni */}
        <CCol xs={12} md={4}>
          <div className="d-flex gap-2 justify-content-end">
            <CButton 
              color="secondary" 
              variant="outline" 
              onClick={resetFilters}
              disabled={loading}
              size="sm"
            >
              <CIcon icon={cilXCircle} className="me-1" />
              Reset
            </CButton>
            
            <CButton 
              color="primary" 
              type="submit"
              disabled={loading || anni.length === 0}
              size="sm"
            >
              {loading ? (
                <>
                  <CIcon icon={cilReload} className="me-1 fa-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <CIcon icon={cilChart} className="me-1" />
                  Applica Filtri
                </>
              )}
            </CButton>
          </div>
        </CCol>
      </CRow>
      
      {/* Info filtri attivi */}
      {anni.length > 0 && (
        <CRow className="mt-2">
          <CCol>
            <div className="d-flex align-items-center text-muted small">
              <CIcon icon={cilCalendar} className="me-1" />
              <strong>Filtro attivo:</strong>
              <span className="ms-1 text-primary fw-semibold">
                {anni.length === 1 
                  ? `Anno ${anni[0]}` 
                  : `${anni.length} anni selezionati (${Math.min(...anni)} - ${Math.max(...anni)})`
                }
              </span>
            </div>
          </CCol>
        </CRow>
      )}
    </CForm>
  );
};

export default StatisticheFiltri;