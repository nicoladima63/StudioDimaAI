import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCardTitle,
  CButton,
  CFormInput,
  CBadge,
  CAlert,
  CSpinner,
  CRow,
  CCol,
  CInputGroup,
  CInputGroupText
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilMagnifyingGlass,
  cilCloudDownload,
  cilCalendar,
  cilDescription,
  cilUser,
  cilMedicalCross,
  cilClock,
  cilWarning,
  cilCheckCircle
} from '@coreui/icons';
import { 
  getRicettePaziente, 
  downloadRicettaPDF,
  type RicettaPaziente,
  type StatistichePaziente 
} from '@/api/services/ricette.service';

interface RicettePazienteProps {
  cfPazienteIniziale?: string;
}

export default function RicettePaziente({ cfPazienteIniziale = '' }: RicettePazienteProps) {
  const [cfPaziente, setCfPaziente] = useState(cfPazienteIniziale);
  const [ricette, setRicette] = useState<RicettaPaziente[]>([]);
  const [statistiche, setStatistiche] = useState<StatistichePaziente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingNre, setDownloadingNre] = useState<string | null>(null);

  const cercaRicette = async () => {
    if (!cfPaziente || cfPaziente.length !== 16) {
      setError('Inserire un codice fiscale valido (16 caratteri)');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await getRicettePaziente(cfPaziente.toUpperCase());
      setRicette(response.ricette);
      setStatistiche(response.statistiche);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il caricamento delle ricette');
      setRicette([]);
      setStatistiche(null);
    } finally {
      setLoading(false);
    }
  };

  const scaricaPDF = async (nre: string, pazienteNome: string) => {
    setDownloadingNre(nre);
    
    try {
      const blob = await downloadRicettaPDF(nre);
      
      // Crea URL del blob e scarica
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ricetta_${nre}_${pazienteNome.replace(' ', '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Errore download PDF: ${err.response?.data?.error || err.message}`);
    } finally {
      setDownloadingNre(null);
    }
  };

  const formatData = (dataString: string) => {
    return new Date(dataString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatoBadge = (stato: string) => {
    const variants = {
      'inviata': { color: 'success', icon: cilCheckCircle },
      'annullata': { color: 'danger', icon: cilWarning },
      'erogata': { color: 'info', icon: cilCheckCircle }
    };
    
    const config = variants[stato as keyof typeof variants] || variants.inviata;
    
    return (
      <CBadge color={config.color} className="d-flex align-items-center gap-1">
        <CIcon icon={config.icon} size="sm" />
        {stato.toUpperCase()}
      </CBadge>
    );
  };

  useEffect(() => {
    if (cfPazienteIniziale) {
      cercaRicette();
    }
  }, [cfPazienteIniziale]);

  return (
    <div className="mb-4">
      {/* Header con ricerca */}
      <CCard className="mb-4">
        <CCardHeader>
          <CCardTitle className="d-flex align-items-center gap-2">
            <CIcon icon={cilUser} />
            Ricette Paziente
          </CCardTitle>
        </CCardHeader>
        <CCardBody>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilUser} />
            </CInputGroupText>
            <CFormInput
              placeholder="Codice Fiscale Paziente (16 caratteri)"
              value={cfPaziente}
              onChange={(e) => setCfPaziente(e.target.value.toUpperCase())}
              maxLength={16}
              style={{ fontFamily: 'monospace' }}
            />
            <CButton 
              color="primary"
              onClick={cercaRicette}
              disabled={loading}
            >
              {loading ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Caricamento...
                </>
              ) : (
                <>
                  <CIcon icon={cilMagnifyingGlass} className="me-2" />
                  Cerca
                </>
              )}
            </CButton>
          </CInputGroup>
        </CCardBody>
      </CCard>

      {/* Errori */}
      {error && (
        <CAlert color="danger" className="d-flex align-items-center mb-4">
          <CIcon icon={cilWarning} className="me-2" />
          {error}
        </CAlert>
      )}

      {/* Statistiche */}
      {statistiche && (
        <CCard className="mb-4">
          <CCardHeader>
            <CCardTitle>
              Statistiche - {cfPaziente}
            </CCardTitle>
          </CCardHeader>
          <CCardBody>
            <CRow>
              <CCol xs={6} md={3} className="text-center mb-3">
                <div className="fs-2 fw-bold text-primary">
                  {statistiche.totale_ricette}
                </div>
                <small className="text-muted">Totale Ricette</small>
              </CCol>
              <CCol xs={6} md={3} className="text-center mb-3">
                <div className="fs-2 fw-bold text-success">
                  {statistiche.ricette_inviate}
                </div>
                <small className="text-muted">Inviate</small>
              </CCol>
              <CCol xs={6} md={3} className="text-center mb-3">
                <div className="fs-2 fw-bold text-danger">
                  {statistiche.ricette_annullate}
                </div>
                <small className="text-muted">Annullate</small>
              </CCol>
              <CCol xs={6} md={3} className="text-center mb-3">
                <div className="fw-bold">
                  {statistiche.ultima_ricetta 
                    ? formatData(statistiche.ultima_ricetta)
                    : 'Nessuna'
                  }
                </div>
                <small className="text-muted">Ultima Ricetta</small>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      )}

      {/* Lista ricette */}
      {ricette.length > 0 && (
        <>
          <h5 className="mb-3">
            Ricette Trovate ({ricette.length})
          </h5>
          
          {ricette.map((ricetta) => (
            <CCard key={ricetta.id} className="mb-3">
              <CCardHeader>
                <CRow className="align-items-center">
                  <CCol>
                    <div className="d-flex align-items-center gap-3">
                      <CIcon icon={cilDescription} size="lg" className="text-primary" />
                      <div>
                        <h6 className="mb-1">NRE: {ricetta.nre}</h6>
                        <small className="text-muted">PIN: {ricetta.codice_pin}</small>
                      </div>
                    </div>
                  </CCol>
                  <CCol xs="auto">
                    <div className="d-flex align-items-center gap-2">
                      {getStatoBadge(ricetta.stato)}
                      <CButton
                        color="outline-primary"
                        size="sm"
                        onClick={() => scaricaPDF(ricetta.nre, `${ricetta.paziente_nome}_${ricetta.paziente_cognome}`)}
                        disabled={downloadingNre === ricetta.nre || !ricetta.pdf_base64}
                      >
                        {downloadingNre === ricetta.nre ? (
                          <>
                            <CSpinner size="sm" className="me-1" />
                            Scaricando...
                          </>
                        ) : (
                          <>
                            <CIcon icon={cilCloudDownload} className="me-1" />
                            PDF
                          </>
                        )}
                      </CButton>
                    </div>
                  </CCol>
                </CRow>
              </CCardHeader>
              
              <CCardBody>
                <CRow>
                  <CCol md={6}>
                    <div className="mb-2 d-flex align-items-center gap-2">
                      <CIcon icon={cilUser} className="text-muted" />
                      <strong>{ricetta.paziente_nome} {ricetta.paziente_cognome}</strong>
                    </div>
                    
                    <div className="mb-2 d-flex align-items-center gap-2">
                      <CIcon icon={cilCalendar} className="text-muted" />
                      <small>{formatData(ricetta.data_compilazione)}</small>
                    </div>
                  </CCol>
                  
                  <CCol md={6}>
                    <div className="mb-2 d-flex align-items-start gap-2">
                      <CIcon icon={cilMedicalCross} className="text-muted mt-1" />
                      <div>
                        <div className="fw-medium">{ricetta.denominazione_farmaco}</div>
                        <small className="text-muted">{ricetta.posologia}</small>
                      </div>
                    </div>
                    
                    <div className="mb-2 d-flex align-items-center gap-2">
                      <CIcon icon={cilClock} className="text-muted" />
                      <small>{ricetta.durata_trattamento}</small>
                    </div>
                  </CCol>
                </CRow>
                
                {ricetta.note && (
                  <div className="mt-3 pt-3 border-top">
                    <strong>Note: </strong>
                    {ricetta.note}
                  </div>
                )}
                
                {ricetta.protocollo_transazione && (
                  <div className="mt-2">
                    <small className="text-muted">
                      Protocollo: {ricetta.protocollo_transazione}
                    </small>
                  </div>
                )}
              </CCardBody>
            </CCard>
          ))}
        </>
      )}

      {/* Messaggio quando non ci sono ricette */}
      {!loading && ricette.length === 0 && cfPaziente && (
        <CCard>
          <CCardBody className="text-center py-5">
            <CIcon icon={cilDescription} size="3xl" className="text-muted mb-3" />
            <p className="text-muted">
              Nessuna ricetta trovata per il paziente {cfPaziente}
            </p>
          </CCardBody>
        </CCard>
      )}
    </div>
  );
}