import React, { useState, useEffect } from 'react';
import { CFormSelect, CSpinner, CRow, CCol, CBadge } from '@coreui/react';
import { useConti, useSottoconti } from '@/store/contiStore';
import type { Conto, Sottoconto } from '@/store/contiStore';

interface ContoSottocontoSelectProps {
  selectedConto?: string;
  selectedSottoconto?: string;
  onContoChange?: (codice: string | null, conto: Conto | null) => void;
  onSottocontoChange?: (codice: string | null, sottoconto: Sottoconto | null) => void;
  disabled?: boolean;
  size?: 'sm' | 'lg';
  showLabels?: boolean;
  autoSelectIfSingle?: boolean; // Se un conto ha un solo sottoconto, lo seleziona automaticamente
}

const ContoSottocontoSelect: React.FC<ContoSottocontoSelectProps> = ({
  selectedConto = '',
  selectedSottoconto = '',
  onContoChange,
  onSottocontoChange,
  disabled = false,
  size = 'sm',
  showLabels = true,
  autoSelectIfSingle = false
}) => {
  const { conti, isLoading: loadingConti, refresh } = useConti();
  const { sottoconti, isLoading: loadingSottoconti } = useSottoconti(selectedConto || null);

  const [localConto, setLocalConto] = useState(selectedConto);
  const [localSottoconto, setLocalSottoconto] = useState(selectedSottoconto);

  // Sincronizza con props
  useEffect(() => {
    setLocalConto(selectedConto);
  }, [selectedConto]);

  useEffect(() => {
    setLocalSottoconto(selectedSottoconto);
  }, [selectedSottoconto]);

  // Auto-seleziona sottoconto se ce n'è solo uno
  useEffect(() => {
    if (autoSelectIfSingle && sottoconti.length === 1 && !localSottoconto) {
      const unico = sottoconti[0];
      setLocalSottoconto(unico.codice_sottoconto);
      onSottocontoChange?.(unico.codice_sottoconto, unico);
    }
  }, [sottoconti, autoSelectIfSingle, localSottoconto, onSottocontoChange]);

  // Reset sottoconto quando cambia il conto
  useEffect(() => {
    if (localConto !== selectedConto) {
      setLocalSottoconto('');
      onSottocontoChange?.(null, null);
    }
  }, [localConto, selectedConto, onSottocontoChange]);

  const handleContoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const codiceConto = event.target.value || null;
    const conto = codiceConto ? conti.find(c => c.codice_conto === codiceConto) || null : null;
    
    setLocalConto(codiceConto || '');
    setLocalSottoconto(''); // Reset sottoconto
    
    onContoChange?.(codiceConto, conto);
    onSottocontoChange?.(null, null); // Reset anche nel parent
  };

  const handleSottocontoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const codiceSottoconto = event.target.value || null;
    const sottoconto = codiceSottoconto 
      ? sottoconti.find(s => s.codice_sottoconto === codiceSottoconto) || null 
      : null;
    
    setLocalSottoconto(codiceSottoconto || '');
    onSottocontoChange?.(codiceSottoconto, sottoconto);
  };

  const selectedContoObj = localConto ? conti.find(c => c.codice_conto === localConto) : null;
  const hasSottoconti = sottoconti.length > 0;

  return (
    <CRow>
      <CCol md={hasSottoconti ? 6 : 12}>
        {showLabels && (
          <label className="form-label small text-muted">
            Conto Contabile 
            {loadingConti && <CSpinner size="sm" className="ms-1" />}
          </label>
        )}
        <div className="d-flex align-items-center">
          <CFormSelect
            size={size}
            value={localConto}
            onChange={handleContoChange}
            disabled={disabled || loadingConti}
            className="me-2"
          >
            <option value="">-- Seleziona Conto --</option>
            {conti.map((conto) => (
              <option key={conto.codice_conto} value={conto.codice_conto}>
                {conto.codice_conto} - {conto.descrizione}
              </option>
            ))}
          </CFormSelect>
          
          {loadingConti && <CSpinner size="sm" />}
        </div>
        
        {/* Info badge per il conto selezionato */}
        {selectedContoObj && (
          <div className="mt-1">
            <CBadge color="info" className="small">
              Tipo: {selectedContoObj.tipo}
            </CBadge>
          </div>
        )}
      </CCol>

      {/* Colonna Sottoconto - mostrata solo se ci sono sottoconti */}
      {hasSottoconti && (
        <CCol md={6}>
          {showLabels && (
            <label className="form-label small text-muted">
              Sottoconto
              {loadingSottoconti && <CSpinner size="sm" className="ms-1" />}
            </label>
          )}
          <div className="d-flex align-items-center">
            <CFormSelect
              size={size}
              value={localSottoconto}
              onChange={handleSottocontoChange}
              disabled={disabled || loadingSottoconti || !localConto}
            >
              <option value="">-- Seleziona Sottoconto --</option>
              {sottoconti.map((sottoconto) => (
                <option key={sottoconto.codice_sottoconto} value={sottoconto.codice_sottoconto}>
                  {sottoconto.codice_sottoconto} - {sottoconto.descrizione}
                </option>
              ))}
            </CFormSelect>
            
            {loadingSottoconti && <CSpinner size="sm" className="ms-1" />}
          </div>
          
          {/* Info badge sottoconti disponibili */}
          <div className="mt-1">
            <CBadge color="secondary" className="small">
              {sottoconti.length} sottoconto{sottoconti.length !== 1 ? 'i' : ''} disponibile{sottoconti.length !== 1 ? 'i' : ''}
            </CBadge>
          </div>
        </CCol>
      )}

      {/* Messaggio se il conto selezionato non ha sottoconti */}
      {localConto && !hasSottoconti && !loadingSottoconti && (
        <CCol md={12}>
          <div className="mt-2">
            <CBadge color="warning" className="small">
              Questo conto non ha sottoconti
            </CBadge>
          </div>
        </CCol>
      )}
    </CRow>
  );
};

export default ContoSottocontoSelect;