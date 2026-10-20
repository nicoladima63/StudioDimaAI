import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AggiungiMaterialiPage from './AggiungiMaterialiPage'
import catalogoService from '../services/catalogo.service'
import type { ClassificazioneIds, PropostaClassificazione, VoceGestionale } from '../types/catalogo'

vi.mock('../services/catalogo.service', () => ({
  default: {
    apiGetVociGestionale: vi.fn(),
    apiGetFornitori: vi.fn(),
    apiAggiungiVoci: vi.fn(),
  },
}))
vi.mock('../components/ClassificazioneSelect', () => ({
  default: ({ value }: { value: ClassificazioneIds }) => (
    <div data-testid="classificazione">{`${value.contoid}/${value.brancaid}/${value.sottocontoid}`}</div>
  ),
}))

const proposta = (branca: number | null, sotto: number | null): PropostaClassificazione => ({
  contoid: 18, brancaid: branca, sottocontoid: sotto, contonome: 'MATERIALI', brancanome: 'IMPLANTOLOGIA', sottocontonome: 'IMPIANTI',
  fonte: 'famiglia_prodotti', confidence: 97, riferimento: 'SEVEN XD',
})

const voce = (nome: string, prop: PropostaClassificazione | null): VoceGestionale => ({
  fornitore_id: 'F1', fornitore_nome: 'Dentsply', codice: nome.slice(-4), nome, n_acquisti: 1, ultimo_acquisto: '2026-09-30',
  ultimo_prezzo: 131.76, fatture: [{ fattura_id: 'D1', numero_documento: 'R1', data: '2026-09-30' }],
  in_catalogo: false, offerta_id: null, prodotto_id: null, proposta: prop,
})

const carica = (voci: VoceGestionale[]) =>
  vi.mocked(catalogoService.apiGetVociGestionale).mockResolvedValue({
    state: 'success',
    data: { voci, pagination: { page: 1, per_page: 20, total: voci.length, pages: 1 } },
  })

const apriDialogCon = async (nomi: string[]) => {
  render(<MemoryRouter><AggiungiMaterialiPage /></MemoryRouter>)
  for (const nome of nomi) fireEvent.click(await screen.findByLabelText(`Seleziona ${nome}`))
  fireEvent.click(screen.getByRole('button', { name: /Scegli una classificazione per tutte/ }))
  return within(await screen.findByRole('dialog'))
}

describe('Aggiungi materiali: dialog con classificazione unica', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.mocked(catalogoService.apiGetFornitori).mockResolvedValue([])
  })

  it('precompila la classificazione proposta', async () => {
    carica([voce('IMPIANTO L6', proposta(4, 40))])
    const dialog = await apriDialogCon(['IMPIANTO L6'])
    expect(dialog.getByTestId('classificazione')).toHaveTextContent('18/4/40')
    expect(dialog.getByText(/precompilata/)).toBeInTheDocument()
  })

  it('con proposte diverse precompila fino al livello su cui concordano', async () => {
    carica([voce('IMPIANTO L6', proposta(4, 40)), voce('IMPIANTO L8', proposta(4, 41))])
    const dialog = await apriDialogCon(['IMPIANTO L6', 'IMPIANTO L8'])
    expect(dialog.getByTestId('classificazione')).toHaveTextContent('18/4/null')
    expect(dialog.getByText(/non coincidono/)).toBeInTheDocument()
  })

  it('senza proposte lascia la classificazione vuota', async () => {
    carica([voce('ARTICOLO NUOVO', null)])
    const dialog = await apriDialogCon(['ARTICOLO NUOVO'])
    expect(dialog.getByTestId('classificazione')).toHaveTextContent('null/null/null')
    expect(dialog.getByText(/Nessuna proposta/)).toBeInTheDocument()
  })

  it('ordina per nome di default, inverte al secondo clic e torna all’ordine del server al terzo', async () => {
    carica([voce('RECIPROC BLUE', null), voce('SEVEN XD L8', null), voce('MIRAJECT 25G', null)])
    render(<MemoryRouter><AggiungiMaterialiPage /></MemoryRouter>)
    const nomi = async () =>
      (await screen.findAllByLabelText(/^Seleziona (?!tutte)/)).map((el) => el.getAttribute('aria-label')?.replace('Seleziona ', ''))
    const intestazione = () => screen.getByRole('button', { name: 'Ordina per Voce in fattura' })
    expect(await nomi()).toEqual(['MIRAJECT 25G', 'RECIPROC BLUE', 'SEVEN XD L8'])
    fireEvent.click(intestazione())
    expect(await nomi()).toEqual(['SEVEN XD L8', 'RECIPROC BLUE', 'MIRAJECT 25G'])
    fireEvent.click(intestazione())
    expect(await nomi()).toEqual(['RECIPROC BLUE', 'SEVEN XD L8', 'MIRAJECT 25G'])
  })

  it('mostra il pulsante di aggiunta rapida solo per le proposte molto affidabili e invia la classificazione mostrata', async () => {
    carica([
      voce('IMPIANTO SICURO', { ...proposta(4, 40), confidence: 97 }),
      voce('IMPIANTO DUBBIO', { ...proposta(4, 40), confidence: 70 }),
      voce('SENZA PROPOSTA', null),
    ])
    vi.mocked(catalogoService.apiAggiungiVoci).mockResolvedValue({ creati: 1, errori: 0, risultati: [] })
    render(<MemoryRouter><AggiungiMaterialiPage /></MemoryRouter>)
    const pulsante = await screen.findByRole('button', { name: 'Aggiungi IMPIANTO SICURO' })
    expect(screen.queryByRole('button', { name: 'Aggiungi IMPIANTO DUBBIO' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aggiungi SENZA PROPOSTA' })).not.toBeInTheDocument()
    fireEvent.click(pulsante)
    await waitFor(() =>
      expect(catalogoService.apiAggiungiVoci).toHaveBeenCalledWith([
        expect.objectContaining({ nome: 'IMPIANTO SICURO', classificazione: { contoid: 18, brancaid: 4, sottocontoid: 40 } }),
      ])
    )
  })

  it('con due voci dalle proposte diverse, il pulsante proposto le aggiunge ognuna con la propria classificazione', async () => {
    carica([voce('IMPIANTO A', proposta(4, 40)), voce('GUANTI B', proposta(7, 70))])
    vi.mocked(catalogoService.apiAggiungiVoci).mockResolvedValue({ creati: 2, errori: 0, risultati: [] })
    render(<MemoryRouter><AggiungiMaterialiPage /></MemoryRouter>)
    fireEvent.click(await screen.findByLabelText('Seleziona IMPIANTO A'))
    fireEvent.click(screen.getByLabelText('Seleziona GUANTI B'))
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi con le classificazioni proposte$/ }))
    await waitFor(() => expect(catalogoService.apiAggiungiVoci).toHaveBeenCalled())
    const inviate = vi.mocked(catalogoService.apiAggiungiVoci).mock.calls[0]?.[0] ?? []
    expect(inviate.map((v) => v.classificazione?.sottocontoid).sort()).toEqual([40, 70])
  })
})
