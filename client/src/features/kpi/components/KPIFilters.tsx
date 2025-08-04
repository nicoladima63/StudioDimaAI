import React, { useState } from 'react';
import { CForm, CRow, CCol, CButton, CFormInput } from '@coreui/react';
import Select from 'react-select';
import CIcon from '@coreui/icons-react';
import { cilReload, cilCalendar } from '@coreui/icons';

export interface KPIFiltersState {
  anni: number[];
  dataInizio?: string;
  dataFine?: string;
}

interface KPIFiltersProps {
  onFiltersChange: (filters: KPIFiltersState) => void;
  loading?: boolean;
  anniDisponibili?: number[];
}

const KPIFilters: React.FC<KPIFiltersProps> = ({
  onFiltersChange,
  loading = false,
  anniDisponibili = []
}) => {
  const [anni, setAnni] = useState<number[]>([new Date().getFullYear()]);
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');

  // Genera anni disponibili se non forniti
  const currentYear = new Date().getFullYear();
  const defaultAnni = anniDisponibili.length > 0 
    ? anniDisponibili 
    : Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (anni.length > 0) {
      onFiltersChange({
        anni,
        dataInizio: dataInizio || undefined,
        dataFine: dataFine || undefined
      });
    }
  };

  const resetFilters = () => {
    const currentYear = new Date().getFullYear();
    setAnni([currentYear]);
    setDataInizio('');
    setDataFine('');
    onFiltersChange({ 
      anni: [currentYear],
      dataInizio: undefined,
      dataFine: undefined 
    });
  };

  const hasCustomRange = dataInizio || dataFine;

  return (
    <CForm onSubmit={handleSubmit} className="mb-4 p-3 border rounded bg-light">
      <CRow className="g-3 align-items-end">
        {/* Multi-select anni */}
        <CCol xs={12} md={7}>
          <label className="form-label fw-semibold">
            <CIcon icon={cilCalendar} className="me-1" />
            Anni da analizzare
          </label>
          <Select
            isMulti
            options={defaultAnni
              .slice()
              .sort((a, b) => b - a)
              .map(a => ({ value: a, label: a }))}
            value={anni.map(a => ({ value: a, label: a }))}
            onChange={opts => setAnni(opts ? opts.map(o => o.value) : [])}
            placeholder="Seleziona anni"
            closeMenuOnSelect={false}
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
                color: '#1976d2'
              })
            }}
            theme={(theme) => ({
              ...theme,
              colors: {
                ...theme.colors,
                primary: '#1976d2',
                primary25: '#e3f2fd'
              }
            })}
          />
          <div className="form-text">
            Seleziona uno o più anni per confronti
          </div>
        </CCol>

        {/* Range date personalizzato */}
        <CCol xs={12} md={2}>
          <label className="form-label fw-semibold">Data Inizio</label>
          <CFormInput
            type="date"
            value={dataInizio}
            onChange={(e) => setDataInizio(e.target.value)}
            disabled={anni.length === 0}
          />
          <div className="form-text">
            {hasCustomRange ? 'Range personalizzato attivo' : 'Opzionale: range specifico'}
          </div>
        </CCol>

        <CCol xs={12} md={2}>
          <label className="form-label fw-semibold">Data Fine</label>
          <CFormInput
            type="date"
            value={dataFine}
            onChange={(e) => setDataFine(e.target.value)}
            disabled={anni.length === 0}
          />
                    <div className="form-text">
            {hasCustomRange ? 'Range personalizzato attivo' : 'Opzionale: range specifico'}
          </div>

        </CCol>

        {/* Pulsanti azione */}
        <CCol xs={12} md={1}>
          <div className="d-flex flex-column gap-2">
            <CButton 
              color="primary" 
              type="submit"
              disabled={loading || anni.length === 0}
              className="d-flex align-items-center justify-content-center"
            >
              <CIcon icon={cilReload} className="me-1" />
              {loading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
            <CButton 
              color="secondary" 
              variant="outline"
              onClick={resetFilters}
              size="sm"
            >
              Reset
            </CButton>
          </div>
        </CCol>
      </CRow>

      {/* Info filtri attivi */}
      <CRow className="mt-3">
        <CCol xs={12}>
          <div className="small text-muted">
            <strong>Filtri attivi:</strong>
            <span className="ms-2">
              Anni: {anni.length > 0 ? anni.join(', ') : 'Nessuno'}
            </span>
            {hasCustomRange && (
              <span className="ms-3">
                Periodo: {dataInizio || '∞'} → {dataFine || '∞'}
              </span>
            )}
            {anni.length > 1 && (
              <span className="ms-3 text-info">
                🔄 Modalità confronto attiva
              </span>
            )}
          </div>
        </CCol>
      </CRow>
    </CForm>
  );
};

export default KPIFilters;