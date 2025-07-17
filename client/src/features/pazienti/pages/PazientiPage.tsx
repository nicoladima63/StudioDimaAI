// src/pages/PazientiUnifiedPage.tsx
import React, { useEffect, useState } from 'react';
import { 
  CButton, 
  CRow, 
  CCol, 
  CSpinner, 
  CAlert, 
  CCard, 
  CCardBody,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CInputGroup,
  CInputGroupText,
  CFormInput,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
  CBadge
} from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import { 
  cilPeople, 
  cilPhone, 
  cilLocationPin, 
  cilChart, 
  cilSearch,
  cilFilter,
  cilReload,
  cilCloudDownload
} from '@coreui/icons';

import Card from '@/components/ui/Card';
import PazientiTable from '../components/PazientiTable';
import PazientiStats from '../components/PazientiStats';
import RecallsTable from '../components/RecallsTable';
import RecallsStatistics from '../components/RecallsStatistics';
import CittaTable from '../components/CittaTable';
import { 
  usePazientiStore, 
  type ViewType, 
  type PriorityFilter, 
  type StatusFilter 
} from '@/store/pazienti.store';
import { 
  getPazientiAll,
  getPazientiStatistics,
  getCittaData,
  exportPazienti,
  getRichiami
} from '@/api/services/pazienti.service';

const PazientiPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViewType>('all');
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const {
    pazienti,
    statistiche,
    cittaData,
    isLoading,
    currentView,
    searchTerm,
    priorityFilter,
    statusFilter,
    selectedCitta,
    
    // Actions
    setPazienti,
    setStatistiche,
    setCittaData,
    setCurrentView,
    setSearchTerm,
    setPriorityFilter,
    setStatusFilter,
    setSelectedCitta,
    clearFilters,
    
    // Getters
    getFilteredPazienti,
    getFilteredRichiami,
    getFilteredCitta
  } = usePazientiStore();
  
  // Carica dati iniziali
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        
        // Carica tutto in parallelo
        const [pazientiRes, statsRes, cittaRes] = await Promise.all([
          getPazientiAll(),
          getPazientiStatistics(),
          getCittaData()
        ]);
        
        // Aggiorna store
        if (pazientiRes.success) setPazienti(pazientiRes.data);
        if (statsRes.success) setStatistiche(statsRes.data);
        if (cittaRes.success) setCittaData(cittaRes.data);
        
      } catch (err) {
        setError('Errore nel caricamento dei dati');
        console.error('Errore caricamento:', err);
      }
    };
    
    loadData();
  }, [setPazienti, setStatistiche, setCittaData]);
  
  // Sincronizza tab con store
  useEffect(() => {
    if (activeTab !== currentView) {
      setCurrentView(activeTab);
    }
  }, [activeTab, currentView, setCurrentView]);
  
  const handleRefresh = async () => {
    try {
      setError(null);
      
      // Ricarica tutti i dati
      const [pazientiRes, statsRes, cittaRes] = await Promise.all([
        getPazientiAll(),
        getPazientiStatistics(),
        getCittaData()
      ]);
      
      // Aggiorna store
      if (pazientiRes.success) setPazienti(pazientiRes.data);
      if (statsRes.success) setStatistiche(statsRes.data);
      if (cittaRes.success) setCittaData(cittaRes.data);
      
    } catch (err) {
      setError('Errore nell\'aggiornamento dei dati');
    }
  };
  
  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportPazienti({ 
        view: currentView, 
        priority: priorityFilter, 
        status: statusFilter 
      });
      // In produzione: gestire download file
    } catch (err) {
      setError('Errore nell\'export');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleClearFilters = () => {
    clearFilters();
  };
  
  // Dati filtrati per vista corrente
  const currentData = React.useMemo(() => {
    switch (currentView) {
      case 'recalls':
        return getFilteredRichiami();
      case 'cities':
        return getFilteredCitta();
      default:
        return getFilteredPazienti();
    }
  }, [currentView, getFilteredPazienti, getFilteredRichiami, getFilteredCitta]);
  
  const hasActiveFilters = searchTerm || priorityFilter || statusFilter || selectedCitta;
  
  return (
    <Card title="Gestione Pazienti e Richiami">
      <CCard>
        <CCardBody>
          {error && (
            <CAlert color="danger" className="mb-3">
              {error}
              <CButton 
                color="link" 
                size="sm" 
                onClick={handleRefresh}
                className="ms-2"
              >
                Riprova
              </CButton>
            </CAlert>
          )}
          
          {/* Navigation Tabs */}
          <CNav variant="tabs" className="mb-3">
            <CNavItem>
              <CNavLink 
                active={activeTab === 'all'} 
                onClick={() => setActiveTab('all')}
                className="d-flex align-items-center"
              >
                <CIcon icon={cilPeople} className="me-2" />
                Tutti i Pazienti
                <CBadge color="primary" className="ms-2">
                  {statistiche?.totale_pazienti || pazienti.length}
                </CBadge>
              </CNavLink>
            </CNavItem>
            
            <CNavItem>
              <CNavLink 
                active={activeTab === 'recalls'} 
                onClick={() => setActiveTab('recalls')}
                className="d-flex align-items-center"
              >
                <CIcon icon={cilPhone} className="me-2" />
                Richiami
                <CBadge color="warning" className="ms-2">
                  {statistiche?.richiami.totale_da_richiamare || 0}
                </CBadge>
              </CNavLink>
            </CNavItem>
            
            <CNavItem>
              <CNavLink 
                active={activeTab === 'cities'} 
                onClick={() => setActiveTab('cities')}
                className="d-flex align-items-center"
              >
                <CIcon icon={cilLocationPin} className="me-2" />
                Per Città
                <CBadge color="info" className="ms-2">
                  {cittaData.length}
                </CBadge>
              </CNavLink>
            </CNavItem>
          </CNav>
          
          {/* Statistiche */}
          {statistiche && currentView === 'all' && (
            <div className="mb-4">
              <PazientiStats stats={statistiche} />
            </div>
          )}
          
          {/* Toolbar */}
          <CRow className="mb-3">
            <CCol md={6}>
              <CInputGroup>
                <CInputGroupText>
                  <CIcon icon={cilSearch} />
                </CInputGroupText>
                <CFormInput
                  placeholder={
                    currentView === 'cities' 
                      ? 'Cerca città...' 
                      : 'Cerca per nome...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <CButton
                    color="outline-secondary"
                    onClick={() => setSearchTerm('')}
                    style={{ borderLeft: 'none' }}
                  >
                    ✕
                  </CButton>
                )}
              </CInputGroup>
            </CCol>
            
            <CCol md={6} className="d-flex justify-content-end gap-2">
              {/* Filtri per richiami */}
              {currentView === 'recalls' && (
                <>
                  <CDropdown>
                    <CDropdownToggle color="outline-secondary" size="sm">
                      <CIcon icon={cilFilter} className="me-1" />
                      Priorità
                      {priorityFilter && (
                        <CBadge color="primary" className="ms-1">
                          {priorityFilter}
                        </CBadge>
                      )}
                    </CDropdownToggle>
                    <CDropdownMenu>
                      <CDropdownItem onClick={() => setPriorityFilter(null)}>
                        Tutte
                      </CDropdownItem>
                      <CDropdownItem onClick={() => setPriorityFilter('high')}>
                        Alta
                      </CDropdownItem>
                      <CDropdownItem onClick={() => setPriorityFilter('medium')}>
                        Media
                      </CDropdownItem>
                      <CDropdownItem onClick={() => setPriorityFilter('low')}>
                        Bassa
                      </CDropdownItem>
                    </CDropdownMenu>
                  </CDropdown>
                  
                  <CDropdown>
                    <CDropdownToggle color="outline-secondary" size="sm">
                      <CIcon icon={cilFilter} className="me-1" />
                      Stato
                      {statusFilter && (
                        <CBadge color="primary" className="ms-1">
                          {statusFilter}
                        </CBadge>
                      )}
                    </CDropdownToggle>
                    <CDropdownMenu>
                      <CDropdownItem onClick={() => setStatusFilter(null)}>
                        Tutti
                      </CDropdownItem>
                      <CDropdownItem onClick={() => setStatusFilter('scaduto')}>
                        Scaduti
                      </CDropdownItem>
                      <CDropdownItem onClick={() => setStatusFilter('in_scadenza')}>
                        In Scadenza
                      </CDropdownItem>
                      <CDropdownItem onClick={() => setStatusFilter('futuro')}>
                        Futuri
                      </CDropdownItem>
                    </CDropdownMenu>
                  </CDropdown>
                </>
              )}
              
              {/* Filtro città per tutte le viste */}
              {currentView !== 'cities' && (
                <CDropdown>
                  <CDropdownToggle color="outline-secondary" size="sm">
                    <CIcon icon={cilLocationPin} className="me-1" />
                    Città
                    {selectedCitta && (
                      <CBadge color="primary" className="ms-1">
                        {selectedCitta}
                      </CBadge>
                    )}
                  </CDropdownToggle>
                  <CDropdownMenu style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <CDropdownItem onClick={() => setSelectedCitta(null)}>
                      Tutte le città
                    </CDropdownItem>
                    {statistiche?.geografia.top_citta && 
                      Object.entries(statistiche.geografia.top_citta).map(([citta, count]) => (
                        <CDropdownItem 
                          key={citta} 
                          onClick={() => setSelectedCitta(citta)}
                        >
                          {citta} ({count})
                        </CDropdownItem>
                      ))
                    }
                  </CDropdownMenu>
                </CDropdown>
              )}
              
              {/* Clear filters */}
              {hasActiveFilters && (
                <CButton 
                  color="outline-warning" 
                  size="sm" 
                  onClick={handleClearFilters}
                >
                  Cancella Filtri
                </CButton>
              )}
              
              {/* Refresh */}
              <CButton 
                color="outline-primary" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <CIcon icon={cilReload} className="me-1" />
                {isLoading ? 'Aggiornando...' : 'Aggiorna'}
              </CButton>
              
              {/* Export */}
              <CButton 
                color="primary" 
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                <CIcon icon={cilCloudDownload} className="me-1" />
                {isExporting ? 'Esportando...' : 'Esporta'}
              </CButton>
            </CCol>
          </CRow>
          
          {/* Tab Content */}
          <CTabContent>
            {/* Tutti i Pazienti */}
            <CTabPane visible={activeTab === 'all'}>
              {isLoading ? (
                <div className="text-center py-5">
                  <CSpinner color="primary" />
                  <p className="mt-2">Caricamento pazienti...</p>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <small className="text-muted">
                      Mostrando {getFilteredPazienti().length} di {pazienti.length} pazienti
                      {hasActiveFilters && ' (filtrati)'}
                    </small>
                  </div>
                  <PazientiTable 
                    pazienti={getFilteredPazienti()} 
                    loading={isLoading}
                  />
                </>
              )}
            </CTabPane>
            
            {/* Richiami */}
            <CTabPane visible={activeTab === 'recalls'}>
              {isLoading ? (
                <div className="text-center py-5">
                  <CSpinner color="primary" />
                  <p className="mt-2">Caricamento richiami...</p>
                </div>
              ) : (
                <>
                  {/* Statistiche richiami */}
                  {statistiche && (
                    <div className="mb-4">
                      <RecallsStatistics 
                        statistics={statistiche.richiami} 
                        loading={isLoading}
                      />
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <small className="text-muted">
                      Mostrando {getFilteredRichiami().length} richiami
                      {hasActiveFilters && ' (filtrati)'}
                    </small>
                  </div>
                  
                  <RecallsTable 
                    richiami={getFilteredRichiami()}
                    loading={isLoading}
                  />
                </>
              )}
            </CTabPane>
            
            {/* Per Città */}
            <CTabPane visible={activeTab === 'cities'}>
              {isLoading ? (
                <div className="text-center py-5">
                  <CSpinner color="primary" />
                  <p className="mt-2">Caricamento dati città...</p>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <small className="text-muted">
                      Mostrando {getFilteredCitta().length} città
                      {searchTerm && ' (filtrate)'}
                    </small>
                  </div>
                  
                  <CittaTable 
                    cittaData={getFilteredCitta()}
                    loading={isLoading}
                    onNavigateToPatients={(citta) => {
                      setSelectedCitta(citta);
                      setCurrentView('all');
                      setActiveTab('all');
                    }}
                  />
                </>
              )}
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>
    </Card>
  );
};

export default PazientiPage;