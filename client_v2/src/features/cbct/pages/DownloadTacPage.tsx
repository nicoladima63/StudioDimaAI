import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Loader2, Download, CheckCircle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import cbctService, { type EsameCbct } from '@/features/cbct/services/cbct.service'

const DownloadTacPage: React.FC = () => {
  const [esami, setEsami] = useState<EsameCbct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ricerca, setRicerca] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadEsami = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await cbctService.getListaEsami()
      setEsami(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore caricamento lista esami')
      setEsami([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEsami()
  }, [loadEsami])

  const handleScarica = async (esame: EsameCbct) => {
    try {
      setBusyId(esame.portal_exam_id)
      setError(null)
      await cbctService.scaricaEsame(esame)
      await loadEsami()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore durante il download')
    } finally {
      setBusyId(null)
    }
  }

  const esamiFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    if (!termine) return esami
    return esami.filter((e) => e.paziente_raw.toLowerCase().includes(termine))
  }, [esami, ricerca])

  return (
    <PageLayout>
      <PageLayout.Header
        title="Download TAC"
        headerAction={
          <Button variant="outline" size="sm" onClick={loadEsami} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Aggiorna lista
          </Button>
        }
      />

      <PageLayout.ContentBody>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Cerca per nome paziente..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>

        {loading && esami.length === 0 && (
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

        {!loading && esamiFiltrati.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Download className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nessun esame trovato sul portale</p>
          </div>
        )}

        {esamiFiltrati.length > 0 && (
          <>
            {/* Mobile: card list */}
            <div className="space-y-3 md:hidden">
              {esamiFiltrati.map((e) => (
                <Card key={e.portal_exam_id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{e.paziente_raw.replace('^', ' ')}</span>
                          <Badge variant={e.gia_scaricato ? 'success' : 'muted'} className="shrink-0">
                            {e.gia_scaricato
                              ? <><CheckCircle className="h-3 w-3 mr-1" />Scaricato</>
                              : 'Da scaricare'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{e.descrizione}</p>
                        <p className="text-xs text-muted-foreground">{e.data_esame}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === e.portal_exam_id || loading}
                        onClick={() => handleScarica(e)}
                      >
                        {busyId === e.portal_exam_id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : 'Scarica'}
                      </Button>
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
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Paziente</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Data esame</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Descrizione</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Stato</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {esamiFiltrati.map((e) => (
                    <tr key={e.portal_exam_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{e.paziente_raw.replace('^', ' ')}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.data_esame}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.descrizione}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={e.gia_scaricato ? 'success' : 'muted'}>
                          {e.gia_scaricato ? 'Scaricato' : 'Da scaricare'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={busyId === e.portal_exam_id || loading}
                          onClick={() => handleScarica(e)}
                        >
                          {busyId === e.portal_exam_id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                          Scarica
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

export default DownloadTacPage
