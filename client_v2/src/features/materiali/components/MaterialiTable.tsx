import React from 'react';
import { CButton, CBadge } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilPencil, cilTrash } from '@coreui/icons';

import DataTable, { DataTableColumn } from '@/components/tables/DataTable';
import type { Materiale } from '@/store/materiali.store';

interface MaterialiTableProps {
  materiali: Materiale[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (materiale: Materiale) => void;
  onDelete?: (materiale: Materiale) => void;
  onView?: (materiale: Materiale) => void;
  searchable?: boolean;
}

const MaterialiTable: React.FC<MaterialiTableProps> = ({
  materiali,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onView,
  searchable = true
}) => {
  
  const columns: DataTableColumn<Materiale>[] = [
    {
      key: 'nome',
      label: 'Nome Materiale',
      sortable: true,
      width: '25%',
      defaultVisible: true,
      order: 1,
      render: (value, item) => (
        <div>
          <div className="fw-bold">{value}</div>
          {item.codicearticolo && (
            <div className="small text-muted">Cod: {item.codicearticolo}</div>
          )}
        </div>
      )
    },
    {
      key: 'fornitorenome',
      label: 'Fornitore',
      sortable: true,
      width: '20%',
      defaultVisible: true,
      order: 2,
      render: (value, item) => (
        <div>
          <div>{value}</div>
          <div className="small text-muted">ID: {item.fornitoreid}</div>
        </div>
      )
    },
    {
      key: 'costo_unitario',
      label: 'Prezzo',
      sortable: true,
      width: '10%',
      defaultVisible: true,
      order: 3,
      render: (value) => (
        <span className="fw-bold text-success">
          €{Number(value).toFixed(2)}
        </span>
      )
    },
    {
      key: 'contonome',
      label: 'Classificazione',
      sortable: true,
      width: '25%',
      defaultVisible: true,
      order: 4,
      render: (value, item) => {
        if (!value) {
          return <CBadge color="secondary">Non classificato</CBadge>;
        }
        
        const getBadgeColor = (confidence: number) => {
          if (confidence >= 95) return 'success';
          if (confidence >= 80) return 'warning';
          return 'danger';
        };
        
        return (
          <div>
            <div className="d-flex align-items-center gap-2">
              <CBadge color={getBadgeColor(item.confidence)}>
                {item.confidence}%
              </CBadge>
              {item.confermato === 1 && (
                <CBadge color="info">✓</CBadge>
              )}
            </div>
            <div className="small mt-1">
              <div>{value}</div>
              {item.brancanome && (
                <div className="text-muted">→ {item.brancanome}</div>
              )}
              {item.sottocontonome && (
                <div className="text-muted">→ {item.sottocontonome}</div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'id',
      label: 'Azioni',
      sortable: false,
      width: '15%',
      defaultVisible: true,
      order: 10, // Ultima colonna
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
              title="Modifica materiale"
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
              title="Elimina materiale"
              className="action-btn"
            >
              <CIcon icon={cilTrash} size="sm"  />
            </CButton>
          )}
        </div>
      )
    },
    // Colonne aggiuntive nascoste di default
    {
      key: 'codicearticolo',
      label: 'Codice Articolo',
      sortable: true,
      width: '15%',
      defaultVisible: false,
      order: 5,
      render: (value) => value || '-'
    },
    {
      key: 'categoria_contabile',
      label: 'Categoria Contabile',
      sortable: true,
      width: '15%',
      defaultVisible: false,
      order: 6,
      render: (value) => value || '-'
    },
    {
      key: 'brancanome',
      label: 'Branca',
      sortable: true,
      width: '15%',
      defaultVisible: false,
      order: 7,
      render: (value) => value || '-'
    },
    {
      key: 'sottocontonome',
      label: 'Sottoconto',
      sortable: true,
      width: '15%',
      defaultVisible: false,
      order: 8,
      render: (value) => value || '-'
    },
    {
      key: 'confidence',
      label: 'Confidence',
      sortable: true,
      width: '10%',
      defaultVisible: false,
      order: 9,
      render: (value) => `${value}%`
    },
    {
      key: 'confermato',
      label: 'Confermato',
      sortable: true,
      width: '10%',
      defaultVisible: false,
      order: 9.5,
      render: (value) => value === 1 ? '✅ Sì' : '❌ No'
    }
  ];

  return (
    <DataTable
      data={materiali}
      columns={columns}
      loading={loading}
      error={error}
      searchable={searchable}
      searchPlaceholder="Cerca per nome, codice, fornitore..."
      pageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      className="materiali-table"
      tableId="materiali-table"
      autoDetectColumns={true}
    />
  );
};

export default MaterialiTable;