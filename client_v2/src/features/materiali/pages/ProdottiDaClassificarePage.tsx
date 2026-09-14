import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CButton } from '@coreui/react';
import api from '@/services/api/client';
import PageLayout from '@/components/layout/PageLayout';
import ContiSelect from '@/components/selects/ContiSelect';
import BrancheSelect from '@/components/selects/BrancheSelect';
import SottocontiSelect from '@/components/selects/SottocontiSelect';

interface Classification {
  contoid: number | null; brancaid: number | null; sottocontoid: number | null;
  contonome?: string; brancanome?: string; sottocontonome?: string; fonte_classificazione?: string; riferimento?: string;
}
interface Product {
  id: string; descrizione: string; codice: string; fornitore_nome: string; partita_iva: string;
  ultimo_acquisto: string; costo_unitario: string; unita: string; occorrenze: number;
  destinazione: string; pronto: boolean; revision: string; stato: string; motivo: string; tipo_riga: string; proposta: Classification | null; fatture: string[];
}
const endpoint = '/materiali/da-classificare';
const labels: Record<string, string> = { nuovo: 'Nuovo', presente: 'Già presente', da_verificare: 'Da verificare', escluso: 'Escluso', elaborato: 'Altra voce confermata' };
const destinations: Record<string, string> = { automatico: 'Automatica dalla categoria (mantieni le destinazioni se non cambi categoria)', materiale: 'Materiale', altra_voce: 'Altra voce', da_decidere: 'Da decidere' };
const pending = (p: Product) => ['nuovo', 'da_verificare'].includes(p.stato);
const kinds: Record<string, string> = { materiale_candidato: 'Possibile materiale', da_revisionare: 'Natura da verificare', costo_accessorio: 'Possibile costo accessorio', servizio_o_utenza: 'Possibile servizio o utenza' };
const sources: Record<string, string> = {
  correzione_manuale: 'Tua correzione', materiale_simile: 'Prodotto simile: verificare',
  materiale_storico_esatto: 'Stessa descrizione e fornitore', materiale_storico_descrizione: 'Stessa descrizione nello storico',
  fornitore_storico_esatto: 'Categoria del fornitore: verificare il prodotto', fornitore_storico_variante: 'Fornitore simile: verificare il prodotto',
};
const errorMessage = (e: unknown) => {
  const error = e as { response?: { data?: { error?: string } }; message?: string };
  return error.response?.data?.error || error.message || 'Operazione non riuscita';
};

export default function ProdottiDaClassificarePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fileErrors, setFileErrors] = useState<Array<{ file: string; errore: string }>>([]);
  const [destination, setDestination] = useState('da_decidere');
  const [destinationChanged, setDestinationChanged] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [categoryChanged, setCategoryChanged] = useState(false);
  const [classification, setClassification] = useState<Classification>({ contoid: null, brancaid: null, sottocontoid: null });
  const refresh = async () => {
    const response = await api.get(endpoint, { timeout: 120000 });
    if (!response.data.success) throw new Error(response.data.error);
    setProducts(response.data.data.prodotti); setSelected([]); setDirty(false); setCategoryChanged(false);
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  useEffect(() => { void run(refresh); }, []);
  const visible = useMemo(() => products.filter(p => (!status || (status === 'pending' ? pending(p) : p.stato === status)) &&
    `${p.descrizione} ${p.codice} ${p.fornitore_nome} ${p.partita_iva}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [products, status, query]);
  const chosen = products.filter(p => selected.includes(p.id));
  const ready = visible.filter(p => p.pronto);
  const materialCount = ready.filter(p => p.destinazione === 'materiale').length;
  const scan = () => void run(async () => {
    setFileErrors([]);
    const response = await api.post(`${endpoint}/email`, {}, { timeout: 120000 });
    if (!response.data.success) throw new Error(response.data.error);
    const result = response.data.data;
    setFileErrors(result.errori);
    await refresh();
    setMessage(`${result.file_trovati} XML trovati: ${result.file_letti} letti, ${result.file_invariati} invariati. ${result.righe_aggiunte} righe aggiunte alla revisione.`);
  });
  const correct = (p: Product) => {
    selectIds(selected.includes(p.id) ? selected : [p.id]);
    document.getElementById('review-editor')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };
  const save = () => void run(async () => {
    const savedIds = [...selected];
    const response = await api.post(`${endpoint}/revisione`, { ids: savedIds, destinazione: categoryChanged && !destinationChanged ? 'automatico' : destination,
      ...(categoryChanged ? { classificazione: classification } : {}) });
    if (!response.data.success) throw new Error(response.data.error);
    await refresh();
    setSelected(savedIds); setDestinationChanged(false);
    setMessage(`Correzioni salvate per ${savedIds.length} voci. La selezione è mantenuta: premi Conferma selezionate per completare.`);
  });
  const confirm = (items: Product[]) => void run(async () => {
    const response = await api.post(`${endpoint}/conferma-proposte`, {
      voci: items.map(p => ({ id: p.id, revision: p.revision })),
    }, { timeout: 120000 });
    if (!response.data.success) throw new Error(response.data.error);
    const result = response.data.data;
    await refresh();
    setMessage(`${result.inseriti} materiali inseriti, ${result.altre_voci} altre voci confermate, ${result.gia_presenti} materiali già presenti. ${result.da_rivedere.length} voci rimaste da verificare.`);
  });
  const reset = () => { setSelected([]); setDirty(false); setCategoryChanged(false); setDestinationChanged(false); setDestination('automatico'); setClassification({ contoid: null, brancaid: null, sottocontoid: null }); };
  const selectIds = (ids: string[]) => {
    const rows = products.filter(p => ids.includes(p.id));
    setSelected(ids); setDirty(false); setCategoryChanged(false); setDestinationChanged(false);
    setClassification(rows.length > 0 && rows[0].proposta && rows.every(p => ['contoid', 'brancaid', 'sottocontoid'].every(k => p.proposta?.[k as keyof Classification] === rows[0].proposta?.[k as keyof Classification])) ? rows[0].proposta : { contoid: null, brancaid: null, sottocontoid: null });
    setDestination(rows.length && rows.every(p => p.destinazione === rows[0].destinazione) ? rows[0].destinazione : 'automatico');
  };
  const changeCategory = (value: Classification) => { setClassification(value); if (!destinationChanged) setDestination('automatico'); setDirty(true); setCategoryChanged(true); };
  return <PageLayout>
    <PageLayout.Header title='Prodotti da classificare' headerAction={<Link to='/materiali' className='btn btn-outline-primary'>Materiali</Link>} />
    <div className='p-3'>
      <p>Controlla le voci delle fatture scaricate dalle email e correggi soltanto le proposte sbagliate. Nessun file da scegliere.</p>
      <CButton color='primary' disabled={busy || dirty} onClick={scan}>Aggiorna dalle fatture email</CButton>
      <p className='text-muted mt-2'>Legge la cartella delle fatture XML email. La conferma inserisce i materiali e conserva le altre voci tra quelle elaborate.</p>
      {error && <div role='alert' className='alert alert-danger'>{error}</div>}
      {message && <div role='status' className='alert alert-success'>{message}</div>}
      {fileErrors.length > 0 && <div role='alert' className='alert alert-warning'>File non caricati:<ul>{fileErrors.map((e, i) => <li key={i}>{e.file}: {e.errore}</li>)}</ul></div>}
      <div className='d-flex flex-wrap gap-2 mb-3'>
        <select aria-label='Stato prodotti' className='form-select w-auto' value={status} disabled={busy || dirty} onChange={e => { setStatus(e.target.value); reset(); }}>
          <option value='pending'>Da controllare ({products.filter(pending).length})</option>
          <option value=''>Tutti ({products.length})</option>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label} ({products.filter(p => p.stato === value).length})</option>)}
        </select>
        <input aria-label='Cerca prodotti o fornitori' placeholder='Cerca prodotto, codice o fornitore' className='form-control w-auto' value={query} disabled={busy || dirty} onChange={e => { setQuery(e.target.value); reset(); }} />
        <CButton color='secondary' disabled={busy || dirty} onClick={() => void run(refresh)}>Ricarica elenco</CButton>
      </div>
      <div className='border rounded p-3 mb-3'>
        <CButton color='success' disabled={busy || dirty || !ready.length || ready.length > 5000} onClick={() => confirm(ready)}>Conferma tutto: {materialCount} materiali · {ready.length - materialCount} altre voci</CButton>
        <p className='mb-0 mt-2'>Conferma le proposte complete visibili con i filtri attuali. {visible.filter(p => pending(p) && !p.pronto).length} voci incomplete o ambigue rimarranno da correggere. Le altre voci non vengono inserite nei materiali.</p>
        {ready.length > 5000 && <p>Restringi la ricerca: massimo 5000 voci per conferma.</p>}
      </div>
      <fieldset id='review-editor' disabled={busy} className='border rounded p-3 mb-3'>
        <legend className='fs-6'>Correggi {selected.length} voci selezionate</legend>
        <label className='form-label' htmlFor='review-destination'>Destinazione</label>
        <select id='review-destination' className='form-select mb-2' value={destination} onChange={e => { setDestination(e.target.value); setDestinationChanged(true); setDirty(true); }}>{Object.entries(destinations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <div className='row g-2 mb-2'>
          <div className='col-md-4'><label className='form-label'>Conto</label><ContiSelect value={classification.contoid} onChange={contoid => changeCategory({ contoid, brancaid: null, sottocontoid: null })} /></div>
          <div className='col-md-4'><label className='form-label'>Branca</label><BrancheSelect contoId={classification.contoid} value={classification.brancaid} onChange={brancaid => changeCategory({ ...classification, brancaid, sottocontoid: null })} /></div>
          <div className='col-md-4'><label className='form-label'>Sottoconto</label><SottocontiSelect brancaId={classification.brancaid} value={classification.sottocontoid} onChange={sottocontoid => changeCategory({ ...classification, sottocontoid })} /></div>
        </div>
        <div className='d-flex flex-wrap gap-2'>
          <CButton color='primary' disabled={busy || !chosen.length || chosen.some(p => p.stato === 'presente') || (categoryChanged && !classification.sottocontoid)} onClick={save}>Salva correzioni</CButton>
          <CButton color='primary' variant='outline' disabled={busy || dirty || !chosen.length || chosen.some(p => !p.pronto)} onClick={() => confirm(chosen)}>Conferma selezionate</CButton>
          <CButton color='secondary' variant='outline' disabled={busy} onClick={reset}>Annulla modifiche non salvate</CButton>
        </div>
        <small>Le correzioni si applicano alle voci selezionate. Cambiando categoria, la destinazione viene ricavata automaticamente salvo una tua scelta esplicita. Il salvataggio mantiene selezionate le voci per la conferma finale.</small>
        {dirty && <p className='text-warning mb-0'>Salva o annulla le modifiche prima di confermare le proposte.</p>}
      </fieldset>
      {busy && <p role='status'>Elaborazione in corso…</p>}
      <div className='table-responsive'><table className='table table-hover align-middle'>
        <thead><tr><th><input type='checkbox' aria-label='Seleziona prodotti visibili' disabled={busy || dirty || !visible.length} checked={visible.some(p => p.stato !== 'presente') && visible.filter(p => p.stato !== 'presente').every(p => selected.includes(p.id))} onChange={e => selectIds(e.target.checked ? visible.filter(p => p.stato !== 'presente').slice(0, 5000).map(p => p.id) : [])} /></th><th>Prodotto</th><th>Fornitore</th><th>Ultimo acquisto</th><th>Categoria proposta</th><th>Destinazione</th><th>Revisione</th></tr></thead>
        <tbody>{visible.map(p => <tr key={p.id}>
          <td><input type='checkbox' aria-label={`Seleziona ${p.descrizione}`} disabled={busy || dirty || p.stato === 'presente'} checked={selected.includes(p.id)} onChange={e => selectIds(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /></td>
          <td>{p.descrizione}<small className='d-block text-muted'>{p.codice || 'Senza codice'} · {p.unita || 'Unità non indicata'}</small><small>{kinds[p.tipo_riga] || p.tipo_riga}</small></td>
          <td>{p.fornitore_nome}<small className='d-block text-muted'>P. IVA {p.partita_iva}</small></td>
          <td>{p.ultimo_acquisto}<small className='d-block'>Prezzo lordo unitario: {p.costo_unitario}</small><details><summary>{p.occorrenze} righe in {p.fatture.length} fatture</summary>{p.fatture.map(f => <div key={f}>{f.replace(/^xml:/, '').split(':').join(' · ')}</div>)}</details></td>
          <td>{p.proposta ? <>{[p.proposta.contonome, p.proposta.brancanome, p.proposta.sottocontonome].filter(Boolean).join(' / ')}<small className='d-block text-muted'>{sources[p.proposta.fonte_classificazione || ''] || p.proposta.fonte_classificazione}</small>{p.proposta.riferimento && <small className='d-block'>Riferimento: {p.proposta.riferimento}</small>}</> : 'Da assegnare'}</td>
          <td>{destinations[p.destinazione]}</td>
          <td>{pending(p) ? p.pronto ? 'Proposta pronta' : 'Da completare' : labels[p.stato]}{p.motivo && <small className='d-block text-danger'>{p.motivo}. Verifica l’anagrafica o i materiali esistenti e aggiorna.</small>}{p.stato !== 'presente' && <CButton size='sm' color='secondary' variant='outline' disabled={busy || dirty} aria-label={`Correggi ${p.descrizione}`} onClick={() => correct(p)}>Correggi</CButton>}</td>
        </tr>)}</tbody>
      </table></div>
      {!busy && !visible.length && <p>Nessuna voce in questa vista. Premi “Aggiorna dalle fatture email” o cambia il filtro.</p>}
    </div>
  </PageLayout>;
}
