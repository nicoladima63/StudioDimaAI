import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CRow,
  CCol,
  CSpinner
} from '@coreui/react';
import type { Materiale } from '@/store/materiali.store';
import ContiSelect from '@/components/selects/ContiSelect';
import BrancheSelect from '@/components/selects/BrancheSelect';
import SottocontiSelect from '@/components/selects/SottocontiSelect';

// Assumiamo che gli store esistano e abbiano un metodo per caricare i dati
// import { useContiStore } from '@/store/conti.store';
// import { useBrancheStore } from '@/store/branche.store';
// import { useSottocontiStore } from '@/store/sottoconti.store';

export interface ClassificazioneData {
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
}

interface ClassificazioneMaterialeModalProps {
  visible: boolean;
  onClose: () => void;
  materiale: Materiale | null;
  onSave: (data: ClassificazioneData) => Promise<void>;
  loading?: boolean;
}

const ClassificazioneMaterialeModal: React.FC<ClassificazioneMaterialeModalProps> = ({
  visible,
  onClose,
  materiale,
  onSave,
  loading = false,
}) => {
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  // Carica i dati per i select quando il modale diventa visibile
  // Nota: i componenti Select potrebbero già gestire il caricamento in autonomia
  useEffect(() => {
    if (visible) {
      // Esempio di come si potrebbero caricare i dati, se necessario
      // useContiStore.getState().load(); 
    }
  }, [visible]);

  // Popola lo stato interno quando il materiale cambia
  useEffect(() => {
    if (materiale) {
      setContoId(materiale.contoid);
      setBrancaId(materiale.brancaid);
      setSottocontoId(materiale.sottocontoid);
    } else {
      // Resetta i campi quando il modale viene chiuso o il materiale è nullo
      setContoId(null);
      setBrancaId(null);
      setSottocontoId(null);
    }
  }, [materiale]);

  const handleSave = () => {
    if (!materiale) return;
    onSave({
      contoid: contoId,
      brancaid: brancaId,
      sottocontoid: sottocontoId,
    });
  };

  return (
    <CModal visible={visible} onClose={onClose} backdrop="static" size="lg">
      <CModalHeader closeButton>
        <CModalTitle>Modifica Classificazione: {materiale?.nome}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {materiale ? (
          <CRow className="g-3">
                      <CCol xs={12}>
                        <label className="form-label fw-bold">Conto</label>
                        <ContiSelect
                          value={contoId}
                          onChange={(conto) => {
                            const newContoId = conto ? conto.id : null;
                            setContoId(newContoId);
                            // Resetta i figli quando il genitore cambia
                            setBrancaId(null);
                            setSottocontoId(null);
                          }}
                          clearable
                        />
                      </CCol>
                      <CCol xs={12}>
                        <label className="form-label fw-bold">Branca</label>
                        <BrancheSelect
                          contoId={contoId} // Passa il filtro
                          value={brancaId}
                          onChange={(branca) => {
                            const newBrancaId = branca ? branca.id : null;
                            setBrancaId(newBrancaId);
                            // Resetta il figlio quando il genitore cambia
                            setSottocontoId(null);
                          }}
                          clearable
                        />
                      </CCol>
                      <CCol xs={12}>
                        <label className="form-label fw-bold">Sottoconto</label>
                        <SottocontiSelect
                          brancaId={brancaId} // Passa il filtro
                          value={sottocontoId}
                          onChange={(sottoconto) => setSottocontoId(sottoconto ? sottoconto.id : null)}
                          clearable
                        />            </CCol>
          </CRow>
        ) : (
          <div className="text-center">
            <CSpinner />
            <p>Caricamento dati materiale...</p>
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose} disabled={loading}>
          Annulla
        </CButton>
        <CButton color="primary" onClick={handleSave} disabled={loading}>
          {loading ? <CSpinner size="sm" /> : 'Salva'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default ClassificazioneMaterialeModal;
