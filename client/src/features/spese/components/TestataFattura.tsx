import React, { useState, useEffect } from "react";
import {
  CAlert,
  CSpinner,
  CButton,
  CRow,
  CCol,
  CBadge,
} from "@coreui/react";
import { speseFornitioriService } from "../services/spese.service";
import type { SpesaFornitore } from "../types";

interface TestataFatturaProps {
  fatturaId: string;
  onVaiAllaFattura?: (fatturaId: string) => void;
}

const TestataFattura: React.FC<TestataFatturaProps> = ({
  fatturaId,
  onVaiAllaFattura,
}) => {
  const [fattura, setFattura] = useState<SpesaFornitore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const caricaFattura = async () => {
    setLoading(true);
    setError(null);

    try {
      // Uso l'API esistente per ottenere una singola fattura
      const response = await speseFornitioriService.getSpeseFornitori({
        anno: new Date().getFullYear(),
        limit: 1000
      });
      
      if (response.success) {
        const fatturaFound = response.data.find(f => f.id === fatturaId);
        if (fatturaFound) {
          setFattura(fatturaFound);
        } else {
          setError("Fattura non trovata");
        }
      } else {
        setError("Errore nel caricamento della fattura");
      }
    } catch (err: any) {
      console.error("Errore caricamento fattura:", err);
      setError(err.message || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fatturaId) {
      caricaFattura();
    }
  }, [fatturaId]);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("it-IT");
  };

  if (loading) {
    return (
      <div className="text-center p-3">
        <CSpinner color="primary" size="sm" />
        <span className="ms-2">Caricamento fattura...</span>
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color="danger" className="m-3">
        {error}
      </CAlert>
    );
  }

  if (!fattura) {
    return (
      <div className="text-center p-3 text-muted">
        Fattura non trovata
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="bg-light p-2 border rounded d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <div>
            <strong>📋 {fattura.numero_documento}</strong>
          </div>
          <div>
            <CBadge color="primary" className="me-1">
              {fattura.codice_fornitore}
            </CBadge>
            <small className="text-muted">
              {fattura.nome_fornitore || 'Nome non trovato'}
            </small>
          </div>
          <div>
            <small className="text-muted">
              {formatDate(fattura.data_spesa)}
            </small>
          </div>
        </div>
        
        {onVaiAllaFattura && (
          <CButton
            color="primary"
            variant="outline"
            size="sm"
            onClick={() => onVaiAllaFattura(fattura.id)}
            title="Vai alla tab fatture"
          >
            📋 Fattura Completa
          </CButton>
        )}
      </div>
    </div>
  );
};

export default TestataFattura;