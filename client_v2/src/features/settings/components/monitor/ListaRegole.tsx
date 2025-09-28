import React from 'react';
import { CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash, cilMediaStop, cilMediaPlay } from '@coreui/icons';
import { AutomationRule } from '@/features/settings/services/automation.service';

// Definiamo le props che il componente riceverà
interface ListaRegoleProps {
  rules: AutomationRule[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}

const ListaRegole: React.FC<ListaRegoleProps> = ({ rules, onToggle, onDelete, loading }) => {
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
              <td>{r.trigger_id}</td>
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