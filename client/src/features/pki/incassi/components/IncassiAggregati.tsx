import React from 'react';
import { CAlert } from '@coreui/react';

interface IncassiAggregatiProps {
  numeroFatture: number;
  importoTotale: number;
}

const IncassiAggregati: React.FC<IncassiAggregatiProps> = ({ numeroFatture, importoTotale }) => {
  return (
    <CAlert color="info" className="mb-3">
      <div><strong>Numero fatture:</strong> {numeroFatture}</div>
      <div><strong>Importo totale:</strong> € {importoTotale.toFixed(2)}</div>
    </CAlert>
  );
};

export default IncassiAggregati; 