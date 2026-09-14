import { useCallback, useEffect, useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import api from '@/services/api/client';
import type { Riga } from '../components/RicercaMateriali';
import { useFornitoriStore } from '@/store/fornitori.store';
import RicercaMateriali from '../components/RicercaMateriali';

export default function ProvaRicercaMaterialiPage() {
  const [materiali, setMateriali] = useState<Riga[]>([]);
  const [fornitoriMaterialiIds, setFornitoriMaterialiIds] = useState<string[]>([]);
  const [avvisi, setAvvisi] = useState<string[]>([]);
  const [copertura, setCopertura] = useState<{ documenti_dbf: number; file_xml: number; documenti_riconciliati: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fornitori = useFornitoriStore(s => s.fornitoriMap);
  const loadFornitori = useFornitoriStore(s => s.loadAllFornitori);
  const erroreFornitori = useFornitoriStore(s => s.error);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/materiali/storico-acquisti', { timeout: 120000 });
      if (!response.data.success) throw new Error('Caricamento non riuscito');
      setMateriali(response.data.data.materiali || []);
      setFornitoriMaterialiIds(response.data.data.fornitori_materiali_ids || []);
      setAvvisi(response.data.data.avvisi || []); setCopertura(response.data.data.copertura);
    } catch { setError('Impossibile caricare i materiali. Premi Aggiorna per riprovare.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); void loadFornitori(); }, [load, loadFornitori]);
  async function conferma(riga: Riga) {
    try {
      const response = await api.post('/materiali/storico-acquisti/conferma-classificazione', { id: riga.id, token: riga.proposta_token }, { timeout: 120000 });
      if (!response.data.success) throw new Error(response.data.error || 'Conferma non riuscita');
      const { ids, classificazione } = response.data.data;
      setMateriali(current => current.map(m => ids.includes(m.id) ? { ...m, ...classificazione, confermato: 1, proposta_classificazione: null, proposta_token: null } : m));
    } catch (error) {
      const e = error as { response?: { data?: { error?: string } }; message?: string };
      throw new Error(e.response?.data?.error || e.message || 'Conferma non riuscita. Riprova.');
    }
  }
  return <PageLayout>
    <PageLayout.Header title='Prova ricerca materiali' headerAction={<button className='btn btn-primary' disabled={loading} onClick={() => { void load(); void loadFornitori(); }}>Aggiorna</button>} />
    <PageLayout.ContentBody>
      <p>Cerca nello storico acquisti DBF e XML, anche fra le righe da classificare. I filtri sono facoltativi e i risultati si aggiornano mentre scrivi.</p>
      {copertura && <p className='small text-muted'>{copertura.documenti_dbf} documenti del gestionale · {copertura.file_xml} file XML · {copertura.documenti_riconciliati} documenti riconciliati</p>}
      {!!avvisi.length && <details><summary>Avvisi sulla copertura ({avvisi.length})</summary><ul>{avvisi.map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
      {erroreFornitori && <p role='alert'>Anagrafica fornitori non aggiornata: vengono usati i nomi disponibili.</p>}
      {error ? <p role='alert'>{error}</p> : loading ? <p role='status'>Caricamento materiali...</p> : <RicercaMateriali materiali={materiali} fornitori={fornitori} fornitoriMaterialiIds={fornitoriMaterialiIds} onConferma={conferma} />}
    </PageLayout.ContentBody>
  </PageLayout>;
}
