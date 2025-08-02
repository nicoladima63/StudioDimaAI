import React from 'react';
import { CContainer } from '@coreui/react';
import FornitoriView from '../components/FornitoriView';

const FornitoriPage: React.FC = () => {
  return (
    <CContainer fluid>
      <div className="mb-4">
        <h2>Gestione Fornitori</h2>
        <p className="text-muted">
          Visualizza e gestisci l'elenco dei fornitori con dettagli completi e fatture associate
        </p>
      </div>

      <FornitoriView />
    </CContainer>
  );
};

export default FornitoriPage;