import React from 'react';
import { CButton, CBadge } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilPencil, cilTrash } from '@coreui/icons';

import DataTable, { DataTableColumn } from '@/components/tables/DataTable';
import type { Fornitore } from '@/store/fornitori.store';

interface FornitoriTableProps {
  fornitori: Fornitore[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (fornitore: Fornitore) => void;
  onDelete?: (fornitore: Fornitore) => void;
  onView?: (fornitore: Fornitore) => void;
}

const FornitoriTable: React.FC<FornitoriTableProps> = ({
  fornitori,
  loading = false,
  error=null,
  onEdit,
  onDelete,
  onView
}) => {

  const columns: DataTableColumn<Fornitore>[] = [
    {
      key: 'nome',
      label: 'Nome Fornitore',
      sortable: true,
      width: '25%',
      defaultVisible: true,
      order: 1,
    },
    {
      key: 'codice',
      label: 'Codice',
      sortable: true,
      width: '12%',
      defaultVisible: true,
      order: 2,
    },
    {
      key: 'partita_iva',
      label: 'Partita IVA',
      sortable: true,
      width: '15%',
      defaultVisible: true,
      order: 3,
    },
    {
      key: 'telefono',
      label: 'Telefono',
      sortable: false,
      width: '12%',
      defaultVisible: true,
      order: 4,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      width: '18%',
      defaultVisible: true,
      order: 5,
    },
    {
      key: 'classificazione_status',
      label: 'Classificazione',
      sortable: false,
      width: '15%',
      defaultVisible: true,
      order: 6,
      render: (value, item) => {
        // Determina lo stato della classificazione
        if (item.contoid && item.brancaid && item.sottocontoid) {
          return <CBadge color="success">Completo</CBadge>;
        } else if (item.contoid) {
          return <CBadge color="warning">Parziale</CBadge>;
        } else {
          return <CBadge color="danger">Non classificato</CBadge>;
        }
      }
    },
    // Colonna Azioni (sempre visibile e non draggable)
    {
      key: 'id',
      label: 'Azioni',
      sortable: false,
      width: '180px',
      defaultVisible: true,
      order: 99, // Ultima colonna
      render: (value, item) => (
        <div className="d-flex gap-1 justify-content-end">
          {onView && (
            <CButton
              color="primary"
              variant="outline"
              size="sm"
              onClick={() => onView(item)}
              title="Visualizza dettagli"
              className="action-btn"
            >
              <CIcon icon={cilList} size="sm" />
            </CButton>
          )}
          {onEdit && (
            <CButton
              color="primary"
              variant="outline"
              size="sm"
              onClick={() => onEdit(item)}
              title="Modifica fornitore"
              className="action-btn"
            >
              <CIcon icon={cilPencil} size="sm" />
            </CButton>
          )}
          {onDelete && (
            <CButton
              color="danger"
              variant="outline"
              size="sm"
              onClick={() => onDelete(item)}
              title="Elimina fornitore"
              className="action-btn"
            >
              <CIcon icon={cilTrash} size="sm" />
            </CButton>
          )}
        </div>
      )
    },
    // Colonne aggiuntive nascoste di default
    {
      key: 'indirizzo',
      label: 'Indirizzo',
      sortable: false,
      width: '20%',
      defaultVisible: false,
      order: 11,
    },
    {
      key: 'citta',
      label: 'Città',
      sortable: true,
      width: '12%',
      defaultVisible: false,
      order: 12,
    },
    {
      key: 'cap',
      label: 'CAP',
      sortable: false,
      width: '8%',
      defaultVisible: false,
      order: 13,
    },
    {
      key: 'provincia',
      label: 'Provincia',
      sortable: true,
      width: '8%',
      defaultVisible: false,
      order: 14,
    },
    {
      key: 'codice_fiscale',
      label: 'Codice Fiscale',
      sortable: false,
      width: '15%',
      defaultVisible: false,
      order: 15,
    },
    {
      key: 'sito_web',
      label: 'Sito Web',
      sortable: false,
      width: '18%',
      defaultVisible: false,
      order: 16,
      render: (value) => value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
          {value}
        </a>
      ) : '-'
    },
    {
      key: 'note',
      label: 'Note',
      sortable: false,
      width: '20%',
      defaultVisible: false,
      order: 17,
      render: (value) => value ? (
        <span title={value}>
          {value.length > 50 ? `${value.substring(0, 50)}...` : value}
        </span>
      ) : '-'
    }
  ];

  return (
    <DataTable
      data={fornitori}
      columns={columns}
      loading={loading}
      error={error}
      searchable={true}
      searchPlaceholder="Cerca per nome, codice, fornitore..."
      pageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      className="materiali-table"
      tableId="fornitori-table"
      autoDetectColumns={true}
    />
  );
};

export default FornitoriTable;