import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CRow, 
  CCol, 
  CCard, 
  CCardBody, 
  CCardHeader, 
  CSpinner, 
  CButton,
  CButtonGroup,
  CAlert
} from '@coreui/react';
import { Card } from '@/components/ui';
import { KPICard, MarginalitaChart, TrendChart, KPIFilters } from '../components';
import { kpiService } from '../services/kpi.service';
import type { 
  KPIMarginalita, 
  KPITrend, 
  KPIRicorrenza, 
  KPIProduttivita 
} from '../services/kpi.service';
import type { KPIFiltersState } from '../components/KPIFilters';
import CIcon from '@coreui/icons-react';
import { cilReload, cilChart, cilUser, cilCash, cilClock } from '@coreui/icons';

type TabType = 'overview' | 'marginalita' | 'trend' | 'ricorrenza' | 'produttivita';

const KpiPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Stato filtri
  const [filters, setFilters] = useState<KPIFiltersState>({
    anni: [new Date().getFullYear()]
  });
  
  // Stati di caricamento granulari per ogni tab
  const [loadingStates, setLoadingStates] = useState<Record<TabType, boolean>>({
    overview: true,
    marginalita: false,
    trend: false,
    ricorrenza: false,
    produttivita: false
  });
  
  // Stati di errore granulari per ogni tab
  const [errorStates, setErrorStates] = useState<Record<TabType, string | null>>({
    overview: null,
    marginalita: null,
    trend: null,
    ricorrenza: null,
    produttivita: null
  });
  
  // Track quali tab sono stati caricati
  const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set(['overview']));
  
  // Stati per i dati (ora supportano multi-anno)
  const [marginalitaData, setMarginalitaData] = useState<Record<number, KPIMarginalita[]>>({});
  const [trendData, setTrendData] = useState<KPITrend | null>(null);
  const [ricorrenzaData, setRicorrenzaData] = useState<Record<number, KPIRicorrenza>>({});
  const [produttivitaData, setProduttivitaData] = useState<Record<number, KPIProduttivita>>({});

  // Funzione helper per aggiornare lo stato di loading di un tab
  const setTabLoading = useCallback((tab: TabType, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [tab]: loading }));
  }, []);

  // Funzione helper per aggiornare lo stato di errore di un tab
  const setTabError = useCallback((tab: TabType, error: string | null) => {
    setErrorStates(prev => ({ ...prev, [tab]: error }));
  }, []);

  // Carica solo i dati per overview (dati essenziali)
  const loadOverviewData = useCallback(async (filterState: KPIFiltersState = filters) => {
    try {
      setTabLoading('overview', true);
      setTabError('overview', null);

      const { anni, dataInizio, dataFine } = filterState;
      
      const baseParams = {
        data_inizio: dataInizio,
        data_fine: dataFine
      };

      // Carica solo i dati necessari per overview
      const promises = anni.map(async (anno) => {
        const [marginalita, ricorrenza, produttivita] = await Promise.all([
          kpiService.getMarginalita({ anno, ...baseParams }),
          kpiService.getRicorrenza({ anno, ...baseParams }),
          kpiService.getProduttivita({ anno, ...baseParams })
        ]);
        return { anno, marginalita, ricorrenza, produttivita };
      });

      const annoData = await Promise.all(promises);

      // Organizza dati per anno
      const newMarginalitaData: Record<number, KPIMarginalita[]> = {};
      const newRicorrenzaData: Record<number, KPIRicorrenza> = {};
      const newProduttivitaData: Record<number, KPIProduttivita> = {};

      annoData.forEach(({ anno, marginalita, ricorrenza, produttivita }) => {
        newMarginalitaData[anno] = marginalita.data;
        newRicorrenzaData[anno] = ricorrenza.data;
        newProduttivitaData[anno] = produttivita.data;
      });

      setMarginalitaData(newMarginalitaData);
      setRicorrenzaData(newRicorrenzaData);
      setProduttivitaData(newProduttivitaData);

    } catch (err) {
      setTabError('overview', 'Errore nel caricamento dei dati overview');
    } finally {
      setTabLoading('overview', false);
    }
  }, [filters, setTabLoading, setTabError]);

  // Carica dati trend (solo quando necessario)
  const loadTrendData = useCallback(async (filterState: KPIFiltersState = filters) => {
    try {
      setTabLoading('trend', true);
      setTabError('trend', null);

      const { anni } = filterState;
      
      const trend = await kpiService.getTrend({ 
        anni: Math.max(...anni) - Math.min(...anni) + 1, 
        tipo: 'mensile' 
      });

      setTrendData(trend.data);

    } catch (err) {
      setTabError('trend', 'Errore nel caricamento dei dati trend');
    } finally {
      setTabLoading('trend', false);
    }
  }, [filters, setTabLoading, setTabError]);

  // Funzione per caricare dati di un tab specifico
  const loadTabData = useCallback(async (tab: TabType, filterState: KPIFiltersState = filters) => {
    switch (tab) {
      case 'overview':
        await loadOverviewData(filterState);
        break;
      case 'trend':
        await loadTrendData(filterState);
        break;
      case 'marginalita':
      case 'ricorrenza':
      case 'produttivita':
        // Questi dati sono già caricati con overview
        break;
    }
  }, [filters, loadOverviewData, loadTrendData]);

  // Carica i dati overview iniziali
  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  // Handler per il cambio di tab con lazy loading
  const handleTabChange = useCallback(async (tab: TabType) => {
    setActiveTab(tab);
    
    // Se il tab non è mai stato caricato, caricalo ora
    if (!loadedTabs.has(tab)) {
      await loadTabData(tab);
      setLoadedTabs(prev => new Set([...prev, tab]));
    }
  }, [loadedTabs, loadTabData]);

  // Handler per il cambio filtri
  const handleFiltersChange = useCallback((newFilters: KPIFiltersState) => {
    setFilters(newFilters);
    
    // Ricarica solo i tab che sono stati già caricati
    loadedTabs.forEach(tab => {
      loadTabData(tab, newFilters);
    });
  }, [loadedTabs, loadTabData]);

  // Funzione per ricaricare tutti i tab caricati
  const handleRefreshAll = useCallback(() => {
    loadedTabs.forEach(tab => {
      loadTabData(tab);
    });
  }, [loadedTabs, loadTabData]);

  // Mostra loading globale solo se overview sta caricando e non è mai stato caricato
  if (loadingStates.overview && !loadedTabs.has('overview')) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
        <CSpinner color="primary" />
      </div>
    );
  }

  // Mostra errore globale solo se overview ha errori
  if (errorStates.overview && !loadedTabs.has('overview')) {
    return (
      <CAlert color="danger">
        {errorStates.overview}
        <CButton color="primary" variant="outline" className="ms-2" onClick={() => loadOverviewData()}>
          Riprova
        </CButton>
      </CAlert>
    );
  }

  // Helper per aggregare dati multi-anno con memoization
  const aggregatedMarginalitaData = useMemo(() => {
    const allData: KPIMarginalita[] = [];
    filters.anni.forEach(anno => {
      if (marginalitaData[anno]) {
        marginalitaData[anno].forEach(item => {
          const existing = allData.find(d => d.tipo_codice === item.tipo_codice);
          if (existing) {
            existing.ricavo_totale += item.ricavo_totale;
            existing.numero_prestazioni += item.numero_prestazioni;
            existing.ricavo_medio = existing.ricavo_totale / existing.numero_prestazioni;
          } else {
            allData.push({ ...item });
          }
        });
      }
    });
    return allData.sort((a, b) => b.ricavo_totale - a.ricavo_totale);
  }, [marginalitaData, filters.anni]);

  // Totali calcolati con memoization per overview
  const overviewTotals = useMemo(() => {
    return {
      ricavoTotale: aggregatedMarginalitaData.reduce((sum, item) => sum + item.ricavo_totale, 0),
      prestazioniTotali: aggregatedMarginalitaData.reduce((sum, item) => sum + item.numero_prestazioni, 0),
      pazientiUnici: Object.values(ricorrenzaData).reduce((sum, data) => sum + (data?.totali.pazienti_unici || 0), 0),
      ricavoMedioGiorno: Math.round(Object.values(produttivitaData).reduce((sum, data) => sum + (data?.kpi_generali.ricavo_medio_giorno || 0), 0) / filters.anni.length)
    };
  }, [aggregatedMarginalitaData, ricorrenzaData, produttivitaData, filters.anni.length]);

  // Helper per ottenere i dati aggregati di ricorrenza
  const aggregatedRicorrenzaData = useMemo(() => {
    const allData = Object.values(ricorrenzaData);
    if (allData.length === 0) return null;
    
    // Se c'è un solo anno, restituisci i dati direttamente
    if (allData.length === 1) return allData[0];
    
    // Altrimenti aggrega i dati multi-anno
    const aggregated = {
      periodo: { anno: filters.anni[0] }, // Anno principale
      totali: {
        pazienti_unici: 0,
        visite_totali: 0,
        visite_per_paziente: 0
      },
      ricorrenza: {
        pazienti_nuovi: 0,
        pazienti_ricorrenti: 0,
        percentuale_nuovi: 0,
        percentuale_ricorrenti: 0
      },
      fidelizzazione: {
        pazienti_controllo_igiene: 0,
        percentuale_controlli: 0
      },
      pazienti_persi: {
        numero: 0,
        soglia_mesi: allData[0].pazienti_persi.soglia_mesi,
        percentuale_persi: 0
      }
    };

    // Aggrega i totali
    allData.forEach(data => {
      aggregated.totali.pazienti_unici += data.totali.pazienti_unici;
      aggregated.totali.visite_totali += data.totali.visite_totali;
      aggregated.ricorrenza.pazienti_nuovi += data.ricorrenza.pazienti_nuovi;
      aggregated.ricorrenza.pazienti_ricorrenti += data.ricorrenza.pazienti_ricorrenti;
      aggregated.fidelizzazione.pazienti_controllo_igiene += data.fidelizzazione.pazienti_controllo_igiene;
      aggregated.pazienti_persi.numero += data.pazienti_persi.numero;
    });

    // Calcola le medie
    aggregated.totali.visite_per_paziente = Math.round(aggregated.totali.visite_totali / aggregated.totali.pazienti_unici * 100) / 100;
    aggregated.ricorrenza.percentuale_nuovi = Math.round(aggregated.ricorrenza.pazienti_nuovi / aggregated.totali.pazienti_unici * 100);
    aggregated.ricorrenza.percentuale_ricorrenti = Math.round(aggregated.ricorrenza.pazienti_ricorrenti / aggregated.totali.pazienti_unici * 100);
    aggregated.fidelizzazione.percentuale_controlli = Math.round(aggregated.fidelizzazione.pazienti_controllo_igiene / aggregated.totali.pazienti_unici * 100);
    aggregated.pazienti_persi.percentuale_persi = Math.round(aggregated.pazienti_persi.numero / aggregated.totali.pazienti_unici * 100);

    return aggregated;
  }, [ricorrenzaData, filters.anni]);

  // Helper per ottenere i dati aggregati di produttività
  const aggregatedProduttivitaData = useMemo(() => {
    const allData = Object.values(produttivitaData);
    if (allData.length === 0) return null;
    
    // Se c'è un solo anno, restituisci i dati direttamente
    if (allData.length === 1) return allData[0];
    
    // Altrimenti aggrega i dati multi-anno
    const aggregated = {
      periodo: { anno: filters.anni[0] },
      kpi_generali: {
        ricavo_totale: 0,
        appuntamenti_totali: 0,
        giorni_lavorativi: 0,
        ricavo_medio_giorno: 0,
        appuntamenti_medio_giorno: 0,
        ricavo_medio_appuntamento: 0
      },
      fasce_orarie: [] as any[],
      medici: [] as any[],
      top_ore_produttive: [] as any[]
    };

    // Aggrega i totali
    allData.forEach(data => {
      aggregated.kpi_generali.ricavo_totale += data.kpi_generali.ricavo_totale;
      aggregated.kpi_generali.appuntamenti_totali += data.kpi_generali.appuntamenti_totali;
      aggregated.kpi_generali.giorni_lavorativi += data.kpi_generali.giorni_lavorativi;
    });

    // Calcola le medie
    aggregated.kpi_generali.ricavo_medio_giorno = Math.round(aggregated.kpi_generali.ricavo_totale / aggregated.kpi_generali.giorni_lavorativi);
    aggregated.kpi_generali.appuntamenti_medio_giorno = Math.round(aggregated.kpi_generali.appuntamenti_totali / aggregated.kpi_generali.giorni_lavorativi * 100) / 100;
    aggregated.kpi_generali.ricavo_medio_appuntamento = Math.round(aggregated.kpi_generali.ricavo_totale / aggregated.kpi_generali.appuntamenti_totali);

    // Aggrega medici (prendi i primi 5 dai dati combinati)
    const mediciMap = new Map();
    allData.forEach(data => {
      data.medici.forEach(medico => {
        if (mediciMap.has(medico.medico)) {
          const existing = mediciMap.get(medico.medico);
          existing.ricavo_totale += medico.ricavo_totale;
          existing.appuntamenti += medico.appuntamenti;
          existing.ricavo_medio = existing.ricavo_totale / existing.appuntamenti;
        } else {
          mediciMap.set(medico.medico, { ...medico });
        }
      });
    });
    
    aggregated.medici = Array.from(mediciMap.values())
      .sort((a, b) => b.ricavo_totale - a.ricavo_totale)
      .slice(0, 5);

    return aggregated;
  }, [produttivitaData, filters.anni]);

  return (
    <div>
      {/* Filtri globali */}
      <KPIFilters
        onFiltersChange={handleFiltersChange}
        loading={loadingStates.overview}
      />

      <CRow className="mb-4">
        <CCol xs={12}>
          <Card title="Dashboard KPI">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <CButtonGroup>
                <CButton 
                  color={activeTab === 'overview' ? 'primary' : 'outline-primary'}
                  onClick={() => handleTabChange('overview')}
                >
                  Overview
                </CButton>
                <CButton 
                  color={activeTab === 'marginalita' ? 'primary' : 'outline-primary'}
                  onClick={() => handleTabChange('marginalita')}
                  disabled={loadingStates.marginalita}
                >
                  {loadingStates.marginalita && <CSpinner size="sm" className="me-1" />}
                  Marginalità
                </CButton>
                <CButton 
                  color={activeTab === 'trend' ? 'primary' : 'outline-primary'}
                  onClick={() => handleTabChange('trend')}
                  disabled={loadingStates.trend}
                >
                  {loadingStates.trend && <CSpinner size="sm" className="me-1" />}
                  Trend
                </CButton>
                <CButton 
                  color={activeTab === 'ricorrenza' ? 'primary' : 'outline-primary'}
                  onClick={() => handleTabChange('ricorrenza')}
                  disabled={loadingStates.ricorrenza}
                >
                  {loadingStates.ricorrenza && <CSpinner size="sm" className="me-1" />}
                  Ricorrenza
                </CButton>
                <CButton 
                  color={activeTab === 'produttivita' ? 'primary' : 'outline-primary'}
                  onClick={() => handleTabChange('produttivita')}
                  disabled={loadingStates.produttivita}
                >
                  {loadingStates.produttivita && <CSpinner size="sm" className="me-1" />}
                  Produttività
                </CButton>
              </CButtonGroup>
              
              <CButton color="primary" variant="outline" onClick={handleRefreshAll}>
                <CIcon icon={cilReload} className="me-1" />
                Aggiorna
              </CButton>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {loadingStates.overview ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <CSpinner color="primary" />
                  </div>
                ) : errorStates.overview ? (
                  <CAlert color="danger">
                    {errorStates.overview}
                    <CButton color="primary" variant="outline" className="ms-2" onClick={() => loadOverviewData()}>
                      Riprova
                    </CButton>
                  </CAlert>
                ) : (
                  <CRow>
                    <CCol xs={12} sm={6} lg={3}>
                      <KPICard
                        title={`Ricavo Totale ${filters.anni.length > 1 ? `(${filters.anni.join(', ')})` : filters.anni[0]}`}
                        value={overviewTotals.ricavoTotale}
                        subtitle="€"
                        color="success"
                        icon={<CIcon icon={cilCash} size="3xl" />}
                      />
                    </CCol>
                    <CCol xs={12} sm={6} lg={3}>
                      <KPICard
                        title="Prestazioni Totali"
                        value={overviewTotals.prestazioniTotali}
                        color="primary"
                        icon={<CIcon icon={cilChart} size="3xl" />}
                      />
                    </CCol>
                    <CCol xs={12} sm={6} lg={3}>
                      <KPICard
                        title="Pazienti Unici"
                        value={overviewTotals.pazientiUnici}
                        color="info"
                        icon={<CIcon icon={cilUser} size="3xl" />}
                      />
                    </CCol>
                    <CCol xs={12} sm={6} lg={3}>
                      <KPICard
                        title="Ricavo Medio/Giorno"
                        value={overviewTotals.ricavoMedioGiorno}
                        subtitle="€"
                        color="warning"
                        icon={<CIcon icon={cilClock} size="3xl" />}
                      />
                    </CCol>
                  </CRow>
                )}
                
                {/* Confronto per anni se multi-anno */}
                {filters.anni.length > 1 && (
                  <CRow className="mt-4">
                    <CCol xs={12}>
                      <div className="bg-light p-3 rounded">
                        <h5>Confronto per Anno</h5>
                        <CRow>
                          {filters.anni.map(anno => (
                            <CCol key={anno} xs={12} md={6} lg={4} className="mb-3">
                              <div className="border p-3 rounded bg-white">
                                <h6 className="text-primary">Anno {anno}</h6>
                                <div className="small">
                                  <div>Ricavo: €{marginalitaData[anno]?.reduce((sum, item) => sum + item.ricavo_totale, 0).toLocaleString() || 0}</div>
                                  <div>Pazienti: {ricorrenzaData[anno]?.totali.pazienti_unici || 0}</div>
                                  <div>Prestazioni: {marginalitaData[anno]?.reduce((sum, item) => sum + item.numero_prestazioni, 0) || 0}</div>
                                </div>
                              </div>
                            </CCol>
                          ))}
                        </CRow>
                      </div>
                    </CCol>
                  </CRow>
                )}
              </>
            )}

            {/* Marginalità Tab */}
            {activeTab === 'marginalita' && (
              <>
                {loadingStates.marginalita ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <CSpinner color="primary" />
                  </div>
                ) : errorStates.marginalita ? (
                  <CAlert color="danger">
                    {errorStates.marginalita}
                    <CButton color="primary" variant="outline" className="ms-2" onClick={() => loadTabData('marginalita')}>
                      Riprova
                    </CButton>
                  </CAlert>
                ) : (
                  <CRow>
                    <CCol xs={12}>
                      <MarginalitaChart 
                        data={aggregatedMarginalitaData} 
                        title={`Marginalità per Prestazione ${filters.anni.length > 1 ? `(${filters.anni.join(', ')})` : filters.anni[0]}`}
                      />
                    </CCol>
                  </CRow>
                )}
              </>
            )}

            {/* Trend Tab */}
            {activeTab === 'trend' && (
              <>
                {loadingStates.trend ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <CSpinner color="primary" />
                  </div>
                ) : errorStates.trend ? (
                  <CAlert color="danger">
                    {errorStates.trend}
                    <CButton color="primary" variant="outline" className="ms-2" onClick={() => loadTabData('trend')}>
                      Riprova
                    </CButton>
                  </CAlert>
                ) : trendData ? (
                  <CRow>
                    <CCol xs={12}>
                      <TrendChart data={trendData} />
                    </CCol>
                  </CRow>
                ) : (
                  <CAlert color="info">
                    Nessun dato trend disponibile per il periodo selezionato.
                  </CAlert>
                )}
              </>
            )}

            {/* Ricorrenza Tab */}
            {activeTab === 'ricorrenza' && (
              <>
                {loadingStates.ricorrenza ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <CSpinner color="primary" />
                  </div>
                ) : errorStates.ricorrenza ? (
                  <CAlert color="danger">
                    {errorStates.ricorrenza}
                    <CButton color="primary" variant="outline" className="ms-2" onClick={() => loadTabData('ricorrenza')}>
                      Riprova
                    </CButton>
                  </CAlert>
                ) : aggregatedRicorrenzaData ? (
                  <CRow>
                    <CCol xs={12} md={6}>
                      <CCard>
                        <CCardHeader>
                          <strong>Analisi Ricorrenza Pazienti</strong>
                        </CCardHeader>
                        <CCardBody>
                          <div className="mb-3">
                            <h6>Pazienti Nuovi vs Ricorrenti</h6>
                            <div className="d-flex justify-content-between">
                              <span>Nuovi: {aggregatedRicorrenzaData.ricorrenza.pazienti_nuovi}</span>
                              <span>{aggregatedRicorrenzaData.ricorrenza.percentuale_nuovi}%</span>
                            </div>
                            <div className="d-flex justify-content-between">
                              <span>Ricorrenti: {aggregatedRicorrenzaData.ricorrenza.pazienti_ricorrenti}</span>
                              <span>{aggregatedRicorrenzaData.ricorrenza.percentuale_ricorrenti}%</span>
                            </div>
                          </div>
                          <div className="mb-3">
                            <h6>Fidelizzazione</h6>
                            <div className="d-flex justify-content-between">
                              <span>Controlli igiene: {aggregatedRicorrenzaData.fidelizzazione.pazienti_controllo_igiene}</span>
                              <span>{aggregatedRicorrenzaData.fidelizzazione.percentuale_controlli}%</span>
                            </div>
                          </div>
                          <div>
                            <h6>Pazienti Persi</h6>
                            <div className="d-flex justify-content-between">
                              <span>Numero: {aggregatedRicorrenzaData.pazienti_persi.numero}</span>
                              <span>{aggregatedRicorrenzaData.pazienti_persi.percentuale_persi}%</span>
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>
                    <CCol xs={12} md={6}>
                      <CCard>
                        <CCardHeader>
                          <strong>Statistiche Generali</strong>
                        </CCardHeader>
                        <CCardBody>
                          <div className="mb-2">
                            <strong>Visite per paziente:</strong> {aggregatedRicorrenzaData.totali.visite_per_paziente}
                          </div>
                          <div className="mb-2">
                            <strong>Visite totali:</strong> {aggregatedRicorrenzaData.totali.visite_totali}
                          </div>
                          <div>
                            <strong>Soglia perdita:</strong> {aggregatedRicorrenzaData.pazienti_persi.soglia_mesi} mesi
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>
                ) : (
                  <CAlert color="info">
                    Nessun dato ricorrenza disponibile per il periodo selezionato.
                  </CAlert>
                )}
              </>
            )}

            {/* Produttività Tab */}
            {activeTab === 'produttivita' && (
              <>
                {loadingStates.produttivita ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <CSpinner color="primary" />
                  </div>
                ) : errorStates.produttivita ? (
                  <CAlert color="danger">
                    {errorStates.produttivita}
                    <CButton color="primary" variant="outline" className="ms-2" onClick={() => loadTabData('produttivita')}>
                      Riprova
                    </CButton>
                  </CAlert>
                ) : aggregatedProduttivitaData ? (
                  <CRow>
                    <CCol xs={12} md={6}>
                      <CCard>
                        <CCardHeader>
                          <strong>KPI Generali</strong>
                        </CCardHeader>
                        <CCardBody>
                          <div className="mb-2">
                            <strong>Ricavo totale:</strong> €{aggregatedProduttivitaData.kpi_generali.ricavo_totale.toLocaleString()}
                          </div>
                          <div className="mb-2">
                            <strong>Appuntamenti:</strong> {aggregatedProduttivitaData.kpi_generali.appuntamenti_totali}
                          </div>
                          <div className="mb-2">
                            <strong>Giorni lavorativi:</strong> {aggregatedProduttivitaData.kpi_generali.giorni_lavorativi}
                          </div>
                          <div className="mb-2">
                            <strong>Ricavo/appuntamento:</strong> €{aggregatedProduttivitaData.kpi_generali.ricavo_medio_appuntamento}
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>
                    <CCol xs={12} md={6}>
                      <CCard>
                        <CCardHeader>
                          <strong>Top Medici</strong>
                        </CCardHeader>
                        <CCardBody>
                          {aggregatedProduttivitaData.medici.slice(0, 5).map((medico, index) => (
                            <div key={index} className="d-flex justify-content-between mb-2">
                              <span>{medico.medico}</span>
                              <span>€{medico.ricavo_totale.toLocaleString()}</span>
                            </div>
                          ))}
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>
                ) : (
                  <CAlert color="info">
                    Nessun dato produttività disponibile per il periodo selezionato.
                  </CAlert>
                )}
              </>
            )}
          </Card>
        </CCol>
      </CRow>
    </div>
  );
};

export default KpiPage;