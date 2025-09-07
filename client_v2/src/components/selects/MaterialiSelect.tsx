import React, { useState, useEffect, useMemo } from "react";
import { useMaterialiByFornitore, type Materiale } from "../../store/materiali.store";

interface MaterialiSelectProps {
  fornitoreId?: string;
  value: string | null;
  onChange: (materiale: Materiale | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
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
  filterByClassificazione
}) => {
  const { materiali, isLoading, error, load } = useMaterialiByFornitore(fornitoreId);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Carica materiali all'inizializzazione
  useEffect(() => {
    load();
  }, []); // Carica una volta sola all'avvio

  // Reset stato interno quando value cambia dall'esterno
  useEffect(() => {
    if (!value) {
      setSearchTerm("");
      setIsOpen(false);
    }
  }, [value]);

  // Filtra e ordina materiali in base alla ricerca locale e classificazione
  const filteredMateriali = useMemo(() => {
    let filtered = Array.isArray(materiali) ? materiali : [];
    
    // Applica filtro di classificazione se specificato
    if (filterByClassificazione) {
      if (filterByClassificazione.contoid) {
        filtered = filtered.filter(m => m.contoid === filterByClassificazione.contoid);
      }
      if (filterByClassificazione.brancaid) {
        filtered = filtered.filter(m => m.brancaid === filterByClassificazione.brancaid);
      }
      if (filterByClassificazione.sottocontoid) {
        filtered = filtered.filter(m => m.sottocontoid === filterByClassificazione.sottocontoid);
      }
    }
    
    // Applica filtro di ricerca se presente
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(materiale =>
        materiale.nome.toLowerCase().includes(searchLower) ||
        materiale.codicearticolo?.toLowerCase().includes(searchLower)
      );

      // Ordina per rilevanza: prima quelli che iniziano con il termine di ricerca
      filtered.sort((a, b) => {
        const aNome = a.nome.toLowerCase();
        const bNome = b.nome.toLowerCase();
        const aCodice = a.codicearticolo?.toLowerCase() || '';
        const bCodice = b.codicearticolo?.toLowerCase() || '';
        
        // Punteggio per rilevanza
        const getScore = (nome: string, codice: string) => {
          let score = 0;
          
          // Bonus massimo se inizia con il termine di ricerca
          if (nome.startsWith(searchLower)) score += 100;
          if (codice.startsWith(searchLower)) score += 90;
          
          // Bonus se contiene il termine all'inizio di una parola
          const words = nome.split(' ');
          for (const word of words) {
            if (word.startsWith(searchLower)) {
              score += 50;
              break;
            }
          }
          
          // Bonus per lunghezza del match (più corto = più rilevante)
          const nomeMatch = nome.indexOf(searchLower);
          if (nomeMatch !== -1) {
            score += Math.max(0, 20 - nomeMatch);
          }
          
          return score;
        };
        
        const scoreA = getScore(aNome, aCodice);
        const scoreB = getScore(bNome, bCodice);
        
        // Ordina per punteggio decrescente, poi alfabeticamente
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        
        return aNome.localeCompare(bNome);
      });
    }
    
    return filtered;
  }, [materiali, searchTerm, filterByClassificazione]);

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

  // Trova il materiale selezionato
  const selectedMateriale = value ? materiali.find(m => 
    m.id.toString() === value ||
    m.codicearticolo === value
  ) : null;

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
          const selectedValue = e.target.value;
          const materiale = selectedValue ? materiali.find(m => 
            m.id.toString() === selectedValue ||
            m.codicearticolo === selectedValue
          ) : null;
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
          <option key={materiale.id} value={materiale.id.toString()}>
            {materiale.nome} {materiale.codicearticolo ? `(${materiale.codicearticolo})` : ''}
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
          value={isOpen ? searchTerm : (selectedMateriale ? `${selectedMateriale.nome} ${selectedMateriale.codicearticolo ? `(${selectedMateriale.codicearticolo})` : ''}` : '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredMateriali.length === 1) {
              e.preventDefault();
              const materiale = filteredMateriali[0];
              onChange(materiale);
              setIsOpen(false);
              setSearchTerm("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          disabled={disabled || isLoading || !fornitoreId}
          aria-invalid={!!error}
          style={selectedMateriale || searchTerm ? { paddingRight: '40px' } : {}}
        />
        
        {/* Pulsante X per cancellare ricerca o selezione */}
        {(selectedMateriale || searchTerm) && (
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
              if (searchTerm) {
                // Se c'è testo di ricerca, cancella solo la ricerca
                setSearchTerm("");
              } else if (selectedMateriale) {
                // Se c'è una selezione, cancella la selezione
                onChange(null);
                setSearchTerm("");
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            title={searchTerm ? "Cancella ricerca" : "Cancella selezione"}
          >
            ✕
          </button>
        )}
      </div>
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1060, top: '100%' }}>
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

            {fornitoreId && !isLoading && !error && filteredMateriali.length === 1 && searchTerm && (
              <div className="px-3 py-1 text-success small">
                <i className="fas fa-keyboard me-1"></i>
                Premi Invio per selezionare
              </div>
            )}
            
            {filteredMateriali.map((materiale) => (
              <div
                key={materiale.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === materiale.id.toString() ? 'bg-primary text-white' : ''}`}
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
                    <div className="fw-bold">{materiale.nome}</div>
                    {materiale.codicearticolo && (
                      <div className="small text-muted">
                        Codice: {materiale.codicearticolo}
                      </div>
                    )}
                    <div className="small text-muted">
                      Prezzo: €{materiale.costo_unitario.toFixed(2)}
                    </div>
                    {materiale.confidence > 0 && (
                      <div className="small">
                        <span className="text-muted">Classificazione: </span>
                        {getConfidenceBadge(materiale.confidence)}
                      </div>
                    )}
                    <div className="small text-muted">
                      {materiale.contonome && `${materiale.contonome}`}
                      {materiale.brancanome && ` > ${materiale.brancanome}`}
                      {materiale.sottocontonome && ` > ${materiale.sottocontonome}`}
                    </div>
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