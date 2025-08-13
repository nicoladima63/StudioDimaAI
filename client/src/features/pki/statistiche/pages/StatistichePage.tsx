import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CContainer,
  CRow,
  CCol
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilUser, cilChart, cilBuilding, cilSpeedometer } from '@coreui/icons';
import CollaboratoriTab from '../components/CollaboratoriTab';
import UtenzeTab from '../components/UtenzeTab';
import StudioTab from '../components/StudioTab';
import AutostradaTab from '../components/AutostradaTab';
import StatisticheFiltri from '../components/StatisticheFiltri';
import { useContiStore } from '@/store/contiStore';
import statisticheService from '../services/statistiche.service';
import type { FornitoreStats, StatisticheFilters } from '../services/statistiche.service';
import type { StatisticheFiltriState } from '../components/StatisticheFiltri';

// Configurazione tab con filtri di classificazione
const TAB_FILTERS: Record<string, StatisticheFilters> = {
  collaboratori: {
    // TODO: Recuperare contoid dinamicamente dal nome "COLLABORATORI"
    periodo: 'anno_corrente'
  },
  utenze: {
    // TODO: Recuperare contoid dinamicamente dal nome "UTENZE" 
    periodo: 'anno_corrente'
  },
  studio: {
    // TODO: Recuperare contoid dinamicamente dal nome "STUDIO"
    periodo: 'anno_corrente'
  },
  autostrada: {
    // TODO: Recuperare contoid dinamicamente dal nome "AUTOSTRADA"
    periodo: 'anno_corrente'
  }
};

const StatistichePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('collaboratori');
  
  // Store per accesso ai conti
  const { conti, loadConti, getBrancaById } = useContiStore();
  
  // 🆕 State per filtri multi-anno
  const [filtriAnni, setFiltriAnni] = useState<StatisticheFiltriState>({
    anni: [new Date().getFullYear()]
  });
  
  // Cache ottimizzato per nuovo endpoint (ora include filtri nella chiave)
  const [cache, setCache] = useState<Record<string, FornitoreStats[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  
  // Helper per trovare contoid per nome
  const getContoIdByName = (nomeContoPattern: string): number | undefined => {
    const conto = conti.find(c => 
      c.nome.toUpperCase().includes(nomeContoPattern.toUpperCase())
    );
    return conto?.id;
  };
  
  // Carica conti all'avvio
  useEffect(() => {
    loadConti();
  }, [loadConti]);
  
  // Genera chiave cache che include tab + filtri anni
  const getCacheKey = (tab: string, anni: number[]) => {
    return `${tab}_${anni.sort().join('-')}`;
  };
  
  // Handler per cambio filtri
  const handleFiltriChange = (nuoviFiltri: StatisticheFiltriState) => {
    setFiltriAnni(nuoviFiltri);
    
    // Invalida cache quando cambiano i filtri (triggera ricaricamento)
    setCache({});
  };
  
  // 🎯 CARICAMENTO OTTIMIZZATO: Reagisce a tab attivo + filtri anni
  useEffect(() => {
    const cacheKey = getCacheKey(activeTab, filtriAnni.anni);
    
    
    // Attende che i conti siano caricati
    if (conti.length === 0) {
      return;
    }
    
    // Controlli anti-loop
    if (loading[cacheKey]) {
      return;
    }
    
    if (cache[cacheKey]) {
      return;
    }
    
    // Carica dati per il tab attivo + filtri
    loadTabData(activeTab, filtriAnni.anni);
  }, [activeTab, filtriAnni.anni, conti]); // Dipende da tab + anni + conti
  
  const loadTabData = async (tab: string, anni: number[]) => {
    const cacheKey = getCacheKey(tab, anni);
    
    setLoading(prev => ({ ...prev, [cacheKey]: true }));
    setErrors(prev => ({ ...prev, [cacheKey]: null }));
    
    try {
      // Costruisci filtri dinamici per il tab
      const baseFilters = TAB_FILTERS[tab] || {};
      
      // Aggiungi contoid se trovato
      const contoid = getContoIdByName(tab); // es. "collaboratori" → contoid per "COLLABORATORI"
      
      // 🆕 Includi filtri anni invece di periodo fisso
      const filters: StatisticheFilters = {
        ...baseFilters,
        ...(contoid && { contoid }),
        anni: anni  // 🎯 Multi-anno filter
      };
      
      
      // Singola chiamata API flessibile con multi-anno
      const response = await statisticheService.apiGetStatisticheFornitori(filters);
      
      if (response.success) {
        setCache(prev => ({ ...prev, [cacheKey]: response.data }));
      } else {
        throw new Error(response.error || `Errore caricamento ${tab}`);
      }
      
    } catch (error: any) {
      console.error('❌ Errore caricamento:', tab, error);
      setErrors(prev => ({ ...prev, [cacheKey]: error.message || 'Errore sconosciuto' }));
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  };
  
  // Wrapper per getBrancaById che gestisce null
  const getBrancaByIdSafe = (id: number | null): string | undefined => {
    if (id === null) return undefined;
    return getBrancaById(id);
  };
  
  // Helper per ottenere dati del tab con cache key corretto
  const getTabData = (tab: string) => {
    const cacheKey = getCacheKey(tab, filtriAnni.anni);
    return {
      data: cache[cacheKey],
      isLoading: loading[cacheKey] || false,
      error: errors[cacheKey] || null
    };
  };
  
  // Adatta dati FornitoreStats al formato legacy per i tab + include statistiche complete
  const adaptDataForTab = (fornitoreStats: FornitoreStats[]) => {
    // Crea raggruppamenti compatibili con la vecchia interfaccia
    const raggruppamenti = fornitoreStats.map(stat => ({
      codice_riferimento: stat.codice_riferimento,
      fornitore_nome: stat.fornitore_nome,
      count: stat.numero_fatture, // Usa numero fatture come count
      brancaid: stat.classificazione.brancaid,
      contoid: stat.classificazione.contoid,
      branca_nome: stat.classificazione.branca_nome, // 🆕 Nome branca diretto da API
      // 🆕 Aggiungi statistiche complete per StatisticheSpeseCard
      statistiche: {
        totale_fatturato: stat.spesa_totale,
        numero_fatture: stat.numero_fatture,
        media_fattura: stat.spesa_media,
        ultimo_lavoro: stat.ultimo_acquisto,
        percentuale_sul_totale: stat.percentuale_sul_totale,
        totali_mensili: [] // TODO: se necessario, calcolare da backend
      }
    }));
    
    return {
      classificazioni: [], // Non più necessario con nuovo endpoint
      raggruppamenti
    };
  };

  return (
    <CContainer fluid>
      <CRow>
        <CCol>
          <CCard>
            <CCardHeader>
              <h4 className="mb-0">Statistiche Studio</h4>
              <small className="text-muted">
                Analisi dettagliate per categorie di spesa e produttività - API Ottimizzata
              </small>
            </CCardHeader>
            <CCardBody>
              {/* 🆕 Filtri Multi-Anno */}
              <StatisticheFiltri 
                onFiltersChange={handleFiltriChange}
                loading={Object.values(loading).some(Boolean)}
              />
              
              {/* Navigation Tabs */}
              <CNav variant="tabs" className="mb-4">
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'collaboratori'}
                    onClick={() => setActiveTab('collaboratori')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilUser} className="me-2" />
                    Collaboratori
                    {getTabData('collaboratori').data && ` (${getTabData('collaboratori').data.length})`}
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'utenze'}
                    onClick={() => setActiveTab('utenze')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilChart} className="me-2" />
                    Utenze
                    {getTabData('utenze').data && ` (${getTabData('utenze').data.length})`}
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'studio'}
                    onClick={() => setActiveTab('studio')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilBuilding} className="me-2" />
                    Studio
                    {getTabData('studio').data && ` (${getTabData('studio').data.length})`}
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'autostrada'}
                    onClick={() => setActiveTab('autostrada')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilSpeedometer} className="me-2" />
                    Autostrada
                    {getTabData('autostrada').data && ` (${getTabData('autostrada').data.length})`}
                  </CNavLink>
                </CNavItem>
              </CNav>

              {/* Tab Content con dati ottimizzati */}
              <CTabContent>
                <CTabPane visible={activeTab === 'collaboratori'} role="tabpanel">
                  {(() => {
                    const tabData = getTabData('collaboratori');
                    return (
                      <CollaboratoriTab 
                        data={tabData.data ? adaptDataForTab(tabData.data) : { classificazioni: [], raggruppamenti: [] }}
                        isLoading={tabData.isLoading}
                        error={tabData.error}
                        getBrancaById={getBrancaByIdSafe}
                      />
                    );
                  })()}
                </CTabPane>
                <CTabPane visible={activeTab === 'utenze'} role="tabpanel">
                  {(() => {
                    const tabData = getTabData('utenze');
                    return (
                      <UtenzeTab 
                        data={tabData.data ? adaptDataForTab(tabData.data) : { classificazioni: [], raggruppamenti: [] }}
                        isLoading={tabData.isLoading}
                        error={tabData.error}
                        getBrancaById={getBrancaByIdSafe}
                      />
                    );
                  })()}
                </CTabPane>
                <CTabPane visible={activeTab === 'studio'} role="tabpanel">
                  {(() => {
                    const tabData = getTabData('studio');
                    return (
                      <StudioTab 
                        data={tabData.data ? adaptDataForTab(tabData.data) : { classificazioni: [], raggruppamenti: [] }}
                        isLoading={tabData.isLoading}
                        error={tabData.error}
                        getBrancaById={getBrancaByIdSafe}
                      />
                    );
                  })()}
                </CTabPane>
                <CTabPane visible={activeTab === 'autostrada'} role="tabpanel">
                  {(() => {
                    const tabData = getTabData('autostrada');
                    return (
                      <AutostradaTab 
                        data={tabData.data ? adaptDataForTab(tabData.data) : { classificazioni: [], raggruppamenti: [] }}
                        isLoading={tabData.isLoading}
                        error={tabData.error}
                        getBrancaById={getBrancaByIdSafe}
                      />
                    );
                  })()}
                </CTabPane>
              </CTabContent>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  );
};

export default StatistichePage;