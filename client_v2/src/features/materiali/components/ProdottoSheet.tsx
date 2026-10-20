import React, { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Scissors } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import catalogoService from '../services/catalogo.service'
import type { ClassificazioneIds, OffertaDettaglio, ProdottoDettaglio } from '../types/catalogo'
import { errorMessage, notify } from '../utils/notify'
import ClassificazioneSelect from './ClassificazioneSelect'
import { ClassificazioneLabel, StatoBadge } from './ClassificazioneLabel'

interface ProdottoSheetProps {
  prodottoId: number | null
  onClose: () => void
  /** Chiamata dopo ogni modifica, per ricaricare l'elenco. */
  onChanged: () => void
}

const euro = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '-' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) }).format(value)

const FONTE_LABEL: Record<OffertaDettaglio['confezione_fonte'], string> = {
  default: 'Predefinita',
  fattura: 'Da fattura',
  manuale: 'Manuale',
}

const textareaClass =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

const OffertaCard: React.FC<{
  offerta: OffertaDettaglio
  puoSeparare: boolean
  onSaved: (prodotto: ProdottoDettaglio) => void
  onSeparata: (prodottoId: number) => void
}> = ({ offerta, puoSeparare, onSaved, onSeparata }) => {
  const [pezzi, setPezzi] = useState(String(offerta.pezzi_per_confezione))
  const [unita, setUnita] = useState(offerta.unita_acquisto)
  const [tutte, setTutte] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPezzi(String(offerta.pezzi_per_confezione))
    setUnita(offerta.unita_acquisto)
  }, [offerta.pezzi_per_confezione, offerta.unita_acquisto])

  const salva = async () => {
    const valore = Number(pezzi.replace(',', '.'))
    if (!Number.isFinite(valore) || valore <= 0) {
      notify('error', 'Inserisci un numero di pezzi maggiore di zero')
      return
    }
    setBusy(true)
    try {
      onSaved(await catalogoService.apiUpdateOfferta(offerta.id, { pezzi_per_confezione: valore, unita_acquisto: unita }))
      notify('success', 'Confezione aggiornata')
    } catch (error) {
      notify('error', errorMessage(error, 'Aggiornamento non riuscito'))
    } finally {
      setBusy(false)
    }
  }

  const separa = async () => {
    setBusy(true)
    try {
      const { prodotto_id } = await catalogoService.apiSeparaOfferta(offerta.id)
      notify('success', 'Offerta separata in un nuovo prodotto')
      onSeparata(prodotto_id)
    } catch (error) {
      notify('error', errorMessage(error, 'Separazione non riuscita'))
    } finally {
      setBusy(false)
    }
  }

  const acquisti = tutte ? offerta.acquisti : offerta.acquisti.slice(0, 5)

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{offerta.fornitore_nome || offerta.fornitore_id}</div>
          <div className="text-xs text-muted-foreground">
            {offerta.codice ? `Codice ${offerta.codice} - ` : 'Senza codice - '}{offerta.nome}
          </div>
        </div>
        <div className="text-right text-sm">
          <div>{euro(offerta.ultimo_prezzo)} <span className="text-muted-foreground">ultimo prezzo</span></div>
          <div className="text-xs text-muted-foreground">{euro(offerta.prezzo_unitario_base, 4)} per unita base</div>
        </div>
      </div>

      <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`pezzi-${offerta.id}`}>
            Pezzi per confezione <Badge variant="muted" className="ml-1">{FONTE_LABEL[offerta.confezione_fonte]}</Badge>
          </Label>
          <Input id={`pezzi-${offerta.id}`} inputMode="decimal" value={pezzi} onChange={(e) => setPezzi(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`unita-${offerta.id}`}>Unita di acquisto</Label>
          <Input id={`unita-${offerta.id}`} value={unita} onChange={(e) => setUnita(e.target.value)} placeholder="es. scatola" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={salva} disabled={busy}>Salva</Button>
          {puoSeparare && (
            <Button size="sm" variant="outline" onClick={separa} disabled={busy} title="Sposta questa offerta in un prodotto separato">
              <Scissors /> Separa
            </Button>
          )}
        </div>
      </div>

      {offerta.acquisti.length > 0 && (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Fattura</TableHead>
                <TableHead className="text-right">Qta</TableHead>
                <TableHead className="text-right">Prezzo</TableHead>
                <TableHead>Lotto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acquisti.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.data || '-'}</TableCell>
                  <TableCell>{a.numero_documento || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{a.fattura_id}</TableCell>
                  <TableCell className="text-right">{a.quantita ?? '-'}</TableCell>
                  <TableCell className="text-right">{euro(a.prezzo_unitario)}</TableCell>
                  <TableCell>{a.lotto || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {offerta.acquisti.length > 5 && (
            <Button variant="ghost" size="sm" onClick={() => setTutte((v) => !v)}>
              {tutte ? 'Mostra meno' : `Mostra tutti i ${offerta.acquisti.length} acquisti`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

const ProdottoSheet: React.FC<ProdottoSheetProps> = ({ prodottoId, onClose, onChanged }) => {
  const [prodotto, setProdotto] = useState<ProdottoDettaglio | null>(null)
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [unitaBase, setUnitaBase] = useState('')
  const [soglia, setSoglia] = useState('')
  const [note, setNote] = useState('')
  const [classificazione, setClassificazione] = useState<ClassificazioneIds>({ contoid: null, brancaid: null, sottocontoid: null })
  const [busy, setBusy] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(prodottoId)

  const applica = useCallback((p: ProdottoDettaglio) => {
    setProdotto(p)
    setNome(p.nome)
    setUnitaBase(p.unita_base)
    setSoglia(p.soglia_minima === null ? '' : String(p.soglia_minima))
    setNote(p.note)
    setClassificazione({ contoid: p.contoid, brancaid: p.brancaid, sottocontoid: p.sottocontoid })
  }, [])

  useEffect(() => {
    setCurrentId(prodottoId)
  }, [prodottoId])

  useEffect(() => {
    if (currentId === null) {
      setProdotto(null)
      return
    }
    let attivo = true
    setLoading(true)
    catalogoService
      .apiGetProdotto(currentId)
      .then((p) => attivo && applica(p))
      .catch((error) => {
        notify('error', errorMessage(error, 'Prodotto non caricato'))
        onClose()
      })
      .finally(() => attivo && setLoading(false))
    return () => {
      attivo = false
    }
  }, [currentId, applica, onClose])

  const salvaDati = async () => {
    if (!prodotto) return
    setBusy(true)
    try {
      applica(
        await catalogoService.apiUpdateProdotto(prodotto.id, {
          nome,
          unita_base: unitaBase,
          soglia_minima: soglia.trim() === '' ? null : Number(soglia.replace(',', '.')),
          note,
        })
      )
      notify('success', 'Prodotto aggiornato')
      onChanged()
    } catch (error) {
      notify('error', errorMessage(error, 'Aggiornamento non riuscito'))
    } finally {
      setBusy(false)
    }
  }

  const salvaClassificazione = async () => {
    if (!prodotto) return
    if (!classificazione.contoid) {
      notify('error', 'Seleziona almeno il conto')
      return
    }
    setBusy(true)
    try {
      await catalogoService.apiClassificaProdotti([prodotto.id], classificazione)
      applica(await catalogoService.apiGetProdotto(prodotto.id))
      notify('success', 'Classificazione salvata')
      onChanged()
    } catch (error) {
      notify('error', errorMessage(error, 'Classificazione non riuscita'))
    } finally {
      setBusy(false)
    }
  }

  const archivia = async () => {
    if (!prodotto) return
    setBusy(true)
    try {
      await catalogoService.apiArchiviaProdotto(prodotto.id, !prodotto.archiviato)
      notify('success', prodotto.archiviato ? 'Prodotto ripristinato' : 'Prodotto archiviato')
      onChanged()
      onClose()
    } catch (error) {
      notify('error', errorMessage(error, 'Operazione non riuscita'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={prodottoId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{prodotto?.nome ?? 'Prodotto'}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-2">
              {prodotto && <StatoBadge stato={prodotto.stato} />}
              {prodotto && <ClassificazioneLabel nomi={prodotto} />}
            </div>
          </SheetDescription>
        </SheetHeader>

        {loading || !prodotto ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Dati prodotto</h3>
              <div className="space-y-1">
                <Label htmlFor="prodotto-nome">Nome</Label>
                <Input id="prodotto-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="prodotto-unita">Unita base</Label>
                  <Input id="prodotto-unita" value={unitaBase} onChange={(e) => setUnitaBase(e.target.value)} placeholder="es. pezzo, ml" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prodotto-soglia">Soglia minima (magazzino)</Label>
                  <Input id="prodotto-soglia" inputMode="decimal" value={soglia} onChange={(e) => setSoglia(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="prodotto-note">Note</Label>
                <textarea id="prodotto-note" className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button size="sm" onClick={salvaDati} disabled={busy || !nome.trim()}>Salva dati</Button>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Classificazione</h3>
              <ClassificazioneSelect value={classificazione} onChange={setClassificazione} />
              <Button size="sm" onClick={salvaClassificazione} disabled={busy || !classificazione.contoid}>Salva classificazione</Button>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Offerte dei fornitori ({prodotto.offerte.length})</h3>
              {prodotto.offerte.map((offerta) => (
                <OffertaCard
                  key={offerta.id}
                  offerta={offerta}
                  puoSeparare={prodotto.offerte.length > 1}
                  onSaved={(p) => {
                    applica(p)
                    onChanged()
                  }}
                  onSeparata={() => {
                    onChanged()
                    setCurrentId(prodotto.id)
                    void catalogoService.apiGetProdotto(prodotto.id).then(applica)
                  }}
                />
              ))}
            </section>

            <div className="flex justify-end border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={archivia} disabled={busy}>
                {prodotto.archiviato ? <ArchiveRestore /> : <Archive />}
                {prodotto.archiviato ? 'Ripristina prodotto' : 'Archivia prodotto'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default ProdottoSheet
