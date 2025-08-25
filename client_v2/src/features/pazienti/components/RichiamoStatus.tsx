import React, { useState, useEffect } from "react";
import { CBadge, CButton, CTooltip, CSpinner } from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilPencil, cilClock, cilCheckCircle, cilX, cilSave } from "@coreui/icons";
import type { Paziente } from "@/store/pazienti.store";
import ModalRichiamoGestione from "./ModalRichiamoGestione";
import richiami from "../services/richiami.service";

interface RichiamoStatusProps {
  paziente: Paziente;
  onRichiamoChange?: (
    pazienteId: string,
    status: string,
    dataRichiamo?: string
  ) => void;
}

const RichiamoStatus: React.FC<RichiamoStatusProps> = ({
  paziente,
  onRichiamoChange,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Determina se il paziente ha dati dal gestionale ma non ancora salvati nella nuova tabella
  const hasGestionaleData = () => {
    return !paziente.is_in_richiami_table && !!paziente.tipo_richiamo_gestionale;
  };

  const needsSave = hasGestionaleData();

  // Determina il tipo di stato richiamo
  const getRichiamoType = () => {
    const status = paziente.da_richiamare;
    const hasUltimaVisita = !!paziente.ultima_visita;
    const hasTempoRichiamo = !!paziente.tempo_richiamo;

    // Se ha tipo_richiamo dal gestionale ma non è ancora salvato, considera come "da_richiamare"
    if (!paziente.is_in_richiami_table && paziente.tipo_richiamo_gestionale && status !== 'R' && status !== 'N') {
      if (hasUltimaVisita && hasTempoRichiamo) {
        // Calcola se è scaduto
        const ultimaVisita = new Date(paziente.ultima_visita);
        const prossimo = new Date(ultimaVisita);
        prossimo.setMonth(prossimo.getMonth() + paziente.tempo_richiamo);
        const oggi = new Date();
        
        return oggi > prossimo ? 'scaduto' : 'da_richiamare';
      }
      return 'da_richiamare';
    }

    if (status === 'R') return 'richiamato';
    if (status === 'N') return 'non_richiamare';
    if (status === 'S') {
      if (hasUltimaVisita && hasTempoRichiamo) {
        // Calcola se è scaduto
        const ultimaVisita = new Date(paziente.ultima_visita);
        const prossimo = new Date(ultimaVisita);
        prossimo.setMonth(prossimo.getMonth() + paziente.tempo_richiamo);
        const oggi = new Date();
        
        return oggi > prossimo ? 'scaduto' : 'da_richiamare';
      }
      return 'da_richiamare';
    }
    
    return 'non_impostato';
  };

  const richiamoType = getRichiamoType();

  // Calcola prossimo richiamo se possibile
  const calcolaProssimoRichiamo = () => {
    if (!paziente.ultima_visita || !paziente.tempo_richiamo) return null;
    
    const ultimaVisita = new Date(paziente.ultima_visita);
    const prossimo = new Date(ultimaVisita);
    prossimo.setMonth(prossimo.getMonth() + paziente.tempo_richiamo);
    
    return prossimo;
  };

  const prossimoRichiamo = calcolaProssimoRichiamo();

  // Decodifica tipo_richiamo in tipi separati con colori corrispondenti agli appuntamenti
  const decodificaTipoRichiamo = (tipoRichiamo: string | undefined) => {
    if (!tipoRichiamo) return [];
    
    const tipi: Array<{code: string, name: string, color: string}> = [];
    
    // Mappa tipi di richiamo ai colori degli appuntamenti corrispondenti
    const tipoMap = {
      '1': { name: 'Generico', color: '#808080' },    // Grigio (come Endodonzia)
      '2': { name: 'Igiene', color: '#800080' },      // Viola (come Igiene)
      '3': { name: 'Rx Impianto', color: '#FF00FF' }, // Magenta (come Implantologia)
      '4': { name: 'Controllo', color: '#ADD8E6' },   // Azzurro chiaro (come Controllo)
      '5': { name: 'Impianto', color: '#FF00FF' },    // Magenta (come Implantologia)
      '6': { name: 'Ortodonzia', color: '#FFC0CB' }   // Rosa (come Ortodonzia)
    };
    
    // Decodifica ogni carattere (es. "11" = Generico + Generico, "21" = Igiene + Generico)
    for (let i = 0; i < tipoRichiamo.length; i++) {
      const code = tipoRichiamo[i];
      const tipo = tipoMap[code as keyof typeof tipoMap];
      if (tipo) {
        tipi.push({ code, name: tipo.name, color: tipo.color });
      }
    }
    
    return tipi;
  };

  const tipiRichiamo = decodificaTipoRichiamo(paziente.tipo_richiamo);

  // Salva rapidamente i dati esistenti dal gestionale nella nuova tabella
  const handleQuickSave = async () => {
    if (!needsSave) return;
    
    setUpdating(true);
    try {
      // Prima crea il richiamo con tutti i dati del gestionale
      const configResponse = await richiami.apiAggiornaTipoRichiamo({
        paziente_id: paziente.id,
        tipo_richiamo: paziente.tipo_richiamo_gestionale || '1', // Usa dato gestionale
        tempo_richiamo: paziente.tempo_richiamo || 6 // Default 6 mesi se mancante
      });

      if (!configResponse.success) {
        throw new Error(configResponse.error || 'Errore salvataggio richiamo');
      }

      // Notifica il parent component
      if (onRichiamoChange) {
        onRichiamoChange(paziente.id, 'S');
      }

    } catch (error: any) {
      console.error('Errore quick save:', error);
      // Qui potresti mostrare un toast di errore
    } finally {
      setUpdating(false);
    }
  };

  const styled = () => {
    return {
      padding: "0.375rem 0.75rem",
      fontSize: "0.875rem",
      fontWeight: "400",
      borderRadius: "0.25rem",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "100px",
    };
  };

  // Visualizzazione dello stato
  const renderStatus = () => {
    if (updating) {
      return <CSpinner size="sm" />;
    }

    switch (richiamoType) {
      case 'richiamato':
        return (
          <div className="d-flex align-items-center justify-content-between" style={{ width: "100%" }}>
            <div className="d-flex align-items-center gap-2">
              <CBadge color="success" style={styled()}>
                <CIcon icon={cilCheckCircle} size="sm" className="me-1" />
                Richiamato
              </CBadge>
              {paziente.data_primo_richiamo && (
                <small className="text-muted">
                  {new Date(paziente.data_primo_richiamo).toLocaleDateString('it-IT')}
                </small>
              )}
            </div>
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Modifica stato richiamo">
                <CButton
                  color="secondary"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowModal(true)}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case 'scaduto':
        return (
          <div className="d-flex align-items-center justify-content-between" style={{ width: "100%" }}>
            <div className="d-flex align-items-center gap-2">
              <CBadge color="danger" style={styled()}>
                <CIcon icon={cilClock} size="sm" className="me-1" />
                Scaduto
              </CBadge>
              {prossimoRichiamo && (
                <small className="text-danger">
                  Era: {prossimoRichiamo.toLocaleDateString('it-IT')}
                </small>
              )}
            </div>
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Gestisci richiamo">
                <CButton
                  color="danger"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowModal(true)}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case 'da_richiamare':
        return (
          <div className="d-flex align-items-center justify-content-between" style={{ width: "100%" }}>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {tipiRichiamo.length > 0 ? (
                // Mostra badge separati per ogni tipo di richiamo
                tipiRichiamo.map((tipo, index) => (
                  <CBadge 
                    key={index}
                    style={{
                      ...styled(),
                      backgroundColor: tipo.color,
                      color: "white",
                      border: "none",
                      fontSize: "0.75rem"
                    }}
                  >
                    {tipo.name} ogni {paziente.tempo_richiamo || 6} mesi
                  </CBadge>
                ))
              ) : (
                // Fallback per tipo_richiamo non decodificabile
                <CBadge 
                  style={{
                    ...styled(),
                    backgroundColor: "#ff8c00",
                    color: "white",
                    border: "none",
                  }}
                >
                  <CIcon icon={cilClock} size="sm" className="me-1" />
                  Da richiamare {paziente.tempo_richiamo ? ` ogni ${paziente.tempo_richiamo} mesi` : ''}
                </CBadge>
              )}
              {prossimoRichiamo && (
                <small className="text-muted">
                  {prossimoRichiamo.toLocaleDateString('it-IT')}
                </small>
              )}
            </div>
            <div className="d-flex align-items-center gap-1">
              {needsSave ? (
                <CTooltip content="Salva dati richiamo dal gestionale">
                  <CButton
                    size="sm"
                    variant="outline"
                    onClick={handleQuickSave}
                    disabled={updating}
                    style={{
                      color: "#28a745",
                      borderColor: "#28a745",
                    }}
                  >
                    <CIcon icon={cilSave} size="sm" />
                  </CButton>
                </CTooltip>
              ) : (
                <CTooltip content="Gestisci richiamo">
                  <CButton
                    size="sm"
                    variant="outline"
                    onClick={() => setShowModal(true)}
                    style={{
                      color: "#ff8c00",
                      borderColor: "#ff8c00",
                    }}
                  >
                    <CIcon icon={cilPencil} size="sm" />
                  </CButton>
                </CTooltip>
              )}
            </div>
          </div>
        );

      case 'non_richiamare':
        return (
          <div className="d-flex align-items-center justify-content-between" style={{ width: "100%" }}>
            <div className="d-flex align-items-center gap-2">
              <CBadge color="secondary" style={styled()}>
                <CIcon icon={cilX} size="sm" className="me-1" />
                Non richiamare
              </CBadge>
            </div>
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Modifica stato richiamo">
                <CButton
                  color="secondary"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowModal(true)}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case 'non_impostato':
      default:
        return (
          <div className="d-flex align-items-center justify-content-between" style={{ width: "100%" }}>
            <div className="d-flex align-items-center gap-2">
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                className="text-nowrap"
                onClick={() => setShowModal(true)}
              >
                IMPOSTA RICHIAMO
              </CButton>
            </div>
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Configura richiamo">
                <CButton
                  color="primary"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowModal(true)}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div>{renderStatus()}</div>
      
      {/* Modal di gestione richiamo */}
      <ModalRichiamoGestione
        visible={showModal}
        onClose={() => setShowModal(false)}
        paziente={paziente}
        onRichiamoChange={(status, dataRichiamo) => {
          if (onRichiamoChange) {
            onRichiamoChange(paziente.id, status, dataRichiamo);
          }
        }}
      />
    </>
  );
};

export default RichiamoStatus;