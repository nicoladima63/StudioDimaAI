import React, { useState, useEffect, useRef } from 'react';
import {
  CFormInput,
  CSpinner,
  CAlert,
  CInputGroup,
  CInputGroupText
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSearch, cilX } from '@coreui/icons';
import { fornitoriService } from '@/features/fornitori/services/fornitori.service';
import type { Fornitore } from '@/features/fornitori/types';

interface FornitoriSelectProps {
  selectedFornitore: Fornitore | null;
  onFornitoreChange: (fornitore: Fornitore | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const FornitoriSelect: React.FC<FornitoriSelectProps> = ({
  selectedFornitore,
  onFornitoreChange,
  disabled = false,
  placeholder = "Cerca fornitore...",
  className = ""
}) => {
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [filteredFornitori, setFilteredFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFornitori();
  }, []);

  // Sincronizza il searchTerm con il fornitore selezionato
  useEffect(() => {
    if (selectedFornitore) {
      setSearchTerm(selectedFornitore.nome || '');
    } else {
      setSearchTerm('');
    }
  }, [selectedFornitore]);

  useEffect(() => {
    if (searchTerm.length >= 2 && !selectedFornitore) {
      const filtered = fornitori.filter(fornitore =>
        fornitore.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornitore.id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredFornitori(filtered);
      setShowDropdown(true);
    } else {
      setFilteredFornitori([]);
      setShowDropdown(false);
    }
  }, [searchTerm, fornitori, selectedFornitore]);

  const fetchFornitori = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fornitoriService.getFornitori();
      const allData = response.data || [];
      
      const sortedFornitori = allData.sort((a, b) => 
        (a.nome || '').localeCompare(b.nome || '', 'it', { numeric: true })
      );
      
      setFornitori(sortedFornitori);
    } catch (err) {
      setError('Errore nel caricamento dei fornitori');
      console.error('Errore caricamento fornitori:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    
    // Solo reset se il valore è vuoto e non è per via del sync con selectedFornitore
    if (!value && selectedFornitore) {
      onFornitoreChange(null);
    }
  };

  const handleFornitoreSelect = (fornitore: Fornitore) => {
    setShowDropdown(false);
    onFornitoreChange(fornitore);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onFornitoreChange(null);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    if (searchTerm.length >= 2 && !selectedFornitore) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => setShowDropdown(false), 200);
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center">
        <CInputGroup className={className}>
          <CInputGroupText>
            <CSpinner size="sm" />
          </CInputGroupText>
          <CFormInput disabled placeholder="Caricamento fornitori..." />
        </CInputGroup>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <CInputGroup className={className}>
          <CInputGroupText>
            <CIcon icon={cilSearch} />
          </CInputGroupText>
          <CFormInput disabled placeholder="Errore caricamento" />
        </CInputGroup>
        <CAlert color="danger" className="mt-2 mb-0 py-1 px-2">
          <small>{error}</small>
        </CAlert>
      </div>
    );
  }

  return (
    <div className={`position-relative ${className}`}>
      <CInputGroup>
        <CInputGroupText>
          <CIcon icon={cilSearch} />
        </CInputGroupText>
        <CFormInput
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
        />
        {searchTerm && (
          <CInputGroupText 
            style={{ cursor: 'pointer' }}
            onClick={handleClear}
            title="Cancella"
          >
            <CIcon icon={cilX} />
          </CInputGroupText>
        )}
      </CInputGroup>

      {showDropdown && filteredFornitori.length > 0 && (
        <div 
          className="position-absolute w-100 bg-white border rounded shadow-sm"
          style={{ 
            top: '100%', 
            zIndex: 1050,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {filteredFornitori.slice(0, 10).map((fornitore) => (
            <div
              key={fornitore.id}
              className="px-3 py-2 border-bottom cursor-pointer hover-bg-light"
              style={{ cursor: 'pointer' }}
              onMouseDown={() => handleFornitoreSelect(fornitore)}
            >
              <div className="fw-bold">{fornitore.nome}</div>
              <small className="text-muted">ID: {fornitore.id}</small>
            </div>
          ))}
          {filteredFornitori.length > 10 && (
            <div className="px-3 py-2 text-muted">
              <small>... e altri {filteredFornitori.length - 10} risultati</small>
            </div>
          )}
        </div>
      )}

      {showDropdown && filteredFornitori.length === 0 && searchTerm.length >= 2 && (
        <div 
          className="position-absolute w-100 bg-white border rounded shadow-sm"
          style={{ top: '100%', zIndex: 1050 }}
        >
          <div className="px-3 py-2 text-muted">
            <small>Nessun fornitore trovato</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default FornitoriSelect;