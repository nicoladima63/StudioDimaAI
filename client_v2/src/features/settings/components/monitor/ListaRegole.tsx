import React from 'react';
import { CBadge, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash, cilMediaStop, cilMediaPlay, cilPencil } from '@coreui/icons';
import { AutomationRule } from '@/features/settings/services/automation.service';

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
  if (rules.length === 0) {
    return <div className='text-muted'>Nessuna regola di automazione presente</div>;
  }

  return (
    <div className='table-responsive'>
      <table className='table table-sm align-middle'>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome Regola</th>
            <th>Trigger ID</th>
            <th>Nome</th>
            <th>Azione</th>
            <th>Stato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td align="center">
                {r.trigger_id}
              </td>
              <td>
                {TRIGGER_META[String(r.trigger_id)] && (
                  <CBadge
                    style={{
                      backgroundColor: TRIGGER_META[String(r.trigger_id)]!.color,
                      color: '#fff', padding: '7px',
                    }}
                    className="mt-1"
                  >
                    {TRIGGER_META[String(r.trigger_id)]!.label}
                  </CBadge>
                )}
              </td>
              <td>{r.action_name}</td>
              <td>
                <CButton
                  size='sm'
                  color={r.attiva ? 'warning' : 'success'}
                  onClick={() => onToggle(r.id)}
                  disabled={loading}
                >
                  {r.attiva ? <CIcon icon={cilMediaStop} /> : <CIcon icon={cilMediaPlay} />}
                </CButton>
              </td>
              <td>
                <CButton
                  size='sm'
                  color='info'
                  variant='outline'
                  onClick={() => onEdit(r)}
                  disabled={loading}
                  className='me-1'
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ListaRegole;