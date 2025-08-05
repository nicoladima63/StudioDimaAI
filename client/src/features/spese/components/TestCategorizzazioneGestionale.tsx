import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CSpinner,
  CAlert,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CBadge,
  CProgress,
  CRow,
  CCol,
  CInputGroup,
  CFormInput,
  CInputGroupText
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilWarning, cilSearch } from '@coreui/icons';
import { speseFornitioriService } from '../services/spese.service';
import type { CategoriaGestionale, RisultatoCategorizzazione } from '../services/spese.service';

interface TestResult {
  input: {
    descrizione: string;
    fornitore: string;
  };
  categoria_predetta: string;
  confidence: number;
}

const TestCategorizzazioneGestionale: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [categorie, setCategorie] = useState<CategoriaGestionale[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Test personalizzato
  const [customTest, setCustomTest] = useState({
    descrizione: '',
    fornitore: ''
  });
  const [customResult, setCustomResult] = useState<RisultatoCategorizzazione | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [xmlLoading, setXmlLoading] = useState(false);

  const runPredefinedTests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await speseFornitioriService.testCategorizzazione();
      if (response.success) {
        setTestResults(response.data.test_results);
      } else {
        setError('Errore nei test predefiniti');
      }
    } catch (err) {
      setError('Errore durante i test');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      // Chiamate sequenziali per evitare conflitti di autenticazione
      const statsResponse = await speseFornitioriService.getStatisticheGestionale();
      if (statsResponse.success) {
        setStatistics(statsResponse.data);
      }
      
      const categorieResponse = await speseFornitioriService.getCategorieGestionale();
      if (categorieResponse.success) {
        setCategorie(categorieResponse.data);
      }
    } catch (err) {
      console.error('Errore caricamento statistiche:', err);
    }
  };

  const testCustomInput = async () => {
    if (!customTest.descrizione.trim()) return;
    
    setCustomLoading(true);
    try {
      const response = await speseFornitioriService.categorizzaSpesa(
        customTest.descrizione,
        customTest.fornitore
      );
      
      if (response.success) {
        setCustomResult(response.data);
      }
    } catch (err) {
      console.error('Errore test personalizzato:', err);
    } finally {
      setCustomLoading(false);
    }
  };

  const clearCache = async () => {
    setCacheLoading(true);
    try {
      const response = await speseFornitioriService.clearCategorizzazioneCache();
      if (response.success) {
        setError(null);
        // Mostra messaggio di successo
        setCustomResult(null); // Reset risultati precedenti
      } else {
        setError('Errore nella pulizia cache');
      }
    } catch (err) {
      setError('Errore durante la pulizia cache');
    } finally {
      setCacheLoading(false);
    }
  };

  const integrateXmlPatterns = async () => {
    setXmlLoading(true);
    try {
      const response = await speseFornitioriService.integrateXmlPatterns();
      if (response.success) {
        setError(null);
        setCustomResult(null);
        // Ricarica statistiche dopo integrazione
        loadStatistics();
      } else {
        setError('Errore nell\'integrazione pattern XML');
      }
    } catch (err) {
      setError('Errore durante l\'integrazione pattern XML');
    } finally {
      setXmlLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <CBadge color="success">Alta ({(confidence * 100).toFixed(1)}%)</CBadge>;
    if (confidence >= 0.5) return <CBadge color="warning">Media ({(confidence * 100).toFixed(1)}%)</CBadge>;
    return <CBadge color="danger">Bassa ({(confidence * 100).toFixed(1)}%)</CBadge>;
  };

  return (
    <div>
      <CRow className="mb-4">
        <CCol md={8}>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Test Categorizzazione Gestionale</strong>
              </div>
              <div className="d-flex gap-2">
                <CButton 
                  color="success" 
                  size="sm"
                  onClick={integrateXmlPatterns}
                  disabled={xmlLoading}
                >
                  {xmlLoading && <CSpinner size="sm" className="me-2" />}
                  Integra XML
                </CButton>
                <CButton 
                  color="secondary" 
                  size="sm"
                  onClick={clearCache}
                  disabled={cacheLoading}
                >
                  {cacheLoading && <CSpinner size="sm" className="me-2" />}
                  Ricarica Pattern
                </CButton>
                <CButton 
                  color="primary" 
                  onClick={runPredefinedTests}
                  disabled={loading}
                >
                  {loading && <CSpinner size="sm" className="me-2" />}
                  Esegui Test
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              {error && (
                <CAlert color="danger" className="mb-3">
                  <CIcon icon={cilWarning} className="me-2" />
                  {error}
                </CAlert>
              )}

              {testResults.length > 0 && (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Descrizione</CTableHeaderCell>
                      <CTableHeaderCell>Fornitore</CTableHeaderCell>
                      <CTableHeaderCell>Categoria Predetta</CTableHeaderCell>
                      <CTableHeaderCell>Confidence</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {testResults.map((result, index) => (
                      <CTableRow key={index}>
                        <CTableDataCell>{result.input.descrizione}</CTableDataCell>
                        <CTableDataCell>{result.input.fornitore}</CTableDataCell>
                        <CTableDataCell>
                          <strong>{result.categoria_predetta}</strong>
                        </CTableDataCell>
                        <CTableDataCell>
                          {getConfidenceBadge(result.confidence)}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}

              {/* Test Personalizzato */}
              <div className="mt-4 p-3 border rounded">
                <h6 className="mb-3">
                  <CIcon icon={cilSearch} className="me-2" />
                  Test Personalizzato
                </h6>
                <CRow className="mb-3">
                  <CCol md={6}>
                    <CInputGroup>
                      <CInputGroupText>Descrizione</CInputGroupText>
                      <CFormInput
                        value={customTest.descrizione}
                        onChange={(e) => setCustomTest(prev => ({
                          ...prev,
                          descrizione: e.target.value
                        }))}
                        placeholder="Es: PUNTE VERDI 671/204/060 5PZ"
                      />
                    </CInputGroup>
                  </CCol>
                  <CCol md={4}>
                    <CInputGroup>
                      <CInputGroupText>Fornitore</CInputGroupText>
                      <CFormInput
                        value={customTest.fornitore}
                        onChange={(e) => setCustomTest(prev => ({
                          ...prev,
                          fornitore: e.target.value
                        }))}
                        placeholder="Es: Dental Supply"
                      />
                    </CInputGroup>
                  </CCol>
                  <CCol md={2}>
                    <CButton
                      color="success"
                      onClick={testCustomInput}
                      disabled={customLoading || !customTest.descrizione.trim()}
                      className="w-100"
                    >
                      {customLoading && <CSpinner size="sm" className="me-1" />}
                      Test
                    </CButton>
                  </CCol>
                </CRow>

                {customResult && (
                  <CAlert color="info">
                    <strong>Risultato:</strong> {customResult.categoria} - {getConfidenceBadge(customResult.confidence)}
                  </CAlert>
                )}
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={4}>
          <CCard>
            <CCardHeader>
              <CIcon icon={cilCheckCircle} className="me-2" />
              <strong>Statistiche Gestionale</strong>
            </CCardHeader>
            <CCardBody>
              {statistics ? (
                <div>
                  <div className="mb-3">
                    <small className="text-muted">Categorie Totali</small>
                    <div className="fs-4 fw-bold">{statistics.totale_categorie}</div>
                  </div>
                  
                  <div className="mb-3">
                    <small className="text-muted">Pattern Estratti</small>
                    <div className="fs-4 fw-bold">{statistics.totale_patterns}</div>
                  </div>

                  <h6 className="mt-4 mb-3">Top Categorie per Importo</h6>
                  {statistics.top_categorie_per_importo?.slice(0, 5).map((cat: any, index: number) => (
                    <div key={index} className="mb-2">
                      <div className="d-flex justify-content-between">
                        <small>{cat.categoria}</small>
                        <small>€{cat.importo.toLocaleString()}</small>
                      </div>
                      <CProgress 
                        height={4}
                        value={(cat.importo / statistics.top_categorie_per_importo[0].importo) * 100}
                        color="primary"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <CSpinner />
                  <div className="mt-2">Caricamento statistiche...</div>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  );
};

export default TestCategorizzazioneGestionale;