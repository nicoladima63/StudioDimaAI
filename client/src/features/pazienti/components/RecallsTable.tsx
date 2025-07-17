// src/features/pazienti/components/RecallsTable.tsx
import React from 'react';
import { CSpinner, CBadge, CButton } from '@coreui/react';
import type { PazienteCompleto } from '@/lib/types';

interface RecallsTableProps {
  richiami: PazienteCompleto[];
  loading: boolean;
}

const RecallsTable: React.FC<RecallsTableProps> = ({ richiami, loading }) => {
  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2">Caricamento richiami...</p>
      </div>
    );
  }

  if (richiami.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Nessun richiamo trovato</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scaduto': return 'danger';
      case 'in_scadenza': return 'warning';
      case 'futuro': return 'success';
      default: return 'secondary';
    }
  };

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>Paziente</th>
            <th>Città</th>
            <th>Contatto</th>
            <th>Ultima Visita</th>
            <th>Giorni</th>
            <th>Tipo Richiamo</th>
            <th>Priorità</th>
            <th>Stato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {richiami.map((richiamo) => (
            <tr key={richiamo.DB_CODE}>
              <td>
                <strong>{richiamo.nome_completo}</strong>
                <br />
                <small className="text-muted">{richiamo.DB_CODE}</small>
              </td>
              <td>{richiamo.citta_clean}</td>
              <td>
                {richiamo.numero_contatto ? (
                  <span className="text-success">{richiamo.numero_contatto}</span>
                ) : (
                  <span className="text-muted">Nessun contatto</span>
                )}
              </td>
              <td>
                {richiamo.ultima_visita ? (
                  new Date(richiamo.ultima_visita).toLocaleDateString('it-IT')
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td>
                {richiamo.giorni_ultima_visita ? (
                  <CBadge color={richiamo.giorni_ultima_visita > 180 ? 'danger' : 'warning'}>
                    {richiamo.giorni_ultima_visita}
                  </CBadge>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td>
                <CBadge color="info">
                  {richiamo.tipo_richiamo_desc}
                </CBadge>
              </td>
              <td>
                <CBadge color={getPriorityColor(richiamo.recall_priority)}>
                  {richiamo.recall_priority}
                </CBadge>
              </td>
              <td>
                <CBadge color={getStatusColor(richiamo.recall_status)}>
                  {richiamo.recall_status}
                </CBadge>
              </td>
              <td>
                <CButton
                  color="primary"
                  size="sm"
                  onClick={() => {
                    // Implementa azione richiamo
                    console.log('Richiamo paziente:', richiamo.DB_CODE);
                  }}
                >
                  Richiama
                </CButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecallsTable;