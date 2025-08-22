import React, { useState, useEffect, useMemo } from "react";
import { usePazientiStore, type Paziente } from "../../store/pazienti.store";

interface PazientiSelectProps {
  value: string | null;
  onChange: (paziente: Paziente | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
}

const PazientiSelect: React.FC<PazientiSelectProps> = ({
  value,
  onChange,
  placeholder = "-- Seleziona paziente --",
  disabled = false,
  searchable = true,
  clearable = false,
  className = ""
}) => {
  const { pazienti, isLoading, error, loadAllPazienti } = usePazientiStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Carica TUTTI i pazienti al mount (per select serve tutto)
  useEffect(() => {
    loadAllPazienti();
  }, []); // Solo al mount

  // Filtra pazienti in base al termine di ricerca
  const filteredPazienti = useMemo(() => {
    let filtered = pazienti;

    // Applica ricerca testuale
    if (searchTerm.trim()) {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter(paziente =>
        paziente.nome.toLowerCase().includes(searchTermLower) ||
        paziente.codice_fiscale?.toLowerCase().includes(searchTermLower) ||
        paziente.telefono?.toLowerCase().includes(searchTermLower) ||
        paziente.cellulare?.toLowerCase().includes(searchTermLower) ||
        paziente.email?.toLowerCase().includes(searchTermLower)
      );
    }

    return filtered;
  }, [pazienti, searchTerm]);

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Trova il paziente selezionato per mostrare il nome
  const selectedPaziente = value ? pazienti.find(p => p.id === value) : null;

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => {
          const selectedId = e.target.value;
          const paziente = selectedId ? pazienti.find(p => p.id === selectedId) : null;
          onChange(paziente || null);
        }}
        disabled={disabled || isLoading}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {isLoading && <option disabled>Caricamento pazienti...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {filteredPazienti.map((paziente) => (
          <option key={paziente.id} value={paziente.id}>
            {paziente.nome} {paziente.codice_fiscale ? `(${paziente.codice_fiscale})` : ''}
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
          placeholder={selectedPaziente ? `${selectedPaziente.nome} ${selectedPaziente.codice_fiscale ? `(${selectedPaziente.codice_fiscale})` : ''}` : placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          disabled={disabled || isLoading}
          aria-invalid={!!error}
          style={clearable && selectedPaziente ? { paddingRight: '40px' } : {}}
        />
        
        {clearable && selectedPaziente && (
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
            
          </button>
        )}
      </div>
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento pazienti...
              </div>
            )}
            
            {error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {!isLoading && !error && filteredPazienti.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessun paziente trovato
              </div>
            )}
            
            {filteredPazienti.map((paziente) => (
              <div
                key={paziente.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === paziente.id ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(paziente);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="fw-bold">{paziente.nome}</div>
                {paziente.codice_fiscale && (
                  <div className="small text-muted">CF: {paziente.codice_fiscale}</div>
                )}
                {paziente.data_nascita && (
                  <div className="small text-muted">
                    Nato: {new Date(paziente.data_nascita).toLocaleDateString('it-IT')}
                  </div>
                )}
                {(paziente.telefono || paziente.cellulare) && (
                  <div className="small text-muted">
                    {paziente.telefono && `Tel: ${paziente.telefono}`}
                    {paziente.telefono && paziente.cellulare && ' - '}
                    {paziente.cellulare && `Cell: ${paziente.cellulare}`}
                  </div>
                )}
                {paziente.ultima_visita && (
                  <div className="small text-muted">
                    Ultima visita: {new Date(paziente.ultima_visita).toLocaleDateString('it-IT')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PazientiSelect;