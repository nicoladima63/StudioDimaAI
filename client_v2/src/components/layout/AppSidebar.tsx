import React, { useEffect, useRef, useState } from 'react'
import {
  CBadge,
  CButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSpinner,
  CToast,
  CToastBody,
  CToastClose,
  CToaster,
} from '@coreui/react'
import { cilReload, cilX } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

import { AppSidebarNav } from './AppSidebarNav'
import navigation from './_nav'
import adminService from '@/features/admin/services/adminService'
import type { BuildInfo } from '@/features/admin/services/adminService'

interface AppSidebarProps {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_FAILURES = 40  // 40 × 3s = 2 minuti prima di arrendersi

const AppSidebar: React.FC<AppSidebarProps> = ({ visible, onVisibleChange }) => {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restartBuildRef = useRef<number | null>(null)
  const pollFailuresRef = useRef(0)
  const isRestartingRef = useRef(false)

  useEffect(() => {
    adminService.apiBuildInfo().then(setBuildInfo).catch(() => { })
  }, [])

  const showToast = (message: string, color: string) => {
    setToast({ message, color })
    setTimeout(() => setToast(null), 4000)
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    pollFailuresRef.current = 0
    isRestartingRef.current = false
    setRestarting(false)
  }

  const startPollingForNewBuild = (previousBuild: number) => {
    restartBuildRef.current = previousBuild
    pollFailuresRef.current = 0
    pollRef.current = setInterval(async () => {
      try {
        const info = await adminService.apiBuildInfo()
        // successo: reset contatore errori
        pollFailuresRef.current = 0
        if (info.build !== restartBuildRef.current) {
          stopPolling()
          setBuildInfo(info)
          showToast(`Build #${info.build} attiva — ricarico...`, 'success')
          setTimeout(() => window.location.reload(), 1500)
        }
      } catch {
        pollFailuresRef.current += 1
        if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
          stopPolling()
          showToast('Riavvio non rilevato: server non risponde. Riavvialo manualmente.', 'danger')
        }
      }
    }, POLL_INTERVAL_MS)
  }

  const handleRestart = async () => {
    if (isRestartingRef.current) return
    isRestartingRef.current = true
    setRestarting(true)
    const previousBuild = buildInfo?.build ?? 0
    showToast('Riavvio in corso — attendi...', 'warning')
    try {
      await adminService.apiRestartServer()
    } catch {
      // la connessione si chiude mentre il server si spegne, è normale
    }
    startPollingForNewBuild(previousBuild)
  }

  useEffect(() => () => stopPolling(), [])

  const envColor = buildInfo?.env === 'production' ? 'success' : 'warning'
  const envLabel = buildInfo?.env === 'production' ? 'PROD' : 'DEV'
  const builtDate = buildInfo?.built_at
    ? buildInfo.built_at.replace('T', ' ').slice(0, 16)
    : ''

  return (
    <>
      <CSidebar
        className="border-end sidebar sidebar-dark sidebar-fixed"
        position="fixed"
        visible={visible}
        onVisibleChange={onVisibleChange}
      >
        <CSidebarBrand href="/" className="border-bottom" style={{ minHeight: '76px' }}>
          <div className="sidebar-brand-full">
            <h5 className="mb-0">Studio Dima V2</h5>
          </div>
          <div className="sidebar-brand-minimized">
            <strong>SD</strong>
          </div>
        </CSidebarBrand>

        <AppSidebarNav items={navigation} />

        <CSidebarFooter className="border-top d-none d-lg-flex flex-column gap-2 py-2 px-2">
          {buildInfo && (
            <div className="d-flex align-items-center gap-2">
              <div style={{ fontSize: '0.72rem', lineHeight: 1.3, color: 'rgba(255,255,255,0.55)' }}>
                <span>v{buildInfo.version} #{buildInfo.build}</span>
                <br />
                <span style={{ fontSize: '0.65rem' }}>{builtDate}</span>
              </div>
              <CBadge
                color={envColor}
                style={{ fontSize: '0.75rem', padding: '6px 8px', letterSpacing: '0.05em' }}
              >
                {envLabel}
              </CBadge>

            </div>
          )}
          <div className="d-flex justify-content-between gap-2">
            <CButton
              color="danger"
              variant="outline"
              size="sm"
              className="flex-fill"
              title="Nascondi sidebar"
              onClick={() => onVisibleChange(false)}
            >
              <CIcon icon={cilX} size="sm" className="me-1" />
              Esci
            </CButton>
            {buildInfo?.env === 'production' && (
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                className="flex-fill"
                title="Riavvia server"
                disabled={restarting}
                onClick={handleRestart}
              >
                {restarting ? (
                  <CSpinner size="sm" className="me-1" />
                ) : (
                  <CIcon icon={cilReload} size="sm" className="me-1" />
                )}
                Riavvia
              </CButton>
            )}
          </div>
        </CSidebarFooter>
      </CSidebar>

      {toast && (
        <CToaster placement="bottom-end" className="p-3">
          <CToast autohide visible color={toast.color}>
            <CToastBody>
              {toast.message}
              <CToastClose className="me-2 m-auto" />
            </CToastBody>
          </CToast>
        </CToaster>
      )}
    </>
  )
}

export default React.memo(AppSidebar)
