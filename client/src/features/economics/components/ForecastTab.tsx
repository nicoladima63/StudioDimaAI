import React, { useState, useEffect } from 'react';
import {
  CRow, CCol, CSpinner, CAlert, CCard, CCardBody, CCardHeader,
  CProgress, CBadge, CButtonGroup, CButton,
} from '@coreui/react';
import { toast } from 'react-toastify';
import KpiCard from './KpiCard';
import ForecastChart from './ForecastChart';
import { economicsService } from '../services/economics.service';
import type { ForecastData, Scenario } from '../types';

type ScenarioKey = 'conservativo' | 'realistico' | 'ottimistico';

const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  conservativo: 'Conservativo',
  realistico: 'Realistico',
  ottimistico: 'Ottimistico',
};

const SCENARIO_COLORS: Record<ScenarioKey, string> = {
  conservativo: '#e55353',
  realistico: '#321fdb',
  ottimistico: '#2eb85c',
};

const ForecastTab: React.FC = () => {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('realistico');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await economicsService.apiGetForecast();
      if (res.state === 'success') {
        setForecast(res.data);
      } else {
        toast.warning(res.error || 'Errore caricamento forecast');
      }
    } catch (err: any) {
      setError(err.message || 'Errore caricamento forecast');
      toast.error('Errore caricamento previsioni');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-body-secondary">Calcolo previsioni...</div>
      </div>
    );
  }

  if (error) {
    return <CAlert color="danger">{error}</CAlert>;
  }

  if (!forecast) {
    return <CAlert color="info">Nessun dato disponibile per le previsioni.</CAlert>;
  }

  const scenarioKey = `scenario_${selectedScenario}` as keyof ForecastData;
  const scenario = forecast[scenarioKey] as Scenario;

  // Calcolo progresso verso obiettivo (target = scenario realistico)
  const target = forecast.scenario_realistico.produzione;
  const progressoPct = target > 0 ? Math.min(100, (forecast.produzione_ytd / target) * 100) : 0;

  return (
    <>
      {/* Scenario selector */}
      <CRow className="mb-4">
        <CCol xs={12} className="d-flex justify-content-center">
          <CButtonGroup>
            {(Object.keys(SCENARIO_LABELS) as ScenarioKey[]).map((key) => (
              <CButton
                key={key}
                color={selectedScenario === key ? 'primary' : 'outline-primary'}
                onClick={() => setSelectedScenario(key)}
              >
                {SCENARIO_LABELS[key]}
              </CButton>
            ))}
          </CButtonGroup>
        </CCol>
      </CRow>

      {/* KPI Forecast */}
      <CRow className="mb-4">
        <CCol xs={6} lg={3}>
          <KpiCard
            title="Produzione Stimata"
            value={scenario.produzione}
            suffix=" EUR"
            color={SCENARIO_COLORS[selectedScenario]}
          />
        </CCol>
        <CCol xs={6} lg={3}>
          <KpiCard
            title="Margine Stimato"
            value={scenario.margine}
            suffix=" EUR"
            color={scenario.margine >= 0 ? '#2eb85c' : '#e55353'}
            subtitle={`${scenario.margine_pct}%`}
          />
        </CCol>
        <CCol xs={6} lg={3}>
          <KpiCard
            title="Produzione YTD"
            value={forecast.produzione_ytd}
            suffix=" EUR"
            color="#321fdb"
          />
        </CCol>
        <CCol xs={6} lg={3}>
          <KpiCard
            title="Pipeline Preventivi"
            value={forecast.pipeline_preventivi}
            suffix=" EUR"
            color="#f9b115"
            subtitle={`Conv. stimata: ${scenario.pipeline_convertita.toLocaleString('it-IT')} EUR`}
          />
        </CCol>
      </CRow>

      {/* Progresso verso obiettivo */}
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex justify-content-between mb-2">
            <strong>Progresso verso obiettivo annuale</strong>
            <span>
              <CBadge color={progressoPct >= 80 ? 'success' : progressoPct >= 50 ? 'warning' : 'danger'}>
                {progressoPct.toFixed(1)}%
              </CBadge>
            </span>
          </div>
          <CProgress
            value={progressoPct}
            color={progressoPct >= 80 ? 'success' : progressoPct >= 50 ? 'warning' : 'danger'}
            className="mb-2"
            style={{ height: '20px' }}
          />
          <div className="d-flex justify-content-between text-body-secondary small">
            <span>YTD: {forecast.produzione_ytd.toLocaleString('it-IT')} EUR</span>
            <span>Target: {target.toLocaleString('it-IT')} EUR</span>
          </div>
        </CCardBody>
      </CCard>

      {/* Grafico forecast */}
      <ForecastChart data={forecast.mesi} title={`Previsione ${forecast.anno} - Scenario ${SCENARIO_LABELS[selectedScenario]}`} />

      {/* Parametri utilizzati */}
      <CCard className="mb-4">
        <CCardHeader><strong>Parametri del Modello</strong></CCardHeader>
        <CCardBody>
          <CRow>
            <CCol xs={6} md={3}>
              <div className="text-body-secondary small">Crescita annuale</div>
              <div className="fw-bold">{forecast.parametri.crescita_annuale_pct}%</div>
            </CCol>
            <CCol xs={6} md={3}>
              <div className="text-body-secondary small">Media globale/mese</div>
              <div className="fw-bold">{forecast.parametri.media_globale_mensile.toLocaleString('it-IT')} EUR</div>
            </CCol>
            <CCol xs={6} md={3}>
              <div className="text-body-secondary small">Fattore trend</div>
              <div className="fw-bold">{forecast.parametri.fattore_trend}</div>
            </CCol>
            <CCol xs={6} md={3}>
              <div className="text-body-secondary small">Anni storico</div>
              <div className="fw-bold">{forecast.parametri.anni_storico}</div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    </>
  );
};

export default ForecastTab;
