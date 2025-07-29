import React, { useState /* useEffect */ } from 'react'; // TODO: Uncomment useEffect when effects are implemented
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
  CModalTitle
} from '@coreui/react';
import { 
  getOperatori,
  checkOperatoreIscrizione,
  getOperatoreSiti,
  createOperatoreRegistro,
  getOperatoreAnagrafica,
  type Operatore,
  type SitoOperatore
} from '@/api/services/rentri.service';

interface OperatoriTabProps {
  isDemo: boolean;
}

const OperatoriTab: React.FC<OperatoriTabProps> = ({ isDemo }) => {
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [siti, setSiti] = useState<SitoOperatore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchForm, setSearchForm] = useState({
    identificativo: '',
    codice_fiscale: ''
  });
  const [selectedOperatore, setSelectedOperatore] = useState<Operatore | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [iscrizioneStatus, setIscrizioneStatus] = useState<any>(null);

  const handleSearch = async () => {
    if (!searchForm.identificativo && !searchForm.codice_fiscale) {
      setError('Inserire almeno un criterio di ricerca');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (searchForm.codice_fiscale) {
        const anagrafica = await getOperatoreAnagrafica(searchForm.codice_fiscale, isDemo);
        setOperatori(anagrafica ? [anagrafica] : []);
      } else {
        const operatoriData = await getOperatori(isDemo);
        setOperatori(operatoriData || []);
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante la ricerca operatori');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIscrizione = async (identificativo: string) => {
    setLoading(true);
    try {
      const status = await checkOperatoreIscrizione(identificativo, isDemo);
      setIscrizioneStatus(status);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || 'Errore durante il controllo iscrizione');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSiti = async (numIscr: string, operatore: Operatore) => {
    setLoading(true);
    try {
      const sitiData = await getOperatoreSiti(numIscr, isDemo);
      setSiti(sitiData || []);
      setSelectedOperatore(operatore);
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento siti');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegistro = async (operatoreId: string) => {
    setLoading(true);
    try {
      const registroData = {
        operatore_id: operatoreId,
        tipo: 'cronologico',
        denominazione: 'Nuovo Registro Cronologico'
      };
      
      await createOperatoreRegistro(registroData, isDemo);
      alert('Registro creato con successo!');
    } catch (err: any) {
      setError(err.message || 'Errore durante la creazione del registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Search Form */}
      <CCard className="mb-4">
        <CCardHeader>
          <strong>🔍 Ricerca Operatori</strong>
        </CCardHeader>
        <CCardBody>
          <CForm>
            <CRow>
              <CCol md={4}>
                <CFormLabel>Identificativo Operatore</CFormLabel>
                <CFormInput
                  value={searchForm.identificativo}
                  onChange={(e) => setSearchForm({ ...searchForm, identificativo: e.target.value })}
                  placeholder="Es. OP123456"
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel>Codice Fiscale</CFormLabel>
                <CFormInput
                  value={searchForm.codice_fiscale}
                  onChange={(e) => setSearchForm({ ...searchForm, codice_fiscale: e.target.value })}
                  placeholder="Es. 12345678901"
                />
              </CCol>
              <CCol md={4} className="d-flex align-items-end">
                <CButton 
                  color="primary" 
                  onClick={handleSearch}
                  disabled={loading}
                >
                  {loading ? <CSpinner size="sm" /> : 'Cerca'}
                </CButton>
              </CCol>
            </CRow>
          </CForm>

          {isDemo && (
            <CAlert color="info" className="mt-3">
              <strong>Modalità Demo:</strong> I dati mostrati sono fittizi e non rappresentano operatori reali.
            </CAlert>
          )}
        </CCardBody>
      </CCard>

      {/* Error Alert */}
      {error && (
        <CAlert color="danger" className="mb-4" onClose={() => setError(null)} dismissible>
          {error}
        </CAlert>
      )}

      {/* Results Table */}
      {operatori.length > 0 && (
        <CCard>
          <CCardHeader>
            <strong>📋 Operatori Trovati ({operatori.length})</strong>
          </CCardHeader>
          <CCardBody>
            <CTable responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Identificativo</CTableHeaderCell>
                  <CTableHeaderCell>Denominazione</CTableHeaderCell>
                  <CTableHeaderCell>Codice Fiscale</CTableHeaderCell>
                  <CTableHeaderCell>Sede Legale</CTableHeaderCell>
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {operatori.map((operatore, index) => (
                  <CTableRow key={index}>
                    <CTableDataCell>
                      <CBadge color="primary">{operatore.identificativo}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{operatore.denominazione}</CTableDataCell>
                    <CTableDataCell>{operatore.codice_fiscale}</CTableDataCell>
                    <CTableDataCell>{operatore.sede_legale}</CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-2">
                        <CButton 
                          size="sm" 
                          color="info"
                          onClick={() => handleCheckIscrizione(operatore.identificativo)}
                          disabled={loading}
                        >
                          Controlla Iscrizione
                        </CButton>
                        <CButton 
                          size="sm" 
                          color="success"
                          onClick={() => handleViewSiti(operatore.identificativo, operatore)}
                          disabled={loading}
                        >
                          Visualizza Siti
                        </CButton>
                        <CButton 
                          size="sm" 
                          color="warning"
                          onClick={() => handleCreateRegistro(operatore.identificativo)}
                          disabled={loading}
                        >
                          Crea Registro
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      )}

      {/* Sites Table */}
      {selectedOperatore && siti.length > 0 && (
        <CCard className="mt-4">
          <CCardHeader>
            <strong>🏭 Siti di {selectedOperatore.denominazione}</strong>
          </CCardHeader>
          <CCardBody>
            <CTable responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>Denominazione</CTableHeaderCell>
                  <CTableHeaderCell>Indirizzo</CTableHeaderCell>
                  <CTableHeaderCell>Comune</CTableHeaderCell>
                  <CTableHeaderCell>Provincia</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {siti.map((sito, index) => (
                  <CTableRow key={index}>
                    <CTableDataCell>
                      <CBadge color="secondary">{sito.id}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{sito.denominazione}</CTableDataCell>
                    <CTableDataCell>{sito.indirizzo}</CTableDataCell>
                    <CTableDataCell>{sito.comune}</CTableDataCell>
                    <CTableDataCell>{sito.provincia}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      )}

      {/* Iscrizione Status Modal */}
      <CModal visible={showModal} onClose={() => setShowModal(false)}>
        <CModalHeader>
          <CModalTitle>Stato Iscrizione Operatore</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {iscrizioneStatus && (
            <div>
              <p><strong>Operatore:</strong> {iscrizioneStatus.identificativo}</p>
              <p><strong>Stato:</strong> 
                <CBadge color={iscrizioneStatus.iscritto ? 'success' : 'danger'} className="ms-2">
                  {iscrizioneStatus.iscritto ? 'Iscritto' : 'Non Iscritto'}
                </CBadge>
              </p>
              {iscrizioneStatus.data_iscrizione && (
                <p><strong>Data Iscrizione:</strong> {iscrizioneStatus.data_iscrizione}</p>
              )}
              {iscrizioneStatus.note && (
                <p><strong>Note:</strong> {iscrizioneStatus.note}</p>
              )}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default OperatoriTab;