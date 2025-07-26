import React, { useState, useEffect } from 'react';
import {
  CRow, CCol, CCard, CCardBody, CCardHeader, CButton, CForm, CFormInput,
  CFormLabel, CFormTextarea, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CBadge, CModal, CModalHeader, CModalBody,
  CModalFooter, CAlert, CSpinner, CFormSelect, CListGroup, CListGroupItem,
  CNav, CNavItem, CNavLink, CTabContent, CTabPane
} from '@coreui/react';
import { 
  getProtocolliCompleti, createDiagnosi, updateDiagnosi, deleteDiagnosi,
  createFarmaco, updateFarmaco, deleteFarmaco
} from '@/api/services/ricette.service';

interface PosologiaAlternativa {
  posologia: string;
  durata: string;
  note: string;
}

interface FarmacoProtocollo {
  codice: string;
  nome: string;
  principio_attivo: string;
  classe: string;
  posologia_default: string;
  durata_default: string;
  note_default: string;
  posologie_alternative: PosologiaAlternativa[];
}

interface Diagnosi {
  id: string;
  codice: string;
  descrizione: string;
  farmaci: FarmacoProtocollo[];
}

interface ProtocolliData {
  diagnosi: { [key: string]: Diagnosi };
  durate_standard: string[];
  note_frequenti: string[];
}

