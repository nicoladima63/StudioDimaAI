import { useId, useMemo, useState } from 'react';
import type { Materiale } from '@/store/materiali.store';
import { ricercaMateriali, type CampoRicerca, type FiltriRicercaMateriali } from '../services/ricerca-materiali';

export type Riga = Omit<Materiale, 'id' | 'costo_unitario' | 'confidence' | 'categoria_contabile'> & { id: string | number; costo_unitario: number | null; tipo_di_costo?: number | null; unita_acquisto?: string; imponibile_riga?: number; totale_documento?: number | null; fonte?: string; numero_documento?: string; proposta_token?: string | null; proposta_classificazione?: { contonome?: string; brancanome?: string; sottocontonome?: string } | null };
interface Props {
  materiali: readonly Riga[];
  fornitoriMaterialiIds?: readonly string[];
  onConferma?: (riga: Riga) => Promise<void>;
  fornitori?: Readonly<Record<string, { nome: string }>>;
}

/** Componente riutilizzabile: riceve i dati e gestisce ricerca, filtri e risultati. */
export default function RicercaMateriali({ materiali: tuttiMateriali, fornitori = {}, onConferma, fornitoriMaterialiIds }: Props) {
  const id = useId();
  const [ambito, setAmbito] = useState('materiali');
  const materiali = useMemo(() => fornitoriMaterialiIds !== undefined && ambito === 'materiali'
    ? tuttiMateriali.filter(m => fornitoriMaterialiIds.includes(m.fornitoreid)) : tuttiMateriali, [tuttiMateriali, fornitoriMaterialiIds, ambito]);
  const [salvataggio, setSalvataggio] = useState<string | number | null>(null);
  const [erroreConferma, setErroreConferma] = useState('');
  async function conferma(riga: Riga) {
    if (!onConferma || salvataggio !== null) return;
    setSalvataggio(riga.id); setErroreConferma('');
    try { await onConferma(riga); }
    catch (error) { setErroreConferma(error instanceof Error ? error.message : 'Conferma non riuscita. Riprova.'); }
    finally { setSalvataggio(null); }
  }
  const [filtri, setFiltri] = useState<FiltriRicercaMateriali>({});
  const [anno, setAnno] = useState('');
  const [vista, setVista] = useState('righe');
  const [limite, setLimite] = useState(100);
  const risultati = useMemo(() => ricercaMateriali(materiali, filtri, { fornitori }).filter(m => !anno || m.data_fattura?.startsWith(anno)), [materiali, filtri, fornitori, anno]);
  const annuali = useMemo(() => {
    const gruppi = new Map<string, { riga: Riga; anno: string; quantita: number; importo: number; righe: number }>();
    risultati.forEach(r => {
      const annoRiga = r.data_fattura?.slice(0, 4) || 'Senza data';
      const key = JSON.stringify([annoRiga, r.nome.trim().toLocaleLowerCase(), r.fornitoreid, r.codicearticolo, r.unita_acquisto || '', r.contoid, r.brancaid, r.sottocontoid]);
      const g = gruppi.get(key) || { riga: r, anno: annoRiga, quantita: 0, importo: 0, righe: 0 };
      g.quantita += r.quantita || 0; g.importo += r.imponibile_riga ?? 0; g.righe += 1; gruppi.set(key, g);
    });
    return [...gruppi.entries()].sort((a, b) => b[1].anno.localeCompare(a[1].anno) || a[1].riga.nome.localeCompare(b[1].riga.nome));
  }, [risultati]);
  const categorie = useMemo(() => {
    const gruppi = new Map<string, { anno: string; categoria: string; totale: number }>();
    risultati.forEach(r => {
      const anno = r.data_fattura?.slice(0, 4) || 'Senza data';
      const categoria = [r.contonome, r.brancanome, r.sottocontonome].filter(Boolean).join(' / ') || 'Da classificare';
      const key = JSON.stringify([anno, r.contoid, r.brancaid, r.sottocontoid]);
      const g = gruppi.get(key) || { anno, categoria, totale: 0 };
      g.totale += r.imponibile_riga ?? 0; gruppi.set(key, g);
    });
    return [...gruppi.entries()].sort((a, b) => b[1].anno.localeCompare(a[1].anno) || a[1].categoria.localeCompare(b[1].categoria));
  }, [risultati]);
  const opzioni = (campo: 'contoid' | 'brancaid' | 'sottocontoid', nome: 'contonome' | 'brancanome' | 'sottocontonome') =>
    [...new Map(materiali.filter(m => m[campo] != null).map(m => [m[campo]!, m[nome] || String(m[campo])])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  const suppliers = [...new Map(materiali.filter(m => m.fornitoreid).map(m => [m.fornitoreid, fornitori[m.fornitoreid]?.nome || m.fornitorenome])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  const costoDisponibile = materiali.some(m => [1, 2, 3].includes(m.tipo_di_costo ?? 0));
  return <div>
    {erroreConferma && <p role='alert' className='text-danger'>{erroreConferma}</p>}
    {fornitoriMaterialiIds !== undefined && <div className='mb-3'><label htmlFor={`${id}-ambito`} className='form-label'>Fornitori da includere</label><select id={`${id}-ambito`} className='form-select' value={ambito} onChange={e => { setAmbito(e.target.value); setFiltri({}); setAnno(''); setLimite(100); }}><option value='materiali'>Venditori di materiali</option><option value='tutti'>Tutti i fornitori</option></select></div>}
    <div className='row g-3 mb-3'>
      <div className='col-md-8'><label htmlFor={`${id}-testo`} className='form-label'>Cerca materiali</label><input id={`${id}-testo`} className='form-control' placeholder='Es. arom' value={filtri.testo || ''} onChange={e => setFiltri({ ...filtri, testo: e.target.value })} /></div>
      <div className='col-md-4'><label htmlFor={`${id}-campo`} className='form-label'>Cerca in</label><select id={`${id}-campo`} className='form-select' value={filtri.campi?.[0] || ''} onChange={e => setFiltri({ ...filtri, campi: e.target.value ? [e.target.value as CampoRicerca] : undefined })}><option value=''>Nome, codice e fornitore</option><option value='nome'>Solo nome prodotto</option><option value='codicearticolo'>Solo codice articolo</option><option value='fornitorenome'>Solo nome fornitore</option></select></div>
      <div className='col-md-4'><label htmlFor={`${id}-fornitore`} className='form-label'>Fornitore</label><select id={`${id}-fornitore`} className='form-select' value={filtri.fornitoriId?.[0] || ''} onChange={e => setFiltri({ ...filtri, fornitoriId: e.target.value ? [e.target.value] : undefined })}><option value=''>Tutti</option>{suppliers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {([
        ['contiId', 'contoid', 'contonome', 'Conto'],
        ['brancheId', 'brancaid', 'brancanome', 'Branca'],
        ['sottocontiId', 'sottocontoid', 'sottocontonome', 'Sottoconto'],
      ] as const).map(([filtro, campo, nome, label]) => <div className='col-md-4' key={filtro}><label htmlFor={`${id}-${filtro}`} className='form-label'>{label}</label><select id={`${id}-${filtro}`} className='form-select' value={filtri[filtro]?.[0] ?? ''} onChange={e => setFiltri({ ...filtri, [filtro]: e.target.value ? [Number(e.target.value)] : undefined })}><option value=''>Tutti</option>{opzioni(campo, nome).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>)}
      <div className='col-md-4'><label htmlFor={`${id}-conferma`} className='form-label'>Conferma</label><select id={`${id}-conferma`} className='form-select' value={filtri.confermato === undefined ? '' : String(filtri.confermato)} onChange={e => setFiltri({ ...filtri, confermato: e.target.value === '' ? undefined : e.target.value === 'true' })}><option value=''>Tutti</option><option value='true'>Confermati</option><option value='false'>Non confermati</option></select></div>
      <div className='col-md-4'><label htmlFor={`${id}-iniziale`} className='form-label'>Iniziale prodotto</label><select id={`${id}-iniziale`} className='form-select' value={filtri.iniziale || ''} onChange={e => setFiltri({ ...filtri, iniziale: e.target.value })}><option value=''>Tutte</option>{[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map(l => <option key={l}>{l}</option>)}</select></div>
    </div>
    <fieldset className='mb-3' disabled={!costoDisponibile}><legend className='fs-6'>Tipo di costo</legend>{([1, 2, 3] as const).map(tipo => <label key={tipo} className='me-3'><input type='checkbox' className='form-check-input me-1' checked={filtri.tipiCosto?.includes(tipo) || false} onChange={e => setFiltri({ ...filtri, tipiCosto: e.target.checked ? [...(filtri.tipiCosto || []), tipo] : filtri.tipiCosto?.filter(t => t !== tipo) })} />Tipo {tipo}</label>)}</fieldset>
    {!costoDisponibile && <p className='small text-muted'>Il tipo di costo non è disponibile nei materiali caricati. Puoi filtrare per conto, branca e sottoconto.</p>}
    <div className='row g-3 mb-3'><div className='col-md-4'><label htmlFor={`${id}-anno`} className='form-label'>Anno acquisto</label><select id={`${id}-anno`} className='form-select' value={anno} onChange={e => setAnno(e.target.value)}><option value=''>Tutti gli anni</option>{[...new Set(materiali.map(m => m.data_fattura?.slice(0, 4)).filter(Boolean))].sort().reverse().map(a => <option key={a}>{a}</option>)}</select></div><div className='col-md-4'><label htmlFor={`${id}-vista`} className='form-label'>Visualizzazione</label><select id={`${id}-vista`} className='form-select' value={vista} onChange={e => setVista(e.target.value)}><option value='righe'>Storico acquisti</option><option value='annuali'>Quantità e costi annuali per prodotto</option><option value='categorie'>Costi annuali per categoria</option></select></div></div>
    <button type='button' className='btn btn-secondary mb-3' onClick={() => { setFiltri({}); setAnno(''); setLimite(100); }}>Azzera ricerca e filtri</button>
    <p role='status'>{risultati.length} risultati su {materiali.length} righe</p>
    {vista === 'categorie' && <div className='table-responsive'><table className='table table-striped'><thead><tr><th>Anno</th><th>Conto / branca / sottoconto</th><th>Imponibile</th></tr></thead><tbody>{categorie.map(([key, g]) => <tr key={key}><td>{g.anno}</td><td>{g.categoria}</td><td>{g.totale.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td></tr>)}</tbody></table></div>}
    {vista === 'annuali' && <><p className='small text-muted'>Quantità di acquisto, non consumi. Prodotti, fornitori e unità diverse restano separati; le unità mancanti sono indicate. Gli importi sono imponibili, al netto degli sconti.</p><div className='table-responsive'><table className='table table-striped'><thead><tr><th>Anno</th><th>Prodotto</th><th>Fornitore</th><th>Quantità</th><th>Unità</th><th>Imponibile</th></tr></thead><tbody>{annuali.slice(0, limite).map(([key, g]) => <tr key={key}><td>{g.anno}</td><td>{g.riga.nome}</td><td>{g.riga.fornitorenome}</td><td>{g.quantita.toLocaleString('it-IT')}</td><td>{g.riga.unita_acquisto || 'Non indicata'}</td><td>{g.importo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td></tr>)}</tbody></table></div></>}
    {vista === 'righe' && (risultati.length === 0 ? <p>Nessun materiale corrispondente.</p> : <div className='table-responsive'><table className='table table-striped align-middle'><thead><tr><th>Prodotto</th><th>Codice</th><th>Fornitore</th><th>Data acquisto</th><th>Quantità / unità</th><th>Prezzo unitario netto</th><th>Imponibile</th><th>Totale fattura</th><th>Documento / fonte</th><th>Conto / branca / sottoconto</th></tr></thead><tbody>{risultati.slice(0, limite).map(m => <tr key={m.id}><td>{m.nome}</td><td>{m.codicearticolo || '—'}</td><td>{fornitori[m.fornitoreid]?.nome || m.fornitorenome || '—'}</td><td>{m.data_fattura || '—'}</td><td>{m.quantita?.toLocaleString('it-IT')} {m.unita_acquisto || '(unità non indicata)'}</td><td>{m.costo_unitario != null && Number.isFinite(m.costo_unitario) ? m.costo_unitario.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '—'}</td><td>{m.imponibile_riga?.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) || '—'}</td><td>{m.unita_acquisto === 'fattura' && m.totale_documento != null ? m.totale_documento.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '—'}</td><td>{m.numero_documento || m.fattura_id} · {m.fonte || 'Catalogo'}</td><td>{[m.contonome, m.brancanome, m.sottocontonome].filter(Boolean).join(' / ') || 'Da classificare'}{m.proposta_classificazione && <small className='d-block text-muted'>Proposta: {[m.proposta_classificazione.contonome, m.proposta_classificazione.brancanome, m.proposta_classificazione.sottocontonome].filter(Boolean).join(' / ')}</small>}{m.proposta_classificazione && onConferma && <button type='button' className='btn btn-sm btn-outline-primary mt-1' disabled={salvataggio !== null} title='Conferma per gli acquisti con stesso fornitore, descrizione e codice articolo' onClick={() => void conferma(m)}>{salvataggio === m.id ? 'Salvataggio…' : 'Conferma classificazione'}</button>}</td></tr>)}</tbody></table></div>)}
    {vista !== 'categorie' && (vista === 'righe' ? risultati.length : annuali.length) > limite && <button className='btn btn-secondary' onClick={() => setLimite(limite + 100)}>Mostra altre 100 righe</button>}
  </div>;
}
