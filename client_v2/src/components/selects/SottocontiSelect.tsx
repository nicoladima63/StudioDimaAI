import React, { useState, useEffect, useMemo } from "react";
import { useSottoconti } from "../../store/conti.store";

interface SottocontiSelectProps {
  brancaId: number | null;
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  autoSelectIfSingle?: boolean;
  className?: string;
}

const SottocontiSelect: React.FC<SottocontiSelectProps> = ({
  brancaId,
  value,
  onChange,
  placeholder = "-- Seleziona sottoconto --",
  disabled = false,
  searchable = true,
  autoSelectIfSingle = false,
  className = ""
}) => {
  const { sottoconti, isLoading, error } = useSottoconti(brancaId);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Filtra sottoconti in base al termine di ricerca
  const filteredSottoconti = useMemo(() => {
    if (!searchTerm.trim()) return sottoconti;
    
    return sottoconti.filter(sottoconto =>
      sottoconto.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sottoconti, searchTerm]);

  // Reset valore se non più valido per questa brancaId
  useEffect(() => {
    if (value && sottoconti.length > 0 && !sottoconti.some(s => s.id === value)) {
      onChange(null);
    }
  }, [brancaId, sottoconti, value]); // Rimosso onChange dalle dipendenze

  // Auto-select se c'è un solo sottoconto
  useEffect(() => {
    if (
      brancaId &&
      !isLoading &&
      !error &&
      sottoconti.length === 1 &&
      autoSelectIfSingle &&
      value !== sottoconti[0].id
    ) {
      onChange(sottoconti[0].id);
    }
  }, [sottoconti, isLoading, error, autoSelectIfSingle, brancaId, value]); // Rimosso onChange dalle dipendenze

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Trova il sottoconto selezionato per mostrare il nome
  const selectedSottoconto = value ? sottoconti.find(s => s.id === value) : null;

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || !brancaId || isLoading}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {isLoading && <option disabled>Caricamento sottoconti...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {sottoconti.map((sottoconto) => (
          <option key={sottoconto.id} value={sottoconto.id}>
            {sottoconto.nome}
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
        placeholder={selectedSottoconto ? selectedSottoconto.nome : placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={disabled || !brancaId || isLoading}
        aria-invalid={!!error}
      />
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {!brancaId && (
              <div className="px-3 py-2 text-muted">
                Seleziona prima una branca
              </div>
            )}
            
            {brancaId && isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento sottoconti...
              </div>
            )}
            
            {brancaId && error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {brancaId && !isLoading && !error && filteredSottoconti.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessun sottoconto trovato
              </div>
            )}
            
            {filteredSottoconti.map((sottoconto) => (
              <div
                key={sottoconto.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === sottoconto.id ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(sottoconto.id);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {sottoconto.nome}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SottocontiSelect;