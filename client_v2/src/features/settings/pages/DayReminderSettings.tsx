import React, { useEffect, useState } from 'react'
import { Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import dayReminderService, { StudioOpeningHours } from '../services/dayReminder.service'

export default function DayReminderSettingsPage() {
  const [schedule, setSchedule] = useState<StudioOpeningHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updates, setUpdates] = useState<Record<number, Partial<StudioOpeningHours>>>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Carica schedule all'apertura
  useEffect(() => {
    loadSchedule()
  }, [])

  const loadSchedule = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dayReminderService.getSchedule()
      setSchedule(data)
      setUpdates({})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handler toggle enabled
  const handleToggleEnabled = (dayOfWeek: number, currentValue: number) => {
    setUpdates((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...(prev[dayOfWeek] || {}),
        enabled: currentValue === 1 ? 0 : 1,
      },
    }))
  }

  // Handler toggle continuous
  const handleToggleContinuous = (dayOfWeek: number, currentValue: number) => {
    setUpdates((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...(prev[dayOfWeek] || {}),
        continuous_hours: currentValue === 1 ? 0 : 1,
      },
    }))
  }

  // Salva un giorno
  const handleSaveDay = async (dayOfWeek: number) => {
    if (!updates[dayOfWeek]) return

    try {
      setSaving(true)
      const updatedDay = await dayReminderService.updateDay(dayOfWeek, updates[dayOfWeek])

      // Aggiorna schedule e rimuovi da updates
      setSchedule((prev) =>
        prev.map((d) => (d.day_of_week === dayOfWeek ? updatedDay : d))
      )
      setUpdates((prev) => {
        const newUpdates = { ...prev }
        delete newUpdates[dayOfWeek]
        return newUpdates
      })

      setSaveMessage({ type: 'success', text: `${updatedDay.name} aggiornato` })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const getEffectiveDay = (dayOfWeek: number) => {
    return updates[dayOfWeek]
      ? { ...schedule.find((d) => d.day_of_week === dayOfWeek), ...updates[dayOfWeek] }
      : schedule.find((d) => d.day_of_week === dayOfWeek)
  }

  if (loading) {
    return (
      <PageLayout>
        <PageLayout.Header title="Configurazione Orari Reminder" />
        <PageLayout.ContentBody>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento...
          </div>
        </PageLayout.ContentBody>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout>
        <PageLayout.Header title="Configurazione Orari Reminder" />
        <PageLayout.ContentBody>
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm text-destructive">{error}</div>
          </div>
        </PageLayout.ContentBody>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Configurazione Orari Reminder"
        headerAction={
          <Button variant="outline" size="sm" onClick={loadSchedule} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '↻'}
            Aggiorna
          </Button>
        }
      />

      <PageLayout.ContentBody>
        {saveMessage && (
          <div
            className={`mb-4 flex items-start gap-3 rounded-md border px-4 py-3 ${
              saveMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-destructive/30 bg-destructive/10'
            }`}
          >
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            )}
            <div className="text-sm">{saveMessage.text}</div>
          </div>
        )}

        {/* Tabella 1: Toggles */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Configurazione Reminder per Giorno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Giorno</th>
                    <th className="px-4 py-2 text-center font-medium">Abilitato</th>
                    <th className="px-4 py-2 text-left font-medium">Modalità</th>
                    <th className="px-4 py-2 text-center font-medium">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((day) => {
                    const effective = getEffectiveDay(day.day_of_week)
                    const isDirty = !!updates[day.day_of_week]

                    return (
                      <tr
                        key={day.day_of_week}
                        className={`border-b ${isDirty ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium">{day.name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={effective?.enabled === 1}
                            onChange={() =>
                              handleToggleEnabled(day.day_of_week, effective?.enabled ?? 0)
                            }
                            disabled={saving}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {effective?.enabled === 1 ? (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={effective?.continuous_hours === 1}
                                onChange={() =>
                                  handleToggleContinuous(
                                    day.day_of_week,
                                    effective?.continuous_hours ?? 0
                                  )
                                }
                                disabled={saving}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">
                                {dayReminderService.getDispatchModeLabel(
                                  effective?.continuous_hours ?? 0
                                )}
                              </span>
                            </label>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            disabled={!isDirty || saving}
                            onClick={() => handleSaveDay(day.day_of_week)}
                            className="gap-1.5"
                          >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Salva
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Tabella 2: Preview Orari */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orari di Apertura e Dispatch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Giorno</th>
                    <th className="px-4 py-2 text-left font-medium">Stato</th>
                    <th className="px-4 py-2 text-left font-medium">Modalità</th>
                    <th className="px-4 py-2 text-left font-medium">Orari</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((day) => {
                    const effective = getEffectiveDay(day.day_of_week)

                    let statusText = ''
                    let statusClass = ''
                    if (effective?.enabled === 1) {
                      statusText = '✓ Abilitato'
                      statusClass = 'text-emerald-600'
                    } else {
                      statusText = '✗ Disabilitato'
                      statusClass = 'text-destructive'
                    }

                    let modeText = ''
                    let orariText = ''
                    if (effective?.enabled === 1) {
                      if (effective?.continuous_hours === 1) {
                        modeText = 'Continuo'
                        orariText = dayReminderService.formatTimeRange(
                          effective?.fascia_unica_start,
                          effective?.fascia_unica_end
                        )
                      } else {
                        modeText = 'Split'
                        const morning = dayReminderService.formatTimeRange(
                          effective?.morning_start,
                          effective?.morning_end
                        )
                        const afternoon = dayReminderService.formatTimeRange(
                          effective?.afternoon_start,
                          effective?.afternoon_end
                        )
                        orariText = `${morning} / ${afternoon}`
                      }
                    } else {
                      modeText = '-'
                      orariText = '-'
                    }

                    return (
                      <tr key={day.day_of_week} className="border-b">
                        <td className="px-4 py-3">
                          <span className="font-medium">{day.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusClass}>{statusText}</span>
                        </td>
                        <td className="px-4 py-3">{modeText}</td>
                        <td className="px-4 py-3 font-mono text-xs">{orariText}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageLayout.ContentBody>
    </PageLayout>
  )
}
