import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CatalogoPage from './CatalogoPage'
import catalogoService from '../services/catalogo.service'
import type { ProdottoCatalogo, RicercaProdottiRisposta } from '../types/catalogo'

vi.mock('../services/catalogo.service', () => ({
  default: {
    apiRicercaProdotti: vi.fn(),
    apiGetFornitori: vi.fn(),
    apiClassificaProdotti: vi.fn(),
    apiUnisciProdotti: vi.fn(),
  },
}))
vi.mock('../components/ClassificazioneSelect', () => ({ default: () => <div>Selettore classificazione</div> }))
vi.mock('../components/ProdottoSheet', () => ({ default: () => null }))

const prodotto = (id: number, nome: string, extra: Partial<ProdottoCatalogo> = {}): ProdottoCatalogo => ({
  id, nome, stato: 'classificato', archiviato: 0, unita_base: '', soglia_minima: null, note: '',
  contoid: 18, brancaid: 2, sottocontoid: 2, contonome: 'MATERIALI', brancanome: 'CONSERVATIVA', sottocontonome: 'COMPOSITI',
  n_offerte: 1, ultimo_acquisto: '2025-03-10', miglior_prezzo_unitario: 31,
  offerte: [{ id: id * 10, prodotto_id: id, fornitore_id: 'F2', fornitore_nome: 'Generale Spa', codice: `C${id}`, ultimo_prezzo: 31, pezzi_per_confezione: 1 }],
  ...extra,
})

const risposta = (prodotti: ProdottoCatalogo[]): RicercaProdottiRisposta => ({
  prodotti,
  riepilogo: { classificato: prodotti.length },
  pagination: { page: 1, per_page: 20, total: prodotti.length, pages: 1 },
})

const renderPage = () => render(<MemoryRouter><CatalogoPage /></MemoryRouter>)

describe('Catalogo materiali', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.mocked(catalogoService.apiGetFornitori).mockResolvedValue([{ id: 'F2', nome: 'Generale Spa', n: 2 }])
    vi.mocked(catalogoService.apiRicercaProdotti).mockResolvedValue(risposta([prodotto(1, 'COMPOSITO A2'), prodotto(2, 'COMPOSITO A3')]))
  })

  it('mostra prodotti, classificazione per nome e paginazione sopra e sotto', async () => {
    renderPage()
    expect(await screen.findByText('COMPOSITO A2')).toBeInTheDocument()
    expect(screen.getAllByText('COMPOSITI')).toHaveLength(2)
    expect(screen.getAllByText('Pagina 1 di 1')).toHaveLength(2)
  })

  it('cerca con debounce e riparte dalla prima pagina', async () => {
    renderPage()
    await screen.findByText('COMPOSITO A2')
    fireEvent.change(screen.getByLabelText('Cerca nel catalogo'), { target: { value: 'a2 composito' } })
    await waitFor(() =>
      expect(catalogoService.apiRicercaProdotti).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'a2 composito', page: 1 }))
    )
  })

  it('abilita Unisci solo con almeno due prodotti selezionati', async () => {
    renderPage()
    await screen.findByText('COMPOSITO A2')
    fireEvent.click(screen.getByLabelText('Seleziona COMPOSITO A2'))
    expect(screen.getByText('1 selezionati')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unisci/ })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Seleziona COMPOSITO A3'))
    expect(screen.getByRole('button', { name: /Unisci/ })).toBeEnabled()
  })

  it('unisce nel prodotto scelto e ricarica l\'elenco', async () => {
    vi.mocked(catalogoService.apiUnisciProdotti).mockResolvedValue({ offerte_spostate: 1, classificazioni_diverse_ignorate: 0 })
    renderPage()
    await screen.findByText('COMPOSITO A2')
    fireEvent.click(screen.getByLabelText('Seleziona COMPOSITO A2'))
    fireEvent.click(screen.getByLabelText('Seleziona COMPOSITO A3'))
    fireEvent.click(screen.getByRole('button', { name: /Unisci$/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getAllByRole('radio')[1] as HTMLElement)
    fireEvent.click(within(dialog).getByRole('button', { name: /Unisci in quello scelto/ }))
    await waitFor(() => expect(catalogoService.apiUnisciProdotti).toHaveBeenCalledWith(2, [1]))
    await waitFor(() => expect(catalogoService.apiRicercaProdotti).toHaveBeenCalledTimes(2))
  })

  it('mostra lo stato vuoto', async () => {
    vi.mocked(catalogoService.apiRicercaProdotti).mockResolvedValue(risposta([]))
    renderPage()
    expect(await screen.findByText(/Nessun prodotto trovato/)).toBeInTheDocument()
  })
})
