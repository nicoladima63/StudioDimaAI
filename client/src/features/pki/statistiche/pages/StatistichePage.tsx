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
import { useContiStore } from '@/store/contiStore';
import statisticheService from '../services/statistiche.service';
import type { FornitoreStats, StatisticheFilters } from '../services/statistiche.service';

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
  
  // Cache ottimizzato per nuovo endpoint
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
  
  // 🎯 CARICAMENTO OTTIMIZZATO: Una singola chiamata per tab attivo
  useEffect(() => {
    console.log('🔍 StatistichePage useEffect:', { 
      activeTab, 
      hasCache: !!cache[activeTab], 
      isLoading: loading[activeTab],
      contiLoaded: conti.length
    });
    
    // Attende che i conti siano caricati
    if (conti.length === 0) {
      console.log('⏸️ Skip: conti non ancora caricati');
      return;
    }
    
    // Controlli anti-loop
    if (loading[activeTab]) {
      console.log('⏸️ Skip: già in caricamento');
      return;
    }
    
    if (cache[activeTab]) {
      console.log('💾 Skip: dati già in cache');
      return;
    }
    
    // Carica dati per il tab attivo
    loadTabData(activeTab);
  }, [activeTab, conti]); // Dipende da conti per i filtri dinamici
  
  const loadTabData = async (tab: string) => {
    console.log('🚀 Caricamento dati per tab:', tab);
    
    setLoading(prev => ({ ...prev, [tab]: true }));
    setErrors(prev => ({ ...prev, [tab]: null }));
    
    try {
      // Costruisci filtri dinamici per il tab
      const baseFilters = TAB_FILTERS[tab] || { periodo: 'anno_corrente' };
      
      // Aggiungi contoid se trovato
      const contoid = getContoIdByName(tab); // es. "collaboratori" → contoid per "COLLABORATORI"
      const filters: StatisticheFilters = {
        ...baseFilters,
        ...(contoid && { contoid })
      };
      
      console.log(`📊 Chiamata API per ${tab}:`, filters);
      
      // Singola chiamata API flessibile
      const response = await statisticheService.apiGetStatisticheFornitori(filters);
      
      if (response.success) {
        setCache(prev => ({ ...prev, [tab]: response.data }));
        console.log(`✅ ${tab} caricati:`, {
          fornitori: response.data.length,
          totale: response.totale_generale,
          filtri_applicati: response.filters_applied
        });
      } else {
        throw new Error(response.error || `Errore caricamento ${tab}`);
      }
      
    } catch (error: any) {
      console.error('❌ Errore caricamento:', tab, error);
      setErrors(prev => ({ ...prev, [tab]: error.message || 'Errore sconosciuto' }));
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  };
  
  // Wrapper per getBrancaById che gestisce null
  const getBrancaByIdSafe = (id: number | null): string | undefined => {
    if (id === null) return undefined;
    return getBrancaById(id);
  };
  
  // Adatta dati FornitoreStats al formato legacy per i tab
  const adaptDataForTab = (fornitoreStats: FornitoreStats[]) => {
    // Crea raggruppamenti compatibili con la vecchia interfaccia
    const raggruppamenti = fornitoreStats.map(stat => ({
      codice_riferimento: stat.codice_riferimento,
      fornitore_nome: stat.fornitore_nome,
      count: stat.numero_fatture, // Usa numero fatture come count
      brancaid: stat.classificazione.brancaid,
      contoid: stat.classificazione.contoid
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
                    {cache.collaboratori && ` (${cache.collaboratori.length})`}
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
                    {cache.utenze && ` (${cache.utenze.length})`}
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
                    {cache.studio && ` (${cache.studio.length})`}
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
                    {cache.autostrada && ` (${cache.autostrada.length})`}
                  </CNavLink>
                </CNavItem>
              </CNav>

              {/* Tab Content con dati ottimizzati */}
              <CTabContent>
                <CTabPane visible={activeTab === 'collaboratori'} role="tabpanel">
                  <CollaboratoriTab 
                    data={cache.collaboratori ? adaptDataForTab(cache.collaboratori) : { classificazioni: [], raggruppamenti: [] }}
                    isLoading={loading.collaboratori || false}
                    error={errors.collaboratori || null}
                    getBrancaById={getBrancaByIdSafe}
                  />
                </CTabPane>
                <CTabPane visible={activeTab === 'utenze'} role="tabpanel">
                  <UtenzeTab 
                    data={cache.utenze ? adaptDataForTab(cache.utenze) : { classificazioni: [], raggruppamenti: [] }}
                    isLoading={loading.utenze || false}
                    error={errors.utenze || null}
                    getBrancaById={getBrancaByIdSafe}
                  />
                </CTabPane>
                <CTabPane visible={activeTab === 'studio'} role="tabpanel">
                  <StudioTab 
                    data={cache.studio ? adaptDataForTab(cache.studio) : { classificazioni: [], raggruppamenti: [] }}
                    isLoading={loading.studio || false}
                    error={errors.studio || null}
                    getBrancaById={getBrancaByIdSafe}
                  />
                </CTabPane>
                <CTabPane visible={activeTab === 'autostrada'} role="tabpanel">
                  <AutostradaTab 
                    data={cache.autostrada ? adaptDataForTab(cache.autostrada) : { classificazioni: [], raggruppamenti: [] }}
                    isLoading={loading.autostrada || false}
                    error={errors.autostrada || null}
                    getBrancaById={getBrancaByIdSafe}
                  />
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