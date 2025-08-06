import React, { useState } from 'react';
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CBadge,
  CButton,
  CAlert
} from '@coreui/react';
import ContoSottocontoSelect from '@/components/ContoSottocontoSelect';
import CategoriaSpesaSelectAdvanced from '@/features/fornitori/components/CategoriaSpesaSelectAdvanced';
import { useConti, useContiStore } from '@/store/contiStore';
import type { Conto, Sottoconto } from '@/store/contiStore';

const ContiTestPage: React.FC = () => {
  const { conti, isLoading, error, refresh } = useConti();
  const { getCacheInfo, invalidateCache } = useContiStore();
  
  const [selectedConto, setSelectedConto] = useState<string>("");
  const [selectedSottoconto, setSelectedSottoconto] = useState<string>("");
  const [selectedContoObj, setSelectedContoObj] = useState<Conto | null>(null);
  const [selectedSottocontoObj, setSelectedSottocontoObj] = useState<Sottoconto | null>(null);

  const handleContoChange = (codice: string | null, conto: Conto | null) => {
    setSelectedConto(codice || "");
    setSelectedContoObj(conto);
    console.log("Conto selezionato:", { codice, conto });
  };

  const handleSottocontoChange = (codice: string | null, sottoconto: Sottoconto | null) => {
    setSelectedSottoconto(codice || "");
    setSelectedSottocontoObj(sottoconto);
    console.log("Sottoconto selezionato:", { codice, sottoconto });
  };

  const cacheInfo = getCacheInfo();

  return (
    <CContainer className="py-4">
      <CRow>
        <CCol xs={12}>
          <h2>Test Sistema Gerarchico Conti → Sottoconti</h2>
          <p className="text-muted">
            Questa pagina testa il nuovo sistema di classificazione gerarchica con caching intelligente.
          </p>
        </CCol>
      </CRow>

      {/* Cache Info */}
      <CRow className="mb-4">
        <CCol xs={12}>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>Info Cache</strong>
              <div>
                <CButton size="sm" color="secondary" onClick={refresh} disabled={isLoading}>
                  {isLoading ? 'Caricamento...' : 'Refresh'}
                </CButton>
                <CButton size="sm" color="warning" className="ms-2" onClick={invalidateCache}>
                  Invalida Cache
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              {cacheInfo.loaded ? (
                <div>
                  <CBadge color="success" className="me-2">Cache Caricato</CBadge>
                  <small>
                    Ultimo aggiornamento: {cacheInfo.lastUpdate} | 
                    Conti: {cacheInfo.counts?.conti} | 
                    Sottoconti: {cacheInfo.counts?.sottoconti}
                  </small>
                </div>
              ) : (
                <CBadge color="warning">Cache Non Caricato</CBadge>
              )}
              
              {error && (
                <CAlert color="danger" className="mt-2 mb-0">
                  Errore: {error}
                </CAlert>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Test Componente Base */}
      <CRow className="mb-4">
        <CCol xs={12}>
          <CCard>
            <CCardHeader>
              <strong>Test Componente ContoSottocontoSelect</strong>
            </CCardHeader>
            <CCardBody>
              <ContoSottocontoSelect
                selectedConto={selectedConto}
                selectedSottoconto={selectedSottoconto}
                onContoChange={handleContoChange}
                onSottocontoChange={handleSottocontoChange}
                showLabels={true}
                autoSelectIfSingle={true}
              />
              
              {/* Risultato selezione */}
              <div className="mt-3 p-3 bg-light rounded">
                <h6>Selezione Attuale:</h6>
                <div>
                  <strong>Conto:</strong> {selectedConto || "Nessuno"} 
                  {selectedContoObj && ` - ${selectedContoObj.descrizione} (${selectedContoObj.tipo})`}
                </div>
                <div>
                  <strong>Sottoconto:</strong> {selectedSottoconto || "Nessuno"}
                  {selectedSottocontoObj && ` - ${selectedSottocontoObj.descrizione}`}
                </div>
                
                {/* Simulazione associazione fornitore */}
                {selectedConto && (
                  <div className="mt-2">
                    <CBadge color="info">
                      Associazione: Fornitore → {selectedConto}
                      {selectedSottoconto && ` → ${selectedSottoconto}`}
                    </CBadge>
                  </div>
                )}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Test Componente Avanzato */}
      <CRow className="mb-4">
        <CCol xs={12}>
          <CCard>
            <CCardHeader>
              <strong>Test Componente CategoriaSpesaSelectAdvanced</strong>
              <small className="text-muted ms-2">(Simulazione con fornitore collaboratore)</small>
            </CCardHeader>
            <CCardBody>
              <CategoriaSpesaSelectAdvanced
                fornitoreId="ZZZZWB" // Roberto Calvisi - Chirurgia
                classificazione={null}
                onCategoriaChange={(conto, sottoconto) => {
                  console.log("Advanced selection:", { conto, sottoconto });
                }}
                showSuggestions={true}
              />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Statistiche Conti */}
      <CRow>
        <CCol xs={12}>
          <CCard>
            <CCardHeader>
              <strong>Statistiche Conti Caricati</strong>
            </CCardHeader>
            <CCardBody>
              <CRow>
                <CCol md={6}>
                  <h6>Conti Principali ({conti.length})</h6>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {conti.slice(0, 10).map(conto => (
                      <div key={conto.codice_conto} className="small mb-1">
                        <CBadge color="primary" className="me-2">{conto.tipo}</CBadge>
                        {conto.codice_conto} - {conto.descrizione}
                      </div>
                    ))}
                    {conti.length > 10 && (
                      <div className="text-muted small">... e altri {conti.length - 10}</div>
                    )}
                  </div>
                </CCol>
                
                <CCol md={6}>
                  <h6>Conti con Sottoconti</h6>
                  <div className="small text-muted">
                    I conti con sottoconti verranno mostrati quando li selezioni nel componente sopra.
                  </div>
                  
                  {/* Shortcut per testare conti noti */}
                  <div className="mt-3">
                    <strong>Test Rapidi:</strong>
                    <div className="mt-2">
                      <CButton 
                        size="sm" 
                        color="outline-primary" 
                        className="me-2"
                        onClick={() => handleContoChange("ZZZZZI", conti.find(c => c.codice_conto === "ZZZZZI") || null)}
                      >
                        ZZZZZI - Collaboratori
                      </CButton>
                      <CButton 
                        size="sm" 
                        color="outline-primary" 
                        className="me-2"
                        onClick={() => handleContoChange("ZZZZZZ", conti.find(c => c.codice_conto === "ZZZZZZ") || null)}
                      >
                        ZZZZZZ - Materiali
                      </CButton>
                    </div>
                  </div>
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  );
};

export default ContiTestPage;