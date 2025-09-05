import React, { useState, useEffect, useMemo, useRef } from "react";
import { useBranche } from "../../store/conti.store";

interface BrancheSelectProps {
  contoId: number | null;
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  autoSelectIfSingle?: boolean;
  className?: string;
}

const BrancheSelect: React.FC<BrancheSelectProps> = ({
  contoId,
  value,
  onChange,
  placeholder = "-- Seleziona branca --",
  disabled = false,
  searchable = true,
  autoSelectIfSingle = false,
  className = ""
}) => {
  const { branche, isLoading, error } = useBranche(contoId);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [zIndex, setZIndex] = useState(2000);

  // Filtra branche in base al termine di ricerca
  const filteredBranche = useMemo(() => {
    if (!searchTerm.trim()) return branche;
    
    return branche.filter(branca =>
      branca.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [branche, searchTerm]);

  // Reset valore se non più valido per questo contoId
  useEffect(() => {
    if (value && branche.length > 0 && !branche.some(b => b.id === value)) {
      onChange(null);
    }
  }, [contoId, branche, value]); // Rimosso onChange dalle dipendenze

  // Auto-select se c'è una sola branca
  useEffect(() => {
    if (
      contoId &&
      !isLoading &&
      !error &&
      branche.length === 1 &&
      autoSelectIfSingle &&
      value !== branche[0].id
    ) {
      onChange(branche[0].id);
    }
  }, [branche, isLoading, error, autoSelectIfSingle, contoId, value]); // Rimosso onChange dalle dipendenze

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Calcola posizione dropdown quando si apre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
      
      // Incrementa z-index per questo dropdown (partendo da 2000)
      const currentZIndex = Math.max(2000, ...Array.from(document.querySelectorAll('[data-dropdown]')).map(el => 
        parseInt(getComputedStyle(el).zIndex) || 0
      )) + 1;
      setZIndex(currentZIndex);
    }
  }, [isOpen]);

  // Trova la branca selezionata per mostrare il nome
  const selectedBranca = value ? branche.find(b => b.id === value) : null;

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || !contoId || isLoading}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {isLoading && <option disabled>Caricamento branche...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {branche.map((branca) => (
          <option key={branca.id} value={branca.id}>
            {branca.nome}
          </option>
        ))}
      </select>
    );
  }

  // Versione con ricerca
  return (
    <div className={`position-relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder={selectedBranca ? selectedBranca.nome : placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={disabled || !contoId || isLoading}
        aria-invalid={!!error}
      />
      
      {isOpen && (
        <div 
          className="position-fixed" 
          data-dropdown="true"
          style={{ 
            zIndex: zIndex, 
            top: `${dropdownPosition.top}px`, 
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {!contoId && (
              <div className="px-3 py-2 text-muted">
                Seleziona prima un conto
              </div>
            )}
            
            {contoId && isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento branche...
              </div>
            )}
            
            {contoId && error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {contoId && !isLoading && !error && filteredBranche.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessuna branca trovata
              </div>
            )}
            
            {filteredBranche.map((branca) => (
              <div
                key={branca.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === branca.id ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(branca.id);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {branca.nome}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrancheSelect;