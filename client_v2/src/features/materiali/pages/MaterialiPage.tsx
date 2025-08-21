import React from 'react';
import { CButton } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import MaterialiTable from '@/features/materiali/components/MaterialiTable';
import { useMateriali, type Materiale } from '@/store/materiali.store';

const MaterialiPage: React.FC = () => {
  const { materiali, isLoading, error, load } = useMateriali();

  // Carica materiali all'avvio
  React.useEffect(() => {
    load();
  }, []);

  // Gestori azioni tabella
  const handleEdit = (materiale: Materiale) => {
    console.log('Edit materiale:', materiale);
    // TODO: Aprire modal di modifica
  };

  const handleDelete = (materiale: Materiale) => {
    console.log('Delete materiale:', materiale);
    // TODO: Conferma eliminazione
  };

  const handleView = (materiale: Materiale) => {
    console.log('View materiale:', materiale);
    // TODO: Aprire modal dettagli
  };

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Gestione Materiali"
        headerAction={
          <div className="d-flex gap-2">
            <CButton 
              color="primary"
              onClick={() => load(true)}
              disabled={isLoading}
            >
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
            <CButton color="success">
              Aggiungi Materiale
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <div className="row">
          <div className="col-md-6">
            <h5>Filtri e Ricerca</h5>
            <p className="text-muted mb-0">
              Placeholder per filtri: fornitore, conto, branca, sottoconto, nome, codice
            </p>
          </div>
          <div className="col-md-6">
            <h5>Statistiche</h5>
            <p className="text-muted mb-0">
              Totale materiali: <strong>{materiali.length}</strong>
            </p>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <MaterialiTable
          materiali={materiali}
          loading={isLoading}
          error={error}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />
      </PageLayout.ContentBody>

      <PageLayout.Footer text="Gestione completa dei materiali del magazzino" />
    </PageLayout>
  );
};

export default MaterialiPage;