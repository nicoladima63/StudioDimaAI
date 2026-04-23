import React, { useEffect, useState } from 'react'
import {
  CRow, CCol, CCard, CCardBody, CBadge, CButton, CSpinner,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilExternalLink, cilQrCode, cilLockLocked } from '@coreui/icons'
import type { BotService, WaState } from '../types/bot.types'
import botService from '../services/botService'

const ICONS: Record<string, string> = {
  whatsapp: '📱',
  n8n:      '⚙️',
  chat:     '💬',
  ntfy:     '🔔',
  status:   '📊',
}

const WA_STATE_BADGE: Record<WaState, { color: string; label: string }> = {
  open:       { color: 'success', label: 'CONNESSO' },
  connecting: { color: 'warning', label: 'CONNESSIONE...' },
  close:      { color: 'danger',  label: 'DISCONNESSO' },
  unknown:    { color: 'secondary', label: 'SCONOSCIUTO' },
}

const ServiziTab: React.FC = () => {
  const [services, setServices] = useState<BotService[]>([])
  const [loading, setLoading] = useState(true)
  const [waState, setWaState] = useState<WaState>('unknown')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const [svcRes, waRes] = await Promise.all([
        botService.apiGetStatus(),
        botService.apiGetWaStatus(),
      ])
      if (svcRes.success) setServices(svcRes.data.services)
      if (waRes.success) setWaState(waRes.data.state)
    } catch {
      // silenzioso
    } finally {
      setLoading(false)
    }
  }

  const handleShowQr = async () => {
    setQrLoading(true)
    setShowQrModal(true)
    try {
      const res = await botService.apiGetWaQr()
      if (res.success) setQrCode(res.data.qr)
    } catch {
      setQrCode(null)
    } finally {
      setQrLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('Disconnettere WhatsApp? Dovrai scansionare di nuovo il QR.')) return
    await botService.apiLogoutWa()
    setWaState('close')
  }

  useEffect(() => { loadStatus() }, [])

  if (loading) return (
    <div className="d-flex justify-content-center py-5">
      <CSpinner color="primary" />
    </div>
  )

  const waBadge = WA_STATE_BADGE[waState]

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <CButton color="secondary" size="sm" onClick={loadStatus} disabled={loading}>
          <CIcon icon={cilReload} className="me-1" />
          Aggiorna stato
        </CButton>
      </div>

      <CRow className="g-4">
        {services.map((svc) => (
          <CCol md={6} lg={4} xl={2} key={svc.id}>
            <CCard className="h-100 shadow-sm border-top-primary border-top-3">
              <CCardBody className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">
                    <span className="me-2">{ICONS[svc.id] ?? '🔗'}</span>
                    {svc.name}
                  </h5>
                  <CBadge color={svc.online ? 'success' : 'danger'} shape="rounded" className="p-2">
                    {svc.online ? 'ONLINE' : 'OFFLINE'}
                  </CBadge>
                </div>

                <p className="small text-muted font-monospace mb-0">{svc.url}</p>

                {/* Pannello extra solo per la card WhatsApp */}
                {svc.id === 'whatsapp' && (
                  <div className="mt-3 p-2 bg-light rounded border small">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted">Connessione WA:</span>
                      <CBadge color={waBadge.color} shape="rounded">
                        {waBadge.label}
                      </CBadge>
                    </div>
                  </div>
                )}

                <div className="flex-grow-1" />

                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <div className="d-flex gap-1">
                    {svc.id === 'whatsapp' && waState !== 'open' && (
                      <CButton color="success" variant="ghost" size="sm" onClick={handleShowQr} title="Mostra QR">
                        <CIcon icon={cilQrCode} />
                      </CButton>
                    )}
                    {svc.id === 'whatsapp' && waState === 'open' && (
                      <CButton color="danger" variant="ghost" size="sm" onClick={handleLogout} title="Disconnetti">
                        <CIcon icon={cilLockLocked} />
                      </CButton>
                    )}
                  </div>
                  <a href={svc.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-primary btn-sm">
                    <CIcon icon={cilExternalLink} className="me-1" />
                    Apri
                  </a>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* QR Modal */}
      <CModal visible={showQrModal} onClose={() => setShowQrModal(false)}>
        <CModalHeader>
          <CModalTitle>Scansiona QR WhatsApp</CModalTitle>
        </CModalHeader>
        <CModalBody className="text-center">
          {qrLoading && <CSpinner color="primary" />}
          {!qrLoading && qrCode && (
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR WhatsApp"
              style={{ maxWidth: '280px', width: '100%' }}
            />
          )}
          {!qrLoading && !qrCode && (
            <p className="text-muted">QR non disponibile. L'istanza potrebbe essere già connessa.</p>
          )}
          <p className="text-muted small mt-2">
            Apri WhatsApp → Impostazioni → Dispositivi collegati → Collega dispositivo
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" size="sm" onClick={handleShowQr} disabled={qrLoading}>
            <CIcon icon={cilReload} className="me-1" />
            Aggiorna QR
          </CButton>
          <CButton color="primary" onClick={() => setShowQrModal(false)}>Chiudi</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default ServiziTab
