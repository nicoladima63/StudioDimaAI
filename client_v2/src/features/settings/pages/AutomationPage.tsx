import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Trash2, Loader2, Zap, CheckCircle, XCircle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { automationService, type AutomationRule } from '@/features/settings/services/automation.service'
import { cn } from '@/lib/utils'

const AutomationPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionBusyId, setActionBusyId] = useState<number | null>(null)

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await automationService.getRules()
      setRules(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore caricamento regole')
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const handleDelete = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa regola?')) return
    try {
      setActionBusyId(id)
      await automationService.deleteRule(id)
      await loadRules()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore eliminazione regola')
    } finally {
      setActionBusyId(null)
    }
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Automazioni"
        headerAction={
          <Button
            variant="outline"
            size="sm"
            onClick={loadRules}
            disabled={loading}
            className="gap-1.5"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />
            }
            Aggiorna
          </Button>
        }
      />

      <PageLayout.ContentBody>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && rules.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && rules.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nessuna regola di automazione configurata</p>
          </div>
        )}

        {/* Rules list — card su mobile, tabella su desktop */}
        {rules.length > 0 && (
          <>
            {/* Mobile: card list */}
            <div className="space-y-3 md:hidden">
              {rules.map((r) => (
                <Card key={r.id} className={cn(!r.attiva && 'opacity-60')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{r.name}</span>
                          <Badge variant={r.attiva ? 'success' : 'muted'} className="shrink-0">
                            {r.attiva
                              ? <><CheckCircle className="h-3 w-3 mr-1" />Attiva</>
                              : <><XCircle className="h-3 w-3 mr-1" />Spenta</>
                            }
                          </Badge>
                        </div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        disabled={actionBusyId === r.id || loading}
                        onClick={() => handleDelete(r.id)}
                      >
                        {actionBusyId === r.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
                      <div>
                        <span className="font-medium text-foreground">Trigger</span>
                        <div className="mt-0.5">{r.trigger_type}:{r.trigger_id}</div>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Azione</span>
                        <div className="mt-0.5">{r.action_name || r.action_id}</div>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Priorità</span>
                        <div className="mt-0.5">{r.priorita}</div>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Aggiornato</span>
                        <div className="mt-0.5">{r.updated_at || '-'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: tabella */}
            <div className="hidden md:block overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">ID</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Trigger</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Azione</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Stato</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Priorità</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Aggiornato</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground">{r.id}</td>
                      <td className="px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.trigger_type}:{r.trigger_id}</td>
                      <td className="px-3 py-2.5">{r.action_name || r.action_id}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={r.attiva ? 'success' : 'muted'}>
                          {r.attiva ? 'Attiva' : 'Spenta'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">{r.priorita}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.updated_at || '-'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 gap-1"
                          disabled={actionBusyId === r.id || loading}
                          onClick={() => handleDelete(r.id)}
                        >
                          {actionBusyId === r.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                          Elimina
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageLayout.ContentBody>
    </PageLayout>
  )
}

export default AutomationPage
