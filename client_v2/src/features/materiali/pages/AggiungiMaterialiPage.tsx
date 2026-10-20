import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Plus, RefreshCw, Search, Tags } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PaginationBar from '@/components/ui/pagination-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import ClassificazioneSelect from '../components/ClassificazioneSelect'
import { ClassificazioneLabel } from '../components/ClassificazioneLabel'
import catalogoService from '../services/catalogo.service'
import type { AggiungiVoceInput, ClassificazioneIds, FornitoreOption, PropostaClassificazione, VoceGestionale, VociGestionaleRisposta } from '../types/catalogo'
import { errorMessage, notify } from '../utils/notify'

const ALL = '__all__'
const NESSUNA: ClassificazioneIds = { contoid: null, brancaid: null, sottocontoid: null }

const FONTE_LABEL: Record<PropostaClassificazione['fonte'], string> = {
  stesso_nome_in_catalogo: 'Stesso nome in catalogo',
  famiglia_prodotti: 'Famiglia di prodotti simili',
  fornitore_completo: 'Fornitore (completa)',
  fornitore_parziale: 'Fornitore (solo conto)',
}

const euro = (value: number | null) =>
  value === null ? '-' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)

/** Proposte con classificazione completa e confidenza alta: si possono aggiungere con un solo clic. */
const SOGLIA_AFFIDABILE = 90
const affidabile = (v: VoceGestionale): boolean =>
  !v.in_catalogo && v.proposta !== null && v.proposta.sottocontoid !== null && v.proposta.confidence >= SOGLIA_AFFIDABILE

const chiave = (v: Pick<VoceGestionale, 'fornitore_id' | 'codice' | 'nome'>) => `${v.fornitore_id}|${v.codice}|${v.nome}`

const confidenceVariant = (confidence: number): 'success' | 'warning' | 'destructive' =>
  confidence >= 95 ? 'success' : confidence >= 80 ? 'warning' : 'destructive'

type ColonnaOrdine = 'nome' | 'fornitore' | 'ultimo_acquisto' | 'prezzo' | 'acquisti' | 'proposta'
interface Ordine { colonna: ColonnaOrdine; dir: 'asc' | 'desc' }

const confronta = (a: VoceGestionale, b: VoceGestionale, colonna: ColonnaOrdine): number => {
  switch (colonna) {
    case 'nome': return a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base', numeric: true })
    case 'fornitore': return a.fornitore_nome.localeCompare(b.fornitore_nome, 'it', { sensitivity: 'base' })
    case 'ultimo_acquisto': return a.ultimo_acquisto.localeCompare(b.ultimo_acquisto)
    case 'prezzo': return (a.ultimo_prezzo ?? -1) - (b.ultimo_prezzo ?? -1)
    case 'acquisti': return a.n_acquisti - b.n_acquisti
    case 'proposta': return (a.proposta?.confidence ?? -1) - (b.proposta?.confidence ?? -1)
  }
}

/** Livello piu' profondo su cui tutte le proposte delle voci concordano (conto, poi branca, poi sottoconto). */
const proposteComuni = (voci: VoceGestionale[]): { comune: ClassificazioneIds; conProposta: number; concordi: boolean } => {
  const proposte = voci.map((v) => v.proposta).filter((p): p is PropostaClassificazione => p !== null)
  const comune: ClassificazioneIds = { contoid: null, brancaid: null, sottocontoid: null }
  if (proposte.length === 0) return { comune, conProposta: 0, concordi: false }
  const primo = proposte[0] as PropostaClassificazione
  if (proposte.every((p) => p.contoid === primo.contoid)) {
    comune.contoid = primo.contoid
    if (proposte.every((p) => p.brancaid === primo.brancaid)) {
      comune.brancaid = primo.brancaid
      if (proposte.every((p) => p.sottocontoid === primo.sottocontoid)) comune.sottocontoid = primo.sottocontoid
    }
  }
  const concordi = proposte.every(
    (p) => p.contoid === primo.contoid && p.brancaid === primo.brancaid && p.sottocontoid === primo.sottocontoid
  )
  return { comune, conProposta: proposte.length, concordi }
}

