import React, { useEffect, useState } from "react";
import { CAlert, CSpinner } from "@coreui/react";
import { healthCheck } from "@/services/api/ricetta.service";

const RicettaAuthStatus: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    healthCheck()
      .then(res => setStatus(res.success ? 'Connesso' : 'Errore'))
      .catch(err => setError(err?.message || "Errore sconosciuto"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CSpinner />;
  if (error) return <CAlert color="danger">{error}</CAlert>;
  return <CAlert color="info">Stato autenticazione: {status}</CAlert>;
};

export default RicettaAuthStatus;
