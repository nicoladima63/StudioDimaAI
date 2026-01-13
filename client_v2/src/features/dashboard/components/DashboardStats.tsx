import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CWidgetStatsF,
  CSpinner,
  CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilChartPie, cilCalendar, cilArrowTop, cilArrowBottom, cilPeople, cilChartLine } from '@coreui/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  apiGetAppuntamentiStats, 
  apiGetAppuntamentiTotali, 
  apiGetPrimeVisiteStats,
  FirstVisitsStats 
} from '@/features/calendar/services/calendar.service';

interface StatsSummary {
  meseCorrente: number;
  mesePrecedente: number;
  meseProssimo: number;
  crescita: number;
}

interface YearData {
  anno: string;
  totale: number;
  progressivo: number;
  colore: string;
}

const DashboardStats: React.FC = () => {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [yearData, setYearData] = useState<YearData[]>([]);
  const [firstVisits, setFirstVisits] = useState<FirstVisitsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryData, yearStats, visits] = await Promise.all([
          apiGetAppuntamentiStats(),
          apiGetAppuntamentiTotali(),
          apiGetPrimeVisiteStats()
        ]);
        
        setSummary(summaryData);
        setYearData(yearStats);
        setFirstVisits(visits);
      } catch (err: any) {
        console.error("Error loading stats:", err);
        setError("Impossibile caricare le statistiche.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-4">
        <CSpinner color="primary" />
      </div>
    );
  }

  if (error) {
    return <CAlert color="danger">{error}</CAlert>;
  }

  return (
    <>
        {/* Summary Widgets - 4 Columns */}
        <CRow className="mb-4">
          <CCol sm={6} lg={3}>
            <CWidgetStatsF
              className="mb-3"
              color="primary"
              icon={<CIcon icon={cilCalendar} height={24} />}
              title="Mese Corrente"
              value={summary?.meseCorrente.toString() || '0'}
              footer={
                <span className="text-medium-emphasis">
                   {summary && summary.crescita > 0 ? (
                     <span className="text-success">
                       <CIcon icon={cilArrowTop} /> {summary.crescita}%
                     </span>
                   ) : (
                     <span className="text-danger">
                       <CIcon icon={cilArrowBottom} /> {summary?.crescita || 0}%
                     </span>
                   )}
                   {' '}vs Mese Precedente
                </span>
              }
            />
          </CCol>
          
          <CCol sm={6} lg={3}>
            <CWidgetStatsF
              className="mb-3"
              color="info"
              icon={<CIcon icon={cilChartPie} height={24} />}
              title="Appuntamenti Futuri"
              value={summary?.meseProssimo.toString() || '0'}
              footer={
                <span className="text-medium-emphasis">
                  Prossimo Mese
                </span>
              }
            />
          </CCol>

           <CCol sm={6} lg={3}>
            <CWidgetStatsF
              className="mb-3"
              color="warning"
              icon={<CIcon icon={cilPeople} height={24} />}
              title={`Prime Visite (${firstVisits?.current_year?.year || 'Anno'})`}
              value={firstVisits?.current_year?.total?.toString() || '0'}
              footer={
                <span className="text-medium-emphasis">
                  {firstVisits?.prev_year?.total || 0} nel {firstVisits?.prev_year?.year || 'Prev'}
                </span>
              }
            />
          </CCol>

          <CCol sm={6} lg={3}>
            <CWidgetStatsF
              className="mb-3"
              color="success"
              icon={<CIcon icon={cilChartLine} height={24} />}
              title="Prime Visite (YTD)"
              value={firstVisits?.current_year?.ytd?.toString() || '0'}
              footer={
                <span className="text-medium-emphasis">
                  {firstVisits?.prev_year?.ytd || 0} nel {firstVisits?.prev_year?.year} (stesso periodo)
                </span>
              }
            />
          </CCol>
        </CRow>

        {/* Chart Section */}
        <CRow>
          <CCol md={12}>
            <CCard className="mb-4">
              <CCardHeader>Andamento Appuntamenti Annuale</CCardHeader>
              <CCardBody>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={yearData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="anno" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totale" name="Totale Anno" fill="#8884d8">
                        {yearData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.colore || '#8884d8'} />
                        ))}
                      </Bar>
                      <Bar dataKey="progressivo" name="Progressivo ad Oggi" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
    </>
  );
};

export default DashboardStats;
