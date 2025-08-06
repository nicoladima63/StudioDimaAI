import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CSpinner,
  CAlert,
  CBadge,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CFormCheck,
  CFormSelect
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilUserPlus, cilCheck, cilReload, cilPeople } from '@coreui/icons';
import type { Collaboratore, CollaboratoriResponse, Statistiche } from '../services/collaboratoriService';
import collaboratoriService from '../services/collaboratoriService';


const CollaboratoriPage: React.FC = () => {
  const [collaboratori, setCollaboratori] = useState<Collaboratore[]>([]);
  const [nuoviCandidati, setNuoviCandidati] = useState<Collaboratore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statistiche, setStatistiche] = useState<Statistiche>({} as Statistiche);
  
  // Stato per selezione collaboratori
  const [selezioneCollaboratori, setSelezioneCollaboratori] = useState<Record<string, boolean>>({});
  const [tipiAssegnati, setTipiAssegnati] = useState<Record<string, string>>({});

  const tipiCollaboratore = ['Chirurgia', 'Ortodonzia', 'Igienista'];

  useEffect(() => {
    caricaCollaboratori();
    caricaStatistiche();
  }, []);

  const caricaCollaboratori = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await collaboratoriService.getCollaboratori();
      
      if (response.success) {
        const data: CollaboratoriResponse = response.data;
        setCollaboratori(data.collaboratori_confermati || []);
        setNuoviCandidati(data.nuovi_candidati || []);
        
        // Pre-seleziona tutti i collaboratori
        const tuttiCollaboratori = [
          ...(data.collaboratori_confermati || []),
          ...(data.nuovi_candidati || [])
        ];
        
        const selezione: Record<string, boolean> = {};
        const tipi: Record<string, string> = {};
        
        tuttiCollaboratori.forEach(c => {
          selezione[c.codice_fornitore] = c.pre_selezionato || false;
          tipi[c.codice_fornitore] = c.tipo || 'Igienista';
        });
        
        setSelezioneCollaboratori(selezione);
        setTipiAssegnati(tipi);
      }
    } catch (err: any) {
      setError('Errore nel caricamento collaboratori: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const caricaStatistiche = async () => {
    try {
      const response = await collaboratoriService.getStatistiche();
      if (response.success) {
        setStatistiche(response.data);
      }
    } catch (err) {
      console.error('Errore caricamento statistiche:', err);
    }
  };

  const salvaSelezione = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Prepara dati per salvataggio
      const codiciSelezionati = Object.keys(selezioneCollaboratori)
        .filter(codice => selezioneCollaboratori[codice]);
      
      const tipiPerSalvataggio: Record<string, string> = {};
      codiciSelezionati.forEach(codice => {
        tipiPerSalvataggio[codice] = tipiAssegnati[codice];
      });
      
      const response = await collaboratoriService.salvaSelezione({
        codici_selezionati: codiciSelezionati,
        tipi_assegnati: tipiPerSalvataggio
      });
      
      if (response.success) {
        setSuccess(`Salvati ${codiciSelezionati.length} collaboratori!`);
        await caricaCollaboratori();
        await caricaStatistiche();
        setShowModal(false);
      }
    } catch (err: any) {
      setError('Errore nel salvare: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const toggleSelezione = (codice: string) => {
    setSelezioneCollaboratori(prev => ({
      ...prev,
      [codice]: !prev[codice]
    }));
  };

  const aggiornaTipo = (codice: string, nuovoTipo: string) => {
    setTipiAssegnati(prev => ({
      ...prev,
      [codice]: nuovoTipo
    }));
  };

  const ricaricaCandidati = async () => {
    setSuccess('Ricaricando candidati automatici...');
    await caricaCollaboratori();
    setSuccess('Candidati ricaricati - controlla nuovi collaboratori!');
  };

  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center">
          <CSpinner /> Caricamento collaboratori...
        </CCardBody>
      </CCard>
    );
  }

  const collaboratoriSelezionati = Object.keys(selezioneCollaboratori)
    .filter(codice => selezioneCollaboratori[codice]).length;

  return (
    <div>
      <CRow>
        <CCol xs={12}>
          <CCard>
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <h5><CIcon icon={cilPeople} /> Gestione Collaboratori</h5>
                <div>
                  <CButton 
                    color="info" 
                    variant="outline" 
                    size="sm"
                    className="me-2"
                    onClick={ricaricaCandidati}
                  >
                    <CIcon icon={cilReload} /> Ricarica
                  </CButton>
                  <CButton 
                    color="primary" 
                    onClick={() => setShowModal(true)}
                    disabled={collaboratoriSelezionati === 0}
                  >
                    <CIcon icon={cilUserPlus} /> Gestisci Selezione ({collaboratoriSelezionati})
                  </CButton>
                </div>
              </div>
            </CCardHeader>
            <CCardBody>
              {error && <CAlert color="danger">{error}</CAlert>}
              {success && <CAlert color="success">{success}</CAlert>}
              
              {/* Statistiche rapide */}
              <CRow className="mb-4">
                <CCol md={3}>
                  <div className="border-start border-4 border-info py-1 px-3">
                    <div className="text-medium-emphasis small">Totale Attivi</div>
                    <div className="fs-5 fw-semibold">{statistiche.totale_attivi || 0}</div>
                  </div>
                </CCol>
                <CCol md={3}>
                  <div className="border-start border-4 border-success py-1 px-3">
                    <div className="text-medium-emphasis small">Chirurgia</div>
                    <div className="fs-5 fw-semibold">{statistiche.chirurgia || 0}</div>
                  </div>
                </CCol>
                <CCol md={3}>
                  <div className="border-start border-4 border-warning py-1 px-3">
                    <div className="text-medium-emphasis small">Ortodonzia</div>
                    <div className="fs-5 fw-semibold">{statistiche.ortodonzia || 0}</div>
                  </div>
                </CCol>
                <CCol md={3}>
                  <div className="border-start border-4 border-primary py-1 px-3">
                    <div className="text-medium-emphasis small">Igienista</div>
                    <div className="fs-5 fw-semibold">{statistiche.igienista || 0}</div>
                  </div>
                </CCol>
              </CRow>

              <CRow>
                {/* Collaboratori Confermati */}
                <CCol md={6}>
                  <h6>✅ Collaboratori Confermati ({collaboratori.length})</h6>
                  <CListGroup>
                    {collaboratori.map(collab => (
                      <CListGroupItem 
                        key={collab.codice_fornitore}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <CFormCheck
                            checked={selezioneCollaboratori[collab.codice_fornitore] || false}
                            onChange={() => toggleSelezione(collab.codice_fornitore)}
                            label={`${collab.codice_fornitore}: ${collab.nome}`}
                          />
                        </div>
                        <div className="d-flex align-items-center">
                          <CFormSelect
                            size="sm"
                            value={tipiAssegnati[collab.codice_fornitore] || collab.tipo}
                            onChange={(e) => aggiornaTipo(collab.codice_fornitore, e.target.value)}
                            style={{width: '120px', marginRight: '10px'}}
                          >
                            {tipiCollaboratore.map(tipo => (
                              <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                          </CFormSelect>
                          <CBadge color="success">Confermato</CBadge>
                        </div>
                      </CListGroupItem>
                    ))}
                  </CListGroup>
                </CCol>

                {/* Nuovi Candidati */}
                <CCol md={6}>
                  <h6>🆕 Nuovi Candidati Automatici ({nuoviCandidati.length})</h6>
                  <CListGroup>
                    {nuoviCandidati.map(candidato => (
                      <CListGroupItem 
                        key={candidato.codice_fornitore}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <CFormCheck
                            checked={selezioneCollaboratori[candidato.codice_fornitore] || false}
                            onChange={() => toggleSelezione(candidato.codice_fornitore)}
                            label={`${candidato.codice_fornitore}: ${candidato.nome}`}
                          />
                          <small className="text-muted d-block">
                            Score: {candidato.score} - {candidato.criteri?.slice(0, 2).join(', ')}
                          </small>
                        </div>
                        <div className="d-flex align-items-center">
                          <CFormSelect
                            size="sm"
                            value={tipiAssegnati[candidato.codice_fornitore] || 'Igienista'}
                            onChange={(e) => aggiornaTipo(candidato.codice_fornitore, e.target.value)}
                            style={{width: '120px', marginRight: '10px'}}
                          >
                            {tipiCollaboratore.map(tipo => (
                              <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                          </CFormSelect>
                          <CBadge color="warning">Da Confermare</CBadge>
                        </div>
                      </CListGroupItem>
                    ))}
                  </CListGroup>
                  
                  {nuoviCandidati.length === 0 && (
                    <CAlert color="info">
                      ✨ Nessun nuovo candidato trovato automaticamente.
                      Sistema di identificazione funzionante!
                    </CAlert>
                  )}
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Modal Conferma Selezione */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} size="lg">
        <CModalHeader>
          <CModalTitle>Conferma Selezione Collaboratori</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color="info">
            Stai per salvare <strong>{collaboratoriSelezionati} collaboratori</strong>.
            I collaboratori non selezionati verranno disattivati.
          </CAlert>
          
          <h6>Collaboratori Selezionati:</h6>
          <CListGroup>
            {Object.keys(selezioneCollaboratori)
              .filter(codice => selezioneCollaboratori[codice])
              .map(codice => {
                const collab = [...collaboratori, ...nuoviCandidati]
                  .find(c => c.codice_fornitore === codice);
                return (
                  <CListGroupItem key={codice} className="d-flex justify-content-between">
                    <span>{collab?.nome || codice}</span>
                    <CBadge color="primary">{tipiAssegnati[codice]}</CBadge>
                  </CListGroupItem>
                );
              })}
          </CListGroup>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={salvaSelezione} disabled={saving}>
            {saving ? <CSpinner size="sm" /> : <CIcon icon={cilCheck} />}
            {saving ? ' Salvando...' : ' Conferma Selezione'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default CollaboratoriPage;