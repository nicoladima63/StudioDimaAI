import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '@/services/api/client';
import ProdottiDaClassificarePage from './ProdottiDaClassificarePage';

vi.mock('@/services/api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/components/selects/ContiSelect', () => ({ default: ({ onChange }: { onChange: (id: number) => void }) => <button onClick={() => onChange(11)}>Seleziona Collaboratori</button> }));
vi.mock('@/components/selects/BrancheSelect', () => ({ default: ({ onChange }: { onChange: (id: number) => void }) => <button onClick={() => onChange(12)}>Seleziona Igiene</button> }));
vi.mock('@/components/selects/SottocontiSelect', () => ({ default: ({ onChange }: { onChange: (id: number) => void }) => <button onClick={() => onChange(28)}>Seleziona Prestazioni professionali</button> }));
const product = {
  destinazione: 'materiale', pronto: true, revision: 'r1', id: 'p1', descrizione: 'Aspirasaliva', codice: '001', fornitore_nome: 'Dentale', partita_iva: '00123456789',
  ultimo_acquisto: '2026-09-08', costo_unitario: '5', unita: 'CF', occorrenze: 2, stato: 'nuovo', motivo: '',
  tipo_riga: 'materiale_candidato', fatture: ['xml:00123456789:1:2026-09-08'],
  proposta: { contoid: 1, brancaid: 2, sottocontoid: 3, contonome: 'Materiali', brancanome: 'Chirurgia', sottocontonome: 'Monouso', fonte_classificazione: 'fornitore_storico_esatto' },
};
const open = () => render(<MemoryRouter><ProdottiDaClassificarePage /></MemoryRouter>);

describe('Prodotti da classificare', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { prodotti: [product] } } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { inseriti: 1, altre_voci: 0, gia_presenti: 0, da_rivedere: [] } } });
  });

  it('requires selection and explicit confirmation before saving proposed categories', async () => {
    open();
    await screen.findByText('Aspirasaliva');
    const button = screen.getByRole('button', { name: 'Conferma selezionate' });
    expect(button).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona Aspirasaliva' }));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/materiali/da-classificare/conferma-proposte', { voci: [{ id: 'p1', revision: 'r1' }] }, { timeout: 120000 }));
    await screen.findByText('1 materiali inseriti, 0 altre voci confermate, 0 materiali già presenti. 0 voci rimaste da verificare.');
  });

  it('clears selection when filtering and blocks unresolved suppliers', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { prodotti: [product, { ...product, id: 'p2', descrizione: 'Guanti', stato: 'da_verificare', motivo: 'Fornitore ambiguo', pronto: false }] } } });
    open(); await screen.findByText('Aspirasaliva');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona Aspirasaliva' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Stato prodotti' }), { target: { value: 'da_verificare' } });
    expect(screen.getByRole('button', { name: 'Conferma selezionate' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona Guanti' }));
    expect(screen.getByRole('button', { name: 'Conferma selezionate' })).toBeDisabled();
  });

  it('reads the email folder without asking for files and reports failures', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { file_trovati: 3, file_letti: 2, file_invariati: 1, righe_aggiunte: 2, errori: [{ file: 'bad.xml', errore: 'XML non valido' }] } } });
    open(); await screen.findByText('Aspirasaliva');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna dalle fatture email' }));
    await screen.findByText('bad.xml: XML non valido');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/materiali/da-classificare/email', {}, { timeout: 120000 });
    expect(document.querySelector('input[type=file]')).toBeNull();
  });

  it('confirms all visible ready proposals without selecting rows', async () => {
    open(); await screen.findByText('Aspirasaliva');
    fireEvent.click(screen.getByRole('button', { name: 'Conferma tutto: 1 materiali · 0 altre voci' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/materiali/da-classificare/conferma-proposte', { voci: [{ id: 'p1', revision: 'r1' }] }, { timeout: 120000 }));
    await screen.findByText(/1 materiali inseriti/);
  });

  it('saves a destination correction without inserting a material or losing the category', async () => {
    open(); await screen.findByText('Aspirasaliva');
    fireEvent.click(screen.getByRole('button', { name: 'Correggi Aspirasaliva' }));
    fireEvent.change(screen.getByLabelText('Destinazione'), { target: { value: 'altra_voce' } });
    expect(screen.getByRole('button', { name: /Conferma tutto:/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Salva correzioni' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/materiali/da-classificare/revisione', { ids: ['p1'], destinazione: 'altra_voce' }));
    await screen.findByText(/Correzioni salvate/);
  });
  it('saves a shared category for mixed destinations and retains the complete selection', async () => {
    const second = { ...product, id: 'p2', descrizione: 'Igiene', destinazione: 'da_decidere', pronto: false };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { prodotti: [product, second] } } });
    open(); await screen.findByText('Aspirasaliva');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona prodotti visibili' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correggi Igiene' }));
    expect(screen.getByText('Correggi 2 voci selezionate')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleziona Aspirasaliva' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Seleziona Igiene' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona Collaboratori' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona Igiene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona Prestazioni professionali' }));
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { prodotti: [product, second].map(p => ({ ...p, pronto: true, destinazione: 'altra_voce', revision: 'new' })) } } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva correzioni' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/materiali/da-classificare/revisione', {
      ids: ['p1', 'p2'], destinazione: 'automatico', classificazione: { contoid: 11, brancaid: 12, sottocontoid: 28 },
    }));
    await screen.findByText(/Correzioni salvate per 2 voci/);
    expect(screen.getByRole('checkbox', { name: 'Seleziona Aspirasaliva' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Seleziona Igiene' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma selezionate' }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/materiali/da-classificare/conferma-proposte', {
      voci: [{ id: 'p1', revision: 'new' }, { id: 'p2', revision: 'new' }],
    }, { timeout: 120000 }));
    await screen.findByText(/1 materiali inseriti/);
  });

});
