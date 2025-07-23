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
  getRegistri,
  getRegistro,
  createRegistro,
  getCurrentOperatore,
  type Registro
} from '@/api/services/rentri.service';

interface RegistriTabProps {
  isDemo: boolean;
  registri: Registro[];
  selectedRegistro: Registro | null;
  onSelectRegistro: (registro: Registro) => void;
  loading: boolean;
  onReload: () => void;
}

const RegistriTab: React.FC<RegistriTabProps> = ({ 
  isDemo, 
  registri, 
  selectedRegistro, 
  onSelectRegistro, 
  loading, 
  onReload 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsRegistro, setDetailsRegistro] = useState<Registro | null>(null);

  const [createForm, setCreateForm] = useState({
    denominazione: '',
    tipo: 'cronologico',
    descrizione: '',
    operatore_id: ''
  });
  const [operatoreLoading, setOperatoreLoading] = useState(false);

  const loadOperatore = async () => {
    setOperatoreLoading(true);
    try {
      const result = await getCurrentOperatore();
      setCreateForm(prev => ({
        ...prev,
        operatore_id: result.operatore_id
      }));
    } catch (err: any) {
      console.error('Errore nel recupero operatore:', err);
      setError('Errore nel recupero dati operatore automatico');
    } finally {
      setOperatoreLoading(false);
    }
  };

  const handleCreateRegistro = async () => {
    if (!createForm.denominazione) {
      setError('Denominazione è obbligatoria');
      return;
    }

    // Se non c'è operatore_id, prova a caricarlo automaticamente
    if (!createForm.operatore_id) {
      await loadOperatore();
      if (!createForm.operatore_id) {
        setError('Impossibile recuperare i dati dell\'operatore');
        return;
      }
    }

    setError(null);

    try {
      const newRegistro = await createRegistro({
        denominazione: createForm.denominazione,
        tipo: createForm.tipo,
        descrizione: createForm.descrizione,
        operatore_id: createForm.operatore_id
      }, isDemo);

      alert('Registro creato con successo!');
      setShowCreateModal(false);
      setCreateForm({
        denominazione: '',
        tipo: 'cronologico',
        descrizione: '',
        operatore_id: ''
      });
      
      // Ricarica la lista tramite parent
      onReload();
    } catch (err: any) {
      setError(err.message || 'Errore durante la creazione del registro');
    }
  };

  const handleViewDetails = (registro: Registro) => {
    setDetailsRegistro(registro);
    setShowDetailsModal(true);
  };

  const handleSelectRegistro = (registro: Registro) => {
    onSelectRegistro(registro);
  };

  const getStatoBadgeColor = (stato: string) => {
    switch (stato) {
      case 'attivo': return 'success';
      case 'sospeso': return 'warning';
      case 'cessato': return 'danger';
      default: return 'secondary';
    }
  };

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'cronologico': return 'primary';
      case 'carico_scarico': return 'info';
      case 'formulari': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div>
      {/* Selected Registry Info */}
      {selectedRegistro && (
        <CAlert color="info" className="mb-4">
          <strong>📋 Registro Selezionato:</strong> {selectedRegistro.denominazione} 
          <CBadge color="primary" className="ms-2">{selectedRegistro.id_registro}</CBadge>
          <CBadge color={getStatoBadgeColor(selectedRegistro.stato)} className="ms-2">
            {selectedRegistro.stato.toUpperCase()}
          </CBadge>
        </CAlert>
      )}

      {/* Actions Section */}
      <CRow className="mb-4">
        <CCol md={12}>
          <CCard>
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <strong>📋 Gestione Registri RENTRI</strong>
                <div>
                  <CButton 
                    color="primary" 
                    onClick={onReload}
                    disabled={loading}
                    className="me-2"
                  >
                    {loading ? <CSpinner size="sm" /> : '🔄 Aggiorna'}
                  </CButton>
                  <CButton 
                    color="success" 
                    onClick={() => {
                      setShowCreateModal(true);
                      loadOperatore(); // Carica automaticamente l'operatore_id
                    }}
                    disabled={loading}
                  >
                    ➕ Crea Nuovo Registro
                  </CButton>
                </div>
              </div>
            </CCardHeader>
            <CCardBody>
              <p className="text-muted mb-0">
                {loading 
                  ? 'Caricamento registri in corso...'
                  : `${registri.length} registro/i trovato/i. I registri vengono caricati automaticamente all'apertura della tab.`
                }
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {isDemo && (
        <CAlert color="info" className="mb-4">
          <strong>Modalità Demo:</strong> I registri mostrati sono fittizi e non rappresentano dati reali del sistema RENTRI.
        </CAlert>
      )}

      {/* Error Alert */}
      {error && (
        <CAlert color="danger" className="mb-4" onClose={() => setError(null)} dismissible>
          {error}
        </CAlert>
      )}

      {/* Results Table */}
      {registri.length > 0 ? (
        <CCard>
          <CCardHeader>
            <strong>📋 Registri Trovati ({registri.length})</strong>
          </CCardHeader>
          <CCardBody>
            <CTable responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Seleziona</CTableHeaderCell>
                  <CTableHeaderCell>ID Registro</CTableHeaderCell>
                  <CTableHeaderCell>Denominazione</CTableHeaderCell>
                  <CTableHeaderCell>Tipo</CTableHeaderCell>
                  <CTableHeaderCell>Stato</CTableHeaderCell>
                  <CTableHeaderCell>Data Creazione</CTableHeaderCell>
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {registri.map((registro, index) => (
                  <CTableRow key={index} className={selectedRegistro?.id_registro === registro.id_registro ? 'table-active' : ''}>
                    <CTableDataCell>
                      <CButton 
                        size="sm" 
                        color={selectedRegistro?.id_registro === registro.id_registro ? 'success' : 'outline-primary'}
                        onClick={() => handleSelectRegistro(registro)}
                      >
                        {selectedRegistro?.id_registro === registro.id_registro ? '✓' : 'Seleziona'}
                      </CButton>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="primary">{registro.id_registro}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{registro.denominazione}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getTipoBadgeColor(registro.tipo)}>
                        {registro.tipo.replace('_', ' ').toUpperCase()}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getStatoBadgeColor(registro.stato)}>
                        {registro.stato.toUpperCase()}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {new Date(registro.data_creazione).toLocaleDateString('it-IT')}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton 
                        size="sm" 
                        color="info"
                        onClick={() => handleViewDetails(registro)}
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
      ) : (
        !loading && (
          <CCard>
            <CCardBody className="text-center py-5">
              <div className="text-muted">
                <h5>📋 Nessun Registro Trovato</h5>
                <p>Non sono stati trovati registri associati al tuo operatore.</p>
                <p className="small">
                  {isDemo 
                    ? 'Modalità demo attiva - i dati potrebbero non essere disponibili.' 
                    : 'Verifica di essere autenticato correttamente con il tuo certificato RENTRI.'}
                </p>
              </div>
            </CCardBody>
          </CCard>
        )
      )}

      {/* Create Registry Modal */}
      <CModal size="lg" visible={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <CModalHeader>
          <CModalTitle>Crea Nuovo Registro RENTRI</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel>Denominazione *</CFormLabel>
                <CFormInput
                  value={createForm.denominazione}
                  onChange={(e) => setCreateForm({ ...createForm, denominazione: e.target.value })}
                  placeholder="Es. Registro Cronologico 2024"
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Operatore ID *</CFormLabel>
                <CFormInput
                  value={operatoreLoading ? 'Caricamento...' : createForm.operatore_id}
                  readOnly
                  placeholder={operatoreLoading ? 'Recupero automatico...' : 'Recuperato automaticamente'}
                />
                <small className="text-muted">
                  {operatoreLoading ? (
                    <>
                      <CSpinner size="sm" className="me-1" />
                      Recupero automatico dal certificato...
                    </>
                  ) : createForm.operatore_id ? (
                    '✓ Recuperato automaticamente dal certificato'
                  ) : (
                    '⚠️ Impossibile recuperare automaticamente'
                  )}
                </small>
              </CCol>
            </CRow>
            
            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel>Tipo Registro</CFormLabel>
                <CFormSelect
                  value={createForm.tipo}
                  onChange={(e) => setCreateForm({ ...createForm, tipo: e.target.value })}
                >
                  <option value="cronologico">Cronologico</option>
                  <option value="carico_scarico">Carico/Scarico</option>
                  <option value="formulari">Formulari</option>
                </CFormSelect>
              </CCol>
            </CRow>
            
            <CRow className="mb-3">
              <CCol md={12}>
                <CFormLabel>Descrizione</CFormLabel>
                <CFormTextarea
                  value={createForm.descrizione}
                  onChange={(e) => setCreateForm({ ...createForm, descrizione: e.target.value })}
                  placeholder="Descrizione opzionale del registro..."
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
          <CButton color="success" onClick={handleCreateRegistro} disabled={loading}>
            {loading ? <CSpinner size="sm" /> : 'Crea Registro'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Registry Details Modal */}
      <CModal visible={showDetailsModal} onClose={() => setShowDetailsModal(false)}>
        <CModalHeader>
          <CModalTitle>Dettagli Registro</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {detailsRegistro && (
            <div>
              <p><strong>ID Registro:</strong> <CBadge color="primary">{detailsRegistro.id_registro}</CBadge></p>
              <p><strong>Denominazione:</strong> {detailsRegistro.denominazione}</p>
              <p><strong>Tipo:</strong> 
                <CBadge color={getTipoBadgeColor(detailsRegistro.tipo)} className="ms-2">
                  {detailsRegistro.tipo.replace('_', ' ').toUpperCase()}
                </CBadge>
              </p>
              <p><strong>Stato:</strong> 
                <CBadge color={getStatoBadgeColor(detailsRegistro.stato)} className="ms-2">
                  {detailsRegistro.stato.toUpperCase()}
                </CBadge>
              </p>
              <p><strong>Data Creazione:</strong> {new Date(detailsRegistro.data_creazione).toLocaleString('it-IT')}</p>
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

export default RegistriTab;