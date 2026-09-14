import { useCallback, useEffect, useMemo, useState } from 'react';
import { CButton, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import PageLayout from '@/components/layout/PageLayout';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import { useMateriali } from '@/store/materiali.store';
import { useFornitoriStore } from '@/store/fornitori.store';
import type { Materiale } from '@/store/materiali.store';
import { ordiniService, type OrdiniData, type PianoAcquisto } from '../services/ordini.service';

const formatDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('it-IT') : '—';
type CarrelloRapido = { materiale: Materiale; quantita: number };

export default function OrdiniPage() {
  const { materiali, load, isLoading: materialsLoading, error: materialsError } = useMateriali();
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
  const [carrelloRapido, setCarrelloRapido] = useState<Record<number, CarrelloRapido>>({});
  const [ricercaRapida, setRicercaRapida] = useState('');
  const [letteraRapida, setLetteraRapida] = useState('');
  const fornitoriMap = useFornitoriStore(state => state.fornitoriMap);
  const loadAllFornitori = useFornitoriStore(state => state.loadAllFornitori);
  useEffect(() => { void loadAllFornitori(); }, [loadAllFornitori]);
  const [checkoutRapido, setCheckoutRapido] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await ordiniService.load()); setError(''); }
    catch { setError('Impossibile caricare gli ordini. Riprova con Aggiorna.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); void load(); }, [refresh, load]);

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
  const availableMaterials = useMemo(() => materiali.filter(m => !data.piani.some(p => p.materiale_id === m.id)), [materiali, data.piani]);
  const materialiRapidi = useMemo(() => {
    const grouped = new Map<string, Materiale[]>();
    materiali.filter(m =>
      m.confermato === 1 &&
      m.contonome?.trim().toLocaleUpperCase() === 'MATERIALI' &&
      m.brancanome?.trim().toLocaleUpperCase() !== 'SPESE' &&
      Boolean(m.nome.trim() && m.fornitorenome?.trim())
    ).forEach(m => {
      const key = m.nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');
      const materiale = { ...m, fornitorenome: fornitoriMap[m.fornitoreid]?.nome || m.fornitorenome.trim() };
      grouped.set(key, [...(grouped.get(key) || []), materiale]);
    });
    return [...grouped.entries()].map(([key, righe]) => {
      righe.sort((a, b) => (b.data_fattura || '').localeCompare(a.data_fattura || '') || b.id - a.id);
      // Una fattura dello stesso fornitore rappresenta un acquisto, anche con più righe.
      const visti = new Set<string>();
      const acquisti = righe.filter(m => {
        if (!m.data_fattura) return false;
        const id = m.fattura_id ? `${m.fornitoreid}|${m.fattura_id}` : `riga:${m.id}`;
        if (visti.has(id)) return false;
        visti.add(id);
        return true;
      }).slice(0, 3);
      return { key, materiale: righe[0], righe, acquisti };
    }).sort((a, b) => a.key.localeCompare(b.key, 'it'));
  }, [materiali, fornitoriMap]);
  const iniziale = (nome: string) => {
    const lettera = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
    return /^[A-Z]$/.test(lettera) ? lettera : '#';
  };
  const materialiRapidiFiltrati = materialiRapidi.filter(prodotto =>
    (!letteraRapida || iniziale(prodotto.key) === letteraRapida) &&
    prodotto.righe.some(m => `${m.nome} ${m.codicearticolo || ''} ${m.fornitorenome}`.toLocaleLowerCase().includes(ricercaRapida.trim().toLocaleLowerCase()))
  );
  const righeCarrello = Object.values(carrelloRapido).map(line => ({ ...line,
    materiale: { ...line.materiale, fornitorenome: fornitoriMap[line.materiale.fornitoreid]?.nome || line.materiale.fornitorenome },
  })).sort((a, b) => a.materiale.fornitorenome.localeCompare(b.materiale.fornitorenome, 'it') || a.materiale.nome.localeCompare(b.materiale.nome, 'it'));
  const prezzo = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'Prezzo non disponibile' : value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

  function chooseMaterial(id: number) {
    const m = materiali.find(item => item.id === id);
    if (m) setDraft({ materiale_id: m.id, nome: m.nome, codice: m.codicearticolo,
      fornitore_id: m.fornitoreid || '', fornitore_nome: m.fornitorenome || '', quantita: 1,
      unita: 'confezioni', frequenza_giorni: null, prossimo_ordine: null, note: '',
      da_ordinare: 0, terminato: 0, in_arrivo: false, scaduto: false });
  }

  function aggiungiRapido(materiale: Materiale) {
    setCarrelloRapido(current => {
      const nome = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');
      const existing = Object.values(current).find(line =>
        line.materiale.fornitoreid === materiale.fornitoreid && nome(line.materiale.nome) === nome(materiale.nome));
      const id = existing?.materiale.id ?? materiale.id;
      return { ...current, [id]: { materiale: existing?.materiale ?? materiale, quantita: (existing?.quantita || 0) + 1 } };
    });
  }

  function cambiaQuantitaRapida(id: number, value: number) {
    setCarrelloRapido(current => {
      if (!current[id] || !Number.isFinite(value) || value <= 0) {
        const { [id]: _, ...remaining } = current;
        return remaining;
      }
      return { ...current, [id]: { ...current[id], quantita: value } };
    });
  }

  function stampaCarrelloRapido() {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) { toast.error('Il browser ha bloccato la finestra di stampa. Consenti i popup e riprova.'); return; }
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
    const groups = new Map<string, CarrelloRapido[]>();
    righeCarrello.forEach(line => groups.set(line.materiale.fornitoreid || line.materiale.fornitorenome, [...(groups.get(line.materiale.fornitoreid || line.materiale.fornitorenome) || []), line]));
    const sections = [...groups.entries()].map(([, lines]) => `<section><h2>${escape(lines[0].materiale.fornitorenome)}</h2><table><thead><tr><th>Materiale</th><th>Codice</th><th>Quantità</th></tr></thead><tbody>${lines.map(line => `<tr><td>${escape(line.materiale.nome)}</td><td>${escape(line.materiale.codicearticolo || '—')}</td><td>${escape(line.quantita)}</td></tr>`).join('')}</tbody></table></section>`).join('');
    popup.document.write(`<!doctype html><html lang="it"><head><title>Lista ordine materiali</title><style>body{font:14px Arial;margin:28px;color:#111}h1{margin-bottom:4px}h2{margin-top:28px;font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:8px;text-align:left}th{background:#eee}@media print{body{margin:12mm}}</style></head><body><h1>Lista ordine materiali</h1><p>Preparata il ${escape(new Date().toLocaleDateString('it-IT'))}</p>${sections}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
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
    <PageLayout.Header title='Ordini materiali' headerAction={<CButton color='primary' disabled={busy || loading} onClick={() => void refresh()}>Aggiorna</CButton>} />
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
            {materialsError && <div className='alert alert-danger' role='alert'>{materialsError}</div>}
            <div className='d-flex flex-wrap gap-2 mb-3' role='group' aria-label='Filtra materiali per iniziale'>
              <CButton size='sm' color={!letteraRapida ? 'primary' : 'secondary'} onClick={() => setLetteraRapida('')}>Tutti</CButton>
              {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map(lettera => <CButton key={lettera} size='sm' aria-pressed={letteraRapida === lettera} color={letteraRapida === lettera ? 'primary' : 'secondary'} onClick={() => setLetteraRapida(lettera)}>{lettera}</CButton>)}
            </div>
            <div className='border rounded p-3 mb-3'>
              <label htmlFor='quick-order-search' className='form-label'>Cerca fra tutti i materiali</label>
              <input id='quick-order-search' className='form-control' autoFocus value={ricercaRapida} onChange={e => setRicercaRapida(e.target.value)} placeholder='Nome commerciale, codice o fornitore' />
            </div>
            <div className='row g-2'>
              {materialiRapidiFiltrati.map(({ key, materiale, acquisti }) => <div key={key} className='col-12 col-md-6 col-xl-4'>
                <article className='border rounded p-3 h-100' aria-label={materiale.nome}>
                  <strong className='d-block mb-2'>{materiale.nome}</strong>
                  <small className='d-block text-muted mb-2'>Ultimi acquisti · prezzo unitario</small>
                  {acquisti.length ? <ul className='list-unstyled mb-2'>{acquisti.map(acquisto => <li key={acquisto.id} className='border-top py-1 small' style={{ overflowWrap: 'anywhere' }}>
                    <strong>{acquisto.fornitorenome}</strong>{' · '}
                    <span>{formatDate(acquisto.data_fattura!)} · {prezzo(acquisto.costo_unitario)}</span>
                  </li>)}</ul> : <p className='small text-muted'>Nessun acquisto datato disponibile.</p>}
                </article>
              </div>)}
            </div>
            {!materialsLoading && !materialiRapidiFiltrati.length && <p>Nessun materiale corrispondente.</p>}
          </div>
          <div className='col-lg-4'><div className='border rounded p-3 bg-light sticky-lg-top'>
            <h5>Carrello ({righeCarrello.length})</h5>
            {!righeCarrello.length && <p className='text-muted mb-0'>Seleziona i materiali da ordinare.</p>}
            {righeCarrello.map(line => <div key={line.materiale.id} className='border-top py-2'>
              <strong className='d-block'>{line.materiale.nome}</strong><small className='d-block text-muted'>{line.materiale.codicearticolo || 'senza codice'} · {line.materiale.fornitorenome}</small>
              <div className='d-flex align-items-center gap-2 mt-2'><CButton size='sm' color='secondary' onClick={() => cambiaQuantitaRapida(line.materiale.id, line.quantita - 1)}>−</CButton><input aria-label={`Quantità ${line.materiale.nome}`} className='form-control form-control-sm' style={{ width: '76px' }} type='number' min='0.001' step='1' value={line.quantita} onChange={e => cambiaQuantitaRapida(line.materiale.id, Number(e.target.value))} /><CButton size='sm' color='secondary' onClick={() => aggiungiRapido(line.materiale)}>+</CButton><CButton size='sm' color='link' className='text-danger' onClick={() => cambiaQuantitaRapida(line.materiale.id, 0)}>Rimuovi</CButton></div>
            </div>)}
            {!!righeCarrello.length && <div className='d-flex flex-wrap gap-2 mt-3'><CButton color='primary' onClick={() => setCheckoutRapido(true)}>Rivedi e stampa</CButton><CButton color='secondary' onClick={() => setCarrelloRapido({})}>Svuota</CButton></div>}
          </div></div>
        </div>
      </>}
      {tab === 'piani' && <>
        <label htmlFor='add-order-material' className='form-label'>Aggiungi un materiale dall’anagrafica</label>
        <Select
          inputId='add-order-material'
          className='mb-3'
          value={null}
          isSearchable
          isDisabled={disabled || materialsLoading}
          isLoading={materialsLoading}
          placeholder='Scrivi nome, codice o fornitore...'
          noOptionsMessage={() => 'Nessun materiale trovato'}
          loadingMessage={() => 'Caricamento materiali...'}
          options={availableMaterials.map(m => ({ value: m.id, label: `${m.nome} · ${m.codicearticolo || 'senza codice'} · ${m.fornitorenome}` }))}
          onChange={option => { if (option) chooseMaterial(option.value); }}
        />
        {materialsError && <div className='alert alert-danger' role='alert'>{materialsError} <CButton onClick={() => void load(true)}>Riprova</CButton></div>}
        <p className='text-muted'>La frequenza è espressa in giorni e decorre dall’ultimo ordine registrato. La data prevista segnala cosa verificare; aggiungi alla lista solo ciò che serve.</p>
        <div className='table-responsive'><table className='table align-middle'><thead><tr><th>Materiale / fornitore</th><th>Quantità abituale</th><th>Frequenza</th><th>Prossimo ordine</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>
          {visiblePlans.map(p => <tr key={p.materiale_id}>
            <td><strong>{p.nome}</strong><div className='small text-muted'>{p.codice} · {p.fornitore_nome}</div></td>
            <td>{p.quantita} {p.unita}</td><td>{p.frequenza_giorni ? `Ogni ${p.frequenza_giorni} giorni` : 'Al bisogno'}</td>
            <td>{formatDate(p.prossimo_ordine)}{p.scaduto && <div className='text-warning'>Da verificare</div>}</td>
            <td>{p.in_arrivo ? 'In attesa di ricezione' : p.da_ordinare ? 'In lista' : 'Disponibile'}{!!p.terminato && <div className='text-danger'>Terminato</div>}</td>
            <td><div className='d-flex flex-wrap gap-2'>
              <CButton size='sm' color='secondary' disabled={disabled} onClick={() => setDraft({ ...p })}>Modifica</CButton>
              <CButton size='sm' color='danger' variant='outline' disabled={disabled || !!p.terminato} onClick={() => void run(() => ordiniService.queue(p.materiale_id, 'terminato'), 'Materiale segnato come terminato e aggiunto alla lista')}>Terminato</CButton>
              <CButton size='sm' color='primary' variant='outline' disabled={disabled || !!p.da_ordinare || p.in_arrivo} onClick={() => void run(() => ordiniService.queue(p.materiale_id, 'aggiungi'), 'Aggiunto alla lista')}>Da ordinare</CButton>
            </div></td>
          </tr>)}
        </tbody></table></div>
        {!loading && !visiblePlans.length && <p>Nessun materiale configurato per questi filtri. Seleziona un materiale dall’anagrafica per iniziare.</p>}
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
      <CModalHeader><CModalTitle>Controlla la lista prima della stampa</CModalTitle></CModalHeader>
      <CModalBody><p>La stampa non invia l’ordine e non modifica il magazzino. È una lista da verificare con fornitore, codice e quantità.</p><div className='table-responsive'><table className='table'><thead><tr><th>Fornitore</th><th>Materiale</th><th>Codice</th><th>Quantità</th></tr></thead><tbody>{righeCarrello.map(line => <tr key={line.materiale.id}><td>{line.materiale.fornitorenome}</td><td>{line.materiale.nome}</td><td>{line.materiale.codicearticolo || '—'}</td><td>{line.quantita}</td></tr>)}</tbody></table></div></CModalBody>
      <CModalFooter><CButton color='secondary' onClick={() => setCheckoutRapido(false)}>Torna al carrello</CButton><CButton color='primary' disabled={!righeCarrello.length} onClick={stampaCarrelloRapido}>Stampa lista</CButton></CModalFooter>
    </CModal>
  </PageLayout>;
}
