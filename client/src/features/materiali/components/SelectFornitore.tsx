import React, { useState, useEffect } from 'react';
import {
  CRow,
  CCol,
  CFormLabel,
  CFormSelect,
  CCard,
  CCardBody
} from '@coreui/react';
import SelectConto from '@/components/selects/SelectConto';

import type { FornitoreItem } from '../types';
import materialiService from '../services/materiali.service';

interface SelectFornitoreProps {
  fornitoreSelezionato: FornitoreItem | null;
  onFornitoreChange: (fornitore: FornitoreItem | null) => void;
  contoid: number | null;
  onContoChange: (contoid: number | null) => void;
}

const SelectFornitore: React.FC<SelectFornitoreProps> = ({
  fornitoreSelezionato,
  onFornitoreChange,
  contoid,
  onContoChange
}) => {
  const [fornitori, setFornitori] = useState<FornitoreItem[]>([]);
  const [loadingFornitori, setLoadingFornitori] = useState(false);

  // Handle conto change
  const handleContoChange = (newContoid: number | null) => {
    onContoChange(newContoid);
  };

  // Load fornitori when conto changes
  useEffect(() => {
    const loadFornitori = async () => {
      // Carica fornitori solo quando è selezionato il conto
      if (contoid) {
        setLoadingFornitori(true);
        
        try {
          const response = await materialiService.apiGetFornitoriByClassificazione({
            contoid
          });
          
          if (response.success) {
            setFornitori(response.data);
          } else {
            console.error('Errore caricamento fornitori:', response.error);
            setFornitori([]);
          }
        } catch (error) {
          console.error('Errore chiamata API fornitori:', error);
          setFornitori([]);
        } finally {
          setLoadingFornitori(false);
        }
      } else {
        setFornitori([]);
        setLoadingFornitori(false);
      }
    };

    loadFornitori();
  }, [contoid]); // Solo il conto attiva il caricamento fornitori

  const handleFornitoreSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const codice = e.target.value;
    if (!codice) {
      onFornitoreChange(null);
      return;
    }

    const fornitore = fornitori.find(f => f.codice_riferimento === codice);
    onFornitoreChange(fornitore || null);
  };

  return (
    <CCard>
      <CCardBody>
        <h6 className="mb-3">Selezione Fornitore</h6>
        
        {/* Selezione semplificata: solo Conto e Fornitore */}
        <CRow className="mb-3">
          <CCol md={4}>
            <CFormLabel>Conto</CFormLabel>
            <SelectConto
              value={contoid}
              onChange={handleContoChange}
              autoSelectIfSingle={false}
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel>Fornitore</CFormLabel>
            <CFormSelect
              value={fornitoreSelezionato?.codice_riferimento || ''}
              onChange={handleFornitoreSelectChange}
              disabled={!contoid || loadingFornitori}
            >
              <option value="">-- Seleziona fornitore --</option>
              
              {loadingFornitori && (
                <option disabled>Caricamento fornitori...</option>
              )}
              
              {fornitori.map((fornitore) => (
                <option 
                  key={fornitore.codice_riferimento} 
                  value={fornitore.codice_riferimento}
                >
                  {fornitore.fornitore_nome}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          
          {fornitoreSelezionato && (
            <CCol md={2} className="d-flex align-items-end">
              <div className="text-success">
                <small>
                  ✓ <strong>Selezionato</strong>
                </small>
              </div>
            </CCol>
          )}
        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default SelectFornitore;