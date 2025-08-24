import React, { useState, useEffect, useMemo } from "react";
import { useFornitori, useFornitoriStore, type Fornitore } from "../../store/fornitori.store";

interface FornitoriSelectProps {
  value: string | null;
  onChange: (fornitore: Fornitore | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  filterByClassificazione?: {
    contoid?: number;
    brancaid?: number;
    sottocontoid?: number;
  };
}

const FornitoriSelect: React.FC<FornitoriSelectProps> = ({
  value,
  onChange,
  placeholder = "-- Seleziona fornitore --",
  disabled = false,
  searchable = true,
  clearable = false,
  className = "",
  filterByClassificazione
}) => {
  const { fornitori, isLoading, error, loadAll } = useFornitori();
  const store = useFornitoriStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Carica TUTTI i fornitori al mount (per select serve tutto)
  useEffect(() => {
    loadAll();
  }, []); // Solo al mount, store non deve essere nelle dipendenze

  // Filtra fornitori in base al termine di ricerca
  const filteredFornitori = useMemo(() => {
    let filtered = fornitori;

    // Applica filtro per classificazione se specificato
    if (filterByClassificazione) {
      // Qui potresti implementare un filtro aggiuntivo basato sulla classificazione
      // Per ora mostra tutti i fornitori
      filtered = fornitori;
    }

    // Applica ricerca testuale
    if (searchTerm.trim()) {
      filtered = filtered.filter(fornitore =>
        fornitore.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornitore.codice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornitore.partita_iva?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [fornitori, searchTerm, filterByClassificazione]);

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);
  
  // Reset search quando cambia il value dall'esterno
  useEffect(() => {
    setSearchTerm("");
  }, [value]);

  // Trova il fornitore selezionato per mostrare il nome
  const selectedFornitore = value ? fornitori.find(f => f.id === value) : null;

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => {
          const selectedId = e.target.value;
          const fornitore = selectedId ? fornitori.find(f => f.id === selectedId) : null;
          onChange(fornitore || null);
        }}
        disabled={disabled || isLoading}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {isLoading && <option disabled>Caricamento fornitori...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {filteredFornitori.map((fornitore) => (
          <option key={fornitore.id} value={fornitore.id}>
            {fornitore.nome} {fornitore.codice ? `(${fornitore.codice})` : ''}
          </option>
        ))}
      </select>
    );
  }

  // Versione con ricerca
  return (
    <div className={`position-relative ${className}`}>
      <div className="position-relative">
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={searchTerm || (selectedFornitore && !isOpen ? `${selectedFornitore.nome} ${selectedFornitore.codice ? `(${selectedFornitore.codice})` : ''}` : '')}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          disabled={disabled || isLoading}
          aria-invalid={!!error}
          style={clearable && selectedFornitore ? { paddingRight: '40px' } : {}}
        />
        
        {clearable && selectedFornitore && (
          <button
            type="button"
            className="btn btn-link position-absolute top-50 translate-middle-y p-0"
            style={{ 
              right: '8px', 
              zIndex: 10,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#6c757d',
              textDecoration: 'none'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(null);
              setSearchTerm("");
            }}
            onMouseDown={(e) => e.preventDefault()}
            title="Cancella selezione"
          >
            ✕
          </button>
        )}
      </div>
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento fornitori...
              </div>
            )}
            
            {error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {!isLoading && !error && filteredFornitori.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessun fornitore trovato
              </div>
            )}
            
            {filteredFornitori.map((fornitore) => (
              <div
                key={fornitore.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === fornitore.id ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(fornitore);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="fw-bold">{fornitore.nome}</div>
                {fornitore.codice && (
                  <div className="small text-muted">Codice: {fornitore.codice}</div>
                )}
                {fornitore.partita_iva && (
                  <div className="small text-muted">P.IVA: {fornitore.partita_iva}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FornitoriSelect;