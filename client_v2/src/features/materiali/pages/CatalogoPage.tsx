import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Merge, Plus, Search, Tags } from 'lucide-react'
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
import { ClassificazioneLabel, StatoBadge } from '../components/ClassificazioneLabel'
import ProdottoSheet from '../components/ProdottoSheet'
import catalogoService from '../services/catalogo.service'
import type { ClassificazioneIds, FornitoreOption, ProdottoCatalogo, RicercaProdottiRisposta, StatoProdotto } from '../types/catalogo'
import { errorMessage, notify } from '../utils/notify'

const ALL = '__all__'
const NESSUNA: ClassificazioneIds = { contoid: null, brancaid: null, sottocontoid: null }

const euro = (value: number | null) =>
  value === null ? '-' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)

const formatData = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('it-IT')
}

const COLONNE: { key: string; label: string; sort?: string; className?: string }[] = [
  { key: 'nome', label: 'Prodotto', sort: 'nome' },
  { key: 'fornitori', label: 'Fornitori' },
  { key: 'classificazione', label: 'Classificazione' },
  { key: 'prezzo', label: 'Miglior prezzo/unita', sort: 'prezzo', className: 'text-right' },
  { key: 'ultimo_acquisto', label: 'Ultimo acquisto', sort: 'ultimo_acquisto' },
  { key: 'stato', label: 'Stato', sort: 'stato' },
]

