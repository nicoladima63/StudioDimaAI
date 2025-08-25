import React, { useState, useEffect } from 'react';
import { 
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CButton,
  CFormSelect, 
  CFormInput, 
  CFormCheck, 
  CSpinner, 
  CBadge,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave, cilCalendar, cilCheckCircle, cilClock, cilX } from '@coreui/icons';
import type { Paziente } from '@/store/pazienti.store';
import richiami from '../services/richiami.service';

interface ModalRichiamoGestioneProps {
  visible: boolean;
  onClose: () => void;
  paziente: Paziente;
  onRichiamoChange?: (status: string, dataRichiamo?: string) => void;
}

// Tipi di richiamo dal backend
const TIPO_RICHIAMI = {
  '1': 'Generico',
  '2': 'Igiene',
  '3': 'Rx Impianto', 
  '4': 'Controllo',
  '5': 'Impianto',
  '6': 'Ortodonzia'
} as const;

const ModalRichiamoGestione: React.FC<ModalRichiamoGestioneProps> = ({
  visible,
  onClose,
  paziente,
  onRichiamoChange
}) => {
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<string>(paziente.da_richiamare || '');
  const [tempoRichiamo, setTempoRichiamo] = useState<number>(paziente.tempo_richiamo || 6);
  const [tipiSelezionati, setTipiSelezionati] = useState<string[]>([]);
  const [dataRichiamo, setDataRichiamo] = useState('');
  const [showAlert, setShowAlert] = useState<{type: 'success' | 'danger' | 'warning', message: string} | null>(null);

  // Inizializza form quando si apre la modal
  useEffect(() => {
    if (visible) {
      // Imposta stato richiamo
      setStatus(paziente.da_richiamare || '');
      
      // Imposta tempo richiamo (default 6 se non valido)
      const tempoValido = [3, 4, 6, 9, 12].includes(paziente.tempo_richiamo || 0);
      setTempoRichiamo(tempoValido ? paziente.tempo_richiamo! : 6);
      
      // Inizializza tipi richiamo dal valore esistente
      if (paziente.tipo_richiamo) {
        const tipoStr = paziente.tipo_richiamo.toString();
        // Converti stringa tipo "123" in array ["1", "2", "3"]
        const tipi = tipoStr.split('').filter(t => TIPO_RICHIAMI[t as keyof typeof TIPO_RICHIAMI]);
        setTipiSelezionati(tipi);
      } else {
        setTipiSelezionati([]);
      }
      
      // Reset altri campi
      setDataRichiamo('');
      setShowAlert(null);
    }
  }, [visible, paziente]);

  const handleTipoToggle = (tipo: string) => {
    setTipiSelezionati(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo].sort()
    );
  };

  const handleSaveStatus = async () => {
    setUpdating(true);
    setShowAlert(null);
    
    try {
      // Salva stato richiamo
      const statusResponse = await richiami.apiSalvaStatoRichiamo({
        paziente_id: paziente.id,
        da_richiamare: status,
        data_richiamo: status === 'R' ? (dataRichiamo || new Date().toISOString()) : undefined
      });

      if (!statusResponse.success) {
        throw new Error(statusResponse.error || 'Errore salvataggio stato');
      }

      // Se è "da richiamare", salva anche la configurazione
      if (status === 'S' && tipiSelezionati.length > 0) {
        const tipoRichiamoValue = tipiSelezionati.join('');
        
        const configResponse = await richiami.apiAggiornaTipoRichiamo({
          paziente_id: paziente.id,
          tipo_richiamo: tipoRichiamoValue,
          tempo_richiamo: tempoRichiamo
        });

        if (!configResponse.success) {
          throw new Error(configResponse.error || 'Errore salvataggio configurazione');
        }
      }

      setShowAlert({
        type: 'success',
        message: 'Richiamo aggiornato con successo!'
      });

      if (onRichiamoChange) {
        onRichiamoChange(status, status === 'R' ? (dataRichiamo || new Date().toISOString()) : undefined);
      }

      // Chiudi automaticamente dopo 1 secondo
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error: any) {
      setShowAlert({
        type: 'danger',
        message: error.message || 'Errore durante il salvataggio'
      });
    } finally {
      setUpdating(false);
    }
  };

  const calcolaProssimoRichiamo = () => {
    if (!paziente.ultima_visita || !tempoRichiamo) return null;
    
    const ultimaVisita = new Date(paziente.ultima_visita);
    const prossimo = new Date(ultimaVisita);
    prossimo.setMonth(prossimo.getMonth() + tempoRichiamo);
    
    return prossimo;
  };

  const prossimoRichiamo = calcolaProssimoRichiamo();

  const getStatusBadge = () => {
    switch (status) {
      case 'S': return <CBadge color="warning">Da richiamare</CBadge>;
      case 'R': return <CBadge color="success">Richiamato</CBadge>;
      case 'N': return <CBadge color="secondary">Non richiamare</CBadge>;
      default: return <CBadge color="light">Non impostato</CBadge>;
    }
  };

  return (
    <CModal visible={visible} onClose={onClose} size="lg" backdrop="static">
      <CModalHeader>
        <CModalTitle>
          <CIcon icon={cilClock} className="me-2" />
          Gestione Richiamo: {paziente.nome}
        </CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        {showAlert && (
          <CAlert color={showAlert.type} dismissible onClose={() => setShowAlert(null)}>
            {showAlert.message}
          </CAlert>
        )}

        <CRow className="g-3">
          {/* Info Paziente */}
          <CCol md={12}>
            <CCard className="mb-3">
              <CCardHeader className="bg-light">
                <strong>Informazioni Paziente</strong>
              </CCardHeader>
              <CCardBody>
                <CRow>
                  <CCol md={6}>
                    <small><strong>Nome:</strong> {paziente.nome}</small><br />
                    <small><strong>CF:</strong> {paziente.codice_fiscale || '-'}</small>
                  </CCol>
                  <CCol md={6}>
                    {paziente.ultima_visita && (
                      <small><strong>Ultima visita:</strong> {new Date(paziente.ultima_visita).toLocaleDateString('it-IT')}</small>
                    )}<br />
                    {prossimoRichiamo && (
                      <small><strong>Prossimo richiamo:</strong> {prossimoRichiamo.toLocaleDateString('it-IT')}</small>
                    )}
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>
          </CCol>

          {/* Stato Richiamo */}
          <CCol md={12}>
            <label className="form-label fw-bold">Stato Richiamo</label>
            <CFormSelect 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={updating}
            >
              <option value="">-- Seleziona stato --</option>
              <option value="S">Da richiamare</option>
              <option value="N">Non richiamare</option>
              <option value="R">Richiamato</option>
            </CFormSelect>
          </CCol>

          {/* Configurazioni per "Da richiamare" */}
          {status === 'S' && (
            <>

              <CCol md={12}>
                <label className="form-label fw-bold">Tipi di Richiamo</label>
                <CCard>
                  <CCardBody>
                    <CRow>
                      {Object.entries(TIPO_RICHIAMI).map(([codice, nome]) => (
                        <CCol md={6} key={codice} className="mb-2">
                          <CFormCheck
                            id={`tipo-${codice}`}
                            label={`${codice} - ${nome}`}
                            checked={tipiSelezionati.includes(codice)}
                            onChange={() => handleTipoToggle(codice)}
                            disabled={updating}
                          />
                        </CCol>
                      ))}
                    </CRow>
                  </CCardBody>
                </CCard>
                
                {tipiSelezionati.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">
                      <strong>Codice risultante:</strong> {tipiSelezionati.join('')}
                    </small>
                  </div>
                )}
              </CCol>
              <CCol md={12}>
                <label className="form-label fw-bold">Tempo Richiamo</label>
                <CCard>
                  <CCardBody>
                    <CRow>
                      {[3, 4, 6, 9, 12].map((mesi) => (
                        <CCol md={2} key={mesi} className="mb-2">
                          <CFormCheck
                            type="radio"
                            name="tempo-richiamo"
                            id={`tempo-${mesi}`}
                            label={`${mesi} mesi`}
                            checked={tempoRichiamo === mesi}
                            onChange={() => setTempoRichiamo(mesi)}
                            disabled={updating}
                          />
                        </CCol>
                      ))}
                    </CRow>
                  </CCardBody>
                </CCard>
                
                {tempoRichiamo && (
                  <div className="mt-2">
                    <small className="text-muted">
                      <strong>Richiamo ogni:</strong> {tempoRichiamo} mesi
                    </small>
                  </div>
                )}
              </CCol>
              
            </>
          )}

          {/* Data per "Richiamato" */}
          {status === 'R' && (
            <CCol md={6}>
              <label className="form-label fw-bold">Data Richiamo Effettuato</label>
              <CFormInput
                type="date"
                value={dataRichiamo}
                onChange={(e) => setDataRichiamo(e.target.value)}
                disabled={updating}
              />
              <small className="text-muted">
                Se vuota, verrà usata la data odierna
              </small>
            </CCol>
          )}
        </CRow>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={onClose} disabled={updating}>
          Annulla
        </CButton>
        
        <CButton
          color="primary"
          onClick={handleSaveStatus}
          disabled={updating || !status}
        >
          {updating ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Salvataggio...
            </>
          ) : (
            <>
              <CIcon icon={cilSave} className="me-2" />
              Salva Richiamo
            </>
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default ModalRichiamoGestione;