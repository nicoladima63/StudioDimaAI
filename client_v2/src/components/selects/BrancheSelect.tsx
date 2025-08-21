import React, { useState, useEffect, useMemo } from "react";
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
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto' }}>
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