import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CAlert,
  CBadge,
  CButton,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import { Skeleton } from '@/components/ui/skeleton'
import automationMessagesService from '../services/automationMessagesService'
import type { AnagraficaSubmission } from '../services/automationMessagesService'

type Props = {
  messageId: number | null
  onClose: () => void
}

// L'app e' servita anche da http://serverdima:5001 (senza HTTPS), dove navigator.clipboard puo' mancare
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // si passa al metodo di riserva
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(area)
  }
}

const isEmpty = (value: string) => value === '' || value === '-'

const fieldValue = (submission: AnagraficaSubmission, label: string) =>
  submission.fields.find(field => field.label === label)?.value ?? '-'

const fmtReceived = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
}

const AnagraficaModal: React.FC<Props> = ({ messageId, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<AnagraficaSubmission[]>([])
  const [selected, setSelected] = useState<AnagraficaSubmission | null>(null)
  const [fromList, setFromList] = useState(false)

  const load = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    setSubmissions([])
    setSelected(null)
    setFromList(false)
    try {
      const res = await automationMessagesService.apiGetAnagrafica(id)
      if (res.state === 'error') {
        setError(res.message || res.error || 'Errore nel recupero dell\'anagrafica')
        return
      }
      const found = res.data?.submissions ?? []
      setSubmissions(found)
      const matches = found.filter(submission => submission.phone_match)
      if (matches.length === 1) setSelected(matches[0])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (messageId !== null) load(messageId)
  }, [messageId, load])

  const handleCopy = async (value: string) => {
    if (await copyText(value)) toast.success('Copiato')
    else toast.error('Copia non riuscita')
  }

  const renderBody = () => {
    if (loading) {
      return (
        <>
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </>
      )
    }
    if (error) {
      return (
        <CAlert color="danger" className="d-flex justify-content-between align-items-center mb-0">
          <span>{error}</span>
          <CButton color="danger" variant="outline" size="sm" onClick={() => messageId !== null && load(messageId)}>
            Riprova
          </CButton>
        </CAlert>
      )
    }
    if (selected) {
      return (
        <CListGroup flush>
          {selected.fields.map(field => (
            <CListGroupItem key={field.label} className="d-flex justify-content-between align-items-center">
              <div>
                <div className="small text-muted">{field.label}</div>
                <div>{field.value}</div>
              </div>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                aria-label={`Copia ${field.label}`}
                disabled={isEmpty(field.value)}
                onClick={() => handleCopy(field.value)}
              >
                Copia
              </CButton>
            </CListGroupItem>
          ))}
        </CListGroup>
      )
    }
    if (submissions.length === 0) {
      return <CAlert color="info" className="mb-0">Anagrafica non ancora ricevuta</CAlert>
    }
    return (
      <>
        <p className="small text-muted">Scegli l&apos;email giusta tra quelle arrivate dopo l&apos;invio:</p>
        <CListGroup flush>
          {submissions.map(submission => (
            <CListGroupItem key={submission.email_id} className="d-flex justify-content-between align-items-center">
              <div>
                <div>
                  {fieldValue(submission, 'Cognome')} {fieldValue(submission, 'Nome')}{' '}
                  {submission.phone_match && <CBadge color="success">stesso numero</CBadge>}
                </div>
                <div className="small text-muted">
                  {fmtReceived(submission.received_at)} - {fieldValue(submission, 'Cellulare')}
                </div>
              </div>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected(submission)
                  setFromList(true)
                }}
              >
                Apri
              </CButton>
            </CListGroupItem>
          ))}
        </CListGroup>
      </>
    )
  }

  return (
    <CModal visible={messageId !== null} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Anagrafica paziente</CModalTitle>
      </CModalHeader>
      <CModalBody>{renderBody()}</CModalBody>
      <CModalFooter>
        {fromList && selected && (
          <CButton color="secondary" variant="outline" className="me-auto" onClick={() => setSelected(null)}>
            Indietro
          </CButton>
        )}
        <CButton color="secondary" onClick={onClose}>
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default AnagraficaModal
