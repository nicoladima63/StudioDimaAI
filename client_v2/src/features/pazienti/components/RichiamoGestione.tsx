import React, { useState, useEffect } from 'react';
import { 
  CFormSelect, 
  CFormInput, 
  CFormCheck, 
  CButton, 
  CSpinner, 
  CBadge, 
  CTooltip,
  CRow,
  CCol
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave, cilCalendar } from '@coreui/icons';
import type { Paziente } from '@/store/pazienti.store';
import richiami from '../services/richiami.service';

interface RichiamoGestioneProps {
  paziente: Paziente;
  onRichiamoChange?: (status: string, dataRichiamo?: string) => void;
}

const RichiamoGestione: React.FC<RichiamoGestioneProps> = ({
  paziente,
  onRichiamoChange
}) => {
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<string>(paziente.da_richiamare || '');
  const [tempoRichiamo, setTempoRichiamo] = useState<number>(paziente.tempo_richiamo || 6);
  const [tipoIgiene, setTipoIgiene] = useState(false);
  const [tipoGenerico, setTipoGenerico] = useState(false);
  const [dataRichiamo, setDataRichiamo] = useState('');

  // Inizializza tipi richiamo dal valore esistente
  useEffect(() => {
    if (paziente.tipo_richiamo) {
      const tipoStr = paziente.tipo_richiamo.toString();
      if (tipoStr.length >= 2) {
        setTipoIgiene(tipoStr[0] === '2');
        setTipoGenerico(tipoStr[1] === '1');
      }
    }
  }, [paziente.tipo_richiamo]);

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    
    // Se imposta come richiamato, salva automaticamente
    if (newStatus === 'R') {
      await handleSaveRichiamato();
    }
  };

  const handleSaveRichiamato = async () => {
    if (!dataRichiamo) {
      setDataRichiamo(new Date().toISOString().split('T')[0]);
    }

    setUpdating(true);
    try {
      const response = await richiami.apiSalvaStatoRichiamo({
        paziente_id: paziente.id,
        da_richiamare: 'R',
        data_richiamo: dataRichiamo || new Date().toISOString()
      });

      if (response.success && onRichiamoChange) {
        onRichiamoChange('R', dataRichiamo || new Date().toISOString());
      }
    } catch (error) {
      console.error('Errore salvataggio richiamo effettuato:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveConfig = async () => {
    setUpdating(true);
    try {
      // Salva stato richiamo
      const statusResponse = await richiami.apiSalvaStatoRichiamo({
        paziente_id: paziente.id,
        da_richiamare: status
      });

      // Salva configurazione tipo e tempo
      const tipoRichiamoValue = `${tipoIgiene ? '2' : '0'}${tipoGenerico ? '1' : '0'}`;
      
      const configResponse = await richiami.apiAggiornaTipoRichiamo({
        paziente_id: paziente.id,
        tipo_richiamo: tipoRichiamoValue,
        tempo_richiamo: tempoRichiamo
      });

      if (statusResponse.success && configResponse.success && onRichiamoChange) {
        onRichiamoChange(status);
      }
    } catch (error) {
      console.error('Errore salvataggio configurazione richiamo:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3" style={{ minWidth: '400px' }}>
      
      {/* Stato Richiamo */}
      <CRow>
        <CCol md={8}>
          <label className="form-label fw-bold">Stato Richiamo</label>
          <CFormSelect 
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating}
          >
            <option value="">-- Seleziona stato --</option>
            <option value="S">Da richiamare</option>
            <option value="N">Non richiamare</option>
            <option value="R">Richiamato</option>
          </CFormSelect>
        </CCol>
        <CCol md={4} className="d-flex align-items-end">
          {status && (
            <CBadge 
              color={status === 'S' ? 'warning' : status === 'R' ? 'success' : 'secondary'}
              className="p-2"
            >
              {status === 'S' ? 'DA RICHIAMARE' : status === 'R' ? 'RICHIAMATO' : 'NON RICHIAMARE'}
            </CBadge>
          )}
        </CCol>
      </CRow>

      {/* Se è da richiamare, mostra configurazioni */}
      {status === 'S' && (
        <>
          <CRow>
            <CCol md={6}>
              <label className="form-label fw-bold">Tempo Richiamo (mesi)</label>
              <CFormInput
                type="number"
                value={tempoRichiamo}
                onChange={(e) => setTempoRichiamo(Number(e.target.value))}
                min={1}
                max={24}
                disabled={updating}
              />
            </CCol>
            <CCol md={6}>
              <label className="form-label fw-bold">Tipi Richiamo</label>
              <div className="d-flex flex-column gap-2">
                <CFormCheck
                  id="tipo-igiene"
                  label="Richiamo Igiene"
                  checked={tipoIgiene}
                  onChange={(e) => setTipoIgiene(e.target.checked)}
                  disabled={updating}
                />
                <CFormCheck
                  id="tipo-generico"
                  label="Richiamo Generico"
                  checked={tipoGenerico}
                  onChange={(e) => setTipoGenerico(e.target.checked)}
                  disabled={updating}
                />
              </div>
            </CCol>
          </CRow>

          <div className="d-flex justify-content-center">
            <CButton
              color="primary"
              onClick={handleSaveConfig}
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
                  Salva Configurazione
                </>
              )}
            </CButton>
          </div>
        </>
      )}

      {/* Se è richiamato, permetti di impostare la data */}
      {status === 'R' && (
        <>
          <CRow>
            <CCol md={8}>
              <label className="form-label fw-bold">Data Richiamo Effettuato</label>
              <CFormInput
                type="date"
                value={dataRichiamo}
                onChange={(e) => setDataRichiamo(e.target.value)}
                disabled={updating}
              />
            </CCol>
            <CCol md={4} className="d-flex align-items-end">
              <CTooltip content="Salva data richiamo effettuato">
                <CButton
                  color="success"
                  onClick={handleSaveRichiamato}
                  disabled={updating}
                >
                  {updating ? (
                    <CSpinner size="sm" />
                  ) : (
                    <CIcon icon={cilCalendar} size="sm" />
                  )}
                </CButton>
              </CTooltip>
            </CCol>
          </CRow>
        </>
      )}

      {/* Salvataggio semplice per "Non richiamare" */}
      {status === 'N' && (
        <div className="d-flex justify-content-center">
          <CButton
            color="secondary"
            onClick={handleSaveConfig}
            disabled={updating}
          >
            {updating ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Salvataggio...
              </>
            ) : (
              <>
                <CIcon icon={cilSave} className="me-2" />
                Salva
              </>
            )}
          </CButton>
        </div>
      )}

      {/* Info paziente */}
      <div className="border-top pt-2">
        <small className="text-muted d-block">
          <strong>Paziente:</strong> {paziente.nome}
        </small>
        {paziente.ultima_visita && (
          <small className="text-muted d-block">
            <strong>Ultima visita:</strong> {new Date(paziente.ultima_visita).toLocaleDateString('it-IT')}
          </small>
        )}
        {paziente.tempo_richiamo && (
          <small className="text-muted d-block">
            <strong>Richiamo ogni:</strong> {paziente.tempo_richiamo} mesi
          </small>
        )}
      </div>
    </div>
  );
};

export default RichiamoGestione;