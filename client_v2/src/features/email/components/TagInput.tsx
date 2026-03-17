import React, { useState, useRef } from 'react'
import { CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilX } from '@coreui/icons'

interface TagInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  separator?: string
}

const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  placeholder = 'Digita e premi Invio...',
  separator = ',',
}) => {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const tags = value
    ? value
        .split(separator)
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) return
    const newTags = [...tags, trimmed]
    onChange(newTags.join(separator))
    setInputValue('')
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onChange(newTags.join(separator))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === separator) {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes(separator)) {
      e.preventDefault()
      const parts = pasted.split(separator).map((t) => t.trim()).filter(Boolean)
      const uniqueNew = parts.filter((p) => !tags.includes(p))
      if (uniqueNew.length > 0) {
        onChange([...tags, ...uniqueNew].join(separator))
      }
    }
  }

  return (
    <div
      className="form-control d-flex flex-wrap gap-1 align-items-center"
      style={{ minHeight: '38px', height: 'auto', cursor: 'text', padding: '4px 8px' }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, idx) => (
        <CBadge
          key={idx}
          color="primary"
          shape="rounded-pill"
          className="d-inline-flex align-items-center gap-1 py-1 px-2"
          style={{ fontSize: '0.85em' }}
        >
          {tag}
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(idx)
            }}
            style={{ cursor: 'pointer', marginLeft: '2px', opacity: 0.8 }}
          >
            <CIcon icon={cilX} size="sm" />
          </span>
        </CBadge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue)
        }}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          border: 'none',
          outline: 'none',
          flex: 1,
          minWidth: '80px',
          background: 'transparent',
          fontSize: '0.875rem',
        }}
      />
    </div>
  )
}

export default TagInput
