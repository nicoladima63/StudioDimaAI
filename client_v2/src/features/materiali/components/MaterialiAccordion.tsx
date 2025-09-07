import React from 'react';
import { 
  CAccordion, 
  CAccordionItem, 
  CAccordionHeader, 
  CAccordionBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CSpinner
} from '@coreui/react';

import type { Materiale } from '@/store/materiali.store';

interface MaterialiAccordionProps {
  materiali: Materiale[];
  loading?: boolean;
  error?: string | null;
}

const MaterialiAccordion: React.FC<MaterialiAccordionProps> = ({
  materiali,
  loading = false,
  error = null
}) => {
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <CSpinner color="primary" />
        <span className="ms-3">Caricamento materiali...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <h4>Errore</h4>
        <p>{error}</p>
      </div>
    );
  }

  // Raggruppa i materiali per nome
  const materialiRaggruppati = materiali.reduce((acc, materiale) => {
    const nome = materiale.nome;
    if (!acc[nome]) {
      acc[nome] = {
        nome,
        materiali: [],
        acquisti_totali: 0,
        prezzo_medio: 0,
        prezzo_min: Infinity,
        prezzo_max: 0,
        fornitori: new Set()
      };
    }
    acc[nome].materiali.push(materiale);
    acc[nome].acquisti_totali++;
    acc[nome].prezzo_medio += materiale.costo_unitario;
    acc[nome].prezzo_min = Math.min(acc[nome].prezzo_min, materiale.costo_unitario);
    acc[nome].prezzo_max = Math.max(acc[nome].prezzo_max, materiale.costo_unitario);
    acc[nome].fornitori.add(materiale.fornitorenome);
    
    return acc;
  }, {} as Record<string, any>);

  // Calcola prezzo medio e ordina per nome
  const gruppiOrdinati = Object.values(materialiRaggruppati).map((gruppo: any) => ({
    ...gruppo,
    prezzo_medio: gruppo.prezzo_medio / gruppo.acquisti_totali,
    fornitori_count: gruppo.fornitori.size
  })).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <CAccordion>
      {gruppiOrdinati.map((gruppo, gruppoIndex) => (
        <CAccordionItem key={gruppoIndex} itemKey={gruppoIndex.toString()}>
          <CAccordionHeader>
            <div className='d-flex justify-content-between align-items-center w-100 me-3'>
              <div>
                <strong>{gruppo.nome}</strong>
                <div className='small text-muted'>
                  <CBadge color='info' size='sm' className='ms-2'>
                    {gruppo.fornitori_count} fornitore{gruppo.fornitori_count > 1 ? 'i' : ''}
                  </CBadge>
                </div>
              </div>
              <div className='d-flex align-items-center gap-2'>
                <CBadge color='primary' size='sm'>
                  {gruppo.acquisti_totali} acquisti
                </CBadge>
                <CBadge color='secondary' size='sm'>
                  €{gruppo.prezzo_medio.toFixed(2)} medio
                </CBadge>
                <CBadge color='outline-primary' size='sm'>
                  €{gruppo.prezzo_min.toFixed(2)} - €{gruppo.prezzo_max.toFixed(2)}
                </CBadge>
              </div>
            </div>
          </CAccordionHeader>
          <CAccordionBody>
            <CTable hover responsive size='sm'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>Codice Articolo</CTableHeaderCell>
                  <CTableHeaderCell>Fornitore</CTableHeaderCell>
                  <CTableHeaderCell>Data Fattura</CTableHeaderCell>
                  <CTableHeaderCell>Numero Fattura</CTableHeaderCell>
                  <CTableHeaderCell>Costo Unitario</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {gruppo.materiali.map((materiale: Materiale, matIndex: number) => (
                  <CTableRow key={matIndex}>
                    <CTableDataCell>{materiale.id}</CTableDataCell>
                    <CTableDataCell>
                      {materiale.codicearticolo || <span className='text-muted'>-</span>}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>
                        <div className="fw-bold">{materiale.fornitorenome}</div>
                        <small className="text-muted">{materiale.fornitoreid}</small>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {materiale.data_fattura ? (
                        new Date(materiale.data_fattura).toLocaleDateString('it-IT')
                      ) : (
                        <span className='text-muted'>-</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {materiale.fattura_id || <span className='text-muted'>-</span>}
                    </CTableDataCell>
                    <CTableDataCell>€{materiale.costo_unitario.toFixed(2)}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CAccordionBody>
        </CAccordionItem>
      ))}
    </CAccordion>
  );
};

export default MaterialiAccordion;
