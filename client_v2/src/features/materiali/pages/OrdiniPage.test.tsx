import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type Isotope from 'isotope-layout';
import OrdiniPage from './OrdiniPage';
import { ordiniService } from '../services/ordini.service';

// In jsdom transitionend non scatta mai: senza durata 0 gli item filtrati non arrivano a display:none.
vi.mock('isotope-layout', async importOriginal => {
  const Real = (await importOriginal<{ default: typeof Isotope }>()).default;
  return { default: class extends Real { constructor(el: HTMLElement, options: Isotope.IsotopeOptions) { super(el, { ...options, transitionDuration: 0 }); } } };
});
// Finto server del carrello: lo stato sopravvive allo smontaggio della pagina, come sul server vero.
const { fakeCart, anagrafica } = vi.hoisted(() => ({
  fakeCart: { rows: [] as { materiale_id: number; quantita: number }[] },
  anagrafica: {
    2: { nome: 'Aghi', codice: 'A2', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    10: { nome: ' aghi ', codice: 'OLD', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
    11: { nome: ' aghi ', codice: 'OLD', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
    12: { nome: ' aghi ', codice: 'OLD', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
    3: { nome: 'Garze', codice: 'G3', fornitore_id: 'B', fornitore_nome: 'Dentale' },
    5: { nome: 'Composito', codice: 'C5', fornitore_id: 'C', fornitore_nome: 'Altro fornitore' },
  } as Record<number, { nome: string; codice: string; fornitore_id: string; fornitore_nome: string }>,
}));
vi.mock('../services/ordini.service', () => {
  const view = () => fakeCart.rows.map(r => ({ ...anagrafica[r.materiale_id], ...r, aggiornato_da: 'anna', aggiornato_il: '2026-10-26T10:00:00' }));
  return { ordiniService: {
    load: vi.fn(), save: vi.fn(), queue: vi.fn(), order: vi.fn(), transition: vi.fn(),
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
    { id: 5, nome: 'Composito', codicearticolo: 'C5', fornitoreid: 'C', fornitorenome: 'Altro fornitore', confermato: 1, contonome: 'MATERIALI', brancanome: 'CONSERVATIVA' },
  ], load: loadMaterials, isLoading: false, error: null,
}) }));
vi.mock('@/store/fornitori.store', () => ({ useFornitoriStore: (selector: (state: unknown) => unknown) => selector({ fornitoriMap: { B: { nome: 'DENTALE' }, C: { nome: 'ALTRO FORNITORE' } }, loadAllFornitori: loadMaterials }) }));
vi.mock('@/components/selects/FornitoriSelect', () => ({ default: () => <div>Fornitore</div> }));

describe('Ordini materiali', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    fakeCart.rows = [];
    vi.mocked(ordiniService.load).mockResolvedValue({ piani: [], ordini: [] });
  });

  it('shows product cards with an add button and excludes expenses', async () => {
    render(<OrdiniPage />);
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Spese di vendita e imballaggio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aggiungi Aghi' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi e stampa' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Ordinato Garze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Segna come ordinati (1)' }));
    await waitFor(() => expect(ordiniService.carrelloOrdina).toHaveBeenCalledWith([2]));
    await screen.findByRole('heading', { name: 'Carrello (1)' });
    expect(screen.getByLabelText('Quantità Garze')).toHaveValue(4);
    expect(screen.queryByLabelText('Quantità Aghi')).not.toBeInTheDocument();
  });

  it('puts an old order back in the cart with the reorder button', async () => {
    vi.mocked(ordiniService.load).mockResolvedValue({ piani: [], ordini: [{ id: 7, fornitore_nome: 'Dentale', data_ordine: '2026-10-01', data_ricezione: null, stato: 'ordinato',
      righe: [{ materiale_id: 3, nome: 'Garze', codice: 'G3', quantita: 2, unita: 'confezioni', note: '' }] }] });
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
    fireEvent.click(await screen.findByRole('button', { name: 'Rivedi e stampa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stampa lista' }));
    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame!.srcdoc).toContain('Lista ordine materiali');
    expect(frame!.srcdoc).toContain('<h2>DENTALE</h2>');
    expect(frame!.srcdoc).toContain('<td>Aghi</td><td>A2</td><td>1</td>');
    frame!.remove();
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
