import React, { useState } from 'react';
import {
  CRow,
  CCol,
} from '@coreui/react';
import PageLayout from '@/components/layout/PageLayout';
import CalendarMainContent from '../components/CalendarMainContent';
import CalendarSettingsContent from '../components/CalendarSettingsContent';
import { CalendarHealthCheck } from '../components/CalendarHealthCheck';

const CalendarPage: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<'healthy' | 'unhealthy' | 'unknown'>('unknown');   

  return (
    <PageLayout>
      <PageLayout.Header title='Gestione Agenda su Calendar'>
        Sincronizza appuntamenti del gestionale con Google Calendar
      </PageLayout.Header>
      <PageLayout.Content>
        <CRow>
          <CCol md={12}>
            <CalendarHealthCheck />
          </CCol>
        </CRow>
        <CRow>
          <CCol md={6}>
            <CalendarMainContent setDbStatus={setDbStatus} /> 
          </CCol>
          <CCol md={6}>
            <CalendarSettingsContent />
          </CCol>
      </CRow>
      </PageLayout.Content>
    </PageLayout>
  );
};

export default CalendarPage;
