import React from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell } from '@coreui/react';

type Incasso = {
  data: string;
  importo: number;
  codice_paziente: string;
  medico: string;
  numero_fattura: string;
  data_fattura?: string;
};

interface IncassiTableProps {
  incassi: Incasso[];
}

const IncassiTable: React.FC<IncassiTableProps> = ({ incassi }) => {
  return (
    <CTable striped hover responsive>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Data</CTableHeaderCell>
          <CTableHeaderCell>Importo</CTableHeaderCell>
          <CTableHeaderCell>Codice Paziente</CTableHeaderCell>
          <CTableHeaderCell>Medico</CTableHeaderCell>
          <CTableHeaderCell>Numero Fattura</CTableHeaderCell>
          <CTableHeaderCell>Data Fattura</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {incassi.map((incasso, idx) => (
          <CTableRow key={idx}>
            <CTableDataCell>{incasso.data}</CTableDataCell>
            <CTableDataCell>{incasso.importo}</CTableDataCell>
            <CTableDataCell>{incasso.codice_paziente}</CTableDataCell>
            <CTableDataCell>{incasso.medico}</CTableDataCell>
            <CTableDataCell>{incasso.numero_fattura}</CTableDataCell>
            <CTableDataCell>{incasso.data_fattura || '-'}</CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  );
};

export default IncassiTable; 