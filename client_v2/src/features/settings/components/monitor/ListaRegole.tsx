import React from 'react';
import { CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash } from '@coreui/icons';

// Definiamo il tipo per una singola regola per chiarezza
interface Regola {
  id: number;
  nome_prestazione: string;
  callback_function: string;
  attiva: boolean;
}

// Definiamo le props che il componente riceverà
interface ListaRegoleProps {
  regole: Regola[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}

const ListaRegole: React.FC<ListaRegoleProps> = ({ regole, onToggle, onDelete, loading }) => {
  if (regole.length === 0) {
    return <div className='text-muted'>Nessuna regola presente</div>;
  }

  return (
    <div className='table-responsive'>
      <table className='table table-sm align-middle'>
        <thead>
          <tr>
            <th>ID</th>
            <th>Prestazione</th>
            <th>Callback</th>
            <th>Stato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {regole.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.nome_prestazione}</td>
              <td>{r.callback_function}</td>
              <td>
                <CButton
                  size='sm'
                  color={r.attiva ? 'warning' : 'success'}
                  onClick={() => onToggle(r.id)}
                  disabled={loading}
                >
                  {r.attiva ? 'Ferma' : 'Avvia'}
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
                  <CIcon icon={cilTrash} /> Elimina
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
