import React, { useState, useEffect } from 'react';
import { CRow, CCol, CSpinner, CAlert, CFormSelect } from '@coreui/react';
import { toast } from 'react-toastify';
import KpiCard from './KpiCard';
import MonthlyChart from './MonthlyChart';
import BreakEvenIndicator from './BreakEvenIndicator';
import ComparisonChart from './ComparisonChart';
import { economicsService } from '../services/economics.service';
import type { KpiCurrent, KpiMonthly, KpiComparison } from '../types';

const DashboardTab: React.FC = () => {
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [kpiCurrent, setKpiCurrent] = useState<KpiCurrent | null>(null);
  const [kpiMonthly, setKpiMonthly] = useState<KpiMonthly | null>(null);
  const [kpiComparison, setKpiComparison] = useState<KpiComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [anno]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resCurrent, resMonthly, resComparison] = await Promise.all([
        economicsService.apiGetKpiCurrent(anno),
        economicsService.apiGetKpiMonthly(anno),
        economicsService.apiGetKpiComparison(anno),
      ]);

      if (resCurrent.state === 'success') setKpiCurrent(resCurrent.data);
      else toast.warning(resCurrent.error || 'Errore caricamento KPI correnti');

      if (resMonthly.state === 'success') setKpiMonthly(resMonthly.data);
      if (resComparison.state === 'success') setKpiComparison(resComparison.data);
    } catch (err: any) {
      setError(err.message || 'Errore caricamento dati');
      toast.error('Errore caricamento dashboard economica');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-body-secondary">Caricamento dati economici...</div>
      </div>
    );
  }

  if (error) {
    return <CAlert color="danger">{error}</CAlert>;
  }

  const annoOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 10; y--) {
    annoOptions.push(y);
  }

  return (
    <>
      {/* Selettore anno */}
      <CRow className="mb-4">
        <CCol xs={12} md={3}>
          <CFormSelect
            value={anno}
            onChange={(e) => setAnno(Number(e.target.value))}
            label="Anno"
          >
            {annoOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>

      {/* KPI Cards */}
      {kpiCurrent && (
        <CRow className="mb-4">
          <CCol xs={6} lg>
            <KpiCard
              title="Produzione YTD"
              value={kpiCurrent.produzione_ytd}
              prefix=""
              suffix=" EUR"
              color="#321fdb"
              subtitle={`${kpiCurrent.num_fatture_ytd} fatture`}
            />
          </CCol>
          <CCol xs={6} lg>
            <KpiCard
              title="Margine YTD"
              value={kpiCurrent.margine_ytd}
              suffix=" EUR"
              color={kpiCurrent.margine_ytd >= 0 ? '#2eb85c' : '#e55353'}
              subtitle={`${kpiCurrent.margine_pct}%`}
            />
          </CCol>
          <CCol xs={6} lg>
            <KpiCard
              title="Ricavo/Ora"
              value={kpiCurrent.ricavo_medio_ora}
              suffix=" EUR"
              color="#f9b115"
            />
          </CCol>
          <CCol xs={6} lg>
            <KpiCard
              title="Ore Cliniche"
              value={kpiCurrent.ore_cliniche_ytd}
              suffix=" h"
              color="#3399ff"
              subtitle={`${kpiCurrent.num_appuntamenti_ytd} appuntamenti`}
            />
          </CCol>
          <CCol xs={6} lg>
            <KpiCard
              title="Costi Totali"
              value={kpiCurrent.costi_totali_ytd}
              suffix=" EUR"
              color="#e55353"
            />
          </CCol>
        </CRow>
      )}

      {/* Grafico produzione mensile */}
      {kpiMonthly && (
        <MonthlyChart data={kpiMonthly.mesi} title={`Produzione vs Costi - ${anno}`} />
      )}

      {/* Break-even */}
      {kpiCurrent && kpiCurrent.break_even_mensile > 0 && (
        <BreakEvenIndicator
          produzioneMedia={kpiCurrent.produzione_media_mensile}
          breakEven={kpiCurrent.break_even_mensile}
        />
      )}

      {/* Confronto anno precedente */}
      {kpiComparison && kpiComparison.confronto.length > 0 && (
        <>
          <ComparisonChart
            data={kpiComparison.confronto}
            annoCorrente={kpiComparison.anno_corrente}
            annoPrecedente={kpiComparison.anno_precedente}
          />
          {kpiComparison.totali && (
            <CRow>
              <CCol xs={6} md={3}>
                <KpiCard
                  title={`Totale ${kpiComparison.anno_precedente}`}
                  value={kpiComparison.totali.produzione_precedente}
                  suffix=" EUR"
                  color="#9da5b1"
                />
              </CCol>
              <CCol xs={6} md={3}>
                <KpiCard
                  title={`Totale ${kpiComparison.anno_corrente}`}
                  value={kpiComparison.totali.produzione_corrente}
                  suffix=" EUR"
                  color="#321fdb"
                />
              </CCol>
              <CCol xs={6} md={3}>
                <KpiCard
                  title="Delta"
                  value={kpiComparison.totali.delta}
                  suffix=" EUR"
                  color={kpiComparison.totali.delta >= 0 ? '#2eb85c' : '#e55353'}
                />
              </CCol>
              <CCol xs={6} md={3}>
                <KpiCard
                  title="Variazione %"
                  value={kpiComparison.totali.delta_pct}
                  suffix="%"
                  color={kpiComparison.totali.delta_pct >= 0 ? '#2eb85c' : '#e55353'}
                />
              </CCol>
            </CRow>
          )}
        </>
      )}
    </>
  );
};

export default DashboardTab;
