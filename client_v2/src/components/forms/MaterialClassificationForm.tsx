import React, { useState, useEffect } from 'react';
import {
  CForm,
  CFormLabel,
  CButton,
  CSpinner,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import ContiSelect from '@/components/selects/ContiSelect';
import BrancheSelect from '@/components/selects/BrancheSelect';
import SottocontiSelect from '@/components/selects/SottocontiSelect';
import { materialiClassificationService } from '@/features/materiali/services/materiali-classification.service';
import { useConti, useBranche, useSottoconti } from '@/store/conti.store';

// Types per il form di classificazione
export interface MaterialClassificationData {
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
  contonome?: string;
  brancanome?: string;
  sottocontonome?: string;
}

export interface MaterialForClassification {
  codice_articolo: string;
  descrizione: string;
  fornitore_id: string;
  nome_fornitore: string;
  fattura_id?: string;
  data_fattura?: string;
  costo_unitario?: number;
}

interface MaterialClassificationFormProps {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialForClassification | null;
  onSave: (materialId: number, classificationData: MaterialClassificationData) => void;
  onError: (error: string) => void;
}

export const MaterialClassificationForm: React.FC<MaterialClassificationFormProps> = ({
  isOpen,
  onClose,
  material,
  onSave,
  onError,
}) => {
  // State per il form - DEVE essere prima degli hook che lo usano
  const [classificazione, setClassificazione] = useState<MaterialClassificationData>({
    contoid: null,
    brancaid: null,
    sottocontoid: null,
  });
  
    const { conti, isLoading: contiLoading } = useConti();
    const { branche } = useBranche(classificazione.contoid);
    const { sottoconti } = useSottoconti(classificazione.brancaid);
  
  // Crea le mappe per i nomi
  const contiMap = conti.reduce((map, conto) => ({ ...map, [conto.id]: conto.nome }), {} as Record<number, string>);
  const brancheMap = branche.reduce((map, branca) => ({ ...map, [branca.id]: branca.nome }), {} as Record<number, string>);
  const sottocontiMap = sottoconti.reduce((map, sottoconto) => ({ ...map, [sottoconto.id]: sottoconto.nome }), {} as Record<number, string>);
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);


  // Reset form quando si apre con nuovo materiale
  useEffect(() => {
    if (isOpen && material) {
      setClassificazione({
        contoid: null,
        brancaid: null,
        sottocontoid: null,
      });
    }
  }, [isOpen, material]);

  const handleContoChange = (contoid: number | null) => {
    const contonome = contoid ? contiMap[contoid] || '' : '';
    
    setClassificazione(prev => ({
      ...prev,
      contoid,
      brancaid: null, // Reset branca quando cambia conto
      sottocontoid: null, // Reset sottoconto quando cambia conto
      contonome,
    }));
  };

  const handleBrancaChange = (brancaid: number | null) => {
    setClassificazione(prev => ({
      ...prev,
      brancaid,
      sottocontoid: null, // Reset sottoconto quando cambia branca
      brancanome: brancaid ? brancheMap[brancaid] || '' : '',
    }));
  };

  const handleSottocontoChange = (sottocontoid: number | null) => {
    setClassificazione(prev => ({
      ...prev,
      sottocontoid,
      sottocontonome: sottocontoid ? sottocontiMap[sottocontoid] || '' : '',
    }));
  };

  const handleSave = async () => {
    if (!material || !classificazione.contoid) {
      onError('Seleziona almeno un conto per salvare la classificazione');
      return;
    }

    // CONTROLLO DATI OBBLIGATORI - se non ci sono, STOP
    const contonome = contiMap[classificazione.contoid];
    if (!contonome) {
      onError('Errore: nome conto non trovato. Ricarica la pagina e riprova.');
      return;
    }

    let brancanome = '';
    let sottocontonome = '';

    // Se è selezionata una branca, deve avere il nome
    if (classificazione.brancaid) {
      brancanome = brancheMap[classificazione.brancaid];
      if (!brancanome) {
        onError('Errore: nome branca non trovato. Ricarica la pagina e riprova.');
        return;
      }
    }

    // Se è selezionato un sottoconto, deve avere il nome
    if (classificazione.sottocontoid) {
      sottocontonome = sottocontiMap[classificazione.sottocontoid];
      if (!sottocontonome) {
        onError('Errore: nome sottoconto non trovato. Ricarica la pagina e riprova.');
        return;
      }
    }

    setSaving(true);
    try {
      // Costruisci il payload per il server - SOLO con dati completi
      const payload = {
        codice_articolo: material.codice_articolo || '',
        descrizione: material.descrizione,
        fornitore_id: material.fornitore_id,
        nome_fornitore: material.nome_fornitore || '',
        contoid: classificazione.contoid,
        contonome: contonome,
        brancaid: classificazione.brancaid || undefined,
        brancanome: brancanome || undefined,
        sottocontoid: classificazione.sottocontoid || undefined,
        sottocontonome: sottocontonome || undefined,
        fattura_id: material.fattura_id,
        data_fattura: material.data_fattura,
        costo_unitario: material.costo_unitario,
      };
      
      console.log('Payload inviato:', payload);
      console.log('Payload dettagliato:', JSON.stringify(payload, null, 2));

      const response = await materialiClassificationService.salvaClassificazioneMateriale(payload as any);

      if (response.success) {
        // Il server non restituisce un ID specifico, usiamo un ID fittizio per la callback
        onSave(1, classificazione); // Passa anche i dati della classificazione
        onClose();
      } else {
        throw new Error(response.error || 'Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Errore nel salvataggio classificazione:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      onError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  if (!material) return null;

  return (
    <CModal 
      visible={isOpen} 
      onClose={handleClose}
      size="lg"
      backdrop={saving ? 'static' : true}
    >
      <CModalHeader>
        <CModalTitle>Classifica Materiale</CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        <div className="mb-3">
          <strong>Materiale:</strong> {material.descrizione}
        </div>
        <div className="mb-3">
          <strong>Codice:</strong> {material.codice_articolo || 'N/A'}
        </div>
        <div className="mb-3">
          <strong>Fornitore:</strong> {material.nome_fornitore}
        </div>
        
        <hr />
        
        <CForm>
          {/* Conto */}
          <div className="mb-3">
            <CFormLabel>Conto *</CFormLabel>
            {contiLoading ? (
              <div className="text-muted">Caricamento conti...</div>
            ) : (
              <ContiSelect
                value={classificazione.contoid}
                onChange={handleContoChange}
                disabled={loading || saving || contiLoading}
              />
            )}
          </div>

          {/* Branca - appare solo dopo selezione conto */}
          {classificazione.contoid && (
            <div className="mb-3">
              <CFormLabel>Branca</CFormLabel>
              <BrancheSelect
                value={classificazione.brancaid}
                onChange={handleBrancaChange}
                contoId={classificazione.contoid}
                disabled={loading || saving}
              />
            </div>
          )}

          {/* Sottoconto - appare solo dopo selezione branca */}
          {classificazione.brancaid && (
            <div className="mb-3">
              <CFormLabel>Sottoconto</CFormLabel>
              <SottocontiSelect
                value={classificazione.sottocontoid}
                onChange={handleSottocontoChange}
                brancaId={classificazione.brancaid}
                disabled={loading || saving}
              />
            </div>
          )}
        </CForm>
      </CModalBody>
      
      <CModalFooter>
        <CButton 
          color="secondary" 
          onClick={handleClose}
          disabled={saving}
        >
          Annulla
        </CButton>
        <CButton 
          color="primary" 
          onClick={handleSave}
          disabled={!classificazione.contoid || saving}
        >
          {saving && <CSpinner size="sm" className="me-2" />}
          Salva Classificazione
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default MaterialClassificationForm;
