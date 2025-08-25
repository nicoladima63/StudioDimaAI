import React from 'react';
import { CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList } from '@coreui/icons';

import DataTable, { DataTableColumn } from '@/components/tables/DataTable';
import DataTable2 from '@/components/tables/DataTable2';
import type { Paziente } from '@/store/pazienti.store';
import RichiamoStatus from './RichiamoStatus';

interface PazientiTableProps {
  pazienti: Paziente[];
  loading?: boolean;
  error?: string | null;
  onView?: (paziente: Paziente) => void;
  onRichiamoChange?: (pazienteId: string, status: string, dataRichiamo?: string) => void;
}

const PazientiTable: React.FC<PazientiTableProps> = ({
  pazienti,
  loading = false,
  error = null,
  onView,
  onRichiamoChange
}) => {
  const columns: DataTableColumn<Paziente>[] = [
    {
      key: 'nome',
      label: 'Nome',
      sortable: true,
      width: '15%',
      defaultVisible: true,
      order: 1,
    },
    {
      key: 'cognome',
      label: 'Cognome',
      sortable: true,
      width: '15%',
      defaultVisible: true,
      order: 2,
    },
    {
      key: 'codice_fiscale',
      label: 'Codice Fiscale',
      sortable: true,
      width: '18%',
      defaultVisible: true,
      order: 3,
    },
    {
      key: 'data_nascita',
      label: 'Data Nascita',
      sortable: true,
      width: '12%',
      defaultVisible: true,
      order: 4,
      render: (value) => value ? new Date(value).toLocaleDateString('it-IT') : '-'
    },
    {
      key: 'luogo_nascita',
      label: 'Luogo Nascita',
      sortable: true,
      width: '12%',
      defaultVisible: true,
      order: 5,
    },
    {
      key: 'telefono',
      label: 'Telefono',
      sortable: false,
      width: '12%',
      defaultVisible: true,
      order: 6,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      width: '18%',
      defaultVisible: true,
      order: 7,
    },
    {
      key: 'stato_richiamo',
      label: 'Stato Richiamo',
      sortable: false,
      width: '200px',
      defaultVisible: true,
      order: 8,
      render: (value, item) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RichiamoStatus
            paziente={item}
            onRichiamoChange={(pazienteId, status, dataRichiamo) => {
              if (onRichiamoChange) {
                onRichiamoChange(pazienteId, status, dataRichiamo);
              }
            }}
          />
        </div>
      )
    },
    // Colonna Azioni (sempre visibile)
    {
      key: 'id',
      label: 'Azioni',
      sortable: false,
      width: '80px',
      defaultVisible: true,
      order: 9,
      render: (value, item) => (
        <div className="d-flex gap-1 justify-content-end">
          {onView && (
            <CButton
              color="primary"
              variant="outline"
              size="sm"
              onClick={() => onView(item)}
              title="Visualizza anagrafica"
              className="action-btn"
            >
              <CIcon icon={cilList} size="sm" />
            </CButton>
          )}
        </div>
      )
    },
    // Colonne aggiuntive nascoste di default
    {
      key: 'sesso',
      label: 'Sesso',
      sortable: true,
      width: '8%',
      defaultVisible: false,
      order: 10,
    },
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
      key: 'tessera_sanitaria',
      label: 'Tessera Sanitaria',
      sortable: false,
      width: '15%',
      defaultVisible: false,
      order: 15,
    },
    {
      key: 'note',
      label: 'Note',
      sortable: false,
      width: '20%',
      defaultVisible: false,
      order: 16,
      render: (value) => value ? (
        <span title={value}>
          {value.length > 50 ? `${value.substring(0, 50)}...` : value}
        </span>
      ) : '-'
    }
  ];

  return (
    <DataTable
      data={pazienti}
      columns={columns}
      loading={loading}
      error={error}
      searchable={true}
      searchPlaceholder="Cerca per nome, cognome, codice fiscale..."
      pageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      className="pazienti-table"
      tableId="pazienti-table"
      autoDetectColumns={true}
    />
  );
};

export default PazientiTable;