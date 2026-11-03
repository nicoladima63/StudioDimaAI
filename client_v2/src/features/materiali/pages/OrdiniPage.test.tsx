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
    20: { nome: 'Lime', codice: 'REF M25', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    21: { nome: 'Lime', codice: 'REF M40', fornitore_id: 'B', fornitore_nome: 'Dentale' },
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
const offerta = (id: number, prodotto_id: number, fornitore_id: string, fornitore_nome: string, codice: string, ultimo_acquisto: string | null, ultimo_prezzo: number | null) =>
  ({ id, prodotto_id, fornitore_id, fornitore_nome, codice, ultimo_acquisto, ultimo_prezzo, pezzi_per_confezione: 1 });
vi.mock('../services/catalogo.service', () => ({ default: { apiRicercaProdotti: vi.fn(async () => ({
  prodotti: [
    { id: 1, nome: 'Aghi', offerte: [offerta(2, 1, 'B', 'Dentale', 'A2', '2026-09-01', 10), offerta(10, 1, 'C', 'Altro fornitore', 'OLD', '2026-08-03', 8)] },
    { id: 2, nome: 'Garze', offerte: [offerta(3, 2, 'B', 'Dentale', 'G3', null, null)] },
    { id: 5, nome: 'Intermedio', offerte: [offerta(30, 5, 'B', 'Dentale', 'I1', '2024-05-01', 4)] },
    { id: 6, nome: 'Vecchio', offerte: [offerta(31, 6, 'B', 'Dentale', 'V1', '2019-05-01', 4)] },
    { id: 3, nome: 'Composito', offerte: [offerta(5, 3, 'C', 'Altro fornitore', 'C5', null, null)] },
    { id: 4, nome: 'Lime', offerte: [offerta(20, 4, 'B', 'Dentale', 'REF M25', null, null), offerta(21, 4, 'B', 'Dentale', 'REF M40', null, null)] },
  ],
  riepilogo: {}, pagination: { page: 1, per_page: 1000, total: 4, pages: 1 },
})) } }));
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

  it('shows product cards from the catalog with an add button', async () => {
    render(<OrdiniPage />);
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aggiungi Aghi' })).toBeInTheDocument();
  });

  it('shows the code under the name only when the card has a single offer', async () => {
    render(<OrdiniPage />);
    expect(within(await screen.findByRole('article', { name: 'Garze' })).getByText('G3')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Aghi' })).queryByText('A2')).not.toBeInTheDocument();
  });

  it('puts the most recent offer in the cart, or the highest id when none is dated', async () => {
    render(<OrdiniPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi Lime' }));
    await waitFor(() => expect(ordiniService.carrelloModifica).toHaveBeenCalledWith(21, { delta: 1 }));
    expect(await within(screen.getByRole('article', { name: 'Lime' })).findByRole('button', { name: 'Aumenta Lime' })).toBeInTheDocument();
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
    // Con il fornitore scelto la scheda mostra solo l'offerta di quel fornitore.
    const card = within(screen.getByRole('article', { name: 'Aghi' }));
    expect(card.getAllByRole('listitem')).toHaveLength(1);
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
    expect(ordiniService.apiPreferitoImposta).toHaveBeenCalledWith('2', 'preferito', true);
    // Marcare un preferito non cambia l'elenco in corso: il filtro si accende da solo solo all'apertura.
    expect(screen.getByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preferiti (1)' }));
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument();
  });

  it('opens on favourites only when there are some, and lets you see everything', async () => {
    fakeCart.segni = [{ chiave: '2', tipo: 'preferito' }];
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Garze' });
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preferiti (1)' }));
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
  });

  it('the Tutti button leaves the favourites filter and the letter filter', async () => {
    fakeCart.segni = [{ chiave: '2', tipo: 'preferito' }];
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

  it('hides products not bought in the last two years until their year is ticked', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    expect(screen.getByRole('article', { name: 'Intermedio' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Vecchio' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ultimo acquisto/ }));
    fireEvent.click(await screen.findByLabelText('2019'));
    expect(await screen.findByRole('article', { name: 'Vecchio' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('2026'));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument());
  });

  it('applies the year filter to favourites too', async () => {
    fakeCart.segni = [{ chiave: '6', tipo: 'preferito' }, { chiave: '2', tipo: 'preferito' }];
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Garze' });
    expect(screen.queryByRole('article', { name: 'Vecchio' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ultimo acquisto/ }));
    fireEvent.click(await screen.findByLabelText('2019'));
    expect(await screen.findByRole('article', { name: 'Vecchio' })).toBeInTheDocument();
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
  it('shows one line per supplier offer, most recent first', async () => {
    render(<OrdiniPage />);
    await screen.findByRole('article', { name: 'Aghi' });
    const card = within(screen.getByRole('article', { name: 'Aghi' }));
    expect(card.getAllByRole('listitem')).toHaveLength(2);
    expect(card.getAllByRole('listitem')[0]).toHaveTextContent('DENTALE');
    expect(card.getAllByRole('listitem')[0]).toHaveTextContent('01/09/2026');
    expect(card.getAllByRole('listitem')[0]).toHaveTextContent('10,00');
    expect(card.getAllByRole('listitem')[1]).toHaveTextContent('03/08/2026');
    fireEvent.change(screen.getByRole('textbox', { name: 'Cerca fra tutti i materiali' }), { target: { value: 'garze' } });
    expect(screen.queryByRole('article', { name: 'Aghi' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Garze' })).toBeInTheDocument();
  });

});
