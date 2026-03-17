import React from 'react'
import { CBadge } from '@coreui/react'
import type { EmailScope } from '../types/email.types'

const FILTER_UNCLASSIFIED = -1

interface EmailScopeFilterProps {
  scopes: EmailScope[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  unclassifiedCount?: number
}

const EmailScopeFilter: React.FC<EmailScopeFilterProps> = ({ scopes, selectedIds, onChange, unclassifiedCount = 0 }) => {
  const toggleScope = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const activeScopes = scopes.filter((s) => s.active)
  const isUnclassifiedSelected = selectedIds.includes(FILTER_UNCLASSIFIED)

  return (
    <div className="d-flex flex-wrap gap-2 align-items-center">
      <CBadge
        color={selectedIds.length === 0 ? 'primary' : 'secondary'}
        role="button"
        className="px-3 py-2"
        onClick={() => onChange([])}
        style={{ cursor: 'pointer' }}
      >
        Tutte
      </CBadge>
      {activeScopes.map((scope) => {
        const isSelected = selectedIds.includes(scope.id)
        return (
          <CBadge
            key={scope.id}
            role="button"
            className="px-3 py-2"
            style={{
              cursor: 'pointer',
              backgroundColor: isSelected ? scope.color : 'transparent',
              color: isSelected ? '#fff' : scope.color,
              border: `1px solid ${scope.color}`,
            }}
            onClick={() => toggleScope(scope.id)}
          >
            {scope.label}
          </CBadge>
        )
      })}
      {unclassifiedCount > 0 && (
        <CBadge
          role="button"
          className="px-3 py-2"
          style={{
            cursor: 'pointer',
            backgroundColor: isUnclassifiedSelected ? '#6c757d' : 'transparent',
            color: isUnclassifiedSelected ? '#fff' : '#6c757d',
            border: '1px solid #6c757d',
          }}
          onClick={() => toggleScope(FILTER_UNCLASSIFIED)}
        >
          Non classificate ({unclassifiedCount})
        </CBadge>
      )}
    </div>
  )
}

export default EmailScopeFilter
