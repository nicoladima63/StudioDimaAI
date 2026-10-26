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
vi.mock('../services/ordini.service', () => ({ ordiniService: {
  load: vi.fn(), save: vi.fn(), queue: vi.fn(), order: vi.fn(), transition: vi.fn(),
} }));
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
    const card = within(screen.getByRole('article', { name: 'Aghi' }));
    expect(card.getByText('1')).toBeInTheDocument();    expect(card.queryByRole('button', { name: 'Aggiungi Aghi' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Carrello (1)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quantità Aghi')).toHaveValue(1);
    expect(screen.getByText(/A2 · DENTALE/)).toBeInTheDocument();
    fireEvent.click(card.getByRole('button', { name: 'Aumenta Aghi' }));
    expect(screen.getByLabelText('Quantità Aghi')).toHaveValue(2);
    fireEvent.click(card.getByRole('button', { name: 'Diminuisci Aghi' }));
    fireEvent.click(card.getByRole('button', { name: 'Diminuisci Aghi' }));
    expect(screen.getByRole('heading', { name: 'Carrello (0)' })).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Aggiungi Aghi' })).toBeInTheDocument();
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
    expect(screen.getByText(/OLD · ALTRO FORNITORE/)).toBeInTheDocument();
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
