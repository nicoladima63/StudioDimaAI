import React, { useState, useEffect } from 'react'
import { CCol, CRow, CButton, CAlert } from '@coreui/react'
import { cilPeople, cilCalendar, cilChart, cilBell,cilReload } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { Card, StatWidget } from '@/components/ui';
import { RecentActivities } from '@/components/common';
import {
  AppuntamentiChart,
  AppuntamentiCoreUICard,
  AppuntamentiTotaliBar
} from '../components';
import { 
  getPazientiStats
} from '@/api/services/pazienti.service'; 
import { 
  getAppuntamentiStats, 
  getPrimeVisiteStats, 
  getAppuntamentiPerAnno,
  getAppointmentsByRange 
} from '@/api/services/calendar.service'; 
import { useDashboardLoader } from '@/store/dashboardLoaderStore';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    pazienti: 0,
    inCura: 0,
    mesePrecedente: 0,
    meseCorrente: 0,
    meseProssimo: 0,
    crescita: 0,
    nuoveVisite: null
  });
  const [datiGrafico, setDatiGrafico] = useState<{ [anno: string]: { month: number; count: number }[] }>({});
  const [totali, setTotali] = useState<{ anno: string; totale: number; colore: string; progressivo: number }[]>([]);

  const loadingStep = useDashboardLoader((s) => s.loadingStep);
  const setStep = useDashboardLoader((s) => s.setStep);
  const refreshKey = useDashboardLoader((s) => s.refreshKey);
const triggerRefresh = useDashboardLoader((s) => s.triggerRefresh);

  useEffect(() => {
    async function fetchStats() {
      try {
        setStep('loading_appointments');
        const pazData = await getPazientiStats();

        setStep('loading_stats');
        const appData = await getAppuntamentiStats();
        const primeData = await getPrimeVisiteStats();

        let crescita = 0;
        if (appData.data.mese_precedente === 0 && appData.data.mese_corrente > 0) {
          crescita = 100;
        } else if (appData.data.mese_precedente === 0 && appData.data.mese_corrente === 0) {
          crescita = 0;
        } else if (appData.data.mese_precedente > 0 && appData.data.mese_corrente === 0) {
          crescita = -100;
        } else if (appData.data.mese_precedente > 0) {
          crescita = Math.round(((appData.data.mese_corrente - appData.data.mese_precedente) / appData.data.mese_precedente) * 100);
        }

        setStats({
          pazienti: pazData.data.totale,
          inCura: pazData.data.in_cura,
          mesePrecedente: appData.data.mese_precedente,
          meseCorrente: appData.data.mese_corrente,
          meseProssimo: appData.data.mese_prossimo,
          crescita,
          nuoveVisite: primeData.data.nuove_visite
        });

        const datiAnni = await getAppuntamentiPerAnno();
        setDatiGrafico(datiAnni.data);
      } catch (error) {
        setStats({
          pazienti: 0,
          inCura: 0,
          mesePrecedente: 0,
          meseCorrente: 0,
          meseProssimo: 0,
          crescita: 0,
          nuoveVisite: null
        });
        setDatiGrafico({});
        setStep('done');
      }
    }

    fetchStats();
  }, [setStep, refreshKey]);

  useEffect(() => {
    async function fetchTotaliBar() {
      if (!datiGrafico || Object.keys(datiGrafico).length === 0) return;

      const today = new Date();
      const currentDay = String(today.getDate()).padStart(2, '0');
      const currentMonth = String(today.getMonth() + 1).padStart(2, '0');

      const anni = Object.keys(datiGrafico).sort();
      const colori = ['#3399ff', '#8884d8', '#b0b0b0'];

      const progressivi = await Promise.all(
        anni.map(async (anno) => {
          const start = `01/01/${anno}`;
          const end = `${currentDay}/${currentMonth}/${anno}`;
          try {
            const count = await getAppointmentsByRange(start, end);
            return count;
          } catch {
            return 0;
          }
        })
      );

      const nuoviTotali = anni.map((anno, idx) => ({
        anno,
        totale: (datiGrafico[anno] || []).reduce((sum, m) => sum + m.count, 0),
        colore: colori[idx % colori.length],
        progressivo: progressivi[idx]
      }));

      setTotali(nuoviTotali);
      setStep('done');
    }

    fetchTotaliBar();
  }, [datiGrafico, setStep, refreshKey]);

  const isLoading = loadingStep !== 'done';

  const loadingMessage: Record<string, string> = {
    loading_appointments: 'Caricamento appuntamenti...',
    loading_stats: 'Caricamento statistiche...',
    done: ''
  }[loadingStep];

  return (
    <Card title="Dashboard"
      headerAction={
      <CButton color="primary" size="sm" onClick={triggerRefresh}>
        <CIcon icon={cilReload} className="me-1" />
        Ricarica
      </CButton>        
      }
    >
      {isLoading && loadingMessage && (
        <div className="d-flex justify-content-center py-3">
          <CAlert color="info" className="text-center px-4 py-2 shadow-sm">
            {loadingMessage}
          </CAlert>
        </div>
      )}

      {!isLoading && (
        <>
          <CRow>
            <CCol sm={6} lg={2}>
              <StatWidget 
                color="primary"
                value={`${stats.pazienti} | ${stats.inCura}`}
                title="Pazienti | In cura"
                icon={cilPeople}
              />
            </CCol>
            <CCol sm={6} lg={2}>
              <StatWidget 
                color="info"
                value={`${stats.mesePrecedente} | ${stats.meseCorrente} | ${stats.meseProssimo}`}
                title="Prec. | In corso | Prossimo"
                icon={cilCalendar}
              />
            </CCol>
            <CCol sm={6} lg={2}>
              <StatWidget 
                color="warning"
                value={`${stats.crescita}%`}
                title="Crescita %"
                icon={cilChart}
              />
            </CCol>
            <CCol sm={6} lg={2}>
              <StatWidget 
                color="danger"
                value={stats.nuoveVisite ?? 0}
                title="Prime visite"
                icon={cilBell}
              />
            </CCol>
            <CCol sm={6} lg={2}>
              <AppuntamentiCoreUICard
                title="Appuntamenti"
                value={stats.meseCorrente}
                percent={stats.crescita}
                data={datiGrafico[String(new Date().getFullYear())] || []}
                color="#3399ff"
              />
            </CCol>
          </CRow>

          <CRow className="mt-4">
            <CCol md={8}>
              <AppuntamentiChart 
                data={datiGrafico}
              />
            </CCol>
            <CCol md={4}>
              <AppuntamentiTotaliBar
                totali={totali}
              />
            </CCol>
          </CRow>

          <CRow className="mt-4">
            <CCol>
              <RecentActivities />
            </CCol>
          </CRow>
        </>
      )}
    </Card>
  );
};

export default Dashboard;
