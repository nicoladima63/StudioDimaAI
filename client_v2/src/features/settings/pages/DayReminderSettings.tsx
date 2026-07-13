import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import dayReminderService from '@/features/settings/services/dayReminder.service'

const weekdayOptions = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 7, label: 'Domenica' },
]

const DayReminderSettings: React.FC = () => {
  const [days, setDays] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadDays = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const data = await dayReminderService.getDays()
      setDays(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore caricamento lista giorni')
      setDays([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDays()
  }, [loadDays])

  const toggleDay = (value: number) => {
    setDays((current) =>
      current.includes(value) ? current.filter((day) => day !== value) : [...current, value].sort((a, b) => a - b),
    )
    setSuccessMessage(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const updatedDays = await dayReminderService.updateDays(days)
      setDays(updatedDays)
      setSuccessMessage('Impostazione salvata')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio lista giorni')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Giorni in cui eseguire i promemoria"
        headerAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDays} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Aggiorna
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || loading} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salva
            </Button>
          </div>
        }
      />

      <PageLayout.ContentBody>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
            {successMessage}
          </div>
        )}

        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Seleziona i giorni in cui il sistema deve inviare i reminder automatici.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento impostazioni...
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {weekdayOptions.map((option) => {
                  const checked = days.includes(option.value)

                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDay(option.value)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout.ContentBody>
    </PageLayout>
  )
}

export default DayReminderSettings
