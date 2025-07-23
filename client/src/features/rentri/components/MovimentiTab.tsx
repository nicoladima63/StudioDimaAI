import React, { useState } from 'react';
import { 
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CAlert,
  CBadge,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CFormTextarea
} from '@coreui/react';
import { 
  getMovimento,
  createMovimento,
  type Movimento
} from '@/api/services/rentri.service';

interface MovimentiTabProps {
  isDemo: boolean;
}

const MovimentiTab: React.FC<MovimentiTabProps> = ({ isDemo }) => {
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMovimento, setSelectedMovimento] = useState<Movimento | null>(null);
  
  const [searchForm, setSearchForm] = useState({
    id_movimento: ''
  });

  const [createForm, setCreateForm] = useState({
    tipo_operazione: 'carico',
    codice_rifiuto: '',
    quantita: '',
    unita_misura: 'kg',
    data_movimento: new Date().toISOString().split('T')[0],
    descrizione: '',
    registro_id: ''
  });

  const handleSearch = async () => {
    if (!searchForm.id_movimento) {
      setError('Inserire l\'ID del movimento da cercare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const movimento = await getMovimento(searchForm.id_movimento, isDemo);
      setMovimenti(movimento ? [movimento] : []);
    } catch (err: any) {
      setError(err.message || 'Errore durante la ricerca del movimento');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMovimento = async () => {
    if (!createForm.tipo_operazione || !createForm.codice_rifiuto || !createForm.quantita) {
      setError('Tipo operazione, codice rifiuto e quantità sono obbligatori');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newMovimento = await createMovimento({
        tipo_operazione: createForm.tipo_operazione,
        codice_rifiuto: createForm.codice_rifiuto,
        quantita: parseFloat(createForm.quantita),
        unita_misura: createForm.unita_misura,
        data_movimento: createForm.data_movimento,
        descrizione: createForm.descrizione,
        registro_id: createForm.registro_id
      }, isDemo);

      alert('Movimento creato con successo!');
      setShowCreateModal(false);
      setCreateForm({
        tipo_operazione: 'carico',
        codice_rifiuto: '',
        quantita: '',
        unita_misura: 'kg',
        data_movimento: new Date().toISOString().split('T')[0],
        descrizione: '',
        registro_id: ''
      });
      
      // Refresh the list
      if (newMovimento?.id_movimento) {
        setMovimenti([newMovimento, ...movimenti]);
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante la creazione del movimento');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (movimento: Movimento) => {
    setSelectedMovimento(movimento);
    setShowDetailsModal(true);
  };

  const getTipoOperazioneBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'carico': return 'success';
      case 'scarico': return 'warning';
      case 'trasferimento': return 'info';
      case 'smaltimento': return 'danger';
      default: return 'secondary';
    }
  };

  const getUnitaMisuraBadge = (unita: string) => {
    const unitaMap: { [key: string]: string } = {
      'kg': '⚖️ kg',
      't': '🏗️ t',
      'l': '🥤 l',
      'm3': '📦 m³',
      'pz': '🔢 pz'
    };
    return unitaMap[unita] || unita;
  };

  return (
    <div>
      {/* Search and Create Section */}
      <CRow className="mb-4">
        <CCol md={8}>
          <CCard>
            <CCardHeader>
              <strong>🔍 Ricerca Movimento</strong>
            </CCardHeader>
            <CCardBody>
              <CForm>
                <CRow>
                  <CCol md={8}>
                    <CFormLabel>ID Movimento</CFormLabel>
                    <CFormInput
                      value={searchForm.id_movimento}
                      onChange={(e) => setSearchForm({ ...searchForm, id_movimento: e.target.value })}
                      placeholder="Es. MOV123456789"
                    />
                  </CCol>
                  <CCol md={4} className="d-flex align-items-end">
                    <CButton 
                      color="primary" 
                      onClick={handleSearch}
                      disabled={loading}
                      className="me-2"
                    >
                      {loading ? <CSpinner size="sm" /> : 'Cerca'}
                    </CButton>
                  </CCol>
                </CRow>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
        
        <CCol md={4}>
          <CCard>
            <CCardHeader>
              <strong>➕ Azioni</strong>
            </CCardHeader>
            <CCardBody>
              <CButton 
                color="success" 
                onClick={() => setShowCreateModal(true)}
                disabled={loading}
              >
                Registra Movimento
              </CButton>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {isDemo && (
        <CAlert color="info" className="mb-4">
          <strong>Modalità Demo:</strong> I movimenti mostrati sono fittizi e non rappresentano operazioni reali del sistema RENTRI.
        </CAlert>
      )}

      {/* Error Alert */}
      {error && (
        <CAlert color="danger" className="mb-4" onClose={() => setError(null)} dismissible>
          {error}
        </CAlert>
      )}

      {/* Results Table */}
      {movimenti.length > 0 && (
        <CCard>
          <CCardHeader>
            <strong>🔄 Movimenti Trovati ({movimenti.length})</strong>
          </CCardHeader>
          <CCardBody>
            <CTable responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>ID Movimento</CTableHeaderCell>
                  <CTableHeaderCell>Tipo Operazione</CTableHeaderCell>
                  <CTableHeaderCell>Codice Rifiuto</CTableHeaderCell>
                  <CTableHeaderCell>Quantità</CTableHeaderCell>
                  <CTableHeaderCell>Data Movimento</CTableHeaderCell>
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {movimenti.map((movimento, index) => (
                  <CTableRow key={index}>
                    <CTableDataCell>
                      <CBadge color="primary">{movimento.id_movimento}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getTipoOperazioneBadgeColor(movimento.tipo_operazione)}>
                        {movimento.tipo_operazione.toUpperCase()}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="info">{movimento.codice_rifiuto}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <strong>{movimento.quantita}</strong> {getUnitaMisuraBadge(movimento.unita_misura)}
                    </CTableDataCell>
                    <CTableDataCell>
                      {new Date(movimento.data_movimento).toLocaleDateString('it-IT')}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton 
                        size="sm" 
                        color="info"
                        onClick={() => handleViewDetails(movimento)}
                      >
                        Dettagli
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      )}

      {/* Create Movement Modal */}
      <CModal size="lg" visible={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <CModalHeader>
          <CModalTitle>Registra Nuovo Movimento</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel>Tipo Operazione *</CFormLabel>
                <CFormSelect
                  value={createForm.tipo_operazione}
                  onChange={(e) => setCreateForm({ ...createForm, tipo_operazione: e.target.value })}
                >
                  <option value="carico">Carico</option>
                  <option value="scarico">Scarico</option>
                  <option value="trasferimento">Trasferimento</option>
                  <option value="smaltimento">Smaltimento</option>
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Codice Rifiuto *</CFormLabel>
                <CFormInput
                  value={createForm.codice_rifiuto}
                  onChange={(e) => setCreateForm({ ...createForm, codice_rifiuto: e.target.value })}
                  placeholder="Es. 200301 (CER)"
                />
              </CCol>
            </CRow>
            
            <CRow className="mb-3">
              <CCol md={4}>
                <CFormLabel>Quantità *</CFormLabel>
                <CFormInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.quantita}
                  onChange={(e) => setCreateForm({ ...createForm, quantita: e.target.value })}
                  placeholder="0.00"
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel>Unità di Misura</CFormLabel>
                <CFormSelect
                  value={createForm.unita_misura}
                  onChange={(e) => setCreateForm({ ...createForm, unita_misura: e.target.value })}
                >
                  <option value="kg">Chilogrammi (kg)</option>
                  <option value="t">Tonnellate (t)</option>
                  <option value="l">Litri (l)</option>
                  <option value="m3">metri cubi (m³)</option>
                  <option value="pz">Pezzi (pz)</option>
                </CFormSelect>
              </CCol>
              <CCol md={4}>
                <CFormLabel>Data Movimento</CFormLabel>
                <CFormInput
                  type="date"
                  value={createForm.data_movimento}
                  onChange={(e) => setCreateForm({ ...createForm, data_movimento: e.target.value })}
                />
              </CCol>
            </CRow>
            
            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel>Registro ID</CFormLabel>
                <CFormInput
                  value={createForm.registro_id}
                  onChange={(e) => setCreateForm({ ...createForm, registro_id: e.target.value })}
                  placeholder="Es. REG123456789"
                />
              </CCol>
            </CRow>
            
            <CRow className="mb-3">
              <CCol md={12}>
                <CFormLabel>Descrizione</CFormLabel>
                <CFormTextarea
                  value={createForm.descrizione}
                  onChange={(e) => setCreateForm({ ...createForm, descrizione: e.target.value })}
                  placeholder="Descrizione opzionale del movimento..."
                  rows={3}
                />
              </CCol>
            </CRow>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowCreateModal(false)}>
            Annulla
          </CButton>
          <CButton color="success" onClick={handleCreateMovimento} disabled={loading}>
            {loading ? <CSpinner size="sm" /> : 'Registra Movimento'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Movement Details Modal */}
      <CModal visible={showDetailsModal} onClose={() => setShowDetailsModal(false)}>
        <CModalHeader>
          <CModalTitle>Dettagli Movimento</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedMovimento && (
            <div>
              <p><strong>ID Movimento:</strong> <CBadge color="primary">{selectedMovimento.id_movimento}</CBadge></p>
              <p><strong>Tipo Operazione:</strong> 
                <CBadge color={getTipoOperazioneBadgeColor(selectedMovimento.tipo_operazione)} className="ms-2">
                  {selectedMovimento.tipo_operazione.toUpperCase()}
                </CBadge>
              </p>
              <p><strong>Codice Rifiuto:</strong> <CBadge color="info">{selectedMovimento.codice_rifiuto}</CBadge></p>
              <p><strong>Quantità:</strong> <strong>{selectedMovimento.quantita}</strong> {getUnitaMisuraBadge(selectedMovimento.unita_misura)}</p>
              <p><strong>Data Movimento:</strong> {new Date(selectedMovimento.data_movimento).toLocaleString('it-IT')}</p>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowDetailsModal(false)}>
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default MovimentiTab;