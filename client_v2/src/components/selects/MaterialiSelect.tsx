import React, { useState, useEffect, useMemo } from "react";
import { useMaterialiSearch, useMaterialiStore, type MaterialeIntelligente } from "../../store/materiali.store";

interface MaterialiSelectProps {
  fornitoreId?: string;
  value: string | null;
  onChange: (materiale: MaterialeIntelligente | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  showClassified?: boolean;
  filterByClassificazione?: {
    contoid?: number;
    brancaid?: number;
    sottocontoid?: number;
  };
}

const MaterialiSelect: React.FC<MaterialiSelectProps> = ({
  fornitoreId,
  value,
  onChange,
  placeholder = "-- Seleziona materiale --",
  disabled = false,
  searchable = true,
  className = "",
  showClassified = false,
  filterByClassificazione
}) => {
  const { materiali, isLoading, error, search, applyFilters } = useMaterialiSearch();
  const store = useMaterialiStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Carica materiali quando cambia il fornitore
  useEffect(() => {
    if (fornitoreId) {
      store.loadMaterialiByFornitore(fornitoreId, { show_classified: showClassified });
    }
  }, [fornitoreId, showClassified, store]);

  // Applica filtri quando cambiano
  useEffect(() => {
    if (filterByClassificazione) {
      applyFilters(filterByClassificazione);
    }
  }, [filterByClassificazione, applyFilters]);

  // Filtra materiali in base alla ricerca locale
  const filteredMateriali = useMemo(() => {
    if (!searchTerm.trim()) return materiali;
    
    return materiali.filter(materiale =>
      materiale.descrizione.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materiale.codice_articolo?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [materiali, searchTerm]);

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Trova il materiale selezionato
  const selectedMateriale = value ? materiali.find(m => m.codice_articolo === value) : null;

  // Funzione per ottenere il badge di confidence
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 95) return <span className="badge bg-success">95%+</span>;
    if (confidence >= 80) return <span className="badge bg-warning">80%+</span>;
    return <span className="badge bg-danger">&lt;80%</span>;
  };

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => {
          const selectedCodice = e.target.value;
          const materiale = selectedCodice ? materiali.find(m => m.codice_articolo === selectedCodice) : null;
          onChange(materiale || null);
        }}
        disabled={disabled || isLoading || !fornitoreId}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {!fornitoreId && <option disabled>Seleziona prima un fornitore</option>}
        
        {fornitoreId && isLoading && <option disabled>Caricamento materiali...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {filteredMateriali.map((materiale) => (
          <option key={materiale.codice_articolo} value={materiale.codice_articolo}>
            {materiale.descrizione} ({materiale.codice_articolo})
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
        placeholder={selectedMateriale ? `${selectedMateriale.descrizione} (${selectedMateriale.codice_articolo})` : placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={disabled || isLoading || !fornitoreId}
        aria-invalid={!!error}
      />
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {!fornitoreId && (
              <div className="px-3 py-2 text-muted">
                Seleziona prima un fornitore
              </div>
            )}
            
            {fornitoreId && isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento materiali...
              </div>
            )}
            
            {fornitoreId && error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {fornitoreId && !isLoading && !error && filteredMateriali.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessun materiale trovato
              </div>
            )}
            
            {filteredMateriali.map((materiale) => (
              <div
                key={materiale.codice_articolo}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === materiale.codice_articolo ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(materiale);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="fw-bold">{materiale.descrizione}</div>
                    <div className="small text-muted">
                      Codice: {materiale.codice_articolo}
                    </div>
                    <div className="small text-muted">
                      Prezzo: €{materiale.prezzo_unitario?.toFixed(2)} | 
                      Qty: {materiale.quantita} | 
                      Tot: €{materiale.totale_riga?.toFixed(2)}
                    </div>
                    {materiale.classificazione_suggerita && (
                      <div className="small">
                        <span className="text-muted">Classificazione suggerita: </span>
                        {getConfidenceBadge(materiale.classificazione_suggerita.confidence)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialiSelect;