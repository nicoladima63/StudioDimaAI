/**
 * HashtagsInput Component
 * Input moderno per hashtags con badge rimovibili e suggerimenti
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { CFormInput, CBadge, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilX } from '@coreui/icons';
import toast from 'react-hot-toast';

interface HashtagsInputProps {
  /**
   * Array di hashtags correnti (senza #)
   */
  hashtags: string[];

  /**
   * Callback quando gli hashtags cambiano
   */
  onChange: (hashtags: string[]) => void;

  /**
   * Lista opzionale di hashtags suggeriti (senza #)
   */
  suggestions?: string[];

  /**
   * Placeholder per input
   */
  placeholder?: string;

  /**
   * Max numero di hashtags
   */
  maxHashtags?: number;
}

// Hashtags predefiniti comuni per dental/medical
const DEFAULT_SUGGESTIONS = [
  'dental',
  'odontoiatria',
  'salute',
  'sorriso',
  'dentista',
  'prevenzione',
  'igieneorale',
  'ortodonzia',
  'implantologia',
  'sbiancamento',
  'cura',
  'benessere',
  'studio',
  'professionisti',
];

const HashtagsInput: React.FC<HashtagsInputProps> = ({
  hashtags = [],
  onChange,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = 'Digita un hashtag e premi Invio',
  maxHashtags = 30,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalizza hashtag (rimuovi # e spazi, lowercase)
  const normalizeHashtag = (tag: string): string => {
    return tag
      .trim()
      .replace(/^#+/, '') // Rimuovi # iniziali
      .replace(/\s+/g, '') // Rimuovi spazi
      .toLowerCase();
  };

  // Aggiungi hashtag
  const addHashtag = (tag: string) => {
    const normalized = normalizeHashtag(tag);

    if (!normalized) {
      return;
    }

    if (hashtags.length >= maxHashtags) {
      toast.error(`Puoi aggiungere massimo ${maxHashtags} hashtags`);
      return;
    }

    if (hashtags.includes(normalized)) {
      toast.error('Hashtag già presente');
      return;
    }

    // Validazione: solo lettere, numeri e underscore
    if (!/^[a-z0-9_]+$/i.test(normalized)) {
      toast.error('Hashtag non valido. Usa solo lettere, numeri e underscore');
      return;
    }

    onChange([...hashtags, normalized]);
    setInputValue('');
    setShowSuggestions(false);
  };

  // Rimuovi hashtag
  const removeHashtag = (tag: string) => {
    onChange(hashtags.filter(h => h !== tag));
  };

  // Gestisci pressione tasti
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHashtag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && hashtags.length > 0) {
      // Rimuovi ultimo hashtag se input vuoto e premi backspace
      onChange(hashtags.slice(0, -1));
    }
  };

  // Filtra suggerimenti in base all'input
  const filteredSuggestions = suggestions.filter(
    (s) =>
      !hashtags.includes(s) &&
      s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="hashtags-input">
      {/* Container con badge e input */}
      <div
        className="border rounded p-2 d-flex flex-wrap align-items-center gap-2"
        style={{ minHeight: '45px', cursor: 'text' }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Badge hashtags esistenti */}
        {hashtags.map((tag) => (
          <CBadge
            key={tag}
            color="primary"
            className="d-flex align-items-center gap-1 px-2 py-1"
            style={{ fontSize: '0.9rem' }}
          >
            #{tag}
            <CButton
              color="primary"
              size="sm"
              className="p-0 border-0 bg-transparent"
              style={{ width: '16px', height: '16px', lineHeight: '1' }}
              onClick={(e) => {
                e.stopPropagation();
                removeHashtag(tag);
              }}
            >
              <CIcon icon={cilX} size="sm" />
            </CButton>
          </CBadge>
        ))}

        {/* Input per nuovi hashtags */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={hashtags.length === 0 ? placeholder : ''}
          style={{
            border: 'none',
            outline: 'none',
            flex: 1,
            minWidth: '150px',
            padding: '4px',
            fontSize: '0.9rem',
          }}
        />
      </div>

      {/* Suggerimenti */}
      {showSuggestions && inputValue && filteredSuggestions.length > 0 && (
        <div
          className="border rounded mt-1 p-2 bg-white shadow-sm"
          style={{
            maxHeight: '150px',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 1000,
          }}
        >
          <small className="text-muted d-block mb-1">Suggerimenti:</small>
          <div className="d-flex flex-wrap gap-1">
            {filteredSuggestions.slice(0, 10).map((suggestion) => (
              <CBadge
                key={suggestion}
                color="secondary"
                style={{ cursor: 'pointer', fontSize: '0.85rem' }}
                onClick={() => addHashtag(suggestion)}
              >
                #{suggestion}
              </CBadge>
            ))}
          </div>
        </div>
      )}

      {/* Info text */}
      <small className="text-muted d-block mt-1">
        Digita un hashtag e premi Invio. Max {maxHashtags} hashtags ({hashtags.length}/
        {maxHashtags})
      </small>
    </div>
  );
};

export default HashtagsInput;
