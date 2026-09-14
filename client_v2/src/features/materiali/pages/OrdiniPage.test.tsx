import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import OrdiniPage from './OrdiniPage';
import { ordiniService } from '../services/ordini.service';

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

  it('shows compact product cards without add buttons and excludes expenses', async () => {
    render(<OrdiniPage />);
    expect(await screen.findByRole('article', { name: 'Aghi' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Spese di vendita e imballaggio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aggiungi/ })).not.toBeInTheDocument();
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