const GestioneProtocolli: React.FC = () => {
  const [protocolli, setProtocolli] = useState<ProtocolliData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('diagnosi');
  const [showModalDiagnosi, setShowModalDiagnosi] = useState(false);
  const [showModalFarmaco, setShowModalFarmaco] = useState(false);
  const [showModalAssociazione, setShowModalAssociazione] = useState(false);
  const [selectedDiagnosi, setSelectedDiagnosi] = useState<string>('');
  const [editingDiagnosi, setEditingDiagnosi] = useState<Diagnosi | null>(null);
  const [editingFarmaco, setEditingFarmaco] = useState<FarmacoProtocollo | null>(null);

  // Form states
  const [formDiagnosi, setFormDiagnosi] = useState({
    id: '',
    codice: '',
    descrizione: ''
  });

  const [formFarmaco, setFormFarmaco] = useState({
    codice: '',
    nome: '',
    principio_attivo: '',
    classe: '',
    posologia_default: '',
    durata_default: '',
    note_default: ''
  });

  useEffect(() => {
    loadProtocolli();
  }, []);

  const loadProtocolli = async () => {
    setLoading(true);
    try {
      const data = await getProtocolliCompleti();
      console.log('Protocolli caricati:', data); // Debug
      
      // Validazione dati
      if (!data || typeof data !== 'object') {
        throw new Error('Dati protocolli non validi');
      }
      
      if (!data.diagnosi) {
        console.warn('Nessuna diagnosi trovata, inizializzo oggetto vuoto');
        data.diagnosi = {};
      }
      
      if (!data.durate_standard) {
        data.durate_standard = [];
      }
      
      if (!data.note_frequenti) {
        data.note_frequenti = [];
      }
      
      setProtocolli(data);
    } catch (error) {
      console.error('Errore caricamento protocolli:', error);
      setProtocolli(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDiagnosi = (diagnosi: Diagnosi) => {
    setEditingDiagnosi(diagnosi);
    setFormDiagnosi({
      id: diagnosi.id,
      codice: diagnosi.codice,
      descrizione: diagnosi.descrizione
    });
    setShowModalDiagnosi(true);
  };

  const handleEditFarmaco = (farmaco: FarmacoProtocollo, diagnosiId: string) => {
    setEditingFarmaco(farmaco);
    setSelectedDiagnosi(diagnosiId);
    setFormFarmaco({
      codice: farmaco.codice,
      nome: farmaco.nome,
      principio_attivo: farmaco.principio_attivo,
      classe: farmaco.classe,
      posologia_default: farmaco.posologia_default,
      durata_default: farmaco.durata_default,
      note_default: farmaco.note_default
    });
    setShowModalFarmaco(true);
  };

  const handleSaveDiagnosi = async () => {
    if (!protocolli) return;
    
    try {
      if (editingDiagnosi) {
        // Modifica esistente
        await updateDiagnosi(formDiagnosi.id, {
          codice: formDiagnosi.codice,
          descrizione: formDiagnosi.descrizione
        });
      } else {
        // Nuova diagnosi
        await createDiagnosi({
          id: formDiagnosi.id,
          codice: formDiagnosi.codice,
          descrizione: formDiagnosi.descrizione
        });
      }
      
      // Ricarica i dati
      await loadProtocolli();
      setShowModalDiagnosi(false);
      resetFormDiagnosi();
    } catch (error) {
      console.error('Errore salvataggio diagnosi:', error);
      alert('Errore durante il salvataggio della diagnosi');
    }
  };

  const handleSaveFarmaco = async () => {
    if (!protocolli || !selectedDiagnosi) return;
    
    try {
      if (editingFarmaco) {
        // Modifica esistente
        await updateFarmaco(selectedDiagnosi, editingFarmaco.codice, formFarmaco);
      } else {
        // Nuovo farmaco
        await createFarmaco(selectedDiagnosi, formFarmaco);
      }
      
      // Ricarica i dati
      await loadProtocolli();
      setShowModalFarmaco(false);
      resetFormFarmaco();
    } catch (error) {
      console.error('Errore salvataggio farmaco:', error);
      alert('Errore durante il salvataggio del farmaco');
    }
  };

  const handleDeleteDiagnosi = async (diagnosiId: string) => {
    if (!protocolli || !confirm('Sei sicuro di voler eliminare questa diagnosi?')) return;
    
    try {
      await deleteDiagnosi(diagnosiId);
      await loadProtocolli();
    } catch (error) {
      console.error('Errore eliminazione diagnosi:', error);
      alert('Errore durante l\'eliminazione della diagnosi');
    }
  };

  const handleDeleteFarmaco = async (diagnosiId: string, farmacoId: string) => {
    if (!protocolli || !confirm('Sei sicuro di voler eliminare questo farmaco?')) return;
    
    try {
      await deleteFarmaco(diagnosiId, farmacoId);
      await loadProtocolli();
    } catch (error) {
      console.error('Errore eliminazione farmaco:', error);
      alert('Errore durante l\'eliminazione del farmaco');
    }
  };

  const resetFormDiagnosi = () => {
    setFormDiagnosi({ id: '', codice: '', descrizione: '' });
    setEditingDiagnosi(null);
  };

  const resetFormFarmaco = () => {
    setFormFarmaco({
      codice: '', nome: '', principio_attivo: '', classe: '',
      posologia_default: '', durata_default: '', note_default: ''
    });
    setEditingFarmaco(null);
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <CSpinner color="primary" />
        <p>Caricamento protocolli...</p>
      </div>
    );
  }

  if (!protocolli) {
    return (
      <CAlert color="danger">
        Errore nel caricamento dei protocolli terapeutici.
      </CAlert>
    );
  }

  return (
    <div>
      <CRow className="mb-3">
        <CCol>
          <h4>⚙️ Gestione Protocolli Terapeutici</h4>
          <p className="text-muted">
            Gestisci diagnosi, farmaci e le loro associazioni per l'auto-completamento delle ricette.
          </p>
        </CCol>
      </CRow>

      {/* Tabs secondarie */}
      <CNav variant="pills" className="mb-3">
        <CNavItem>
          <CNavLink 
            active={activeTab === 'diagnosi'}
            onClick={() => setActiveTab('diagnosi')}
            style={{ cursor: 'pointer' }}
          >
            🩺 Diagnosi
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink 
            active={activeTab === 'farmaci'}
            onClick={() => setActiveTab('farmaci')}
            style={{ cursor: 'pointer' }}
          >
            💊 Farmaci per Diagnosi
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink 
            active={activeTab === 'durate'}
            onClick={() => setActiveTab('durate')}
            style={{ cursor: 'pointer' }}
          >
            📅 Durate & Note
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        {/* Tab Diagnosi */}
        <CTabPane visible={activeTab === 'diagnosi'}>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">🩺 Gestione Diagnosi</h5>
              <CButton 
                color="primary" 
                size="sm"
                onClick={() => {
                  resetFormDiagnosi();
                  setShowModalDiagnosi(true);
                }}
              >
                ➕ Nuova Diagnosi
              </CButton>
            </CCardHeader>
            <CCardBody>
              <CTable hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>ID</CTableHeaderCell>
                    <CTableHeaderCell>Codice</CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell>Farmaci</CTableHeaderCell>
                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {protocolli?.diagnosi && Object.values(protocolli.diagnosi).length > 0 ? 
                    Object.values(protocolli.diagnosi).map((diagnosi) => (
                      <CTableRow key={diagnosi.id}>
                        <CTableDataCell><code>{diagnosi.id}</code></CTableDataCell>
                        <CTableDataCell><strong>{diagnosi.codice}</strong></CTableDataCell>
                        <CTableDataCell>{diagnosi.descrizione}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="info">{diagnosi.farmaci?.length || 0} farmaci</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton 
                            color="warning" 
                            size="sm" 
                            className="me-2"
                            onClick={() => handleEditDiagnosi(diagnosi)}
                          >
                            ✏️ Modifica
                          </CButton>
                          <CButton 
                            color="danger" 
                            size="sm"
                            onClick={() => handleDeleteDiagnosi(diagnosi.id)}
                          >
                            🗑️ Elimina
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={5} className="text-center text-muted">
                          Nessuna diagnosi disponibile
                        </CTableDataCell>
                      </CTableRow>
                    )
                  }
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CTabPane>

        {/* Tab Farmaci */}
        <CTabPane visible={activeTab === 'farmaci'}>
          <CRow>
            <CCol md={4}>
              <CCard>
                <CCardHeader>
                  <h6>🩺 Seleziona Diagnosi</h6>
                </CCardHeader>
                <CCardBody>
                  <CListGroup>
                    {protocolli?.diagnosi && Object.values(protocolli.diagnosi).length > 0 ? 
                      Object.values(protocolli.diagnosi).map((diagnosi) => (
                        <CListGroupItem
                          key={diagnosi.id}
                          active={selectedDiagnosi === diagnosi.id}
                          onClick={() => setSelectedDiagnosi(diagnosi.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <strong>{diagnosi.codice}</strong>
                          <br />
                          <small>{diagnosi.descrizione}</small>
                          <br />
                          <CBadge color="secondary" className="mt-1">
                            {diagnosi.farmaci?.length || 0} farmaci
                          </CBadge>
                        </CListGroupItem>
                      )) : (
                        <CListGroupItem>
                          <em className="text-muted">Nessuna diagnosi disponibile</em>
                        </CListGroupItem>
                      )
                    }
                  </CListGroup>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol md={8}>
              {selectedDiagnosi ? (
                <CCard>
                  <CCardHeader className="d-flex justify-content-between align-items-center">
                    <h6>💊 Farmaci per {protocolli.diagnosi[selectedDiagnosi]?.codice}</h6>
                    <CButton 
                      color="primary" 
                      size="sm"
                      onClick={() => {
                        resetFormFarmaco();
                        setShowModalFarmaco(true);
                      }}
                    >
                      ➕ Nuovo Farmaco
                    </CButton>
                  </CCardHeader>
                  <CCardBody>
                    {protocolli.diagnosi[selectedDiagnosi]?.farmaci.map((farmaco) => (
                      <CCard key={farmaco.codice} className="mb-3">
                        <CCardBody>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h6>{farmaco.nome}</h6>
                              <p className="mb-1">
                                <strong>Codice:</strong> {farmaco.codice} | 
                                <strong> Principio:</strong> {farmaco.principio_attivo} |
                                <strong> Classe:</strong> {farmaco.classe}
                              </p>
                              <p className="mb-1">
                                <strong>Posologia:</strong> {farmaco.posologia_default}
                              </p>
                              <p className="mb-1">
                                <strong>Durata:</strong> {farmaco.durata_default}
                              </p>
                              {farmaco.note_default && (
                                <p className="mb-0">
                                  <strong>Note:</strong> {farmaco.note_default}
                                </p>
                              )}
                            </div>
                            <div>
                              <CButton 
                                color="warning" 
                                size="sm" 
                                className="me-2"
                                onClick={() => handleEditFarmaco(farmaco, selectedDiagnosi)}
                              >
                                ✏️
                              </CButton>
                              <CButton 
                                color="danger" 
                                size="sm"
                                onClick={() => handleDeleteFarmaco(selectedDiagnosi, farmaco.codice)}
                              >
                                🗑️
                              </CButton>
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    ))}
                  </CCardBody>
                </CCard>
              ) : (
                <CAlert color="info">
                  Seleziona una diagnosi per gestire i farmaci associati.
                </CAlert>
              )}
            </CCol>
          </CRow>
        </CTabPane>

        {/* Tab Durate & Note */}
        <CTabPane visible={activeTab === 'durate'}>
          <CRow>
            <CCol md={6}>
              <CCard>
                <CCardHeader>
                  <h6>📅 Durate Standard</h6>
                </CCardHeader>
                <CCardBody>
                  <CListGroup>
                    {protocolli?.durate_standard?.length > 0 ? 
                      protocolli.durate_standard.map((durata, index) => (
                        <CListGroupItem key={index}>{durata}</CListGroupItem>
                      )) : (
                        <CListGroupItem>
                          <em className="text-muted">Nessuna durata configurata</em>
                        </CListGroupItem>
                      )
                    }
                  </CListGroup>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol md={6}>
              <CCard>
                <CCardHeader>
                  <h6>📝 Note Frequenti</h6>
                </CCardHeader>
                <CCardBody>
                  <CListGroup>
                    {protocolli?.note_frequenti?.length > 0 ? 
                      protocolli.note_frequenti.map((nota, index) => (
                        <CListGroupItem key={index}>{nota}</CListGroupItem>
                      )) : (
                        <CListGroupItem>
                          <em className="text-muted">Nessuna nota configurata</em>
                        </CListGroupItem>
                      )
                    }
                  </CListGroup>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>
      </CTabContent>

      {/* Modal Diagnosi */}
      <CModal visible={showModalDiagnosi} onClose={() => setShowModalDiagnosi(false)} size="lg">
        <CModalHeader>
          <h4>{editingDiagnosi ? 'Modifica Diagnosi' : 'Nuova Diagnosi'}</h4>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>ID Univoco</CFormLabel>
              <CFormInput
                value={formDiagnosi.id}
                onChange={(e) => setFormDiagnosi({...formDiagnosi, id: e.target.value})}
                placeholder="es. ascesso_periapicale"
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Codice ICD10</CFormLabel>
              <CFormInput
                value={formDiagnosi.codice}
                onChange={(e) => setFormDiagnosi({...formDiagnosi, codice: e.target.value})}
                placeholder="es. K04.7"
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Descrizione</CFormLabel>
              <CFormInput
                value={formDiagnosi.descrizione}
                onChange={(e) => setFormDiagnosi({...formDiagnosi, descrizione: e.target.value})}
                placeholder="es. Ascesso periapicale senza fistola"
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModalDiagnosi(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSaveDiagnosi}>
            💾 Salva
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal Farmaco */}
      <CModal visible={showModalFarmaco} onClose={() => setShowModalFarmaco(false)} size="lg">
        <CModalHeader>
          <h4>{editingFarmaco ? 'Modifica Farmaco' : 'Nuovo Farmaco'}</h4>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Codice AIC</CFormLabel>
                  <CFormInput
                    value={formFarmaco.codice}
                    onChange={(e) => setFormFarmaco({...formFarmaco, codice: e.target.value})}
                    placeholder="es. 025181018"
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Classe</CFormLabel>
                  <CFormInput
                    value={formFarmaco.classe}
                    onChange={(e) => setFormFarmaco({...formFarmaco, classe: e.target.value})}
                    placeholder="es. A"
                  />
                </div>
              </CCol>
            </CRow>
            
            <div className="mb-3">
              <CFormLabel>Nome Commerciale</CFormLabel>
              <CFormInput
                value={formFarmaco.nome}
                onChange={(e) => setFormFarmaco({...formFarmaco, nome: e.target.value})}
                placeholder="es. Augmentin 875mg + 125mg compresse"
              />
            </div>
            
            <div className="mb-3">
              <CFormLabel>Principio Attivo</CFormLabel>
              <CFormInput
                value={formFarmaco.principio_attivo}
                onChange={(e) => setFormFarmaco({...formFarmaco, principio_attivo: e.target.value})}
                placeholder="es. Amoxicillina + Acido clavulanico"
              />
            </div>
            
            <div className="mb-3">
              <CFormLabel>Posologia Default</CFormLabel>
              <CFormInput
                value={formFarmaco.posologia_default}
                onChange={(e) => setFormFarmaco({...formFarmaco, posologia_default: e.target.value})}
                placeholder="es. 1 compressa ogni 12 ore"
              />
            </div>
            
            <div className="mb-3">
              <CFormLabel>Durata Default</CFormLabel>
              <CFormInput
                value={formFarmaco.durata_default}
                onChange={(e) => setFormFarmaco({...formFarmaco, durata_default: e.target.value})}
                placeholder="es. 6 giorni"
              />
            </div>
            
            <div className="mb-3">
              <CFormLabel>Note Default</CFormLabel>
              <CFormTextarea
                value={formFarmaco.note_default}
                onChange={(e) => setFormFarmaco({...formFarmaco, note_default: e.target.value})}
                placeholder="es. Assumere a stomaco pieno"
                rows={2}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModalFarmaco(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSaveFarmaco}>
            💾 Salva
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default GestioneProtocolli;