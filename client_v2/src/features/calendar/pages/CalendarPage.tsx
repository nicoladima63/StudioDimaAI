import React, { useState } from 'react'
import PageLayout from '@/components/layout/PageLayout'
import CalendarMainContent from '../components/CalendarMainContent'
import CalendarSettingsContent from '../components/CalendarSettingsContent'
import { CalendarHealthCheck } from '../components/CalendarHealthCheck'

const CalendarPage: React.FC = () => {
  const [, setDbStatus] = useState<'healthy' | 'unhealthy' | 'unknown'>('unknown')

  return (
    <div className="space-y-4">
      <PageLayout>
        <PageLayout.Header title="Gestione Agenda su Calendar">
          <span className="text-sm text-muted-foreground">
            Sincronizza appuntamenti del gestionale con Google Calendar
          </span>
        </PageLayout.Header>
      </PageLayout>

      <CalendarHealthCheck />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CalendarMainContent setDbStatus={setDbStatus} />
        <CalendarSettingsContent />
      </div>
    </div>
  )
}

export default CalendarPage
