import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OrdiniPage from './OrdiniPage';
import { ordiniService } from '../services/ordini.service';

// Finto server del carrello: lo stato sopravvive allo smontaggio della pagina, come sul server vero.
const { fakeCart, anagrafica } = vi.hoisted(() => ({
  fakeCart: { rows: [] as { materiale_id: number; quantita: number }[], segni: [] as { chiave: string; tipo: string }[] },
  anagrafica: {
    2: { nome: 'Aghi', codice: 'A2', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    10: { nome: ' aghi ', codice: 'OLD', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
    11: { nome: ' aghi ', codice: 'OLD', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
    12: { nome: ' aghi ', codice: 'OLD', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
    20: { nome: 'Lime', codice: 'REF Misura 25 · 25 mm', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    21: { nome: 'Lime', codice: 'REF Misura 40 · 25 mm', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    3: { nome: 'Garze', codice: 'G3', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    5: { nome: 'Composito', codice: 'C5', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
  } as Record<number, { nome: string; codice: string; fornitore_id: string; fornitore_nome: string }>,
}));
vi.mock('../services/ordini.service', () => {
  const view = () => fakeCart.rows.map(r => ({ ...anagrafica[r.materiale_id], ...r, aggiornato_da: 'anna', aggiornato_il: '2026-10-26T10:00:00' }));
  return { ordiniService: {
    load: vi.fn(), save: vi.fn(), queue: vi.fn(), order: vi.fn(), transition: vi.fn(),
    apiPreferiti: vi.fn(async () => fakeCart.segni),
    apiPreferitoImposta: vi.fn(async (chiave: string, tipo: string, attivo: boolean) => {
      fakeCart.segni = fakeCart.segni.filter(s => !(s.chiave === chiave && s.tipo === tipo));
      if (attivo) fakeCart.segni.push({ chiave, tipo });
      return fakeCart.segni;
    }),
    carrello: vi.fn(async () => view()),
    carrelloModifica: vi.fn(async (id: number, change: { delta?: number; quantita?: number }) => {
      const current = fakeCart.rows.find(r => r.materiale_id === id)?.quantita ?? 0;
      const next = change.delta !== undefined ? current + change.delta : change.quantita!;
      fakeCart.rows = fakeCart.rows.filter(r => r.materiale_id !== id);
      if (next > 0) fakeCart.rows.push({ materiale_id: id, quantita: next });
      return view();
    }),
    carrelloRimuovi: vi.fn(async (id?: number) => { fakeCart.rows = id === undefined ? [] : fakeCart.rows.filter(r => r.materiale_id !== id); return view(); }),
    carrelloOrdina: vi.fn(async (ids: number[]) => { fakeCart.rows = fakeCart.rows.filter(r => !ids.includes(r.materiale_id)); return { ordini: [1], carrello: view() }; }),
    carrelloRiordina: vi.fn(async () => { fakeCart.rows.push({ materiale_id: 3, quantita: 2 }); return { aggiunte: 1, saltate: 0, carrello: view() }; }),
  } };
});
const { loadMaterials } = vi.hoisted(() => ({ loadMaterials: vi.fn() }));
vi.mock('@/store/materiali.store', () => ({ useMateriali: () => ({
  materiali: [
    { id: 2, data_fattura: '2026-09-01', fattura_id: 'F2', costo_unitario: 10, nome: 'Aghi', codicearticolo: 'A2', fornitoreid: 'B', fornitorenome: 'Dentale', confermato: 1, contonome: 'MATERIALI', brancanome: 'DPI' },
    ...[0, 1, 2].map(i => ({ id: 10 + i, nome: ' aghi ', data_fattura: `2026-08-0${i + 1}`, fattura_id: `OLD${i}`, costo_unitario: 8 + i, codicearticolo: 'OLD', fornitoreid: 'C', fornitorenome: 'Altro fornitore', confermato: 1, contonome: 'MATERIALI', brancanome: 'DPI' })),
    { id: 3, nome: 'Garze', codicearticolo: 'G3', fornitoreid: 'B', fornitorenome: 'Dentale', confermato: 1, contonome: 'MATERIALI', brancanome: 'CHIRURGIA' },
    { id: 4, nome: 'Spese di vendita e imballaggio', codicearticolo: 'ZZZZXD', fornitoreid: 'B', fornitorenome: 'Dentale', confermato: 1, contonome: 'MATERIALI', brancanome: 'SPESE' },
    { id: 6, nome: '71430 BISICO S4I ligth ribasante', codicearticolo: '', fornitoreid: 'B', fornitorenome: 'Dentale', confermato: 1, contonome: 'MATERIALI', brancanome: 'DPI' },
    { id: 20, nome: 'Lime', data_fattura: '2026-07-01', fattura_id: 'L1', costo_unitario: 90, codicearticolo: 'REF Misura 25 · 25 mm', fornitoreid: 'B', fornitorenome: 'Dentale', confermato: 1, contonome: 'MATERIALI', brancanome: 'DPI' },
    { id: 21, nome: 'Lime', data_fattura: '2026-06-01', fattura_id: 'L2', costo_unitario: 90, codicearticolo: 'REF Misura 40 · 25 mm', fornitoreid: 'B', fornitorenome: 'Dentale', confermato: 1, contonome: 'MATERIALI', brancanome: 'DPI' },
    { id: 5, nome: 'Composito', codicearticolo: 'C5', fornitoreid: 'C', fornitorenome: 'Altro fornitore', confermato: 1, contonome: 'MATERIALI', brancanome: 'CONSERVATIVA' },
  ], load: loadMaterials, isLoading: false, error: null,
}) }));
vi.mock('@/store/fornitori.store', () => ({ useFornitoriStore: (selector: (state: unknown) => unknown) => selector({ fornitoriMap: { B: { nome: 'DENTALE' }, C: { nome: 'ALTRO FORNITORE' } }, loadAllFornitori: loadMaterials }) }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a> }));
vi.mock('@/components/selects/FornitoriSelect', () => ({ default: () => <div>Fornitore</div> }));

describe('Ordini materiali', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    fakeCart.rows = [];
    fakeCart.segni = [];
    vi.mocked(ordiniService.load).mockResolvedValue({ piani: [], ordini: [] });
  });

  it('shows product cards with an add button and excludes expenses', async () => {
    render(<OrdiniPage />);
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Spese di vendita e imballaggio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aggiungi Aghi' })).toBeInTheDocument();
  });

  it('shows the stripped code under the name, so variants can be told apart', async () => {
    render(<OrdiniPage />);
    const card = await screen.findByRole('article', { name: 'BISICO S4I ligth ribasante' });
    expect(within(card).getByText('71430')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Aghi' })).queryByText('A2')).not.toBeInTheDocument();
  });

  it('splits a name with several codes into one card per code, and the + adds that code', async () => {
    render(<OrdiniPage />);
    const schede = await screen.findAllByRole('article', { name: 'Lime' });
    expect(schede).toHaveLength(2);
    const codici = schede.map(s => ['Misura 25 · 25 mm', 'Misura 40 · 25 mm'].find(c => within(s).queryByText(c)));
    expect(codici.sort()).toEqual(['Misura 25 · 25 mm', 'Misura 40 · 25 mm']);
    expect(within(screen.getByRole('article', { name: 'Garze' })).queryByText('G3')).not.toBeInTheDocument();
    const scheda40 = schede.find(s => within(s).queryByText('Misura 40 · 25 mm'))!;
    fireEvent.click(within(scheda40).getByRole('button', { name: 'Aggiungi Lime' }));
    await waitFor(() => expect(ordiniService.carrelloModifica).toHaveBeenCalledWith(21, { delta: 1 }));
    // la riga nel carrello appartiene solo alla scheda del suo codice: l'altra scheda aggiunge ancora una riga nuova
    expect(await within(scheda40).findByRole('button', { name: 'Aumenta Lime' })).toBeInTheDocument();
    const scheda25 = schede.find(s => within(s).queryByText('Misura 25 · 25 mm'))!;
    expect(within(scheda25).getByRole('button', { name: 'Aggiungi Lime' })).toBeInTheDocument();
  });

  it('adds a product to the cart from its card with the latest supplier and adjusts the quantity', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi Aghi' }));
    await screen.findByRole('heading', { name: 'Carrello (1)' });
    const card = within(screen.getByRole('article', { name: 'Aghi' }));
    expect(card.getByText('1')).toBeInTheDocument();
    expect(card.queryByRole('button', { name: 'Aggiungi Aghi' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quantità Aghi')).toHaveValue(1);
    expect(screen.getByText(/A2 · DENTALE/)).toBeInTheDocument();
    expect(ordiniService.carrelloModifica).toHaveBeenCalledWith(2, { delta: 1 });
    fireEvent.click(card.getByRole('button', { name: 'Aumenta Aghi' }));
    await waitFor(() => expect(screen.getByLabelText('Quantità Aghi')).toHaveValue(2));
    fireEvent.click(card.getByRole('button', { name: 'Diminuisci Aghi' }));
    await waitFor(() => expect(screen.getByLabelText('Quantità Aghi')).toHaveValue(1));
    fireEvent.click(card.getByRole('button', { name: 'Diminuisci Aghi' }));
    await screen.findByRole('heading', { name: 'Carrello (0)' });
    expect(card.getByRole('button', { name: 'Aggiungi Aghi' })).toBeInTheDocument();
  });

  it('keeps the cart on the server: it survives leaving and returning to the page', async () => {
    const first = render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi Aghi' }));
    await screen.findByRole('heading', { name: 'Carrello (1)' });
    first.unmount();
    render(<OrdiniPage />);
    expect(await screen.findByRole('heading', { name: 'Carrello (1)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quantità Aghi')).toHaveValue(1);
  });

  it('clears the whole shared cart only after confirmation', async () => {
    fakeCart.rows = [{ materiale_id: 2, quantita: 1 }, { materiale_id: 3, quantita: 4 }];
    render(<OrdiniPage />);
    await screen.findByRole('heading', { name: 'Carrello (2)' });
    fireEvent.click(screen.getByRole('button', { name: 'Svuota' }));
    expect(ordiniService.carrelloRimuovi).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Svuota tutto' }));
    await screen.findByRole('heading', { name: 'Carrello (0)' });
    expect(ordiniService.carrelloRimuovi).toHaveBeenCalledWith();
  });

  it('marks only the ticked lines as ordered and keeps the others in the cart', async () => {
    fakeCart.rows = [{ materiale_id: 2, quantita: 1 }, { materiale_id: 3, quantita: 4 }];
    render(<OrdiniPage />);
    await screen.findByRole('heading', { name: 'Carrello (2)' });
    fireEvent.click(screen.getByRole('button', { name: 'Vai al checkout' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Includi Garze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ordina' }));
    await waitFor(() => expect(ordiniService.carrelloOrdina).toHaveBeenCalledWith([2]));
    document.querySelector('iframe')?.remove();
    await screen.findByRole('heading', { name: 'Carrello (1)' });
    expect(screen.getByLabelText('Quantità Garze')).toHaveValue(4);
    expect(screen.queryByLabelText('Quantità Aghi')).not.toBeInTheDocument();
  });

  it('puts an old order back in the cart with the reorder button', async () => {
    vi.mocked(ordiniService.load).mockResolvedValue({ piani: [], ordini: [{ id: 7, fornitore_nome: 'Dentale', data_ordine: '2026-10-01', data_ricezione: null, stato: 'ordinato',
      righe: [{ id: 1, materiale_id: 3, nome: 'Garze', codice: 'G3', quantita: 2, unita: 'confezioni', note: '' }] }] });
    render(<OrdiniPage />);
    const order = within(await screen.findByRole('article', { name: 'Ordine 7' }));
    expect(order.getByText(/Garze · 2/)).toBeInTheDocument();
    fireEvent.click(order.getByRole('button', { name: 'Riordina' }));
    expect(await screen.findByLabelText('Quantità Garze')).toHaveValue(2);
    expect(ordiniService.carrelloRiordina).toHaveBeenCalledWith(7);
  });

  it('filters the search results by supplier and resets the supplier when the query changes', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    const search = screen.getByRole('textbox', { name: 'Cerca fra tutti i materiali' });
    expect(screen.queryByRole('group', { name: 'Filtra per fornitore' })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'a' } });
    const chips = within(screen.getByRole('group', { name: 'Filtra per fornitore' }));
    fireEvent.click(chips.getByRole('button', { name: 'DENTALE' }));
    expect(chips.getByRole('button', { name: 'DENTALE' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Composito' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument();
    // Cambiare fornitore più volte deve riaprire le schede nascoste dal filtro precedente.
    fireEvent.click(chips.getByRole('button', { name: 'ALTRO FORNITORE' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Garze' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: 'Composito' })).toBeInTheDocument();
    fireEvent.click(chips.getByRole('button', { name: 'DENTALE' }));
    await waitFor(() => expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument());
    expect(screen.queryByRole('article', { name: 'Composito' })).not.toBeInTheDocument();
    fireEvent.click(chips.getByRole('button', { name: 'Tutti i fornitori' }));
    await waitFor(() => expect(screen.getByRole('article', { name: 'Composito' })).toBeInTheDocument());
    expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'aghi' } });
    expect(within(screen.getByRole('group', { name: 'Filtra per fornitore' })).getByRole('button', { name: 'Tutti i fornitori' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtra per fornitore' })).getByRole('button', { name: 'ALTRO FORNITORE' }));
    // Con il fornitore scelto la scheda mostra il prodotto di quel fornitore (qui scritto " aghi ").
    const card = within(screen.getByRole('article', { name: /aghi/i }));
    expect(card.getAllByRole('listitem')).toHaveLength(3);
    expect(card.queryByText(/DENTALE/)).not.toBeInTheDocument();
    fireEvent.click(card.getByRole('button', { name: /Aggiungi/ }));
    expect(await screen.findByText(/OLD · ALTRO FORNITORE/)).toBeInTheDocument();
  });

  it('prints the cart list grouped by supplier from a hidden iframe', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi Aghi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vai al checkout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ordina' }));
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
    expect(ordiniService.carrelloOrdina).toHaveBeenCalledWith([2]);
    expect(screen.queryByRole('button', { name: 'Continua ordine' })).not.toBeInTheDocument();
    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame!.srcdoc).toContain('Lista ordine materiali');
    expect(frame!.srcdoc).toContain('<h2>DENTALE</h2>');
    expect(frame!.srcdoc).toContain('<td>Aghi</td><td>A2</td><td>1</td>');
    frame!.remove();
  });

  it('marks favourites with the heart and filters on them', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    fireEvent.click(screen.getByRole('button', { name: 'Metti tra i preferiti Garze' }));
    expect(await screen.findByRole('button', { name: 'Togli dai preferiti Garze' })).toBeInTheDocument();
    expect(ordiniService.apiPreferitoImposta).toHaveBeenCalledWith('garze', 'preferito', true);
    // Marcare un preferito non cambia l'elenco in corso: il filtro si accende da solo solo all'apertura.
    expect(screen.getByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preferiti (1)' }));
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument();
  });

  it('opens on favourites only when there are some, and lets you see everything', async () => {
    fakeCart.segni = [{ chiave: 'garze', tipo: 'preferito' }];
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Garze' });
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preferiti (1)' }));
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
  });

  it('the Tutti button leaves the favourites filter and the letter filter', async () => {
    fakeCart.segni = [{ chiave: 'garze', tipo: 'preferito' }];
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Garze' });
    expect(screen.getByRole('button', { name: 'Tutti' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Tutti' }));
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tutti' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Preferiti (1)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves a cart line for later and moves it back', async () => {
    fakeCart.rows = [{ materiale_id: 3, quantita: 4 }];
    render(<OrdiniPage />);
    await screen.findByRole('heading', { name: 'Carrello (1)' });
    fireEvent.click(screen.getByRole('button', { name: 'Salva per dopo' }));
    await screen.findByRole('heading', { name: 'Carrello (0)' });
    expect(await screen.findByRole('heading', { name: 'Salvati per dopo (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sposta nel carrello' }));
    await screen.findByRole('heading', { name: 'Carrello (1)' });
    expect(screen.getByRole('heading', { name: 'Salvati per dopo (0)' })).toBeInTheDocument();
  });

  it('shows the product name without the leading article code', async () => {
    render(<OrdiniPage />);
    expect(await screen.findByRole('article', { name: 'BISICO S4I ligth ribasante' })).toBeInTheDocument();
    expect(screen.getByText('BISICO S4I ligth ribasante').textContent).not.toMatch(/71430/);
  });

  it('clears the search with the x button', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    const search = screen.getByRole('textbox', { name: 'Cerca fra tutti i materiali' });
    expect(screen.queryByRole('button', { name: 'Cancella ricerca' })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'garze' } });
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancella ricerca' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(screen.getByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancella ricerca' })).not.toBeInTheDocument();
  });

  it('filters products alphabetically and switches letters repeatedly', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.getByRole('article', { name: 'Composito' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(screen.getByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Composito' })).not.toBeInTheDocument();
  });
  it('groups the same product across suppliers and shows the latest three purchases', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    const card = within(screen.getByRole('article', { name: 'Aghi' }));
    expect(card.getAllByRole('listitem')).toHaveLength(3);
    expect(card.getAllByRole('listitem')[0]).toHaveTextContent('DENTALE');
    expect(card.getAllByRole('listitem')[0]).toHaveTextContent('01/09/2026');
    expect(card.getAllByRole('listitem')[0]).toHaveTextContent('10,00');
    expect(card.queryByText(/01\/08\/2026/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Cerca fra tutti i materiali' }), { target: { value: 'garze' } });
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument();
  });

});
