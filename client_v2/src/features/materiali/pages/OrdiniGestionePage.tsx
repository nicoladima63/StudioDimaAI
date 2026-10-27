import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Pencil, Search, Trash2, X } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PaginationBar from '@/components/ui/pagination-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ordiniService, type OrdineMateriali, type StatoOrdine } from '../services/ordini.service'
import { errorMessage, notify } from '../utils/notify'

const ALL = '__all__'
const STATI: Record<StatoOrdine, string> = { ordinato: 'In attesa di ricezione', ricevuto: 'Ricevuto', annullato: 'Annullato' }
type Colonna = 'id' | 'fornitore_nome' | 'data_ordine' | 'stato'
const COLONNE: { key: Colonna; label: string }[] = [
  { key: 'id', label: 'N.' },
  { key: 'fornitore_nome', label: 'Fornitore' },
  { key: 'data_ordine', label: 'Data' },
  { key: 'stato', label: 'Stato' },
]

interface Bozza {
  id: number
  data_ordine: string
  data_ricezione: string
  stato: StatoOrdine
  righe: { id: number; nome: string; quantita: string; note: string }[]
}

const formatData = (value: string | null) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString('it-IT') : '-')

const OrdiniGestionePage: React.FC = () => {
  const [ordini, setOrdini] = useState<OrdineMateriali[]>([])
  const [loading, setLoading] = useState(true)
  const [testo, setTesto] = useState('')
  const [stato, setStato] = useState<StatoOrdine | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sort, setSort] = useState<Colonna>('data_ordine')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [daEliminare, setDaEliminare] = useState<OrdineMateriali | null>(null)
  const [busy, setBusy] = useState(false)

  const carica = useCallback(async () => {
    setLoading(true)
    try {
      setOrdini((await ordiniService.load()).ordini)
    } catch (error) {
      notify('error', errorMessage(error, 'Ordini non caricati'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void carica() }, [carica])

  const filtrati = useMemo(() => {
    const cerca = testo.trim().toLocaleLowerCase('it')
    const righe = ordini.filter((o) =>
      (!stato || o.stato === stato) &&
      (!cerca || `${o.id} ${o.fornitore_nome} ${o.righe.map((r) => r.nome).join(' ')}`.toLocaleLowerCase('it').includes(cerca)))
    const verso = dir === 'asc' ? 1 : -1
    return righe.sort((a, b) => {
      const x = a[sort], y = b[sort]
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'it')) * verso || b.id - a.id
    })
  }, [ordini, testo, stato, sort, dir])

  const pages = Math.max(1, Math.ceil(filtrati.length / perPage))
  const pagina = Math.min(page, pages)
  const visibili = filtrati.slice((pagina - 1) * perPage, pagina * perPage)

  const ordina = (colonna: Colonna) => {
    if (sort === colonna) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(colonna); setDir('asc') }
    setPage(1)
  }
  const icona = (colonna: Colonna) =>
    sort !== colonna ? <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" /> : dir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />

  const apriModifica = (o: OrdineMateriali) => setBozza({
    id: o.id, data_ordine: o.data_ordine, data_ricezione: o.data_ricezione ?? '', stato: o.stato,
    righe: o.righe.map((r) => ({ id: r.id, nome: r.nome, quantita: String(r.quantita), note: r.note })),
  })

  const salva = async () => {
    if (!bozza) return
    const righe = bozza.righe.map((r) => ({ id: r.id, quantita: Number(r.quantita), note: r.note }))
    if (!righe.length || righe.some((r) => !Number.isFinite(r.quantita) || r.quantita <= 0)) {
      notify('warning', 'Ogni riga deve avere una quantita maggiore di zero; per togliere tutto elimina l\'ordine')
      return
    }
    setBusy(true)
    try {
      await ordiniService.apiOrdineModifica(bozza.id, {
        data_ordine: bozza.data_ordine, data_ricezione: bozza.data_ricezione || null, stato: bozza.stato, righe,
      })
      notify('success', 'Ordine aggiornato')
      setBozza(null)
      await carica()
    } catch (error) {
      notify('error', errorMessage(error, 'Ordine non aggiornato'))
    } finally {
      setBusy(false)
    }
  }

  const elimina = async () => {
    if (!daEliminare) return
    setBusy(true)
    try {
      await ordiniService.apiOrdineElimina(daEliminare.id)
      notify('success', 'Ordine eliminato')
      setDaEliminare(null)
      await carica()
    } catch (error) {
      notify('error', errorMessage(error, 'Ordine non eliminato'))
    } finally {
      setBusy(false)
    }
  }

  const paginazione = (
    <PaginationBar
      page={pagina} pages={pages} total={filtrati.length} perPage={perPage}
      onPageChange={setPage}
      onPerPageChange={(value) => { setPerPage(value); setPage(1) }}
      disabled={loading}
    />
  )

  return (
    <PageLayout>
      <PageLayout.Header
        title="Gestione ordini materiali"
        headerAction={<Button asChild size="sm" variant="outline"><Link to="/materiali/ordini"><ArrowLeft /> Torna agli ordini</Link></Button>}
      />
      <PageLayout.ContentHeader>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9" value={testo} aria-label="Cerca ordini"
              onChange={(e) => { setTesto(e.target.value); setPage(1) }}
              placeholder="Cerca per numero, fornitore o materiale"
            />
          </div>
          <Select value={stato || ALL} onValueChange={(v) => { setStato(v === ALL ? '' : (v as StatoOrdine)); setPage(1) }}>
            <SelectTrigger aria-label="Stato"><SelectValue placeholder="Stato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tutti gli stati</SelectItem>
              {Object.entries(STATI).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </PageLayout.ContentHeader>
      <PageLayout.ContentBody>
        <div className="space-y-3">
          {paginazione}
          <Table>
            <TableHeader>
              <TableRow>
                {COLONNE.map((c) => (
                  <TableHead key={c.key}>
                    <button type="button" className="inline-flex items-center uppercase" onClick={() => ordina(c.key)}>{c.label}{icona(c.key)}</button>
                  </TableHead>
                ))}
                <TableHead>Righe</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && ordini.length === 0
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}>{Array.from({ length: COLONNE.length + 2 }, (_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                  ))
                : visibili.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>#{o.id}</TableCell>
                      <TableCell className="font-medium">{o.fornitore_nome}</TableCell>
                      <TableCell>{formatData(o.data_ordine)}</TableCell>
                      <TableCell><Badge variant={o.stato === 'ricevuto' ? 'default' : 'muted'}>{STATI[o.stato]}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {o.righe.map((r) => `${r.nome} x${r.quantita}`).join(', ')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" aria-label={`Modifica ordine ${o.id}`} onClick={() => apriModifica(o)}><Pencil /></Button>
                        <Button size="sm" variant="ghost" aria-label={`Elimina ordine ${o.id}`} onClick={() => setDaEliminare(o)}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && visibili.length === 0 && (
                <TableRow><TableCell colSpan={COLONNE.length + 2} className="py-10 text-center text-muted-foreground">Nessun ordine trovato.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {paginazione}
        </div>
      </PageLayout.ContentBody>

      <Dialog open={!!bozza} onOpenChange={(open) => { if (!open && !busy) setBozza(null) }}>
        <DialogContent className="max-w-2xl">
          {bozza && <>
            <DialogHeader>
              <DialogTitle>Modifica ordine #{bozza.id}</DialogTitle>
              <DialogDescription>Cambia data, stato, quantita e note, oppure togli righe. Per aggiungere materiali usa un nuovo ordine.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1"><Label htmlFor="ord-data">Data ordine</Label>
                <Input id="ord-data" type="date" value={bozza.data_ordine} onChange={(e) => setBozza({ ...bozza, data_ordine: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="ord-stato">Stato</Label>
                <Select value={bozza.stato} onValueChange={(v) => setBozza({ ...bozza, stato: v as StatoOrdine })}>
                  <SelectTrigger id="ord-stato"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATI).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
                </Select></div>
              {bozza.stato === 'ricevuto' && <div className="space-y-1"><Label htmlFor="ord-ricezione">Data ricezione</Label>
                <Input id="ord-ricezione" type="date" value={bozza.data_ricezione} onChange={(e) => setBozza({ ...bozza, data_ricezione: e.target.value })} /></div>}
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {bozza.righe.map((r, i) => (
                <div key={r.id} className="grid grid-cols-[1fr_6rem_1fr_auto] items-center gap-2">
                  <span className="text-sm font-medium">{r.nome}</span>
                  <Input type="number" min="0.001" step="any" aria-label={`Quantita ${r.nome}`} value={r.quantita}
                    onChange={(e) => setBozza({ ...bozza, righe: bozza.righe.map((x, j) => (j === i ? { ...x, quantita: e.target.value } : x)) })} />
                  <Input aria-label={`Note ${r.nome}`} placeholder="Note" maxLength={2000} value={r.note}
                    onChange={(e) => setBozza({ ...bozza, righe: bozza.righe.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                  <Button size="sm" variant="ghost" aria-label={`Togli ${r.nome}`} onClick={() => setBozza({ ...bozza, righe: bozza.righe.filter((_, j) => j !== i) })}><X /></Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setBozza(null)}>Annulla</Button>
              <Button disabled={busy || !bozza.data_ordine} onClick={() => void salva()}>Salva</Button>
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!daEliminare} onOpenChange={(open) => { if (!open && !busy) setDaEliminare(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina ordine #{daEliminare?.id}</DialogTitle>
            <DialogDescription>L'ordine e le sue righe vengono cancellati dallo storico. L'operazione non si puo annullare.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDaEliminare(null)}>Indietro</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void elimina()}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

export default OrdiniGestionePage
