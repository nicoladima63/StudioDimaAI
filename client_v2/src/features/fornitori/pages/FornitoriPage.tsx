import React from 'react';
import { CButton } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import FornitoriTable from '@/features/fornitori/components/FornitoriTable';
import { ModalAnagrafica, ModalFattureElenco, ModalFatturaDetail } from '@/components/modals';
import { useFornitori, useFornitoriStore, type Fornitore } from '@/store/fornitori.store';
import { useFornitoreModals } from '@/features/fornitori/hooks/useFornitoreModals';

const FornitoriPage: React.FC = () => {
  const { fornitori, isLoading, error, loadAll } = useFornitori();
  const { invalidateCache } = useFornitoriStore();

  // Hook per gestire le 3 modal riusabili
  const {
    // Stati modal
    anagraficaModalVisible,
    fattureElencoModalVisible,
    fatturaDetailModalVisible,
    
    // Dati selezionati
    selectedFornitore,
    selectedFatturaId,

    // Configurazioni
    getCampiAnagrafica,

    // API functions
    fetchFattureFornitore,
    fetchDettagliFatturaRighe,
    fetchFatturaCompleta,
    fetchDettagliCompleti,

    // Handlers
    openAnagraficaModal,
    closeAnagraficaModal,
    closeFattureElencoModal,
    closeFatturaDetailModal,
    switchToFattureFromAnagrafica
  } = useFornitoreModals();

  // Carica fornitori all'avvio
  React.useEffect(() => {
    loadAll();
  }, []);
  
  // Handler per aggiornamento forzato
  const handleForceRefresh = () => {
    invalidateCache();
    loadAll();
  };

  // Gestori azioni tabella (solo visualizzazione anagrafica)
  const handleView = (fornitore: Fornitore) => {
    openAnagraficaModal(fornitore);
  };

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Gestione Fornitori"
        headerAction={
          <div className="d-flex gap-2">
            <CButton color="primary" onClick={handleForceRefresh} disabled={isLoading}>
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <div className="row">
          <div className="col-md-10">
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
          <div className="col-md-2">
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
          onView={handleView}
        />
      </PageLayout.ContentBody>

      <PageLayout.Footer text="Sistema modulare con 3 modal riusabili per fornitori" />
      
      {/* 1. Modal Anagrafica Fornitore */}
      {selectedFornitore && (
        <ModalAnagrafica
          visible={anagraficaModalVisible}
          onClose={closeAnagraficaModal}
          title={`Anagrafica Fornitore: ${selectedFornitore.nome}`}
          subtitle={`Codice: ${selectedFornitore.codice}`}
          campi={getCampiAnagrafica(selectedFornitore)}
          onViewFatture={switchToFattureFromAnagrafica}
          showFattureButton={true}
        />
      )}

      {/* 2. Modal Elenco Fatture Fornitore */}
      {selectedFornitore && (
        <ModalFattureElenco
          visible={fattureElencoModalVisible}
          onClose={closeFattureElencoModal}
          title={`Fatture Fornitore: ${selectedFornitore.nome}`}
          subtitle={`Codice: ${selectedFornitore.codice}`}
          entitaId={selectedFornitore.id}
          entitaType="fornitore"
          onFetchFatture={fetchFattureFornitore}
          onFetchDettagliFattura={fetchDettagliFatturaRighe}
        />
      )}

      {/* 3. Modal Dettaglio Singola Fattura */}
      <ModalFatturaDetail
        visible={fatturaDetailModalVisible}
        onClose={closeFatturaDetailModal}
        fatturaId={selectedFatturaId}
        entitaType="fornitore"
        onFetchFatturaDetail={fetchFatturaCompleta}
        onFetchDettagliRighe={fetchDettagliCompleti}
      />
    </PageLayout>
  );
};

export default FornitoriPage;