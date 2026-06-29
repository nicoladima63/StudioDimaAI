import React, { useState } from 'react'
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CToast, CToastBody, CToaster } from '@coreui/react'
import PageLayout from '@/components/layout/PageLayout'
import ServiziTab from '../components/ServiziTab'
import SimulazioneTab from '../components/SimulazioneTab'
import ReminderRepliesTab from '../components/ReminderRepliesTab'
import StoricoComunicazioniTab from '../components/StoricoComunicazioniTab'

type ToastState = 'success' | 'warning' | 'error'

interface ToastMsg {
  id: number
  msg: string
  state: ToastState
}

const COLOR: Record<ToastState, string> = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
}

const TABS = [
  { label: 'WhatsApp' },
  { label: 'Simulazione' },
  { label: 'Risposte Reminder' },
  { label: 'Storico Invii' },
]

const BotPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  const showToast = (msg: string, state: ToastState) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, state }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  return (
    <PageLayout>
      <PageLayout.Header title="Bot WhatsApp" />
      <PageLayout.ContentBody>
        <CNav variant="tabs" className="mb-3">
          {TABS.map((tab, i) => (
            <CNavItem key={i}>
              <CNavLink active={activeTab === i} onClick={() => setActiveTab(i)} style={{ cursor: 'pointer' }}>
                {tab.label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>

        <CTabContent>
          <CTabPane visible={activeTab === 0}>
            <ServiziTab />
          </CTabPane>
          <CTabPane visible={activeTab === 1}>
            {activeTab === 1 && <SimulazioneTab />}
          </CTabPane>
          <CTabPane visible={activeTab === 2}>
            {activeTab === 2 && <ReminderRepliesTab />}
          </CTabPane>
          <CTabPane visible={activeTab === 3}>
            {activeTab === 3 && <StoricoComunicazioniTab />}
          </CTabPane>
        </CTabContent>
      </PageLayout.ContentBody>

      <CToaster placement="top-end">
        {toasts.map(t => (
          <CToast key={t.id} autohide visible color={COLOR[t.state]}>
            <CToastBody className="text-white">{t.msg}</CToastBody>
          </CToast>
        ))}
      </CToaster>
    </PageLayout>
  )
}

export default BotPage
