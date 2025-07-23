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
  getFIR,
  getFIRPDF,
  uploadDocumento,
  type FIR
} from '@/api/services/rentri.service';

interface FIRTabProps {
  isDemo: boolean;
}

const FIRTab: React.FC<FIRTabProps> = ({ isDemo }) => {
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFIR, setSelectedFIR] = useState<FIR | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  const [searchForm, setSearchForm] = useState({
    id_fir: '',
    numero: ''
  });

  const handleSearch = async () => {
    if (!searchForm.id_fir && !searchForm.numero) {
      setError('Inserire almeno un criterio di ricerca (ID FIR o Numero)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (searchForm.id_fir) {
        const fir = await getFIR(searchForm.id_fir, isDemo);
        setFirs(fir ? [fir] : []);
      } else {
        // In a real implementation, you would have a search by number endpoint
        setError('La ricerca per numero non è ancora implementata nel backend');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante la ricerca del FIR');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (fir: FIR) => {
    setSelectedFIR(fir);
    setShowDetailsModal(true);
  };

  const handleDownloadPDF = async (idFir: string) => {
    setLoading(true);
    try {
      const pdfBlob = await getFIRPDF(idFir, isDemo);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `FIR_${idFir}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err: any) {
      setError(err.message || 'Errore durante il download del PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile) {
      setError('Selezionare un file da caricare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('tipo', 'FIR');
      
      await uploadDocumento(formData, isDemo);
      alert('Documento caricato con successo!');
      setShowUploadModal(false);
      setUploadFile(null);
      
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento del documento');
    } finally {
      setLoading(false);
    }
  };

  const getStatoBadgeColor = (stato: string) => {
    switch (stato.toLowerCase()) {
      case 'bozza': return 'secondary';
      case 'compilato': return 'warning';
      case 'firmato': return 'info';
      case 'inviato': return 'primary';
      case 'accettato': return 'success';
      case 'rifiutato': return 'danger';
      default: return 'secondary';
    }
  };

  const formatFIRNumber = (numero: string) => {
    return numero ? `FIR-${numero}` : 'N/A';
  };

  return (
    <div>
      {/* Search and Upload Section */}
      <CRow className="mb-4">
        <CCol md={8}>
          <CCard>
            <CCardHeader>
              <strong>🔍 Ricerca FIR</strong>
            </CCardHeader>
            <CCardBody>
              <CForm>
                <CRow>
                  <CCol md={6}>
                    <CFormLabel>ID FIR</CFormLabel>
                    <CFormInput
                      value={searchForm.id_fir}
                      onChange={(e) => setSearchForm({ ...searchForm, id_fir: e.target.value })}
                      placeholder="Es. FIR123456789"
                    />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Numero FIR</CFormLabel>
                    <CFormInput
                      value={searchForm.numero}
                      onChange={(e) => setSearchForm({ ...searchForm, numero: e.target.value })}
                      placeholder="Es. 2024001"
                    />
                  </CCol>
                </CRow>
                <CRow className="mt-3">
                  <CCol>
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
              <strong>📎 Azioni</strong>
            </CCardHeader>
            <CCardBody>
              <CButton 
                color="success" 
                onClick={() => setShowUploadModal(true)}
                disabled={loading}
                className="mb-2"
              >
                Carica Documento
              </CButton>
              <br />
              <small className="text-muted">
                Carica FIR compilati o documenti correlati
              </small>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {isDemo && (
        <CAlert color="info" className="mb-4">
          <strong>Modalità Demo:</strong> I FIR mostrati sono fittizi e non rappresentano documenti reali del sistema RENTRI.
        </CAlert>
      )}

      {/* Error Alert */}
      {error && (
        <CAlert color="danger" className="mb-4" onClose={() => setError(null)} dismissible>
          {error}
        </CAlert>
      )}

      {/* Results Table */}
      {firs.length > 0 && (
        <CCard>
          <CCardHeader>
            <strong>📄 FIR Trovati ({firs.length})</strong>
          </CCardHeader>
          <CCardBody>
            <CTable responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>ID FIR</CTableHeaderCell>
                  <CTableHeaderCell>Numero</CTableHeaderCell>
                  <CTableHeaderCell>Data Compilazione</CTableHeaderCell>
                  <CTableHeaderCell>Stato</CTableHeaderCell>
                  <CTableHeaderCell>Produttore</CTableHeaderCell>
                  <CTableHeaderCell>Trasportatore</CTableHeaderCell>
                  <CTableHeaderCell>Destinatario</CTableHeaderCell>
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {firs.map((fir, index) => (
                  <CTableRow key={index}>
                    <CTableDataCell>
                      <CBadge color="primary">{fir.id_fir}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <strong>{formatFIRNumber(fir.numero)}</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      {new Date(fir.data_compilazione).toLocaleDateString('it-IT')}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getStatoBadgeColor(fir.stato)}>
                        {fir.stato.toUpperCase()}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <small>{fir.produttore}</small>
                    </CTableDataCell>
                    <CTableDataCell>
                      <small>{fir.trasportatore}</small>
                    </CTableDataCell>
                    <CTableDataCell>
                      <small>{fir.destinatario}</small>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-1 flex-column">
                        <CButton 
                          size="sm" 
                          color="info"
                          onClick={() => handleViewDetails(fir)}
                        >
                          Dettagli
                        </CButton>
                        <CButton 
                          size="sm" 
                          color="danger"
                          onClick={() => handleDownloadPDF(fir.id_fir)}
                          disabled={loading}
                        >
                          📄 PDF
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

      {/* Upload Document Modal */}
      <CModal visible={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <CModalHeader>
          <CModalTitle>Carica Documento FIR</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Seleziona File</CFormLabel>
              <CFormInput
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  setUploadFile(file || null);
                }}
              />
              <div className="form-text">
                Formati supportati: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
              </div>
            </div>
            
            {uploadFile && (
              <CAlert color="info">
                <strong>File selezionato:</strong> {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
              </CAlert>
            )}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowUploadModal(false)}>
            Annulla
          </CButton>
          <CButton color="success" onClick={handleUploadDocument} disabled={loading || !uploadFile}>
            {loading ? <CSpinner size="sm" /> : 'Carica'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* FIR Details Modal */}
      <CModal size="lg" visible={showDetailsModal} onClose={() => setShowDetailsModal(false)}>
        <CModalHeader>
          <CModalTitle>Dettagli FIR</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedFIR && (
            <div>
              <CRow className="mb-3">
                <CCol md={6}>
                  <p><strong>ID FIR:</strong> <CBadge color="primary">{selectedFIR.id_fir}</CBadge></p>
                  <p><strong>Numero:</strong> <strong>{formatFIRNumber(selectedFIR.numero)}</strong></p>
                  <p><strong>Data Compilazione:</strong> {new Date(selectedFIR.data_compilazione).toLocaleString('it-IT')}</p>
                </CCol>
                <CCol md={6}>
                  <p><strong>Stato:</strong> 
                    <CBadge color={getStatoBadgeColor(selectedFIR.stato)} className="ms-2">
                      {selectedFIR.stato.toUpperCase()}
                    </CBadge>
                  </p>
                </CCol>
              </CRow>
              
              <hr />
              
              <CRow>
                <CCol md={4}>
                  <h6>👷 Produttore</h6>
                  <p className="small">{selectedFIR.produttore}</p>
                </CCol>
                <CCol md={4}>
                  <h6>🚛 Trasportatore</h6>
                  <p className="small">{selectedFIR.trasportatore}</p>
                </CCol>
                <CCol md={4}>
                  <h6>🏭 Destinatario</h6>
                  <p className="small">{selectedFIR.destinatario}</p>
                </CCol>
              </CRow>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton 
            color="danger" 
            onClick={() => selectedFIR && handleDownloadPDF(selectedFIR.id_fir)}
            disabled={loading}
          >
            📄 Scarica PDF
          </CButton>
          <CButton color="secondary" onClick={() => setShowDetailsModal(false)}>
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default FIRTab;