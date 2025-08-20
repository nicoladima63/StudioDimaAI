import React, { useState, useEffect, useMemo } from "react";
import { useConti } from "../../store/conti.store";

interface ContiSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  autoSelectIfSingle?: boolean;
  className?: string;
}

const ContiSelect: React.FC<ContiSelectProps> = ({
  value,
  onChange,
  placeholder = "-- Seleziona conto --",
  disabled = false,
  searchable = true,
  autoSelectIfSingle = false,
  className = ""
}) => {
  const { conti, isLoading, error } = useConti();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Filtra conti in base al termine di ricerca
  const filteredConti = useMemo(() => {
    if (!searchTerm.trim()) return conti;
    
    return conti.filter(conto =>
      conto.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [conti, searchTerm]);

  // Auto-select se c'è un solo conto
  useEffect(() => {
    if (!isLoading && !error && conti.length === 1 && autoSelectIfSingle && !value) {
      onChange(conti[0].id);
    }
  }, [conti, isLoading, error, autoSelectIfSingle, onChange, value]);

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Trova il conto selezionato per mostrare il nome
  const selectedConto = value ? conti.find(c => c.id === value) : null;

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || isLoading}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {isLoading && <option disabled>Caricamento conti...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {conti.map((conto) => (
          <option key={conto.id} value={conto.id}>
            {conto.nome}
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
        placeholder={selectedConto ? selectedConto.nome : placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={disabled || isLoading}
        aria-invalid={!!error}
      />
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento conti...
              </div>
            )}
            
            {error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {!isLoading && !error && filteredConti.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessun conto trovato
              </div>
            )}
            
            {filteredConti.map((conto) => (
              <div
                key={conto.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === conto.id ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(conto.id);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()} // Previene blur prima del click
              >
                {conto.nome}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContiSelect;