import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import toast from 'react-hot-toast'
import AnagraficaModal from './AnagraficaModal'
import automationMessagesService from '../services/automationMessagesService'
import type { AnagraficaResponse, AnagraficaSubmission } from '../services/automationMessagesService'

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('../services/automationMessagesService', () => ({
  default: { apiGetAnagrafica: vi.fn() },
}))

const FIELD_LABELS = [
  'Cognome', 'Nome', 'Data di nascita', 'Comune di nascita', 'Codice fiscale', 'Sesso',
  'Indirizzo', 'CAP', 'Citta', 'Provincia', 'Cellulare', 'Email', 'Informativa privacy',
]

const makeSubmission = (
  id: string,
  overrides: Record<string, string>,
  phoneMatch: boolean,
): AnagraficaSubmission => {
  const values: Record<string, string> = {
    Cognome: 'Rossi', Nome: 'Mario', 'Data di nascita': '01/02/1990', 'Comune di nascita': 'Prato',
    'Codice fiscale': 'RSSMRA90B01G999X', Sesso: 'Maschio', Indirizzo: 'Via Roma 1', CAP: '59100',
    Citta: 'Prato', Provincia: 'PO', Cellulare: '3331112233', Email: 'mario.rossi@example.com',
    'Informativa privacy': "Letta e confermata dall'utente", ...overrides,
  }
  return {
    email_id: id,
    received_at: 'Thu, 22 Oct 2026 20:51:00 +0200',
    phone_match: phoneMatch,
    fields: FIELD_LABELS.map(label => ({ label, value: values[label] })),
  }
}

const respond = (submissions: AnagraficaSubmission[]) =>
  vi.mocked(automationMessagesService.apiGetAnagrafica).mockResolvedValue({
    state: 'success',
    data: { submissions },
  })

const open = () => render(<AnagraficaModal messageId={5} onClose={vi.fn()} />)

describe('AnagraficaModal', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('con una sola coincidenza per numero apre direttamente i campi, senza Copia tutto', async () => {
    respond([makeSubmission('m1', {}, true), makeSubmission('m2', { Cognome: 'Bianchi' }, false)])
    open()
    expect(await screen.findByRole('button', { name: 'Copia Cognome' })).toBeInTheDocument()
    expect(automationMessagesService.apiGetAnagrafica).toHaveBeenCalledWith(5)
    expect(screen.getAllByRole('button', { name: /^Copia / })).toHaveLength(13)
    expect(screen.queryByRole('button', { name: /copia tutto/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Indietro' })).not.toBeInTheDocument()
  })

  it('senza coincidenze mostra l elenco; Apri mostra i campi e Indietro torna all elenco', async () => {
    respond([
      makeSubmission('m1', { Cognome: 'Verdi', Nome: 'Anna' }, false),
      makeSubmission('m2', { Cognome: 'Neri', Nome: 'Luca' }, false),
    ])
    open()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/Verdi Anna/)).toBeInTheDocument()
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Apri' }))
    expect(await screen.findByRole('button', { name: 'Copia Cognome' })).toBeInTheDocument()
    expect(screen.getByText('Neri')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
  })

  it('con piu coincidenze mostra l elenco e segna quelle dello stesso numero', async () => {
    respond([makeSubmission('m1', {}, true), makeSubmission('m2', {}, true)])
    open()
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByText('stesso numero')).toHaveLength(2)
  })

  it('senza anagrafiche dice che non e ancora arrivata', async () => {
    respond([])
    open()
    expect(await screen.findByText('Anagrafica non ancora ricevuta')).toBeInTheDocument()
  })

  it('Copia scrive il solo valore del campo negli appunti e mostra il toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Cellulare' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('3331112233'))
    expect(toast.success).toHaveBeenCalledWith('Copiato')
  })

  it('senza navigator.clipboard usa il metodo di riserva', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Email' }))
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
    expect(toast.success).toHaveBeenCalledWith('Copiato')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('se la copia non riesce mostra il toast rosso', async () => {
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Nome' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Copia non riuscita'))
  })

  it('un campo vuoto ha il Copia disabilitato', async () => {
    respond([makeSubmission('m1', { Provincia: '-' }, true)])
    open()
    expect(await screen.findByRole('button', { name: 'Copia Provincia' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copia Cognome' })).toBeEnabled()
  })

  it('se Gmail risponde con un errore mostra il messaggio e Riprova ricarica', async () => {
    vi.mocked(automationMessagesService.apiGetAnagrafica).mockResolvedValueOnce({
      state: 'error',
      error: 'GMAIL_AUTH_REQUIRED',
      message: 'Autenticazione Gmail richiesta',
    })
    open()
    expect(await screen.findByText('Autenticazione Gmail richiesta')).toBeInTheDocument()
    respond([makeSubmission('m1', {}, true)])
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByRole('button', { name: 'Copia Cognome' })).toBeInTheDocument()
    expect(automationMessagesService.apiGetAnagrafica).toHaveBeenCalledTimes(2)
  })

  it('se la richiesta fallisce mostra un errore di rete', async () => {
    vi.mocked(automationMessagesService.apiGetAnagrafica).mockRejectedValueOnce({ message: 'Errore server', status: 500 })
    open()
    expect(await screen.findByText('Errore server')).toBeInTheDocument()
  })

  it('se writeText rifiuta usa il metodo di riserva', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Nome' }))
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
    expect(toast.success).toHaveBeenCalledWith('Copiato')
  })

  it('una risposta in ritardo del messaggio precedente non sostituisce quella del nuovo', async () => {
    let resolveFirst: (value: AnagraficaResponse) => void = () => {}
    vi.mocked(automationMessagesService.apiGetAnagrafica)
      .mockReturnValueOnce(new Promise<AnagraficaResponse>(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce({
        state: 'success',
        data: { submissions: [makeSubmission('m6', { Cognome: 'Secondo' }, true)] },
      })
    const { rerender } = render(<AnagraficaModal messageId={5} onClose={vi.fn()} />)
    rerender(<AnagraficaModal messageId={6} onClose={vi.fn()} />)
    expect(await screen.findByText('Secondo')).toBeInTheDocument()
    resolveFirst({
      state: 'success',
      data: { submissions: [makeSubmission('m5', { Cognome: 'Primo' }, true)] },
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.queryByText('Primo')).not.toBeInTheDocument()
    expect(screen.getByText('Secondo')).toBeInTheDocument()
  })

  it('il metodo di riserva mette la textarea dentro la finestra e non nel body', async () => {
    let hostTag = ''
    const execCommand = vi.fn(() => {
      const area = document.querySelector('textarea')
      hostTag = area?.parentElement === document.body ? 'body' : 'dentro'
      return true
    })
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    const button = await screen.findByRole('button', { name: 'Copia Nome' })
    button.focus() // un click vero sposta il focus sul pulsante, fireEvent no
    fireEvent.click(button)
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
    expect(hostTag).toBe('dentro')
  })
})
