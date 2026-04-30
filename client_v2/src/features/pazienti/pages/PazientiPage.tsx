import React from 'react';
import { CButton } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import PazientiTable from '@/features/pazienti/components/PazientiTable';
import { ModalAnagrafica } from '@/components/modals';
import { usePazienti, usePazientiStore, type Paziente } from '@/store/pazienti.store';
import FiltriPazienti, {
  FILTRI_DEFAULT,
  applicaFiltri,
  type FiltriState,
} from '../components/FiltriPazienti';
import BroadcastModal from '../components/BroadcastModal';

const PazientiPage: React.FC = () => {
  const { pazienti, isLoading, error, loadAll } = usePazienti();
  const { invalidateCache } = usePazientiStore();

  const [anagraficaModalVisible, setAnagraficaModalVisible] = React.useState(false);
  const [selectedPaziente, setSelectedPaziente] = React.useState<Paziente | null>(null);
  const [filtri, setFiltri] = React.useState<FiltriState>(FILTRI_DEFAULT);
  const [broadcastVisible, setBroadcastVisible] = React.useState(false);

  React.useEffect(() => {
    loadAll();
  }, []);

  const handleForceRefresh = () => {
    invalidateCache();
    loadAll();
  };

  const handleView = (paziente: Paziente) => {
    setSelectedPaziente(paziente);
    setAnagraficaModalVisible(true);
  };

  const closeAnagraficaModal = () => {
    setAnagraficaModalVisible(false);
    setSelectedPaziente(null);
  };

  const pazientiMostra  = applicaFiltri(pazienti, filtri);
  const pazientiWa      = pazientiMostra.filter((p) => !!p.cellulare);
  const filtriAttivi    = JSON.stringify(filtri) !== JSON.stringify(FILTRI_DEFAULT);

  const getCampiAnagrafica = (paziente: Paziente) => [
    { label: 'Nome', value: paziente.nome || '-' },
    { label: 'Codice Fiscale', value: paziente.codice_fiscale || '-' },
    { label: 'Data di Nascita', value: paziente.data_nascita || '-' },
    { label: 'Luogo di Nascita', value: paziente.luogo_nascita || '-' },
    { label: 'Sesso', value: paziente.sesso || '-' },
    { label: 'Indirizzo', value: paziente.indirizzo || '-' },
    { label: 'Citta', value: paziente.citta || '-' },
    { label: 'CAP', value: paziente.cap || '-' },
    { label: 'Provincia', value: paziente.provincia || '-' },
    { label: 'Telefono', value: paziente.telefono || '-' },
    { label: 'Email', value: paziente.email || '-' },
    { label: 'Tessera Sanitaria', value: paziente.tessera_sanitaria || '-' },
    { label: 'Note', value: paziente.note || '-' },
  ];

  return (
    <PageLayout>
      <PageLayout.Header
        title="Gestione Pazienti"
        headerAction={
          <div className="d-flex gap-2">
            <CButton
              color="success"
              disabled={pazientiWa.length === 0}
              onClick={() => setBroadcastVisible(true)}
            >
              Invia WhatsApp ({pazientiWa.length})
            </CButton>
            <CButton color="primary" onClick={handleForceRefresh} disabled={isLoading}>
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <FiltriPazienti
          filtri={filtri}
          onChange={setFiltri}
          totale={pazienti.length}
          filtrati={pazientiMostra.length}
          conCellulare={pazientiWa.length}
        />
        {filtriAttivi && (
          <div className="text-end mb-2">
            <CButton color="link" size="sm" onClick={() => setFiltri(FILTRI_DEFAULT)}>
              Azzera filtri
            </CButton>
          </div>
        )}
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <PazientiTable
          pazienti={pazientiMostra}
          loading={isLoading}
          error={error}
          onView={handleView}
          onRichiamoChange={(pazienteId, status, dataRichiamo) => {
            usePazientiStore.getState().updateRichiamoStatus(pazienteId, status, dataRichiamo);
          }}
        />
      </PageLayout.ContentBody>

      <PageLayout.Footer text="Gestione pazienti dello studio" />

      {selectedPaziente && (
        <ModalAnagrafica
          visible={anagraficaModalVisible}
          onClose={closeAnagraficaModal}
          title={`Anagrafica Paziente: ${selectedPaziente.nome}`}
          subtitle={`CF: ${selectedPaziente.codice_fiscale}`}
          campi={getCampiAnagrafica(selectedPaziente)}
          showFattureButton={false}
        />
      )}

      <BroadcastModal
        visible={broadcastVisible}
        onClose={() => setBroadcastVisible(false)}
        pazienti={pazientiWa}
      />
    </PageLayout>
  );
};

export default PazientiPage;
