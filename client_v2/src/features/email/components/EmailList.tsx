import React, { useState } from 'react'
import {
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CButton,
  CSpinner,
  CFormInput,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilReload, cilEnvelopeClosed, cilEnvelopeOpen } from '@coreui/icons'
import type { EmailMessage } from '../types/email.types'

interface EmailListProps {
  emails: EmailMessage[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onRefresh: () => void
  onSelectEmail: (email: EmailMessage) => void
  onSearch: (query: string) => void
  searchQuery: string
  showClassification?: boolean
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  hasMore,
  onLoadMore,
  onRefresh,
  onSelectEmail,
  onSearch,
  searchQuery,
  showClassification = false,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const handleSearch = () => {
    onSearch(localSearch)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      if (isToday) {
        return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      }
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
    } catch {
      return dateStr
    }
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-3">
        <CInputGroup>
          <CInputGroupText>
            <CIcon icon={cilSearch} />
          </CInputGroupText>
          <CFormInput
            placeholder="Cerca email (usa sintassi Gmail: from:, subject:, has:attachment...)"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <CButton color="primary" onClick={handleSearch}>
            Cerca
          </CButton>
        </CInputGroup>
        <CButton color="outline-secondary" onClick={onRefresh} disabled={loading}>
          <CIcon icon={cilReload} />
        </CButton>
      </div>

      {loading && emails.length === 0 ? (
        <div className="text-center py-5">
          <CSpinner color="primary" />
          <p className="mt-2 text-muted">Caricamento email...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-5 text-muted">
          Nessuna email trovata
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
            <CTable hover responsive striped style={{ tableLayout: 'fixed' }}>
              <CTableHead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--cui-body-bg, #fff)' }}>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '30px' }}></CTableHeaderCell>
                  {showClassification && (
                    <CTableHeaderCell style={{ width: '120px' }}>Categoria</CTableHeaderCell>
                  )}
                  <CTableHeaderCell style={{ width: '80px' }}>Data</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '200px' }}>Da</CTableHeaderCell>
                  <CTableHeaderCell>Oggetto</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {emails.map((email) => (
                  <CTableRow
                    key={email.id}
                    onClick={() => onSelectEmail(email)}
                    style={{
                      cursor: 'pointer',
                      fontWeight: email.is_unread ? 'bold' : 'normal',
                    }}
                  >
                    <CTableDataCell>
                      <CIcon
                        icon={email.is_unread ? cilEnvelopeClosed : cilEnvelopeOpen}
                        size="sm"
                        className={email.is_unread ? 'text-primary' : 'text-muted'}
                      />
                    </CTableDataCell>
                    {showClassification && (
                      <CTableDataCell>
                        {email.classification ? (
                          <CBadge
                            style={{
                              backgroundColor: email.classification.scope_color,
                              fontSize: '0.75rem',
                            }}
                          >
                            {email.classification.scope_label}
                          </CBadge>
                        ) : (
                          <CBadge color="secondary" style={{ fontSize: '0.75rem' }}>
                            Non classificata
                          </CBadge>
                        )}
                      </CTableDataCell>
                    )}
                    <CTableDataCell className="text-nowrap text-muted">
                      {formatDate(email.date)}
                    </CTableDataCell>
                    <CTableDataCell className="text-truncate">
                      {email.from_name || email.from_email}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="text-truncate">
                        {email.subject}
                      </div>
                      <small className="text-muted text-truncate d-block">
                        {email.snippet}
                      </small>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>

          <div className="d-flex justify-content-between align-items-center pt-2 border-top">
            <small className="text-muted">{emails.length} email visualizzate</small>
            {hasMore && (
              <CButton
                color="outline-primary"
                size="sm"
                onClick={onLoadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Caricamento...
                  </>
                ) : (
                  'Carica altre email'
                )}
              </CButton>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default EmailList