const AggiungiMaterialiPage: React.FC = () => {
  const [testo, setTesto] = useState('')
  const q = useDebouncedValue(testo, 300)
  const [fornitoreId, setFornitoreId] = useState('')
  const [tutte, setTutte] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [fornitori, setFornitori] = useState<FornitoreOption[]>([])
  const [risposta, setRisposta] = useState<VociGestionaleRisposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [selezionate, setSelezionate] = useState<Map<string, VoceGestionale>>(new Map())
  const [dialog, setDialog] = useState(false)
  const [classificazione, setClassificazione] = useState<ClassificazioneIds>(NESSUNA)
  const [busy, setBusy] = useState(false)
  const [ordine, setOrdine] = useState<Ordine | null>({ colonna: 'nome', dir: 'asc' })
  const richiesta = useRef(0)

  const carica = useCallback(async (refresh = false) => {
    const id = ++richiesta.current
    setLoading(true)
    try {
      const esito = await catalogoService.apiGetVociGestionale({ q, fornitore_id: fornitoreId, tutte, page, per_page: perPage, refresh })
      if (id !== richiesta.current) return
      setRisposta(esito.data)
      if (esito.state === 'warning') notify('warning', esito.message ?? 'Gestionale non raggiungibile')
    } catch (error) {
      if (id === richiesta.current) notify('error', errorMessage(error, 'Voci del gestionale non caricate'))
    } finally {
      if (id === richiesta.current) setLoading(false)
    }
  }, [q, fornitoreId, tutte, page, perPage])

  useEffect(() => {
    void carica()
  }, [carica])

  useEffect(() => {
    catalogoService.apiGetFornitori('gestionale').then(setFornitori).catch(() => setFornitori([]))
  }, [])

  const vociServer = risposta?.voci ?? []
  const voci = ordine
    ? [...vociServer].sort((a, b) => (ordine.dir === 'asc' ? 1 : -1) * (confronta(a, b, ordine.colonna) || a.nome.localeCompare(b.nome, 'it')))
    : vociServer
  const pagination = risposta?.pagination ?? { page: 1, per_page: perPage, total: 0, pages: 1 }
  const selezionabili = voci.filter((v) => !v.in_catalogo)
  const tutteSelezionate = selezionabili.length > 0 && selezionabili.every((v) => selezionate.has(chiave(v)))

  const ordinaPer = (colonna: ColonnaOrdine) =>
    setOrdine((prev) => {
      if (prev?.colonna !== colonna) return { colonna, dir: 'asc' }
      return prev.dir === 'asc' ? { colonna, dir: 'desc' } : null
    })

  const intestazione = (colonna: ColonnaOrdine, etichetta: string) => {
    const attiva = ordine?.colonna === colonna
    const Icona = !attiva ? ArrowUpDown : ordine.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => ordinaPer(colonna)}
        aria-label={`Ordina per ${etichetta}`}>
        {etichetta}
        <Icona className={`h-3 w-3 ${attiva ? '' : 'opacity-40'}`} />
      </button>
    )
  }

  const toggle = (voce: VoceGestionale) =>
    setSelezionate((prev) => {
      const next = new Map(prev)
      if (next.has(chiave(voce))) next.delete(chiave(voce))
      else next.set(chiave(voce), voce)
      return next
    })

  const cambia = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const apriDialog = () => {
    setClassificazione(proposteComuni([...selezionate.values()]).comune)
    setDialog(true)
  }

  const aggiungiVoci = async (daAggiungere: VoceGestionale[], conClassificazione?: ClassificazioneIds) => {
    // Senza una classificazione scelta si invia quella proposta e mostrata a video, voce per voce.
    const payload: AggiungiVoceInput[] = daAggiungere.map((v) => {
      const proposta = v.proposta
        ? { contoid: v.proposta.contoid, brancaid: v.proposta.brancaid, sottocontoid: v.proposta.sottocontoid }
        : undefined
      const classificazione = conClassificazione ?? proposta
      return { fornitore_id: v.fornitore_id, codice: v.codice, nome: v.nome, ...(classificazione ? { classificazione } : {}) }
    })
    setBusy(true)
    try {
      const esito = await catalogoService.apiAggiungiVoci(payload)
      notify(esito.errori ? 'warning' : 'success', `${esito.creati} materiali aggiunti${esito.errori ? `, ${esito.errori} non aggiunti` : ''}`)
      setSelezionate((prev) => {
        const next = new Map(prev)
        daAggiungere.forEach((v) => next.delete(chiave(v)))
        return next
      })
      setDialog(false)
      setClassificazione(NESSUNA)
      await carica()
    } catch (error) {
      notify('error', errorMessage(error, 'Aggiunta non riuscita'))
    } finally {
      setBusy(false)
    }
  }

  const aggiungi = (conClassificazione?: ClassificazioneIds) => aggiungiVoci([...selezionate.values()], conClassificazione)

  const suggerimento = proposteComuni([...selezionate.values()])

  const paginazione = (
    <PaginationBar
      page={pagination.page}
      pages={pagination.pages}
      total={pagination.total}
      perPage={perPage}
      onPageChange={setPage}
      onPerPageChange={(value) => {
        setPerPage(value)
        setPage(1)
      }}
      disabled={loading}
    />
  )

  return (
    <PageLayout>
      <PageLayout.Header
        title="Aggiungi materiali dal gestionale"
        headerAction={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => carica(true)} disabled={loading}><RefreshCw /> Rileggi gestionale</Button>
            <Button asChild variant="outline" size="sm"><Link to="/materiali"><ArrowLeft /> Catalogo</Link></Button>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={testo}
                onChange={(e) => {
                  setTesto(e.target.value)
                  setPage(1)
                }}
                placeholder="Cerca per nome commerciale, codice o fornitore"
                aria-label="Cerca nelle fatture"
              />
            </div>
            <Select value={fornitoreId || ALL} onValueChange={(v) => cambia(setFornitoreId)(v === ALL ? '' : v)}>
              <SelectTrigger aria-label="Fornitore"><SelectValue placeholder="Fornitore" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tutti i fornitori di materiali</SelectItem>
                {fornitori.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome} ({f.n})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="tutte" checked={tutte} onCheckedChange={cambia(setTutte)} />
            <Label htmlFor="tutte">Mostra anche le voci gia in catalogo</Label>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <div className="space-y-3">
          {paginazione}

          {selezionate.size > 0 && (
            <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md">
              <span>{selezionate.size} selezionate</span>
              <Button size="sm" onClick={() => aggiungi()} disabled={busy}
                title="Ogni voce viene aggiunta con la propria classificazione proposta, anche se diverse tra loro">
                <Plus /> Aggiungi con le classificazioni proposte
              </Button>
              <Button size="sm" variant="outline" onClick={apriDialog} disabled={busy}
                title="Applica la stessa classificazione a tutte le voci selezionate, al posto delle proposte">
                <Tags /> Scegli una classificazione per tutte...
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelezionate(new Map())}>Deseleziona</Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleziona tutte le voci della pagina"
                    checked={tutteSelezionate}
                    onChange={() =>
                      setSelezionate((prev) => {
                        const next = new Map(prev)
                        selezionabili.forEach((v) => (tutteSelezionate ? next.delete(chiave(v)) : next.set(chiave(v), v)))
                        return next
                      })
                    }
                  />
                </TableHead>
                <TableHead className="w-12"><span className="sr-only">Aggiungi subito</span></TableHead>
                <TableHead>{intestazione('nome', 'Voce in fattura')}</TableHead>
                <TableHead>{intestazione('fornitore', 'Fornitore')}</TableHead>
                <TableHead>{intestazione('ultimo_acquisto', 'Ultimo acquisto')}</TableHead>
                <TableHead className="text-right">{intestazione('prezzo', 'Prezzo')}</TableHead>
                <TableHead className="text-right">{intestazione('acquisti', 'Acquisti')}</TableHead>
                <TableHead>{intestazione('proposta', 'Classificazione proposta')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && voci.length === 0
                ? Array.from({ length: 8 }, (_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }, (_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : voci.map((v) => (
                    <TableRow key={chiave(v)} data-state={selezionate.has(chiave(v)) ? 'selected' : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Seleziona ${v.nome}`}
                          disabled={v.in_catalogo}
                          checked={selezionate.has(chiave(v))}
                          onChange={() => toggle(v)}
                        />
                      </TableCell>
                      <TableCell>
                        {affidabile(v) && (
                          <Button
                            size="icon-sm"
                            title={`Aggiungi con la classificazione proposta (${v.proposta?.confidence}%)`}
                            aria-label={`Aggiungi ${v.nome}`}
                            onClick={() => aggiungiVoci([v])}
                            disabled={busy}
                          >
                            <Plus />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{v.nome}</div>
                        <div className="text-xs text-muted-foreground">{v.codice ? `Codice ${v.codice}` : 'Senza codice'}</div>
                      </TableCell>
                      <TableCell>{v.fornitore_nome}</TableCell>
                      <TableCell>
                        <div>{v.ultimo_acquisto || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.fatture.map((f) => `doc. ${f.numero_documento || f.fattura_id}`).join(', ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{euro(v.ultimo_prezzo)}</TableCell>
                      <TableCell className="text-right">{v.n_acquisti}</TableCell>
                      <TableCell>
                        {v.in_catalogo ? (
                          <Badge variant="info">In catalogo</Badge>
                        ) : v.proposta ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={confidenceVariant(v.proposta.confidence)}>{v.proposta.confidence}%</Badge>
                              <span className="text-xs text-muted-foreground">{FONTE_LABEL[v.proposta.fonte]}</span>
                            </div>
                            <ClassificazioneLabel nomi={v.proposta} />
                            {v.proposta.riferimento && v.proposta.fonte !== 'fornitore_completo' && v.proposta.fonte !== 'fornitore_parziale' && (
                              <div className="text-xs text-muted-foreground">da: {v.proposta.riferimento}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Nessuna proposta</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && voci.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Nessuna voce trovata. Prova con meno parole o attiva "Mostra anche le voci gia in catalogo".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {paginazione}
        </div>
      </PageLayout.ContentBody>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi {selezionate.size} materiali</DialogTitle>
            <DialogDescription>
              {suggerimento.conProposta === 0
                ? 'Nessuna proposta per queste voci: scegli la classificazione da applicare a tutte.'
                : suggerimento.concordi
                  ? 'Classificazione proposta precompilata: modificala se serve. Viene applicata a tutte le voci selezionate.'
                  : `Attenzione: le proposte delle voci non coincidono. Ho precompilato fino al livello su cui concordano (${suggerimento.conProposta} voci con proposta su ${selezionate.size}). La scelta sostituisce le proposte di tutte le voci: per tenere ognuna la sua, chiudi e usa "Aggiungi con le classificazioni proposte".`}
            </DialogDescription>
          </DialogHeader>
          <ClassificazioneSelect value={classificazione} onChange={setClassificazione} className="grid gap-2" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annulla</Button>
            <Button onClick={() => aggiungi(classificazione)} disabled={busy || !classificazione.contoid}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

export default AggiungiMaterialiPage
