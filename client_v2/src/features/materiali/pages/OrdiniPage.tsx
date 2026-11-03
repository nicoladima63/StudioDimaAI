import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CButton, CCloseButton, CDropdown, CDropdownMenu, CDropdownToggle, CFormCheck, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '@/components/layout/PageLayout';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import { useFornitoriStore } from '@/store/fornitori.store';
import catalogoService from '../services/catalogo.service';
import type { ProdottoCatalogo } from '../types/catalogo';
import { ordiniService, type OrdiniData, type PianoAcquisto, type RigaCarrello, type Segno } from '../services/ordini.service';

const formatDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('it-IT') : '—';
type RigaCarrelloVista = { id: number; nome: string; codice: string | null; fornitoreid: string; fornitorenome: string; quantita: number };
// Un'offerta del catalogo = prodotto + fornitore: e' la riga che si mette nel carrello.
type Offerta = { id: number; codice: string; fornitoreid: string; fornitorenome: string; data: string | null; prezzo: number | null };
// Il codice articolo serve alle macchine, non alle persone: si toglie dal nome mostrato.
// shortcut: toglie solo il codice scritto come parola a sé; se è incollato ad altre lettere resta.
function nomeUmano(nome: string, codice: string | null | undefined) {
  // Nei dati reali il codice è quasi sempre la prima parola del nome (71430, UC001A3, GL001AS): maiuscole e cifre, almeno 4 caratteri.
  const senzaPrefisso = nome.trim().replace(/^(?=\S*\d)[A-Z0-9][A-Z0-9,./-]{3,}\s+(?=\S)/, '');
  const code = codice?.trim().toLocaleLowerCase();
  if (!code) return senzaPrefisso;
  const pulito = senzaPrefisso.split(/\s+/).filter(t => t.replace(/^[([]+|[)\]]+$/g, '').toLocaleLowerCase() !== code).join(' ')
    .replace(/^[-–—:]\s*|\s*[-–—:]$/g, '').trim();
  return pulito || senzaPrefisso;
}
// Codice del fornitore leggibile: senza "REF" e senza i segnaposto ZZZ... dell'anagrafica.
const codiceUtile = (codice: string | null | undefined) => {
  const pulito = (codice ?? '').trim().replace(/^REF\s+/i, '');
  return /^Z{3,}/i.test(pulito) ? '' : pulito;
};
const quadrato = { width: 28, height: 28, padding: 0, lineHeight: 1 };
const SENZA_DATA = 'nd';

