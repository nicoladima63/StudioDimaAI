import React from 'react';
import { CButton } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import PazientiTable from '@/features/pazienti/components/PazientiTable';
import { ModalAnagrafica } from '@/components/modals';
import { usePazienti, usePazientiStore, type Paziente } from '@/store/pazienti.store';

const PazientiPage: React.FC = () => {
  const { pazienti, isLoading, error, loadAll } = usePazienti();
  const { invalidateCache } = usePazientiStore();

  // Stati per modal anagrafica
  const [anagraficaModalVisible, setAnagraficaModalVisible] = React.useState(false);
  const [selectedPaziente, setSelectedPaziente] = React.useState<Paziente | null>(null);

  // Carica pazienti all'avvio
  React.useEffect(() => {
    loadAll();
  }, []);
  
  // Handler per aggiornamento forzato
  const handleForceRefresh = () => {
    invalidateCache();
    loadAll();
  };

  // Gestori azioni tabella
  const handleView = (paziente: Paziente) => {
    setSelectedPaziente(paziente);
    setAnagraficaModalVisible(true);
  };

  const closeAnagraficaModal = () => {
    setAnagraficaModalVisible(false);
    setSelectedPaziente(null);
  };

  // Configurazione campi anagrafica paziente
  const getCampiAnagrafica = (paziente: Paziente) => [
    { label: 'Nome', value: paziente.nome || '-' },
    { label: 'Cognome', value: paziente.cognome || '-' },
    { label: 'Codice Fiscale', value: paziente.codice_fiscale || '-' },
    { label: 'Data di Nascita', value: paziente.data_nascita || '-' },
    { label: 'Luogo di Nascita', value: paziente.luogo_nascita || '-' },
    { label: 'Sesso', value: paziente.sesso || '-' },
    { label: 'Indirizzo', value: paziente.indirizzo || '-' },
    { label: 'Città', value: paziente.citta || '-' },
    { label: 'CAP', value: paziente.cap || '-' },
    { label: 'Provincia', value: paziente.provincia || '-' },
    { label: 'Telefono', value: paziente.telefono || '-' },
    { label: 'Email', value: paziente.email || '-' },
    { label: 'Tessera Sanitaria', value: paziente.tessera_sanitaria || '-' },
    { label: 'Note', value: paziente.note || '-' }
  ];

  return (
    <PageLayout>
      <PageLayout.Header 
        title="Gestione Pazienti"
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
                  Prossimamente: nome, cognome, codice fiscale, data nascita
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <h5 className="mb-3">Statistiche</h5>
            <div className="row g-2">
              <div className="col-12">
                <div className="d-flex justify-content-between">
                  <span>Totale pazienti:</span>
                  <strong>{pazienti.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <PazientiTable
          pazienti={pazienti}
          loading={isLoading}
          error={error}
          onView={handleView}
          onRichiamoChange={(pazienteId, status, dataRichiamo) => {
            // Aggiorna lo store locale
            usePazientiStore.getState().updateRichiamoStatus(pazienteId, status, dataRichiamo);
          }}
        />
      </PageLayout.ContentBody>

      <PageLayout.Footer text="Gestione pazienti dello studio" />
      
      {/* Modal Anagrafica Paziente */}
      {selectedPaziente && (
        <ModalAnagrafica
          visible={anagraficaModalVisible}
          onClose={closeAnagraficaModal}
          title={`Anagrafica Paziente: ${selectedPaziente.nome} ${selectedPaziente.cognome}`}
          subtitle={`CF: ${selectedPaziente.codice_fiscale}`}
          campi={getCampiAnagrafica(selectedPaziente)}
          showFattureButton={false}
        />
      )}
    </PageLayout>
  );
};

export default PazientiPage;