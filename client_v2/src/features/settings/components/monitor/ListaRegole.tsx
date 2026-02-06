import React, { useEffect } from 'react';
import {
  CBadge,
  CButton,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CSpinner
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash, cilMediaStop, cilMediaPlay, cilPencil } from '@coreui/icons';
import { AutomationRule } from '@/features/settings/services/automation.service';
import { usePrestazioniStore } from '@/store/prestazioni.store';

type TriggerMeta = {
  label: string;
  color: string; // CoreUI color
};

const TRIGGER_META: Record<string, TriggerMeta> = {
  V: { label: 'Prima visita', color: '#FFA500' },
  I: { label: 'Igiene', color: '#800080' },
  C: { label: 'Conservativa', color: '#00BFFF' },
  E: { label: 'Endodonzia', color: '#808080' },
  H: { label: 'Chirurgia', color: '#FF0000' },
  P: { label: 'Protesi', color: '#008000' },
  O: { label: 'Ortodonzia', color: '#FFC0CB' },
  L: { label: 'Implantologia', color: '#FF00FF' },
  R: { label: 'Parodontologia', color: '#FFFF00' },
  S: { label: 'Controllo', color: '#ADD8E6' },
  U: { label: 'Gnatologia', color: '#C8A2C8' },
  F: { label: 'Ferie/Assenza', color: '#A9A9A9' },
  A: { label: 'Attività/Manuten', color: '#808080' },
  M: { label: 'Privato', color: '#00FF00' },
};


// Definiamo le props che il componente riceverà
interface ListaRegoleProps {
  rules: AutomationRule[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (rule: AutomationRule) => void;
  loading: boolean;
}

const ListaRegole: React.FC<ListaRegoleProps> = ({ rules, onToggle, onDelete, onEdit, loading }) => {
  const { loadPrestazioni, getPrestazioneById, isLoading: isLoadingPrestazioni } = usePrestazioniStore();

  useEffect(() => {
    loadPrestazioni();
  }, [loadPrestazioni]);

  if (rules.length === 0) {
    return <div className='text-muted'>Nessuna regola di automazione presente</div>;
  }

  const renderTrigger = (rule: AutomationRule) => {
    // Caso 1: Appuntamento Tipo (codici V, I, C...)
    // Controlliamo sia tramite META che tramite trigger_type se disponibile
    if (rule.trigger_type === 'appuntamento_tipo' || (!rule.trigger_type && TRIGGER_META[rule.trigger_id])) {
      const meta = TRIGGER_META[rule.trigger_id];
      if (meta) {
        return (
          <CBadge style={{ backgroundColor: meta.color, color: '#fff', padding: '7px' }}>
            {meta.label}
          </CBadge>
        );
      }
      return rule.trigger_id;
    }

    // Caso 2: Prestazione
    if (rule.trigger_type === 'prestazione' || !rule.trigger_type) {
      if (isLoadingPrestazioni) return <CSpinner size="sm" />;
      const prestazione = getPrestazioneById(rule.trigger_id);
      if (prestazione) {
        return (
          <span className="fw-semibold text-primary">
            {prestazione.codice_breve}
          </span>
        )
      }
      // Fallback se non trovato (o se è un ID vecchio)
      return <span className="text-muted font-monospace">{rule.trigger_id}</span>
    }

    return rule.trigger_id;
  };

  return (
    <CTable small align="middle" responsive hover bordered>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>ID</CTableHeaderCell>
          <CTableHeaderCell>Nome Regola</CTableHeaderCell>
          <CTableHeaderCell>Trigger</CTableHeaderCell>
          <CTableHeaderCell>Azione</CTableHeaderCell>
          <CTableHeaderCell>Stato</CTableHeaderCell>
          <CTableHeaderCell>Azioni</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {rules.map((r) => (
          <CTableRow key={r.id}>
            <CTableDataCell>{r.id}</CTableDataCell>
            <CTableDataCell>{r.name}</CTableDataCell>
            <CTableDataCell>
              {renderTrigger(r)}
            </CTableDataCell>
            <CTableDataCell>{r.action_name}</CTableDataCell>
            <CTableDataCell>
              <CButton
                size='sm'
                color={r.attiva ? 'warning' : 'success'}
                onClick={() => onToggle(r.id)}
                disabled={loading}
                variant="ghost"
              >
                {r.attiva ? <CIcon icon={cilMediaStop} /> : <CIcon icon={cilMediaPlay} />}
              </CButton>
            </CTableDataCell>
            <CTableDataCell>
              <CButton
                size='sm'
                color='info'
                variant='outline'
                onClick={() => onEdit(r)}
                disabled={loading}
              >
                <CIcon icon={cilPencil} />
              </CButton>
              <CButton
                size='sm'
                color='danger'
                variant='outline'
                onClick={() => onDelete(r.id)}
                disabled={loading}
              >
                <CIcon icon={cilTrash} />
              </CButton>
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  );
};

export default ListaRegole;