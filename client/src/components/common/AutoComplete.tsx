import { useState, useEffect, useRef } from 'react';
import { CFormInput, CSpinner } from '@coreui/react';
import debounce from 'lodash/debounce';

interface AutoCompleteProps<T> {
  value: string;
  onChange: (val: string) => void;
  onSelect: (item: T) => void;
  fetchSuggestions: (q: string) => Promise<T[]>;
  getOptionLabel: (item: T) => string;
  placeholder?: string;
  disabled?: boolean;
}

function AutoComplete<T>({ value, onChange, onSelect, fetchSuggestions, getOptionLabel, placeholder, disabled }: AutoCompleteProps<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch
  const debouncedFetch = useRef(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setSuggestions([]);
        setNoResults(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchSuggestions(q);
        setSuggestions(res);
        setNoResults(res.length === 0);
      } catch {
        setSuggestions([]);
        setNoResults(true);
      } finally {
        setLoading(false);
      }
    }, 350)
  ).current;

  useEffect(() => {
    if (showList && value.trim()) {
      debouncedFetch(value);
    } else {
      setSuggestions([]);
      setNoResults(false);
    }
    // eslint-disable-next-line
  }, [value, showList]);

  // Chiudi lista su click fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.parentElement?.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    if (showList) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showList]);

  return (
    <div style={{ position: 'relative' }}>
      <CFormInput
        ref={inputRef}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {showList && (
        <div style={{
          position: 'absolute',
          zIndex: 20,
          background: '#fff',
          border: '1px solid #ccc',
          width: '100%',
          maxHeight: 220,
          overflowY: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          {loading && (
            <div style={{ padding: 8, textAlign: 'center' }}><CSpinner size="sm" /> Caricamento...</div>
          )}
          {!loading && noResults && (
            <div style={{ padding: 8, color: '#888' }}>Nessun risultato</div>
          )}
          {!loading && suggestions.map((item, idx) => (
            <div
              key={idx}
              style={{ padding: 8, cursor: 'pointer' }}
              onMouseDown={e => {
                e.preventDefault();
                onSelect(item);
                setShowList(false);
              }}
            >
              {getOptionLabel(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoComplete; 