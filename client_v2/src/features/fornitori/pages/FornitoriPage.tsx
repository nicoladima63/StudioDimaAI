import React, { useState, useEffect } from 'react';
import { CButton, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CSpinner, CAlert } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilDollar, cilSettings } from '@coreui/icons';

import PageLayout from '@/components/layout/PageLayout';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import ClassificazioneStatus from '@/features/fornitori/components/ClassificazioneStatus';
import { ModalAnagrafica, ModalFattureElenco, ModalFatturaDetail } from '@/components/modals';
import { useFornitori, useFornitoriStore, type Fornitore } from '@/store/fornitori.store';
import { useFornitoreModals } from '@/features/fornitori/hooks/useFornitoreModals';
import classificazioniService from '@/features/fornitori/services/classificazioni.service';
import type { ClassificazioneCosto } from '@/features/fornitori/types';

const FornitoriPage: React.FC = () => {
  const { fornitori, isLoading, error, loadAll } = useFornitori();
  const { invalidateCache } = useFornitoriStore();
  
  // Stato per il filtro fornitore
  const [selectedFornitore, setSelectedFornitore] = useState<Fornitore | null>(null);
  
  // Stato per le classificazioni
  const [classificazioni, setClassificazioni] = useState<ClassificazioneCosto[]>([]);
  
  // Hook per gestire le 3 modal riusabili
  const {
    // Stati modal
    anagraficaModalVisible,
    fattureElencoModalVisible,
    fatturaDetailModalVisible,
    
    // Dati selezionati
    selectedFornitore: selectedFornitoreModal,
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
    openFattureElencoModal,
    closeAnagraficaModal,
    closeFattureElencoModal,
    closeFatturaDetailModal
  } = useFornitoreModals();
  
  // Fornitori filtrati per la tabella
  const filteredFornitori = selectedFornitore ? [selectedFornitore] : fornitori;

  // Carica classificazioni usando il servizio centralizzato
  const loadClassificazioni = async () => {
    try {
      const response = await classificazioniService.getFornitoriClassificati();
      if (response.success) {
        setClassificazioni(response.data);
      }
    } catch (error) {
      console.error('Errore nel caricamento classificazioni:', error);
    }
  };

  // Carica dati all'avvio
  useEffect(() => {
    loadAll();
    loadClassificazioni();
  }, []);

  // Handler per aggiornamento forzato
  const handleForceRefresh = () => {
    invalidateCache();
    loadAll();
    loadClassificazioni();
  };

  // Ottieni classificazione per un fornitore
  const getClassificazioneForFornitore = (fornitoreId: string): ClassificazioneCosto | null => {
    // Cerca per codice_riferimento che dovrebbe contenere l'ID del fornitore
    return classificazioni.find(c => c.codice_riferimento === fornitoreId) || null;
  };

  // Handler per cambio classificazione
  const handleClassificazioneChange = () => {
    // Ricarica le classificazioni per aggiornare lo stato
    loadClassificazioni();
  };

  // Gestori azioni tabella
  const handleView = (fornitore: Fornitore) => {
    openAnagraficaModal(fornitore);
  };

  const handleViewSpese = (fornitore: Fornitore) => {
    openFattureElencoModal(fornitore);
  };

  if (error) {
    return (
      <PageLayout>
        <PageLayout.Header title="Gestione Fornitori" />
        <PageLayout.ContentBody>
          <CAlert color="danger">
            Errore nel caricamento dei fornitori: {error}
          </CAlert>
        </PageLayout.ContentBody>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Gestione Fornitori (Esperimento)"
        headerAction={
          <div className="d-flex gap-2">
            <CButton color="primary" onClick={handleForceRefresh} disabled={isLoading}>
              {isLoading ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Caricamento...
                </>
              ) : (
                <>
                  <CIcon icon={cilSettings} className="me-2" />
                  Aggiorna
                </>
              )}
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
                <label className="form-label fw-bold">Filtro Fornitore</label>
                <FornitoriSelect
                  value={selectedFornitore?.id || null}
                  onChange={setSelectedFornitore}
                  placeholder="Seleziona un fornitore per filtrare..."
                  clearable={true}
                />
                {selectedFornitore && (
                  <small className="text-muted">
                    Filtro attivo: {selectedFornitore.nome}
                  </small>
                )}
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
        {isLoading ? (
          <div className="text-center py-4">
            <CSpinner size="sm" />
            <p className="mt-2">Caricamento fornitori...</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <CTable striped hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell scope="col">Codice</CTableHeaderCell>
                  <CTableHeaderCell scope="col">Nome Fornitore</CTableHeaderCell>
                  <CTableHeaderCell scope="col">Partita IVA</CTableHeaderCell>
                  <CTableHeaderCell scope="col">Telefono</CTableHeaderCell>
                  <CTableHeaderCell scope="col">Email</CTableHeaderCell>
                  <CTableHeaderCell scope="col">Classificazione Gerarchica</CTableHeaderCell>
                  <CTableHeaderCell scope="col">Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filteredFornitori.map((fornitore) => {
                  const classificazione = getClassificazioneForFornitore(fornitore.id);
                  
                  return (
                    <CTableRow key={fornitore.id}>
                      <CTableDataCell>
                        <code>{fornitore.codice}</code>
                      </CTableDataCell>
                      <CTableDataCell>
                        <strong>{fornitore.nome}</strong>
                      </CTableDataCell>
                      <CTableDataCell>
                        {fornitore.partita_iva || '-'}
                      </CTableDataCell>
                      <CTableDataCell>
                        {fornitore.telefono || '-'}
                      </CTableDataCell>
                      <CTableDataCell>
                        {fornitore.email || '-'}
                      </CTableDataCell>
                      <CTableDataCell>
                        <ClassificazioneStatus
                          fornitoreId={fornitore.id}
                          fornitoreNome={fornitore.nome}
                          classificazione={classificazione}
                          onClassificazioneChange={handleClassificazioneChange}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex gap-1">
                          <CButton
                            color="primary"
                            size="sm"
                            variant="outline"
                            onClick={() => handleView(fornitore)}
                            title="Visualizza anagrafica"
                          >
                            <CIcon icon={cilList} size="sm" />
                          </CButton>
                          <CButton
                            color="warning"
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewSpese(fornitore)}
                            title="Visualizza spese"
                          >
                            <CIcon icon={cilDollar} size="sm" />
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  );
                })}
              </CTableBody>
            </CTable>
          </div>
        )}
      </PageLayout.ContentBody>

      <PageLayout.Footer text="Sistema modulare con 3 modal riusabili per fornitori" />
      
      {/* 1. Modal Anagrafica Fornitore */}
      {selectedFornitoreModal && (
        <ModalAnagrafica
          visible={anagraficaModalVisible}
          onClose={closeAnagraficaModal}
          title={`Anagrafica Fornitore: ${selectedFornitoreModal.nome}`}
          subtitle={`Codice: ${selectedFornitoreModal.codice}`}
          campi={getCampiAnagrafica(selectedFornitoreModal)}
          showFattureButton={false}
        />
      )}

      {/* 2. Modal Elenco Spese Fornitore */}
      {selectedFornitoreModal && (
        <ModalFattureElenco
          visible={fattureElencoModalVisible}
          onClose={closeFattureElencoModal}
          title={`Spese Fornitore: ${selectedFornitoreModal.nome}`}
          subtitle={`Codice: ${selectedFornitoreModal.codice}`}
          entitaId={selectedFornitoreModal.id}
          entitaType="fornitore"
          onFetchFatture={fetchFattureFornitore}
          onFetchDettagliFattura={fetchDettagliFatturaRighe}
        />
      )}

      {/* 3. Modal Dettaglio Singola Spesa */}
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