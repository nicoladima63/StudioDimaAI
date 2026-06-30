import { useEffect } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Trash2, Calendar, Loader2,
} from 'lucide-react'
import { useCalendarHealth } from '../hook/useCalendarHealth'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StatusCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  variant?: 'default' | 'danger'
}

function StatusCard({ icon, title, children, variant = 'default' }: StatusCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 h-full',
        variant === 'danger'
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-muted/40 border-border'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('shrink-0', variant === 'danger' ? 'text-destructive' : 'text-muted-foreground')}>
          {icon}
        </span>
        <h6 className={cn('text-sm font-semibold m-0', variant === 'danger' ? 'text-destructive' : 'text-foreground')}>
          {title}
        </h6>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  )
}

function OkBadge({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
    : <XCircle className="h-5 w-5 text-destructive" />
}

export function CalendarHealthCheck() {
  const { health, isLoading, isResetting, checkHealth, resetSyncState } = useCalendarHealth()

  useEffect(() => { checkHealth() }, [])

  if (isLoading && !health) {
    return (
      <PageLayout>
        <PageLayout.ContentBody className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </PageLayout.ContentBody>
      </PageLayout>
    )
  }

  if (!health) return null

  return (
    <PageLayout>
      <PageLayout.Header title="Stato Sincronizzazione">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Calendar className="h-3.5 w-3.5" />
          Google Calendar
        </span>
      </PageLayout.Header>

      <PageLayout.ContentBody>
        {/* 6 card su una singola riga — responsive: 2 col mobile, 3 col tablet, 6 col desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* 1. Connessione Google */}
          <StatusCard icon={<Calendar className="h-4 w-4" />} title="Connessione">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Stato</span>
              <OkBadge ok={health.google_calendar_connected} />
            </div>
            <p className={cn('text-xs font-semibold mt-1', health.google_calendar_connected ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
              {health.google_calendar_connected ? 'Connesso' : 'Disconnesso'}
            </p>
          </StatusCard>

          {/* 2. Token OAuth */}
          <StatusCard icon={<CheckCircle className="h-4 w-4" />} title="Token OAuth">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Validità</span>
              <OkBadge ok={health.token_exists} />
            </div>
          </StatusCard>

          {/* 3. Credenziali */}
          <StatusCard icon={<CheckCircle className="h-4 w-4" />} title="Credenziali">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Config</span>
              <OkBadge ok={health.credentials_exists} />
            </div>
          </StatusCard>

          {/* 4. Sincronizzazione */}
          <StatusCard icon={<RefreshCw className="h-4 w-4" />} title="Sync eventi">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Nel DB</span>
              <span className="text-xl font-bold tabular-nums text-primary">
                {health.sync_state_entries}
              </span>
            </div>
          </StatusCard>

          {/* 5. Errori */}
          <StatusCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Errori"
            variant={health.google_error ? 'danger' : 'default'}
          >
            {health.google_error ? (
              <p className="text-xs text-destructive font-medium leading-tight">
                {health.google_error}
              </p>
            ) : (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium">Nessun errore</span>
              </div>
            )}
          </StatusCard>

          {/* 6. Azioni */}
          <StatusCard icon={<RefreshCw className="h-4 w-4" />} title="Azioni">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
                disabled={isLoading}
                className="w-full gap-1.5"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                Ricarica
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={resetSyncState}
                disabled={isResetting || !health.google_calendar_connected}
                className="w-full gap-1.5"
              >
                {isResetting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />
                }
                {isResetting ? 'Reset...' : 'Reset Sync'}
              </Button>
            </div>
          </StatusCard>

        </div>
      </PageLayout.ContentBody>

      <PageLayout.Footer>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Reset Stato:</strong> forza la ricreazione di tutti gli eventi alla prossima sincronizzazione. Usare se ci sono duplicati o errori persistenti.
        </p>
      </PageLayout.Footer>
    </PageLayout>
  )
}