export default function OrdiniPage() {
  const [prodotti, setProdotti] = useState<ProdottoCatalogo[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState('');
  const [data, setData] = useState<OrdiniData>({ piani: [], ordini: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Il flusso iniziale è volutamente una sola pagina di carrello e stampa.
  // Le strutture di pianificazione restano nel servizio per l'integrazione con
  // il magazzino, ma non fanno parte della maschera operativa corrente.
  const tab: string = 'rapido';
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [draft, setDraft] = useState<PianoAcquisto | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [carrello, setCarrello] = useState<RigaCarrello[]>([]);
  const [daOrdinare, setDaOrdinare] = useState<number[]>([]);
  const [svuotaCarrello, setSvuotaCarrello] = useState(false);
  const [ordiniVisibili, setOrdiniVisibili] = useState(10);
  const [ricercaRapida, setRicercaRapida] = useState('');
  const [letteraRapida, setLetteraRapida] = useState('');
  const [fornitoreRapido, setFornitoreRapido] = useState('');
  const fornitoriMap = useFornitoriStore(state => state.fornitoriMap);
  const loadAllFornitori = useFornitoriStore(state => state.loadAllFornitori);
  useEffect(() => { void loadAllFornitori(); }, [loadAllFornitori]);
  const [checkoutRapido, setCheckoutRapido] = useState(false);
  const [segni, setSegni] = useState<Segno[]>([]);
  const [soloPreferiti, setSoloPreferiti] = useState(false);
  const [anniScelti, setAnniScelti] = useState<Set<string> | null>(null);
  const preferitiApplicati = useRef(false);
  const preferiti = useMemo(() => new Set(segni.filter(s => s.tipo === 'preferito').map(s => s.chiave)), [segni]);
  const perDopo = useMemo(() => segni.filter(s => s.tipo === 'dopo').map(s => s.chiave), [segni]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ordini, righe, marcati] = await Promise.all([ordiniService.load(), ordiniService.carrello(), ordiniService.apiPreferiti()]);
      setData(ordini); setCarrello(righe); setSegni(marcati); setError('');
      // All'apertura si parte dai soli preferiti, se ce ne sono; i ricaricamenti successivi non cambiano la scelta.
      if (!preferitiApplicati.current) { preferitiApplicati.current = true; setSoloPreferiti(marcati.some(s => s.tipo === 'preferito')); }
    }
    catch { setError('Impossibile caricare gli ordini. Riprova con Aggiorna.'); }
    finally { setLoading(false); }
  }, []);
  const caricaCatalogo = useCallback(async () => {
    setMaterialsLoading(true);
    try {
      // Il catalogo e' di qualche centinaio di prodotti: si carica tutto e si filtra qui.
      const { prodotti: elenco } = await catalogoService.apiRicercaProdotti({ page: 1, per_page: 1000, sort: 'nome', dir: 'asc' });
      setProdotti(elenco); setMaterialsError('');
    } catch { setMaterialsError('Impossibile caricare il catalogo materiali.'); }
    finally { setMaterialsLoading(false); }
  }, []);
  useEffect(() => { void refresh(); void caricaCatalogo(); }, [refresh, caricaCatalogo]);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try { await action(); toast.success(message); await refresh(); }
    catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      toast.error(apiError.response?.data?.error || 'Operazione non riuscita. Riprova.');
    } finally { setBusy(false); }
  }

  const matches = (p: { nome: string; codice: string | null; fornitore_nome: string }) =>
    (!supplier || p.fornitore_nome === supplier) && `${p.nome} ${p.codice || ''} ${p.fornitore_nome}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const visiblePlans = data.piani.filter(matches);
  const queue = visiblePlans.filter(p => p.da_ordinare);
  const suppliers = [...new Set(data.piani.map(p => p.fornitore_nome))].sort();
  const selectedPlans = data.piani.filter(p => selected.includes(p.materiale_id) && p.da_ordinare && !p.in_arrivo);
  const materialiRapidi = useMemo(() => prodotti.map(p => ({
    key: String(p.id), nome: p.nome,
    // Prima l'offerta piu' recente: e' quella che il + mette nel carrello.
    righe: [...p.offerte].sort((a, b) => (b.ultimo_acquisto || '').localeCompare(a.ultimo_acquisto || '') || b.id - a.id).map((o): Offerta => ({
      id: o.id, codice: codiceUtile(o.codice), fornitoreid: o.fornitore_id,
      fornitorenome: fornitoriMap[o.fornitore_id]?.nome || o.fornitore_nome.trim() || o.fornitore_id,
      data: o.ultimo_acquisto, prezzo: o.ultimo_prezzo,
    })),
  })).filter(p => p.righe.length).map(p => ({ ...p, anno: p.righe[0].data?.slice(0, 4) || SENZA_DATA })), [prodotti, fornitoriMap]);
  // Anno dell'ultimo acquisto: all'apertura sono scelti gli ultimi due anni, cosi' non si scorrono prodotti fermi da anni.
  const anniDisponibili = useMemo(() => [...new Set(materialiRapidi.map(p => p.anno))].sort().reverse(), [materialiRapidi]);
  const anniAttivi = anniScelti ?? new Set([...anniDisponibili.filter(a => a !== SENZA_DATA).slice(0, 2), SENZA_DATA]);
  const cambiaAnno = (anno: string) => setAnniScelti(() => { const next = new Set(anniAttivi); if (!next.delete(anno)) next.add(anno); return next; });
  const prodottoDiOfferta = useMemo(() => new Map(materialiRapidi.flatMap(p => p.righe.map(o => [o.id, p.key] as const))), [materialiRapidi]);
  const iniziale = (nome: string) => {
    const lettera = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
    return /^[A-Z]$/.test(lettera) ? lettera : '#';
  };
  // Senza preferiti il filtro non ha senso: si vede tutto come prima.
  const filtroPreferiti = soloPreferiti && preferiti.size > 0;
  // Ogni parola scritta deve comparire in nome, codice o fornitore, in qualsiasi ordine.
  const paroleRicerca = ricercaRapida.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const materialiRapidiFiltrati = materialiRapidi.filter(prodotto =>
    (!letteraRapida || iniziale(prodotto.nome) === letteraRapida) &&
    (!filtroPreferiti || preferiti.has(prodotto.key)) && anniAttivi.has(prodotto.anno) &&
    paroleRicerca.every(parola => `${prodotto.nome} ${prodotto.righe.map(o => `${o.codice} ${o.fornitorenome}`).join(' ')}`.toLocaleLowerCase().includes(parola))
  );
  const fornitoriRisultanti = [...new Set(materialiRapidiFiltrati.flatMap(p => p.righe.map(o => o.fornitorenome)))].sort((a, b) => a.localeCompare(b, 'it'));
  // I chip dei fornitori restano quelli dei risultati; il filtro fornitore restringe solo le schede mostrate.
  const perFornitore = fornitoreRapido ? materialiRapidiFiltrati.filter(p => p.righe.some(o => o.fornitorenome === fornitoreRapido)) : materialiRapidiFiltrati;
  // Nei preferiti i prodotti fermi da piu' tempo vengono prima (anno e mese crescenti, senza data in fondo): sono quelli da riguardare.
  const materialiVisibili = filtroPreferiti
    ? [...perFornitore].sort((a, b) => (a.righe[0].data ?? '9999').localeCompare(b.righe[0].data ?? '9999') || a.nome.localeCompare(b.nome, 'it'))
    : perFornitore;
  const ricercaInputRef = useRef<HTMLInputElement>(null);
  const righeCarrello: RigaCarrelloVista[] = carrello.map(line => ({
    id: line.materiale_id, nome: nomeUmano(line.nome, line.codice), codice: line.codice, fornitoreid: line.fornitore_id, quantita: line.quantita,
    fornitorenome: fornitoriMap[line.fornitore_id]?.nome || line.fornitore_nome,
  })).sort((a, b) => a.fornitorenome.localeCompare(b.fornitorenome, 'it') || a.nome.localeCompare(b.nome, 'it'));
  const prezzo = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'Prezzo non disponibile' : value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

  // Il carrello e' sul server e condiviso: ogni azione restituisce il carrello aggiornato.
  async function aggiornaCarrello(action: () => Promise<RigaCarrello[]>) {
    try { setCarrello(await action()); }
    catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      toast.error(apiError.response?.data?.error || 'Carrello non aggiornato. Riprova.');
    }
  }

  function aggiungiRapido(offertaId: number) {
    void aggiornaCarrello(() => ordiniService.carrelloModifica(offertaId, { delta: 1 }));
  }

  async function segna(chiave: string, tipo: Segno['tipo'], attivo: boolean) {
    try { setSegni(await ordiniService.apiPreferitoImposta(chiave, tipo, attivo)); return true; }
    catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      toast.error(apiError.response?.data?.error || 'Operazione non riuscita. Riprova.');
      return false;
    }
  }

  async function salvaPerDopo(line: RigaCarrelloVista) {
    const chiave = prodottoDiOfferta.get(line.id);
    if (chiave && await segna(chiave, 'dopo', true)) void aggiornaCarrello(() => ordiniService.carrelloRimuovi(line.id));
  }

  async function spostaNelCarrello(offertaId: number, chiave: string) {
    if (await segna(chiave, 'dopo', false)) aggiungiRapido(offertaId);
  }

  function diminuisciRapido(id: number) {
    void aggiornaCarrello(() => ordiniService.carrelloModifica(id, { delta: -1 }));
  }

  function cambiaQuantitaRapida(id: number, value: number) {
    void aggiornaCarrello(() => !Number.isFinite(value) || value <= 0 ? ordiniService.carrelloRimuovi(id) : ordiniService.carrelloModifica(id, { quantita: value }));
  }

  // Registra l'ordine (righe spuntate), poi stampa la lista di quelle righe e chiude il checkout.
  function ordina() {
    const righe = righeCarrello.filter(line => daOrdinare.includes(line.id));
    void run(async () => {
      const result = await ordiniService.carrelloOrdina(righe.map(line => line.id));
      setCarrello(result.carrello);
      setCheckoutRapido(false);
      stampaListaOrdine(righe);
    }, 'Ordine registrato e tolto dal carrello');
  }

  async function riordina(orderId: number) {
    try {
      const result = await ordiniService.carrelloRiordina(orderId);
      setCarrello(result.carrello);
      if (result.saltate) toast(`${result.aggiunte} righe nel carrello, ${result.saltate} non più in anagrafica`);
      else toast.success('Righe aggiunte al carrello');
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      toast.error(apiError.response?.data?.error || 'Riordino non riuscito. Riprova.');
    }
  }

  function stampaListaOrdine(righe: RigaCarrelloVista[]) {
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
    const groups = new Map<string, RigaCarrelloVista[]>();
    righe.forEach(line => groups.set(line.fornitoreid || line.fornitorenome, [...(groups.get(line.fornitoreid || line.fornitorenome) || []), line]));
    const sections = [...groups.entries()].map(([, lines]) => `<section><h2>${escape(lines[0].fornitorenome)}</h2><table><thead><tr><th>Materiale</th><th>Codice</th><th>Quantità</th></tr></thead><tbody>${lines.map(line => `<tr><td>${escape(line.nome)}</td><td>${escape(line.codice || '—')}</td><td>${escape(line.quantita)}</td></tr>`).join('')}</tbody></table></section>`).join('');
    const html = `<!doctype html><html lang="it"><head><title>Lista ordine materiali</title><style>body{font:14px Arial;margin:28px;color:#111}h1{margin-bottom:4px}h2{margin-top:28px;font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:8px;text-align:left}th{background:#eee}@media print{body{margin:12mm}}</style></head><body><h1>Lista ordine materiali</h1><p>Preparata il ${escape(new Date().toLocaleDateString('it-IT'))}</p>${sections}</body></html>`;
    // window.open con noopener restituisce null e lascia about:blank: si stampa da un iframe nascosto.
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    frame.srcdoc = html;
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) { frame.remove(); return; }
      win.onafterprint = () => frame.remove();
      win.focus();
      win.print();
    };
    document.body.appendChild(frame);
  }

  function exportList() {
    const cell = (value: unknown) => {
      const text = String(value ?? '');
      return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
    };
    const lines = [['Fornitore', 'Materiale', 'Codice', 'Quantità', 'Unità', 'Note'],
      ...queue.map(p => [p.fornitore_nome, p.nome, p.codice, p.quantita, p.unita, p.note])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'materiali-da-ordinare.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const disabled = busy || loading || !!error;
  return <PageLayout>
    <PageLayout.Header title='Ordini materiali' headerAction={<div className='d-flex gap-2'><Link className='btn btn-outline-primary' to='/materiali/ordini/gestione'>Gestisci ordini</Link><CButton color='primary' disabled={busy || loading} onClick={() => void refresh()}>Aggiorna</CButton></div>} />
    <PageLayout.ContentHeader>
      <p>Organizza gli acquisti, segnala i materiali terminati e prepara la lista per ciascun fornitore.</p>
      {(tab === 'piani' || tab === 'lista') && <div className='row g-3'>
        <div className='col-md-6'><label htmlFor='ordini-search' className='form-label'>Cerca materiale, codice o fornitore</label><input id='ordini-search' className='form-control' value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className='col-md-6'><label htmlFor='ordini-supplier' className='form-label'>Fornitore</label><select id='ordini-supplier' className='form-select' value={supplier} onChange={e => setSupplier(e.target.value)}><option value=''>Tutti i fornitori</option>{suppliers.map(s => <option key={s}>{s}</option>)}</select></div>
      </div>}
    </PageLayout.ContentHeader>
    <PageLayout.ContentBody>
      {error && <div role='alert' className='alert alert-danger'>{error}</div>}
      {loading && <p role='status'>Caricamento ordini...</p>}
      {tab === 'rapido' && <>
        <div className='row g-4'>
          <div className='col-lg-8'>
            <div className='mb-2'><h5 className='mb-0'>Materiali ordinabili</h5><p className='text-muted mb-0'>Cerca il prodotto per nome e confronta gli ultimi tre acquisti.</p></div>
            {materialsError && <div className='alert alert-danger' role='alert'>{materialsError} <CButton onClick={() => void caricaCatalogo()}>Riprova</CButton></div>}
            <div className='d-flex flex-wrap gap-2 mb-3' role='group' aria-label='Filtra materiali per iniziale'>
              <CButton size='sm' aria-pressed={filtroPreferiti} color={filtroPreferiti ? 'danger' : 'secondary'} disabled={!preferiti.size} onClick={() => setSoloPreferiti(!filtroPreferiti)}>Preferiti ({preferiti.size})</CButton>
              <CButton size='sm' aria-pressed={!letteraRapida && !filtroPreferiti} color={!letteraRapida && !filtroPreferiti ? 'primary' : 'secondary'} onClick={() => { setLetteraRapida(''); setFornitoreRapido(''); setSoloPreferiti(false); }}>Tutti</CButton>
              {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map(lettera => <CButton key={lettera} size='sm' aria-pressed={letteraRapida === lettera} color={letteraRapida === lettera ? 'primary' : 'secondary'} onClick={() => { setLetteraRapida(lettera); setFornitoreRapido(''); }}>{lettera}</CButton>)}
            </div>
            <div className='d-flex align-items-center gap-2 mb-3'>
              <CDropdown autoClose='outside'>
                <CDropdownToggle color='secondary' size='sm'>Ultimo acquisto: {[...anniAttivi].map(a => a === SENZA_DATA ? 'senza data' : a).sort().reverse().join(', ') || 'nessun anno'}</CDropdownToggle>
                <CDropdownMenu className='p-2'>
                  {anniDisponibili.map(anno => <CFormCheck key={anno} id={`anno-${anno}`} className='mb-1' label={anno === SENZA_DATA ? 'Senza data' : anno} checked={anniAttivi.has(anno)} onChange={() => cambiaAnno(anno)} />)}
                </CDropdownMenu>
              </CDropdown>            </div>
            <div className='border rounded p-3 mb-3'>
              <label htmlFor='quick-order-search' className='form-label'>Cerca fra tutti i materiali</label>
              <div className='position-relative'>
                <input id='quick-order-search' ref={ricercaInputRef} className='form-control pe-5' autoFocus value={ricercaRapida} onChange={e => { setRicercaRapida(e.target.value); setFornitoreRapido(''); }} placeholder='Nome commerciale, codice o fornitore' />
                {ricercaRapida && <CCloseButton aria-label='Cancella ricerca' className='position-absolute top-50 end-0 translate-middle-y me-3' onClick={() => { setRicercaRapida(''); setFornitoreRapido(''); ricercaInputRef.current?.focus(); }} />}
              </div>
              {ricercaRapida.trim() && fornitoriRisultanti.length > 1 && <div className='d-flex flex-wrap gap-2 mt-2' role='group' aria-label='Filtra per fornitore'>
                <CButton size='sm' aria-pressed={!fornitoreRapido} color={!fornitoreRapido ? 'primary' : 'secondary'} onClick={() => setFornitoreRapido('')}>Tutti i fornitori</CButton>
                {fornitoriRisultanti.map(nome => <CButton key={nome} size='sm' aria-pressed={fornitoreRapido === nome} color={fornitoreRapido === nome ? 'primary' : 'secondary'} onClick={() => setFornitoreRapido(nome)}>{nome}</CButton>)}
              </div>}
            </div>
            {/* Colonne CSS: schede di altezza diversa si impilano senza calcoli di posizione. */}
            <div style={{ columnWidth: '18rem', columnGap: '0.5rem' }}>
              {materialiVisibili.map(({ key, nome, righe }) => {
                // Con un fornitore scelto, scheda e pulsante + usano l'offerta di quel fornitore.
                const righeScelte = fornitoreRapido && righe.some(o => o.fornitorenome === fornitoreRapido) ? righe.filter(o => o.fornitorenome === fornitoreRapido) : righe;
                const materiale = { nome, ...righeScelte[0] };
                const dettaglio = righeScelte.length === 1 ? materiale.codice : '';
                const nelCarrello = righeCarrello.find(line => righe.some(o => o.id === line.id));
                return <div key={key} className='mb-2' style={{ breakInside: 'avoid' }}>
                <article className='border rounded p-3' aria-label={materiale.nome}>
                  <div className='d-flex align-items-start justify-content-between gap-2 mb-2'>
                    <div className='me-auto' style={{ minWidth: 0 }}>
                      <strong>{materiale.nome}</strong>
                      {dettaglio && <div className='text-muted' style={{ fontSize: '0.75rem' }}>{dettaglio}</div>}
                    </div>
                    <button type='button' className='btn btn-link p-0 flex-shrink-0 text-danger' aria-pressed={preferiti.has(key)} aria-label={`${preferiti.has(key) ? 'Togli dai preferiti' : 'Metti tra i preferiti'} ${materiale.nome}`} onClick={() => void segna(key, 'preferito', !preferiti.has(key))}>
                      <Heart size={20} fill={preferiti.has(key) ? 'currentColor' : 'none'} />
                    </button>
                    {nelCarrello
                      ? <div className='d-flex align-items-center gap-1 flex-shrink-0'>
                        <CButton color='secondary' style={quadrato} aria-label={`Diminuisci ${materiale.nome}`} onClick={() => diminuisciRapido(nelCarrello.id)}>−</CButton>
                        <strong className='px-1'>{nelCarrello.quantita}</strong>
                        <CButton color='primary' style={quadrato} aria-label={`Aumenta ${materiale.nome}`} onClick={() => aggiungiRapido(nelCarrello.id)}>+</CButton>
                      </div>
                      : <CButton color='primary' className='flex-shrink-0' style={quadrato} aria-label={`Aggiungi ${materiale.nome}`} onClick={() => aggiungiRapido(materiale.id)}>+</CButton>}
                  </div>
                  <ul className='list-unstyled mb-0'>{righeScelte.map(o => <li key={o.id} className='border-top py-1 small text-muted' style={{ overflowWrap: 'anywhere' }}>
                    {o.fornitorenome} · {formatDate(o.data)} · {prezzo(o.prezzo)}{righeScelte.length > 1 && o.codice && ` · ${o.codice}`}
                  </li>)}</ul>
                </article>
              </div>;
              })}
            </div>
            {!materialsLoading && !materialiVisibili.length && <p>Nessun materiale corrispondente.{anniAttivi.size < anniDisponibili.length && ' Controlla il filtro Ultimo acquisto: alcuni anni sono esclusi.'}</p>}
          </div>
          <div className='col-lg-4'><div className='border rounded p-3 bg-light sticky-lg-top'>
            <h5>Carrello ({righeCarrello.length})</h5>
            {!righeCarrello.length && <p className='text-muted mb-0'>Seleziona i materiali da ordinare.</p>}
            {righeCarrello.map(line => <div key={line.id} className='border-top py-2'>
              <strong className='d-block'>{line.nome}</strong><small className='d-block text-muted'>{line.codice || 'senza codice'} · {line.fornitorenome}</small>
              <div className='d-flex align-items-center gap-2 mt-2'><CButton size='sm' color='secondary' onClick={() => diminuisciRapido(line.id)}>−</CButton><input aria-label={`Quantità ${line.nome}`} className='form-control form-control-sm' style={{ width: '76px' }} type='number' min='0.001' step='1' value={line.quantita} onChange={e => cambiaQuantitaRapida(line.id, Number(e.target.value))} /><CButton size='sm' color='secondary' onClick={() => void aggiornaCarrello(() => ordiniService.carrelloModifica(line.id, { delta: 1 }))}>+</CButton><CButton size='sm' color='link' onClick={() => void salvaPerDopo(line)}>Salva per dopo</CButton><CButton size='sm' color='link' className='text-danger' onClick={() => cambiaQuantitaRapida(line.id, 0)}>Rimuovi</CButton></div>
            </div>)}
            {!!righeCarrello.length && <div className='d-flex flex-wrap gap-2 mt-3'><CButton color='primary' onClick={() => { setDaOrdinare(righeCarrello.map(line => line.id)); setCheckoutRapido(true); }}>Vai al checkout</CButton><CButton color='secondary' onClick={() => setSvuotaCarrello(true)}>Svuota</CButton></div>}
            <h5 className='mt-4'>Salvati per dopo ({perDopo.length})</h5>
            {!perDopo.length && <p className='text-muted mb-0'>Metti da parte i prodotti che non ti servono adesso.</p>}
            {perDopo.map(chiave => {
              const prodotto = materialiRapidi.find(p => p.key === chiave);
              return <div key={chiave} className='border-top py-2'>
                <strong className='d-block'>{prodotto?.nome ?? 'Prodotto non piu in catalogo'}</strong>
                <div className='d-flex gap-2 mt-1'>
                  {prodotto && <CButton size='sm' color='link' onClick={() => void spostaNelCarrello(prodotto.righe[0].id, chiave)}>Sposta nel carrello</CButton>}
                  <CButton size='sm' color='link' className='text-danger' onClick={() => void segna(chiave, 'dopo', false)}>Rimuovi</CButton>
                </div>
              </div>;
            })}
          </div></div>
        </div>
        <section className='mt-4' aria-label='Ordini precedenti'>
          <h5>Ordini precedenti</h5>
          {!data.ordini.length && <p className='text-muted'>Non ci sono ancora ordini registrati. Le righe che segni come ordinate le ritrovi qui, pronte da riordinare.</p>}
          <div className='row g-2'>{data.ordini.slice(0, ordiniVisibili).map(order => <div key={order.id} className='col-12 col-md-6 col-xl-4'>
            <article className='border rounded p-3 h-100' aria-label={`Ordine ${order.id}`}>
              <div className='d-flex justify-content-between align-items-start gap-2'>
                <div><strong>{order.fornitore_nome}</strong><small className='d-block text-muted'>{formatDate(order.data_ordine)}</small></div>
                <CButton size='sm' color='primary' variant='outline' onClick={() => void riordina(order.id)}>Riordina</CButton>
              </div>
              <ul className='list-unstyled small text-muted mt-2 mb-0'>{order.righe.map(line => <li key={line.materiale_id} className='border-top py-1'>{line.nome} · {line.quantita}</li>)}</ul>
            </article>
          </div>)}</div>
          {data.ordini.length > ordiniVisibili && <CButton color='secondary' className='mt-3' onClick={() => setOrdiniVisibili(n => n + 10)}>Mostra altri ordini</CButton>}
        </section>
      </>}
      {tab === 'lista' && <>
        <div className='d-flex flex-wrap gap-2 mb-3'>
          <CButton color='secondary' disabled={disabled || !queue.some(p => !p.in_arrivo)} onClick={() => setSelected(queue.filter(p => !p.in_arrivo).map(p => p.materiale_id))}>Seleziona disponibili nei filtri</CButton>
          <CButton color='secondary' disabled={!selected.length || busy} onClick={() => setSelected([])}>Deseleziona</CButton>
          <CButton color='primary' disabled={disabled || !selectedPlans.length} onClick={() => setConfirmOrder(true)}>Registra ordine ({selectedPlans.length})</CButton>
          <CButton color='secondary' disabled={disabled || !queue.length} onClick={exportList}>Esporta lista CSV</CButton>
        </div>
        <p className='text-muted'>La lista include i materiali segnalati manualmente. Gli ordini registrati restano in attesa fino alla conferma di ricezione.</p>
        {[...new Set(queue.map(p => p.fornitore_id))].map(id => <section key={id} className='mb-4'>
          <h5>{queue.find(p => p.fornitore_id === id)?.fornitore_nome}</h5>
          <div className='table-responsive'><table className='table align-middle'><thead><tr><th>Seleziona</th><th>Materiale</th><th>Quantità</th><th>Note / stato</th><th>Azioni</th></tr></thead><tbody>
            {queue.filter(p => p.fornitore_id === id).map(p => <tr key={p.materiale_id}>
              <td><input type='checkbox' aria-label={`Seleziona ${p.nome}`} disabled={disabled || p.in_arrivo} checked={selectedPlans.some(item => item.materiale_id === p.materiale_id)} onChange={e => setSelected(current => e.target.checked ? [...current, p.materiale_id] : current.filter(i => i !== p.materiale_id))} /></td>
              <td>{p.nome}<div className='small text-muted'>{p.codice}</div></td><td>{p.quantita} {p.unita}</td>
              <td>{p.note}{!!p.terminato && <div className='text-danger'>Terminato</div>}{p.in_arrivo && <div>Già in attesa di ricezione</div>}</td>
              <td><div className='d-flex gap-2'><CButton size='sm' color='secondary' disabled={disabled} onClick={() => setDraft({ ...p })}>Modifica</CButton><CButton size='sm' color='secondary' disabled={disabled} onClick={() => void run(() => ordiniService.queue(p.materiale_id, 'rimuovi'), 'Rimosso dalla lista; segnalazione terminato cancellata')}>Rimuovi</CButton></div></td>
            </tr>)}
          </tbody></table></div>
        </section>)}
        {!loading && !queue.length && <div className='py-4'><h5>Nessun materiale da ordinare</h5><p>Apri “Materiali e frequenze”, configura i materiali e premi “Terminato” oppure “Da ordinare”.</p></div>}
      </>}
      {tab === 'storico' && <>
        {!loading && !data.ordini.length && <p>Non sono ancora stati registrati ordini.</p>}
        {data.ordini.map(order => <section key={order.id} className='border rounded p-3 mb-3'>
          <div className='d-flex flex-wrap justify-content-between gap-2'><h5>Ordine #{order.id} · {order.fornitore_nome}</h5><strong>{order.stato === 'ordinato' ? 'In attesa di ricezione' : order.stato === 'ricevuto' ? 'Ricevuto' : 'Annullato'}</strong></div>
          <p>Ordinato il {formatDate(order.data_ordine)}{order.data_ricezione && ` · Ricevuto il ${formatDate(order.data_ricezione)}`}</p>
          <ul>{order.righe.map(line => <li key={line.materiale_id}>{line.nome} {line.codice && `(${line.codice})`} — {line.quantita} {line.unita}{line.note && ` · ${line.note}`}</li>)}</ul>
          {order.stato === 'ordinato' && <div className='d-flex gap-2'><CButton color='success' disabled={disabled} onClick={() => void run(() => ordiniService.transition(order.id, 'ricevuto'), 'Ricezione completa registrata')}>Conferma ricezione completa</CButton><CButton color='secondary' disabled={disabled} onClick={() => setCancelId(order.id)}>Annulla ordine</CButton></div>}
        </section>)}
      </>}
    </PageLayout.ContentBody>
    <CModal visible={!!draft} onClose={() => { if (!busy) setDraft(null); }} size='lg'>
      <CModalHeader><CModalTitle>{draft?.nome}</CModalTitle></CModalHeader>
      {draft && <form onSubmit={e => { e.preventDefault(); void run(async () => { await ordiniService.save(draft); setDraft(null); }, 'Piano di acquisto salvato'); }}>
        <CModalBody><fieldset disabled={busy}>
          <label className='form-label'>Fornitore per gli ordini</label><FornitoriSelect value={draft.fornitore_id || null} disabled={busy} onChange={f => setDraft({ ...draft, fornitore_id: f?.id || '', fornitore_nome: f?.nome || '' })} />
          <div className='row g-3 mt-1'>
            <div className='col-md-6'><label htmlFor='order-quantity' className='form-label'>Quantità da ordinare</label><input id='order-quantity' type='number' min='0.001' max='1000000' step='any' required className='form-control' value={draft.quantita || ''} onChange={e => setDraft({ ...draft, quantita: Number(e.target.value) })} /></div>
            <div className='col-md-6'><label htmlFor='order-unit' className='form-label'>Unità (es. confezioni, pezzi)</label><input id='order-unit' required maxLength={50} className='form-control' value={draft.unita} onChange={e => setDraft({ ...draft, unita: e.target.value })} /></div>
            <div className='col-md-6'><label htmlFor='order-frequency' className='form-label'>Ogni quanti giorni (vuoto = al bisogno)</label><input id='order-frequency' type='number' min='1' max='3650' step='1' className='form-control' value={draft.frequenza_giorni ?? ''} onChange={e => setDraft({ ...draft, frequenza_giorni: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className='col-md-6'><label htmlFor='order-next' className='form-label'>Prossimo ordine previsto</label><input id='order-next' type='date' className='form-control' value={draft.prossimo_ordine || ''} onChange={e => setDraft({ ...draft, prossimo_ordine: e.target.value || null })} /></div>
            <div className='col-12'><label htmlFor='order-notes' className='form-label'>Note per l’acquisto</label><textarea id='order-notes' className='form-control' maxLength={2000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></div>
          </div>
        </fieldset></CModalBody>
        <CModalFooter><CButton color='secondary' disabled={busy} onClick={() => setDraft(null)}>Chiudi</CButton><CButton color='primary' type='submit' disabled={busy || !draft.fornitore_id}>{busy ? 'Salvataggio...' : 'Salva'}</CButton></CModalFooter>
      </form>}
    </CModal>
    <CModal visible={confirmOrder} onClose={() => { if (!busy) setConfirmOrder(false); }}>
      <CModalHeader><CModalTitle>Registra gli ordini effettuati</CModalTitle></CModalHeader>
      <CModalBody><p>Verrà registrato un ordine per ciascun fornitore selezionato. Questa operazione non invia messaggi ai fornitori.</p><ul>{selectedPlans.map(p => <li key={p.materiale_id}>{p.fornitore_nome}: {p.nome} — {p.quantita} {p.unita}</li>)}</ul></CModalBody>
      <CModalFooter><CButton color='secondary' disabled={busy} onClick={() => setConfirmOrder(false)}>Indietro</CButton><CButton color='primary' disabled={disabled || !selectedPlans.length} onClick={() => void run(async () => { await ordiniService.order(selectedPlans.map(p => p.materiale_id)); setSelected([]); setConfirmOrder(false); }, 'Ordini registrati')}>Conferma registrazione</CButton></CModalFooter>
    </CModal>
    <CModal visible={cancelId !== null} onClose={() => { if (!busy) setCancelId(null); }}>
      <CModalHeader><CModalTitle>Annulla ordine #{cancelId}</CModalTitle></CModalHeader>
      <CModalBody>I materiali torneranno nella lista da ordinare. L’annullamento verrà conservato nello storico; contatta separatamente il fornitore se necessario.</CModalBody>
      <CModalFooter><CButton color='secondary' disabled={busy} onClick={() => setCancelId(null)}>Indietro</CButton><CButton color='danger' disabled={disabled} onClick={() => void run(async () => { await ordiniService.transition(cancelId!, 'annullato'); setCancelId(null); }, 'Ordine annullato')}>Conferma annullamento</CButton></CModalFooter>
    </CModal>
    <CModal visible={checkoutRapido} onClose={() => setCheckoutRapido(false)} size='lg'>
      <CModalHeader><CModalTitle>Checkout</CModalTitle></CModalHeader>
      <CModalBody><p>“Ordina” stampa la lista, registra l’ordine nello storico e toglie dal carrello le righe spuntate; le altre restano. L’ordine non viene inviato ai fornitori.</p><div className='table-responsive'><table className='table'><thead><tr><th>Includi</th><th>Fornitore</th><th>Materiale</th><th>Codice</th><th>Quantità</th></tr></thead><tbody>{righeCarrello.map(line => <tr key={line.id}><td><input type='checkbox' aria-label={`Includi ${line.nome}`} checked={daOrdinare.includes(line.id)} onChange={e => setDaOrdinare(current => e.target.checked ? [...current, line.id] : current.filter(id => id !== line.id))} /></td><td>{line.fornitorenome}</td><td>{line.nome}</td><td>{line.codice || '—'}</td><td>{line.quantita}</td></tr>)}</tbody></table></div></CModalBody>
      <CModalFooter><CButton color='secondary' onClick={() => setCheckoutRapido(false)}>Continua ordine</CButton><CButton color='primary' disabled={busy || !daOrdinare.some(id => righeCarrello.some(line => line.id === id))} onClick={ordina}>Ordina</CButton></CModalFooter>
    </CModal>
    <CModal visible={svuotaCarrello} onClose={() => setSvuotaCarrello(false)}>
      <CModalHeader><CModalTitle>Svuota il carrello</CModalTitle></CModalHeader>
      <CModalBody>Il carrello è condiviso con tutto lo studio: verranno tolte tutte le righe, senza registrarle come ordinate.</CModalBody>
      <CModalFooter><CButton color='secondary' onClick={() => setSvuotaCarrello(false)}>Indietro</CButton><CButton color='danger' onClick={() => { setSvuotaCarrello(false); void aggiornaCarrello(() => ordiniService.carrelloRimuovi()); }}>Svuota tutto</CButton></CModalFooter>
    </CModal>
  </PageLayout>;
}
