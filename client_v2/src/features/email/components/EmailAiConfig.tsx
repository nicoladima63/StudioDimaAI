import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardHeader,
  CCardBody,
  CButton,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CAlert,
  CSpinner,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilXCircle, cilSave, cilMediaPlay } from '@coreui/icons'
import { emailService } from '../services/emailService'
import type { EmailAiConfig as AiConfigType } from '../types/email.types'

const AI_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Consigliato)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Veloce)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Avanzato)' },
]

const EmailAiConfig: React.FC = () => {
  const [config, setConfig] = useState<AiConfigType | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-20250514')
  const [active, setActive] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await emailService.apiGetAiConfig()
      if (result.success && result.data) {
        setConfig(result.data)
        setModel(result.data.model || 'claude-sonnet-4-20250514')
        setActive(result.data.active === 1)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const data: Partial<AiConfigType> = {
        provider: 'claude',
        model,
        active: active ? 1 : 0,
      }
      // Only send API key if user entered a new one
      if (apiKey) {
        data.api_key = apiKey
      }

      const result = await emailService.apiSaveAiConfig(data)
      if (result.success) {
        setSuccess('Configurazione AI salvata')
        setApiKey('')
        loadConfig()
      } else {
        setError(result.error || 'Errore salvataggio')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center py-4">
          <CSpinner color="primary" />
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Classificazione AI (Claude)</strong>
        <CBadge color={config?.active ? 'success' : 'secondary'}>
          <CIcon icon={config?.active ? cilCheckCircle : cilXCircle} className="me-1" />
          {config?.active ? 'Attiva' : 'Disattivata'}
        </CBadge>
      </CCardHeader>
      <CCardBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}
        {success && (
          <CAlert color="success" dismissible onClose={() => setSuccess(null)}>
            {success}
          </CAlert>
        )}

        <p className="text-muted mb-3">
          Quando le regole manuali non trovano una corrispondenza, l'AI analizza l'email
          e la classifica automaticamente nella categoria piu' appropriata.
        </p>

        <div className="mb-3">
          <CFormLabel>API Key Anthropic</CFormLabel>
          <CFormInput
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.api_key_masked || 'Inserisci la tua API key Anthropic'}
          />
          {config?.api_key_masked && (
            <small className="text-muted">
              Chiave attuale: {config.api_key_masked} (lascia vuoto per mantenerla)
            </small>
          )}
        </div>

        <div className="mb-3">
          <CFormLabel>Modello</CFormLabel>
          <CFormSelect value={model} onChange={(e) => setModel(e.target.value)}>
            {AI_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </CFormSelect>
        </div>

        <div className="mb-3">
          <CFormSwitch
            label="Abilita classificazione AI"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </div>

        <div className="d-flex gap-2">
          <CButton color="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilSave} className="me-1" />
            )}
            Salva Configurazione
          </CButton>
          {config?.active === 1 && (
            <CButton
              color="outline-info"
              onClick={async () => {
                setTesting(true)
                setTestResult(null)
                setError(null)
                try {
                  // Fetch the latest email to test
                  const emailsResult = await emailService.apiGetMessages(1)
                  if (!emailsResult.success || !emailsResult.data?.emails?.length) {
                    setError('Nessuna email disponibile per il test')
                    setTesting(false)
                    return
                  }
                  const testEmail = emailsResult.data.emails[0]
                  const result = await emailService.apiTestAiClassification(testEmail)
                  if (result.success && result.data) {
                    const d = result.data as any
                    setTestResult(
                      `Scopo: ${d.scope_label || d.scope_name || 'N/A'} | Confidence: ${Math.round((d.confidence || 0) * 100)}% | Oggetto: "${testEmail.subject || 'N/A'}"`
                    )
                  } else {
                    setTestResult(`L'AI non ha classificato l'email "${testEmail.subject}" in nessuno scopo attivo`)
                  }
                } catch (err: any) {
                  setError(err.message)
                } finally {
                  setTesting(false)
                }
              }}
              disabled={testing}
            >
              {testing ? (
                <CSpinner size="sm" className="me-1" />
              ) : (
                <CIcon icon={cilMediaPlay} className="me-1" />
              )}
              Testa AI
            </CButton>
          )}
        </div>
        {testResult && (
          <CAlert color="info" className="mt-3" dismissible onClose={() => setTestResult(null)}>
            <strong>Risultato test:</strong> {testResult}
          </CAlert>
        )}
      </CCardBody>
    </CCard>
  )
}

export default EmailAiConfig
