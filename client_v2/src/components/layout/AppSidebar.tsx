import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, RefreshCw, Loader2 } from 'lucide-react'
import { AppSidebarNav } from './AppSidebarNav'
import navigation from './_nav'
import adminService from '@/features/admin/services/adminService'
import { useAuthStore } from '@/store/auth.store'
import type { BuildInfo } from '@/features/admin/services/adminService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AppSidebarProps {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_FAILURES = 40

const AppSidebar: React.FC<AppSidebarProps> = ({ visible, onVisibleChange }) => {
  const { user } = useAuthStore()
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [restarting, setRestarting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restartBuildRef = useRef<number | null>(null)
  const pollFailuresRef = useRef(0)
  const isRestartingRef = useRef(false)

  useEffect(() => {
    adminService.apiBuildInfo().then(setBuildInfo).catch(() => {})
  }, [])

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
        pollFailuresRef.current = 0
        if (info.build !== restartBuildRef.current) {
          stopPolling()
          setBuildInfo(info)
          toast.success(`Build #${info.build} attiva — ricarico...`)
          setTimeout(() => window.location.reload(), 1500)
        }
      } catch {
        pollFailuresRef.current += 1
        if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
          stopPolling()
          toast.error('Riavvio non rilevato: server non risponde.')
        }
      }
    }, POLL_INTERVAL_MS)
  }

  const handleRestart = async () => {
    if (isRestartingRef.current) return
    isRestartingRef.current = true
    setRestarting(true)
    const previousBuild = buildInfo?.build ?? 0
    toast('Riavvio in corso — attendi...', { icon: '⏳' })
    try {
      await adminService.apiRestartServer()
    } catch {
      // la connessione si chiude mentre il server si spegne, è normale
    }
    startPollingForNewBuild(previousBuild)
  }

  useEffect(() => () => stopPolling(), [])

  const builtDate = buildInfo?.built_at
    ? buildInfo.built_at.replace('T', ' ').slice(0, 16)
    : ''

  return (
    <>
      {/* Overlay per chiudere la sidebar su tablet */}
      {visible && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => onVisibleChange(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-zinc-900 dark:bg-zinc-950 text-white transition-transform duration-200 ease-in-out',
          visible ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-white text-xs font-bold">
              SD
            </div>
            <span className="font-semibold text-sm tracking-wide">Studio Dima</span>
          </Link>
          <button
            onClick={() => onVisibleChange(false)}
            className="p-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <AppSidebarNav items={navigation} />

        {/* Footer */}
        <div className="border-t border-white/10 px-3 py-3 space-y-2">
          {buildInfo && (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[11px] text-white/40 leading-tight">
                <div>v{buildInfo.version} #{buildInfo.build}</div>
                <div className="text-[10px]">{builtDate}</div>
              </div>
              <Badge
                variant={buildInfo.env === 'production' ? 'success' : 'warning'}
                className="text-[10px] px-1.5 py-0"
              >
                {buildInfo.env === 'production' ? 'PROD' : 'DEV'}
              </Badge>
            </div>
          )}
          {buildInfo?.env === 'production' && user?.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/40 bg-transparent"
              disabled={restarting}
              onClick={handleRestart}
            >
              {restarting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              }
              {restarting ? 'Riavvio...' : 'Riavvia server'}
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}

export default React.memo(AppSidebar)
