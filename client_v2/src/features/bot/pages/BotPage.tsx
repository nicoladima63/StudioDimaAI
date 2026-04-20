import React, { useState } from 'react'
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CToast, CToastBody, CToaster } from '@coreui/react'
import PageLayout from '@/components/layout/PageLayout'
import ServiziTab from '../components/ServiziTab'
import StudioInfoTab from '../components/StudioInfoTab'
import ConversazioniTab from '../components/ConversazioniTab'

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
          <CNavItem>
            <CNavLink active={activeTab === 0} onClick={() => setActiveTab(0)} style={{ cursor: 'pointer' }}>
              Servizi
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} style={{ cursor: 'pointer' }}>
              Studio Info
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 2} onClick={() => setActiveTab(2)} style={{ cursor: 'pointer' }}>
              Conversazioni
            </CNavLink>
          </CNavItem>
        </CNav>

        <CTabContent>
          <CTabPane visible={activeTab === 0}>
            <ServiziTab />
          </CTabPane>
          <CTabPane visible={activeTab === 1}>
            {activeTab === 1 && <StudioInfoTab onToast={showToast} />}
          </CTabPane>
          <CTabPane visible={activeTab === 2}>
            {activeTab === 2 && <ConversazioniTab />}
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