const CatalogoPage: React.FC = () => {
  const [testo, setTesto] = useState('')
  const q = useDebouncedValue(testo, 300)
  const [fornitoreId, setFornitoreId] = useState('')
  const [classificazione, setClassificazione] = useState<ClassificazioneIds>(NESSUNA)
  const [stato, setStato] = useState<StatoProdotto | ''>('')
  const [archiviati, setArchiviati] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sort, setSort] = useState('nome')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const [fornitori, setFornitori] = useState<FornitoreOption[]>([])
  const [risposta, setRisposta] = useState<RicercaProdottiRisposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [selezionati, setSelezionati] = useState<Set<number>>(new Set())
  const [aperto, setAperto] = useState<number | null>(null)
  const [dialogClassifica, setDialogClassifica] = useState(false)
  const [dialogUnisci, setDialogUnisci] = useState(false)
  const [bulkClassificazione, setBulkClassificazione] = useState<ClassificazioneIds>(NESSUNA)
  const [target, setTarget] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const richiesta = useRef(0)

  const carica = useCallback(async () => {
    const id = ++richiesta.current
    setLoading(true)
    try {
      const data = await catalogoService.apiRicercaProdotti({
        q, fornitore_id: fornitoreId, ...classificazione, stato, archiviati, page, per_page: perPage, sort, dir,
      })
      if (id === richiesta.current) {
        setRisposta(data)
        setSelezionati(new Set())
      }
    } catch (error) {
      if (id === richiesta.current) notify('error', errorMessage(error, 'Catalogo non caricato'))
    } finally {
      if (id === richiesta.current) setLoading(false)
    }
  }, [q, fornitoreId, classificazione, stato, archiviati, page, perPage, sort, dir])

  useEffect(() => {
    void carica()
  }, [carica])

  useEffect(() => {
    catalogoService.apiGetFornitori('catalogo').then(setFornitori).catch(() => setFornitori([]))
  }, [])

  const cambiaFiltro = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const ordina = (colonna: string) => {
    if (sort === colonna) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(colonna)
      setDir('asc')
    }
    setPage(1)
  }

  const prodotti = risposta?.prodotti ?? []
  const pagination = risposta?.pagination ?? { page: 1, per_page: perPage, total: 0, pages: 1 }
  const riepilogo = risposta?.riepilogo ?? {}
  const tuttiSelezionati = prodotti.length > 0 && prodotti.every((p) => selezionati.has(p.id))

  const toggle = (id: number) =>
    setSelezionati((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const confermaClassifica = async () => {
    if (!bulkClassificazione.contoid) return
    setBusy(true)
    try {
      const { aggiornati } = await catalogoService.apiClassificaProdotti([...selezionati], bulkClassificazione)
      notify('success', `${aggiornati} prodotti classificati`)
      setDialogClassifica(false)
      setBulkClassificazione(NESSUNA)
      await carica()
    } catch (error) {
      notify('error', errorMessage(error, 'Classificazione non riuscita'))
    } finally {
      setBusy(false)
    }
  }

  const apriUnisci = () => {
    setTarget([...selezionati][0] ?? null)
    setDialogUnisci(true)
  }

  const confermaUnisci = async () => {
    if (target === null) return
    setBusy(true)
    try {
      const esito = await catalogoService.apiUnisciProdotti(target, [...selezionati].filter((id) => id !== target))
      notify(esito.classificazioni_diverse_ignorate ? 'warning' : 'success',
        esito.classificazioni_diverse_ignorate
          ? `Prodotti uniti. ${esito.classificazioni_diverse_ignorate} classificazioni diverse ignorate: vale quella del prodotto scelto`
          : 'Prodotti uniti')
      setDialogUnisci(false)
      await carica()
    } catch (error) {
      notify('error', errorMessage(error, 'Unione non riuscita'))
    } finally {
      setBusy(false)
    }
  }

  const iconaOrdine = (colonna: string) =>
    sort !== colonna ? <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" /> : dir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />

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

  const selezionatiLista = prodotti.filter((p) => selezionati.has(p.id))

  return (
    <PageLayout>
      <PageLayout.Header
        title="Catalogo materiali"
        headerAction={
          <Button asChild size="sm">
            <Link to="/materiali/aggiungi"><Plus /> Aggiungi dal gestionale</Link>
          </Button>
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
                placeholder="Cerca per nome, codice o fornitore (anche piu parole)"
                aria-label="Cerca nel catalogo"
              />
            </div>
            <Select value={fornitoreId || ALL} onValueChange={(v) => cambiaFiltro(setFornitoreId)(v === ALL ? '' : v)}>
              <SelectTrigger aria-label="Fornitore"><SelectValue placeholder="Fornitore" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tutti i fornitori</SelectItem>
                {fornitori.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome} ({f.n})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ClassificazioneSelect value={classificazione} onChange={cambiaFiltro(setClassificazione)} clearable />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={stato === '' ? 'default' : 'outline'} onClick={() => cambiaFiltro(setStato)('')}>Tutti</Button>
              <Button size="sm" variant={stato === 'classificato' ? 'default' : 'outline'} onClick={() => cambiaFiltro(setStato)('classificato')}>
                Classificati <Badge variant="muted" className="ml-2">{riepilogo.classificato ?? 0}</Badge>
              </Button>
              <Button size="sm" variant={stato === 'parziale' ? 'default' : 'outline'} onClick={() => cambiaFiltro(setStato)('parziale')}>
                Parziali <Badge variant="muted" className="ml-2">{riepilogo.parziale ?? 0}</Badge>
              </Button>
              <Button size="sm" variant={stato === 'da_classificare' ? 'default' : 'outline'} onClick={() => cambiaFiltro(setStato)('da_classificare')}>
                Da classificare <Badge variant="muted" className="ml-2">{riepilogo.da_classificare ?? 0}</Badge>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="archiviati" checked={archiviati} onCheckedChange={cambiaFiltro(setArchiviati)} />
              <Label htmlFor="archiviati">Mostra archiviati</Label>
            </div>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <div className="space-y-3">
          {paginazione}

          {selezionati.size > 0 && (
            <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md">
              <span>{selezionati.size} selezionati</span>
              <Button size="sm" variant="outline" onClick={() => setDialogClassifica(true)}><Tags /> Classifica</Button>
              <Button size="sm" variant="outline" onClick={apriUnisci} disabled={selezionati.size < 2}><Merge /> Unisci</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelezionati(new Set())}>Deseleziona</Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleziona tutti"
                    checked={tuttiSelezionati}
                    onChange={() => setSelezionati(tuttiSelezionati ? new Set() : new Set(prodotti.map((p) => p.id)))}
                  />
                </TableHead>
                {COLONNE.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    {c.sort ? (
                      <button type="button" className="inline-flex items-center uppercase" onClick={() => ordina(c.sort as string)}>
                        {c.label}{iconaOrdine(c.sort)}
                      </button>
                    ) : c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && prodotti.length === 0
                ? Array.from({ length: 8 }, (_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLONNE.length + 1 }, (_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : prodotti.map((p: ProdottoCatalogo) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setAperto(p.id)} data-state={selezionati.has(p.id) ? 'selected' : undefined}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Seleziona ${p.nome}`} checked={selezionati.has(p.id)} onChange={() => toggle(p.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.nome}</div>
                        {p.offerte.some((o) => o.codice) && (
                          <div className="text-xs text-muted-foreground">{p.offerte.map((o) => o.codice).filter(Boolean).slice(0, 3).join(', ')}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.offerte.slice(0, 3).map((o) => (
                            <Badge key={o.id} variant="outline">{o.fornitore_nome || o.fornitore_id}</Badge>
                          ))}
                          {p.offerte.length > 3 && <Badge variant="muted">+{p.offerte.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell><ClassificazioneLabel nomi={p} /></TableCell>
                      <TableCell className="text-right">{euro(p.miglior_prezzo_unitario)}</TableCell>
                      <TableCell>{formatData(p.ultimo_acquisto)}</TableCell>
                      <TableCell><StatoBadge stato={p.stato} /></TableCell>
                    </TableRow>
                  ))}
              {!loading && prodotti.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLONNE.length + 1} className="py-10 text-center text-muted-foreground">
                    Nessun prodotto trovato. Aggiungi materiali dal gestionale per popolare il catalogo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {paginazione}
        </div>
      </PageLayout.ContentBody>

      <ProdottoSheet prodottoId={aperto} onClose={() => setAperto(null)} onChanged={carica} />

      <Dialog open={dialogClassifica} onOpenChange={setDialogClassifica}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Classifica {selezionati.size} prodotti</DialogTitle>
            <DialogDescription>La classificazione sostituisce quella attuale. Conto obbligatorio, branca e sottoconto opzionali.</DialogDescription>
          </DialogHeader>
          <ClassificazioneSelect value={bulkClassificazione} onChange={setBulkClassificazione} className="grid gap-2" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogClassifica(false)}>Annulla</Button>
            <Button onClick={confermaClassifica} disabled={busy || !bulkClassificazione.contoid}>Applica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogUnisci} onOpenChange={setDialogUnisci}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unisci prodotti</DialogTitle>
            <DialogDescription>
              Le offerte dei prodotti selezionati vengono spostate sul prodotto che scegli. Unisci solo prodotti identici: colori e misure diverse restano separati.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selezionatiLista.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm">
                <input type="radio" name="target" className="mt-1" checked={target === p.id} onChange={() => setTarget(p.id)} />
                <span>
                  <span className="font-medium">{p.nome}</span>
                  <span className="block text-xs text-muted-foreground">{p.offerte.map((o) => o.fornitore_nome).join(', ')}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogUnisci(false)}>Annulla</Button>
            <Button onClick={confermaUnisci} disabled={busy || target === null}>Unisci in quello scelto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

export default CatalogoPage
