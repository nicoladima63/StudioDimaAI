import React, { useState, useEffect } from 'react';
import {
  CRow, CCol, CCard, CCardBody, CButton, CForm, CFormInput,
  CFormLabel, CFormTextarea, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CBadge, CModal, CModalHeader, CModalBody,
  CModalFooter, CAlert, CSpinner, CFormSelect
} from '@coreui/react';
import { 
  protocolliService,
  type Diagnosi,
  type Farmaco,
  type ProtocolloTerapeutico
} from '@/api/services/protocolli.service';

const GestioneProtocolli: React.FC = () => {
  // State per dati
  const [diagnosi, setDiagnosi] = useState<Diagnosi[]>([]);
  const [farmaci, setFarmaci] = useState<Farmaco[]>([]);
  const [categorieFarmaci, setCategorieFarmaci] = useState<string[]>([]);
  const [protocolli, setProtocolli] = useState<ProtocolloTerapeutico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiagnosi, setSelectedDiagnosi] = useState<Diagnosi | null>(null);

  // State per modali
  const [showModalDiagnosi, setShowModalDiagnosi] = useState(false);
  const [showModalDuplica, setShowModalDuplica] = useState(false);
  const [showModalProtocollo, setShowModalProtocollo] = useState(false);
  const [showModalAssociazione, setShowModalAssociazione] = useState(false);
  
  // State per editing
  const [editingDiagnosi, setEditingDiagnosi] = useState<Diagnosi | null>(null);
  const [editingProtocollo, setEditingProtocollo] = useState<ProtocolloTerapeutico | null>(null);
  const [editingAssociazione, setEditingAssociazione] = useState<any>(null);

  // Form states
  const [formDiagnosi, setFormDiagnosi] = useState({
    id: '',
    codice: '',
    descrizione: '',
    categoria: ''
  });

  const [formDuplica, setFormDuplica] = useState({
    new_codice: '',
    new_descrizione: '',
    new_categoria: ''
  });

  const [formProtocollo, setFormProtocollo] = useState({
    farmacoId: 0,
    posologia_custom: '',
    durata_custom: '',
    note_custom: ''
  });

  const [formAssociazione, setFormAssociazione] = useState({
    farmaco_codice: '',
    posologia: '',
    durata: '',
    note: ''
  });

  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [alert, setAlert] = useState<{type: string, message: string} | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDiagnosi) {
      loadProtocolli();
    }
  }, [selectedDiagnosi]);

  useEffect(() => {
    if (filtroCategoria) {
      loadFarmaci();
    }
  }, [filtroCategoria]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [diagnosiData, farmaciData, categorieData] = await Promise.all([
        protocolliService.getDiagnosi(),
        protocolliService.getFarmaci(),
        protocolliService.getCategorieFarmaci()
      ]);
      setDiagnosi(diagnosiData);
      setFarmaci(farmaciData);
      setCategorieFarmaci(categorieData);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProtocolli = async () => {
    if (!selectedDiagnosi) return;
    
    try {
      const protocolliData = await protocolliService.getProtocolliPerDiagnosi(selectedDiagnosi.id);
      setProtocolli(protocolliData || []);
      setError('');
    } catch (error) {
      console.error('Errore caricamento protocolli:', error);
      setProtocolli([]);
      setError('Errore nel caricamento dei protocolli');
    }
  };

  const loadFarmaci = async () => {
    try {
      const farmaciData = await protocolliService.getFarmaci(filtroCategoria || undefined);
      setFarmaci(farmaciData);
    } catch (error) {
      console.error('Errore caricamento farmaci:', error);
    }
  };

  // Handlers per Diagnosi
  const handleCreateDiagnosi = () => {
    setEditingDiagnosi(null);
    setFormDiagnosi({ id: '', codice: '', descrizione: '', categoria: '' });
    setShowModalDiagnosi(true);
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

  const handleSaveDiagnosi = async () => {
    try {
      if (editingDiagnosi) {
        await protocolliService.updateDiagnosi(editingDiagnosi.id, {
          codice: formDiagnosi.codice,
          descrizione: formDiagnosi.descrizione
        });
      } else {
        await protocolliService.createDiagnosi(formDiagnosi);
      }
      
      await loadData();
      setShowModalDiagnosi(false);
    } catch (error) {
      console.error('Errore salvataggio diagnosi:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleDuplicaDiagnosi = (diagnosi: Diagnosi) => {
    setEditingDiagnosi(diagnosi);
    setFormDuplica({
      new_id: `${diagnosi.id}_copy`,
      new_codice: `${diagnosi.codice}_copy`,
      new_descrizione: `${diagnosi.descrizione} (Copia)`
    });
    setShowModalDuplica(true);
  };

  const handleSaveDuplica = async () => {
    if (!editingDiagnosi) return;
    
    try {
      await protocolliService.duplicateDiagnosi(editingDiagnosi.id, formDuplica);
      await loadData();
      setShowModalDuplica(false);
    } catch (error) {
      console.error('Errore duplicazione diagnosi:', error);
      alert('Errore durante la duplicazione');
    }
  };

  const handleDeleteDiagnosi = async (diagnosi: Diagnosi) => {
    if (!confirm(`Eliminare la diagnosi "${diagnosi.codice}"? Verranno eliminate anche tutte le associazioni farmaci.`)) {
      return;
    }
    
    try {
      await protocolliService.deleteDiagnosi(diagnosi.id);
      await loadData();
      if (selectedDiagnosi?.id === diagnosi.id) {
        setSelectedDiagnosi(null);
        setProtocolli([]);
      }
    } catch (error) {
      console.error('Errore eliminazione diagnosi:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  // Handlers per Associazioni Farmaci
  const handleAddAssociazione = () => {
    setEditingAssociazione(null);
    setFormAssociazione({ farmaco_codice: '', posologia: '', durata: '', note: '' });
    setShowModalAssociazione(true);
  };

  const handleEditAssociazione = (protocollo: ProtocolloTerapeutico) => {
    setEditingAssociazione(protocollo);
    setFormAssociazione({
      farmaco_codice: protocollo.farmaco_id.toString(),
      posologia: protocollo.posologia_custom || protocollo.posologia_standard,
      durata: protocollo.durata_custom || '',
      note: protocollo.note_custom || ''
    });
    setShowModalAssociazione(true);
  };

  const handleFarmacoChange = (farmacoId: string) => {
    const farmaco = farmaci.find(f => f.id === parseInt(farmacoId));
    
    setFormAssociazione({
      ...formAssociazione, 
      farmaco_codice: farmacoId,
      posologia: farmaco?.posologia_standard || '',
      durata: '', // Il farmaco non ha durata standard, lasciamo vuoto
      note: farmaco?.note || ''
    });
  };

  const handleSaveAssociazione = async () => {
    if (!selectedDiagnosi) return;
    
    try {
      if (editingAssociazione) {
        await protocolliService.updateProtocollo(editingAssociazione.protocollo_id, {
          posologia_custom: formAssociazione.posologia,
          durata_custom: formAssociazione.durata,
          note_custom: formAssociazione.note
        });
      } else {
        await protocolliService.createProtocollo({
          diagnosiId: selectedDiagnosi.id,
          farmacoId: parseInt(formAssociazione.farmaco_codice),
          posologia_custom: formAssociazione.posologia,
          durata_custom: formAssociazione.durata,
          note_custom: formAssociazione.note,
          ordine: 0
        });
      }
      
      await loadProtocolli();
      setShowModalAssociazione(false);
    } catch (error) {
      console.error('Errore salvataggio protocollo:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleDeleteAssociazione = async (protocollo: ProtocolloTerapeutico) => {
    if (!confirm('Eliminare questo protocollo terapeutico?')) return;
    
    try {
      await protocolliService.deleteProtocollo(protocollo.protocollo_id);
      await loadProtocolli();
    } catch (error) {
      console.error('Errore eliminazione protocollo:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <CSpinner color="primary" />
        <p>Caricamento protocolli...</p>
      </div>
    );
  }

  return (
    <div>
      <CRow className="mb-4">
        {/* Lista Diagnosi */}
        <CCol md={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="mb-0 fw-semibold">🩺 Diagnosi Disponibili</h6>
                <CButton 
                  color="primary" 
                  size="sm"
                  onClick={handleCreateDiagnosi}
                >
                  ➕ Nuova
                </CButton>
              </div>
              
              <CTable hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Codice</CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell>Farmaci</CTableHeaderCell>
                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {diagnosi && diagnosi.length > 0 ? diagnosi.map((d) => (
                    <CTableRow 
                      key={d.id}
                      className={selectedDiagnosi?.id === d.id ? 'table-active' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedDiagnosi(d)}
                    >
                      <CTableDataCell><strong>{d.codice}</strong></CTableDataCell>
                      <CTableDataCell>{d.descrizione}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="info">{d.num_farmaci || 0}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton 
                          color="link" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDiagnosi(d);
                          }}
                          title="Gestisci associazioni"
                        >
                          🔗
                        </CButton>
                        <CButton 
                          color="warning" 
                          size="sm" 
                          className="me-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDiagnosi(d);
                          }}
                          title="Modifica"
                        >
                          ✏️
                        </CButton>
                        <CButton 
                          color="info" 
                          size="sm" 
                          className="me-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicaDiagnosi(d);
                          }}
                          title="Duplica"
                        >
                          📋
                        </CButton>
                        <CButton 
                          color="danger" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDiagnosi(d);
                          }}
                          title="Elimina"
                        >
                          🗑️
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={4} className="text-center text-muted">
                        {loading ? 'Caricamento...' : 'Nessuna diagnosi disponibile'}
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>

        {/* Associazioni Farmaci */}
        <CCol md={6}>
          <CCard className="h-100">
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="mb-0 fw-semibold">💊 Farmaci Associati</h6>
                {selectedDiagnosi && (
                  <CButton 
                    color="primary" 
                    size="sm"
                    onClick={handleAddAssociazione}
                  >
                    ➕ Aggiungi
                  </CButton>
                )}
              </div>
              
              {!selectedDiagnosi ? (
                <CAlert color="info">
                  Seleziona una diagnosi per gestire le associazioni farmaci
                </CAlert>
              ) : (
                <div>
                  <div className="mb-3 p-2 bg-light rounded">
                    <strong>{selectedDiagnosi.codice}</strong>
                    <br />
                    <small>{selectedDiagnosi.descrizione}</small>
                  </div>
                  
                  {!protocolli || protocolli.length === 0 ? (
                    <p className="text-muted">Nessun farmaco associato</p>
                  ) : (
                    <div>
                      {protocolli.map((protocollo) => (
                        <CCard key={protocollo.protocollo_id} className="mb-2">
                          <CCardBody className="py-2">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <strong>{protocollo.principio_attivo}</strong>
                                <br />
                                <small>Nomi commerciali: {protocollo.nomi_commerciali}</small>
                                <br />
                                <small>Posologia: {protocollo.posologia_custom || protocollo.posologia_standard}</small>
                                <br />
                                <small>Durata: {protocollo.durata_custom || 'Non specificata'}</small>
                                {protocollo.note_custom && (
                                  <>
                                    <br />
                                    <small>Note: {protocollo.note_custom}</small>
                                  </>
                                )}
                              </div>
                              <div>
                                <CButton 
                                  color="warning" 
                                  size="sm" 
                                  className="me-1"
                                  onClick={() => handleEditAssociazione(protocollo)}
                                >
                                  ✏️
                                </CButton>
                                <CButton 
                                  color="danger" 
                                  size="sm"
                                  onClick={() => handleDeleteAssociazione(protocollo)}
                                >
                                  🗑️
                                </CButton>
                              </div>
                            </div>
                          </CCardBody>
                        </CCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

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
                disabled={!!editingDiagnosi}
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

      {/* Modal Duplica */}
      <CModal visible={showModalDuplica} onClose={() => setShowModalDuplica(false)} size="lg">
        <CModalHeader>
          <h4>📋 Duplica Diagnosi</h4>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Nuovo ID</CFormLabel>
              <CFormInput
                value={formDuplica.new_id}
                onChange={(e) => setFormDuplica({...formDuplica, new_id: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Nuovo Codice</CFormLabel>
              <CFormInput
                value={formDuplica.new_codice}
                onChange={(e) => setFormDuplica({...formDuplica, new_codice: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Nuova Descrizione</CFormLabel>
              <CFormInput
                value={formDuplica.new_descrizione}
                onChange={(e) => setFormDuplica({...formDuplica, new_descrizione: e.target.value})}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModalDuplica(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSaveDuplica}>
            📋 Duplica
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal Associazione Farmaco */}
      <CModal visible={showModalAssociazione} onClose={() => setShowModalAssociazione(false)} size="lg">
        <CModalHeader>
          <h4>{editingAssociazione ? 'Modifica Associazione' : 'Nuova Associazione Farmaco'}</h4>
        </CModalHeader>
        <CModalBody>
          <CForm>
            {!editingAssociazione && (
              <div className="mb-3">
                <CFormLabel>Farmaco</CFormLabel>
                <CFormSelect
                  value={formAssociazione.farmaco_codice}
                  onChange={(e) => handleFarmacoChange(e.target.value)}
                >
                  <option value="">Seleziona farmaco...</option>
                  {farmaci && farmaci.map(farmaco => (
                    <option key={farmaco.id} value={farmaco.id}>
                      {farmaco.principio_attivo} - {farmaco.nomi_commerciali}
                    </option>
                  ))}
                </CFormSelect>
              </div>
            )}
            
            <div className="mb-3">
              <CFormLabel>Posologia</CFormLabel>
              <CFormInput
                value={formAssociazione.posologia}
                onChange={(e) => setFormAssociazione({...formAssociazione, posologia: e.target.value})}
                placeholder="es. 1 compressa ogni 12 ore"
              />
            </div>
            
            <div className="mb-3">
              <CFormLabel>Durata</CFormLabel>
              <CFormInput
                value={formAssociazione.durata}
                onChange={(e) => setFormAssociazione({...formAssociazione, durata: e.target.value})}
                placeholder="es. 6 giorni"
              />
            </div>
            
            <div className="mb-3">
              <CFormLabel>Note</CFormLabel>
              <CFormTextarea
                value={formAssociazione.note}
                onChange={(e) => setFormAssociazione({...formAssociazione, note: e.target.value})}
                placeholder="Note aggiuntive..."
                rows={2}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModalAssociazione(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSaveAssociazione}>
            💾 Salva
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default GestioneProtocolli;