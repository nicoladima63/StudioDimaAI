import React, { useState, useEffect } from 'react'
import {
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CModalTitle,
  CBadge,
  CButton,
  CSpinner,
  CListGroup,
  CListGroupItem,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPaperclip, cilFilter } from '@coreui/icons'
import { emailService } from '../services/emailService'
import type { EmailMessage, EmailMessageDetail } from '../types/email.types'

export interface RulePreset {
  field: string
  operator: string
  value: string
  label: string
}

interface EmailDetailProps {
  email: EmailMessage | null
  visible: boolean
  onClose: () => void
  onCreateRule?: (presets: RulePreset[]) => void
}

const EmailDetail: React.FC<EmailDetailProps> = ({ email, visible, onClose, onCreateRule }) => {
  const [detail, setDetail] = useState<EmailMessageDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (email && visible) {
      loadDetail(email.id)
    } else {
      setDetail(null)
    }
  }, [email, visible])

  const loadDetail = async (messageId: string) => {
    setLoading(true)
    try {
      const result = await emailService.apiGetMessageDetail(messageId)
      if (result.success && result.data) {
        setDetail(result.data)
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const buildRulePresets = (): RulePreset[] => {
    if (!detail) return []
    const presets: RulePreset[] = []

    if (detail.from_email) {
      presets.push({
        field: 'from',
        operator: 'contains',
        value: detail.from_email,
        label: `Mittente contiene "${detail.from_email}"`,
      })
      // Extract domain
      const domain = detail.from_email.split('@')[1]
      if (domain) {
        presets.push({
          field: 'from',
          operator: 'contains',
          value: `@${domain}`,
          label: `Mittente da dominio "@${domain}"`,
        })
      }
    }

    if (detail.subject) {
      presets.push({
        field: 'subject',
        operator: 'contains',
        value: detail.subject,
        label: `Oggetto contiene "${detail.subject.substring(0, 40)}${detail.subject.length > 40 ? '...' : ''}"`,
      })
      // Extract meaningful words from subject (>3 chars)
      const words = detail.subject
        .replace(/re:|fwd:|fw:|r:|i:/gi, '')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 3)
      if (words.length > 0) {
        const keyword = words[0].toLowerCase()
        presets.push({
          field: 'subject',
          operator: 'contains',
          value: keyword,
          label: `Oggetto contiene "${keyword}"`,
        })
      }
    }

    if (detail.from_name) {
      presets.push({
        field: 'from',
        operator: 'contains',
        value: detail.from_name,
        label: `Mittente contiene "${detail.from_name}"`,
      })
    }

    return presets
  }

  const handleCreateRule = (preset: RulePreset) => {
    if (onCreateRule) {
      onCreateRule([preset])
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} size="xl" scrollable>
      <CModalHeader>
        <CModalTitle className="text-truncate" style={{ maxWidth: '90%' }}>
          {email?.subject || '(nessun oggetto)'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className="text-center py-5">
            <CSpinner color="primary" />
          </div>
        ) : detail ? (
          <div>
            {/* Header info */}
            <div className="mb-3 p-3 bg-light rounded">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong>Da:</strong> {detail.from_name} &lt;{detail.from_email}&gt;
                  <br />
                  <strong>A:</strong> {detail.to}
                  <br />
                  <strong>Data:</strong> {detail.date}
                </div>
                {email?.classification && (
                  <CBadge
                    style={{
                      backgroundColor: email.classification.scope_color,
                    }}
                  >
                    {email.classification.scope_label}
                  </CBadge>
                )}
              </div>
            </div>

            {/* Attachments */}
            {detail.attachments.length > 0 && (
              <div className="mb-3">
                <strong>
                  <CIcon icon={cilPaperclip} className="me-1" />
                  Allegati ({detail.attachments.length}):
                </strong>
                <CListGroup className="mt-2">
                  {detail.attachments.map((att, idx) => (
                    <CListGroupItem key={idx} className="d-flex justify-content-between align-items-center py-2">
                      <span>{att.filename}</span>
                      <small className="text-muted">{formatFileSize(att.size)}</small>
                    </CListGroupItem>
                  ))}
                </CListGroup>
              </div>
            )}

            {/* Body */}
            <div className="border rounded p-3">
              {detail.body_html ? (
                <div
                  dangerouslySetInnerHTML={{ __html: detail.body_html }}
                  style={{ maxHeight: '500px', overflow: 'auto' }}
                />
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '500px', overflow: 'auto' }}>
                  {detail.body_text || 'Nessun contenuto'}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted py-5">
            Impossibile caricare il contenuto dell'email
          </div>
        )}
      </CModalBody>
      {detail && onCreateRule && (
        <CModalFooter className="d-flex justify-content-between">
          <CDropdown>
            <CDropdownToggle color="primary" size="sm">
              <CIcon icon={cilFilter} className="me-1" />
              Crea Regola da questa email
            </CDropdownToggle>
            <CDropdownMenu>
              {buildRulePresets().map((preset, idx) => (
                <CDropdownItem key={idx} onClick={() => handleCreateRule(preset)}>
                  {preset.label}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
          <CButton color="secondary" size="sm" onClick={onClose}>
            Chiudi
          </CButton>
        </CModalFooter>
      )}
    </CModal>
  )
}

export default EmailDetail
