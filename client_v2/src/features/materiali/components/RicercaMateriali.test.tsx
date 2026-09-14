import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Materiale } from '@/store/materiali.store';
import RicercaMateriali from './RicercaMateriali';
afterEach(cleanup);
const materiali = [
  { id: 1, nome: 'Aroma rosa', fornitoreid: 'K', fornitorenome: 'Henry', contoid: 1, contonome: 'MATERIALI', confermato: 1, tipo_di_costo: 1 },
  { id: 2, nome: 'Alginato aroma', fornitoreid: 'U', fornitorenome: 'Umbra', contoid: 2, contonome: 'ALTRO', confermato: 0, tipo_di_costo: 2 },
] as (Materiale & { tipo_di_costo: number })[];
it('searches real-shaped rows, combines filters and resets them', () => {
  render(<RicercaMateriali materiali={materiali} />);
  fireEvent.change(screen.getByLabelText('Cerca materiali'), { target: { value: 'arom' } });
  expect(screen.getByRole('status')).toHaveTextContent('2 risultati');
  fireEvent.change(screen.getByLabelText('Conto'), { target: { value: '1' } });
  expect(screen.getByRole('status')).toHaveTextContent('1 risultati');
  fireEvent.click(screen.getByRole('button', { name: 'Azzera ricerca e filtri' }));
  expect(screen.getByRole('status')).toHaveTextContent('2 risultati');
  expect(screen.getByLabelText('Cerca materiali')).toHaveValue('');
});
it('supports supplier-only search using the official name and cost filters', () => {
  render(<RicercaMateriali materiali={materiali} fornitori={{ K: { nome: 'KRUGG' } }} />);
  fireEvent.change(screen.getByLabelText('Cerca in'), { target: { value: 'fornitorenome' } });
  fireEvent.change(screen.getByLabelText('Cerca materiali'), { target: { value: 'krugg' } });
  expect(screen.getByRole('status')).toHaveTextContent('1 risultati');
  fireEvent.click(screen.getByLabelText('Tipo 2'));
  expect(screen.getByText('Nessun materiale corrispondente.')).toBeInTheDocument();
});
it('explains unavailable cost classification', () => {
  render(<RicercaMateriali materiali={materiali.map(m => ({ ...m, tipo_di_costo: null }))} />);
  expect(screen.getByLabelText('Tipo 1')).toBeDisabled();
  expect(screen.getByText(/Il tipo di costo non è disponibile/)).toBeInTheDocument();
});

it('summarizes annual purchases with credit quantities and costs and keeps units separate', () => {
  const base = materiali[0];
  render(<RicercaMateriali materiali={[
    { ...base, id: 'a', data_fattura: '2026-01-01', quantita: 5, unita_acquisto: 'CF', imponibile_riga: 50 },
    { ...base, id: 'b', data_fattura: '2026-02-01', quantita: -1, unita_acquisto: 'CF', imponibile_riga: -10 },
    { ...base, id: 'c', data_fattura: '2025-01-01', quantita: 3, unita_acquisto: 'PZ', imponibile_riga: 12 },
  ]} />);
  fireEvent.change(screen.getByLabelText('Anno acquisto'), { target: { value: '2026' } });
  fireEvent.change(screen.getByLabelText('Visualizzazione'), { target: { value: 'annuali' } });
  expect(screen.getByRole('cell', { name: '4' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: /40,00\s+€/  })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'PZ' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Visualizzazione'), { target: { value: 'categorie' } });
  expect(screen.getByRole('cell', { name: 'MATERIALI' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: /40,00\s+€/  })).toBeInTheDocument();
});

it('confirms the displayed proposal and reports failure without losing the search', async () => {
  const conferma = vi.fn().mockRejectedValue(new Error('Salvataggio non riuscito'));
  const riga = { ...materiali[0], proposta_classificazione: { contonome: 'MATERIALI' }, proposta_token: 'token' };
  render(<RicercaMateriali materiali={[riga]} onConferma={conferma} />);
  fireEvent.change(screen.getByLabelText('Cerca materiali'), { target: { value: 'aroma' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conferma classificazione' }));
  await waitFor(() => expect(conferma).toHaveBeenCalledWith(riga));
  expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio non riuscito');
  expect(screen.getByLabelText('Cerca materiali')).toHaveValue('aroma');
  expect(screen.getByRole('button', { name: 'Conferma classificazione' })).toBeEnabled();
});

it('defaults to material suppliers including unclassified products and can show everyone', () => {
  render(<RicercaMateriali materiali={materiali} fornitoriMaterialiIds={['U']} />);
  expect(screen.getByRole('status')).toHaveTextContent('1 risultati su 1 righe');
  expect(screen.getByRole('cell', { name: 'Alginato aroma' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aroma rosa' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Fornitori da includere'), { target: { value: 'tutti' } });
  expect(screen.getByRole('status')).toHaveTextContent('2 risultati su 2 righe');
  fireEvent.change(screen.getByLabelText('Fornitori da includere'), { target: { value: 'materiali' } });
  fireEvent.click(screen.getByRole('button', { name: 'Azzera ricerca e filtri' }));
  expect(screen.getByRole('status')).toHaveTextContent('1 risultati su 1 righe');
});
