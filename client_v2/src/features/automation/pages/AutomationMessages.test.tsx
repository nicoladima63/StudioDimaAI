import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import AutomationMessages from './AutomationMessages'
import automationMessagesService from '../services/automationMessagesService'

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('../services/automationMessagesService', () => ({
  default: { list: vi.fn(), apiGetAnagrafica: vi.fn() },
}))

const row = (id: number, recipient: string) => ({
  id,
  created_at: '2026-10-22 16:47:57',
  channel: 'whatsapp',
  recipient,
  message_text: 'Ciao Mario Rossi, ecco il modulo https://example.com/form',
  result_json: '{"message": "ok"}',
})

describe('AutomationMessages', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.mocked(automationMessagesService.list).mockResolvedValue({
      data: [row(12, '3331112233'), row(11, '3334445566')],
    })
    vi.mocked(automationMessagesService.apiGetAnagrafica).mockResolvedValue({
      state: 'success',
      data: { submissions: [] },
    })
  })

  it('ogni riga ha l icona Dettaglio', async () => {
    render(<AutomationMessages />)
    expect(await screen.findAllByRole('button', { name: 'Dettaglio' })).toHaveLength(2)
  })

  it('il clic su Dettaglio cerca l anagrafica di quella riga e apre la finestra', async () => {
    render(<AutomationMessages />)
    const rows = await screen.findAllByRole('row')
    fireEvent.click(within(rows[2]).getByRole('button', { name: 'Dettaglio' }))
    expect(await screen.findByText('Anagrafica non ancora ricevuta')).toBeInTheDocument()
    expect(automationMessagesService.apiGetAnagrafica).toHaveBeenCalledWith(11)
    expect(screen.getByText('Anagrafica paziente')).toBeInTheDocument()
  })

  it('Chiudi nasconde la finestra', async () => {
    render(<AutomationMessages />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Dettaglio' }))[0])
    await screen.findByText('Anagrafica non ancora ricevuta')
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    // waitFor di Testing Library (non vi.waitFor): durante l'attesa disattiva il controllo act sull'animazione di chiusura
    await waitFor(() => expect(screen.queryByText('Anagrafica paziente')).not.toBeInTheDocument())
  })
})
