import React, { useMemo } from 'react';
import { CButton } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import MaterialiTable from '@/features/materiali/components/MaterialiTable';
//import MaterialiAccordion from '@/features/materiali/components/MaterialiAccordion';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import { useMateriali, type Materiale } from '@/store/materiali.store';
import type { Fornitore } from '@/store/fornitori.store';

const MaterialiPage: React.FC = () => {
  const { materiali, isLoading, error, load } = useMateriali();
  const [selectedFornitore, setSelectedFornitore] = React.useState<Fornitore | null>(null);

  // Carica materiali all'avvio
  React.useEffect(() => {
    load();
  }, []);

  // Refresh automatico quando cambia il fornitore selezionato
  React.useEffect(() => {
    if (selectedFornitore) {
      load(true); // Force refresh quando selezioni un fornitore
    }
  }, [selectedFornitore, load]);

  // Filtra materiali in base al fornitore selezionato
  const filteredMateriali = useMemo(() => {
    if (!selectedFornitore) return materiali;
    return materiali.filter(materiale => materiale.fornitoreid === selectedFornitore.id);
  }, [materiali, selectedFornitore]);

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
        title='Gestione Materiali'
        headerAction={
          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={() => load(true)} disabled={isLoading}>
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <div className='row'>
          <div className='col-md-10'>
            <h5 className='mb-3'>Filtri e Ricerca</h5>
            <div className='row g-3'>
              <div className='col-md-6'>
                <label className='form-label fw-bold'>Fornitore</label>
                <FornitoriSelect
                  value={selectedFornitore?.id || null}
                  onChange={fornitore => setSelectedFornitore(fornitore)}
                  placeholder='-- Tutti i fornitori --'
                  searchable={true}
                  clearable={true}
                />
              </div>
              <div className='col-md-6'>
                <label className='form-label fw-bold'>Altri filtri</label>
              </div>
            </div>
          </div>
          <div className='col-md-2'>
            <h5 className='mb-3'>Fornitore selezionato</h5>
            {selectedFornitore && (
              <div className='col-12'>
                <div className='text-muted'>
                  <strong>{selectedFornitore.nome}</strong>
                </div>
              </div>
            )}

            <div className='row g-2'>
              <div className='col-12'>
                <div className='d-flex justify-content-between text-muted'>
                  <strong>Materiali filtrati:</strong>
                    {filteredMateriali.length} su {materiali.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <MaterialiTable
          materiali={filteredMateriali}
          loading={isLoading}
          error={error}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />
        {/* <MaterialiAccordion
          materiali={filteredMateriali}
          loading={isLoading}
          error={error}
        /> */}
      </PageLayout.ContentBody>

      <PageLayout.Footer text='Gestione completa dei materiali del magazzino' />
    </PageLayout>
  );
};

export default MaterialiPage;
