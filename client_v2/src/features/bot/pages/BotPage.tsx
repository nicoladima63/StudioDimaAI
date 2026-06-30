import React, { useState } from 'react'
import PageLayout from '@/components/layout/PageLayout'
import ServiziTab from '../components/ServiziTab'
import SimulazioneTab from '../components/SimulazioneTab'
import ReminderRepliesTab from '../components/ReminderRepliesTab'
import StoricoComunicazioniTab from '../components/StoricoComunicazioniTab'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'WhatsApp' },
  { label: 'Simulazione' },
  { label: 'Risposte' },
  { label: 'Storico' },
]

const BotPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <PageLayout>
      <PageLayout.Header title="Bot WhatsApp" />

      {/* Tab bar — scroll orizzontale su mobile */}
      <div className="border-b border-border bg-background overflow-x-auto scroll-x-hidden">
        <div className="flex min-w-max px-1">
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                'relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === i
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === i && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-0">
        {activeTab === 0 && <ServiziTab />}
        {activeTab === 1 && <SimulazioneTab />}
        {activeTab === 2 && <ReminderRepliesTab />}
        {activeTab === 3 && <StoricoComunicazioniTab />}
      </div>
    </PageLayout>
  )
}

export default BotPage
