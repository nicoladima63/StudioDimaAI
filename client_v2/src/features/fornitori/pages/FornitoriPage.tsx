import React from 'react';
import { CButton } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import FornitoriTable from '@/features/fornitori/components/FornitoriTable';
import { useFornitori, type Fornitore } from '@/store/fornitori.store';

const FornitoriPage: React.FC = () => {
  const { fornitori, isLoading, error, loadAll } = useFornitori();

  // Carica fornitori all'avvio
  React.useEffect(() => {
    loadAll();
  }, []);

  // Gestori azioni tabella
  const handleEdit = (fornitore: Fornitore) => {
    console.log('Edit fornitore:', fornitore);
    // TODO: Aprire modal di modifica
  };

  const handleDelete = (fornitore: Fornitore) => {
    console.log('Delete fornitore:', fornitore);
    // TODO: Conferma eliminazione
  };

  const handleView = (fornitore: Fornitore) => {
    console.log('View fornitore:', fornitore);
    // TODO: Aprire modal dettagli
  };

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Gestione Fornitori"
        headerAction={
          <div className="d-flex gap-2">
            <CButton 
              color="primary"
              onClick={() => loadAll(true)}
              disabled={isLoading}
            >
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
            <CButton color="success">
              Aggiungi Fornitore
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <div className="row">
          <div className="col-md-8">
            <h5 className="mb-3">Filtri e Ricerca</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Filtri</label>
                <p className="text-muted mb-0 small">
                  Prossimamente: classificazione, nome, codice, partita IVA
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <h5 className="mb-3">Statistiche</h5>
            <div className="row g-2">
              <div className="col-12">
                <div className="d-flex justify-content-between">
                  <span>Totale fornitori:</span>
                  <strong>{fornitori.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <FornitoriTable
          fornitori={fornitori}
          loading={isLoading}
          error={error}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />
      </PageLayout.ContentBody>

      <PageLayout.Footer text="Gestione completa dei fornitori del progetto" />
    </PageLayout>
  );
};

export default FornitoriPage;