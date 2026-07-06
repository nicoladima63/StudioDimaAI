import React, { useEffect, useState } from 'react'
import {
  CCard, CCardBody, CButton, CBadge, CSpinner,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CRow, CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilQrCode, cilLockLocked, cilCheckCircle, cilXCircle } from '@coreui/icons'
import type { WaState } from '../types/bot.types'
import botService from '../services/botService'

const WA_BADGE: Record<WaState, { color: string; label: string }> = {
  open:       { color: 'success', label: 'CONNESSO' },
  connecting: { color: 'warning', label: 'CONNESSIONE IN CORSO...' },
  close:      { color: 'danger',  label: 'DISCONNESSO' },
  unknown:    { color: 'warning', label: 'NON DISPONIBILE' },
}

const ServiziTab: React.FC = () => {
  const [waState, setWaState]       = useState<WaState>('unknown')
  const [loading, setLoading]       = useState(true)
  const [qrCode, setQrCode]         = useState<string | null>(null)
  const [qrLoading, setQrLoading]   = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await botService.apiGetWaStatus()
      if (res.success) setWaState(res.data.state)
    } catch {
      setWaState('unknown')
    } finally {
      setLoading(false)
    }
  }

  const handleShowQr = async () => {
    setQrLoading(true)
    setShowQrModal(true)
    setQrCode(null)
    try {
      const res = await botService.apiGetWaQr()
      if (res.success) setQrCode(res.data.qr)
    } finally {
      setQrLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('Disconnettere WhatsApp? Dovrai scansionare di nuovo il QR.')) return
    await botService.apiLogoutWa()
    setWaState('close')
  }

  useEffect(() => { load() }, [])

  const badge = WA_BADGE[waState]

  return (
    <>
      <CRow className="g-3">
        {/* Card stato WhatsApp */}
        <CCol md={6} lg={4}>
          <CCard className="h-100 shadow-sm">
            <CCardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">WhatsApp Evolution</h5>
                <CBadge color={badge.color} shape="rounded" className="px-3 py-2">
                  {badge.label}
                </CBadge>
              </div>

              <div className="d-flex gap-2 mt-auto">
                <CButton color="secondary" size="sm" onClick={load} disabled={loading}>
                  <CIcon icon={cilReload} className="me-1" />
                  {loading ? <CSpinner size="sm" /> : 'Aggiorna'}
                </CButton>

                {waState !== 'open' && (
                  <CButton color="success" size="sm" onClick={handleShowQr}>
                    <CIcon icon={cilQrCode} className="me-1" />
                    Scansiona QR
                  </CButton>
                )}

                {waState === 'open' && (
                  <CButton color="danger" variant="outline" size="sm" onClick={handleLogout}>
                    <CIcon icon={cilLockLocked} className="me-1" />
                    Disconnetti
                  </CButton>
                )}
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        {/* Card riepilogo stato sistema */}
        <CCol md={6} lg={4}>
          <CCard className="h-100 shadow-sm">
            <CCardBody>
              <h5 className="mb-3">Stato sistema</h5>
              <StatusRow label="Evolution API" ok={waState !== 'unknown'} />
              <StatusRow label="Cloudflare Tunnel" ok={window.location.protocol === 'https:'} />
              <StatusRow label="Push Notifications" ok={window.location.protocol === 'https:'} note={window.location.protocol !== 'https:' ? 'Richiede HTTPS' : undefined} />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

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
            <p className="text-muted">QR non disponibile — istanza gia connessa o Evolution non raggiungibile.</p>
          )}
          <p className="text-muted small mt-2">
            WhatsApp → Impostazioni → Dispositivi collegati → Collega dispositivo
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

const StatusRow: React.FC<{ label: string; ok: boolean; note?: string | undefined }> = ({ label, ok, note }) => (
  <div className="d-flex align-items-center justify-content-between mb-2">
    <span className="small">{label}{note && <span className="text-muted ms-1">({note})</span>}</span>
    <CIcon icon={ok ? cilCheckCircle : cilXCircle} className={ok ? 'text-success' : 'text-danger'} />
  </div>
)

export default ServiziTab
