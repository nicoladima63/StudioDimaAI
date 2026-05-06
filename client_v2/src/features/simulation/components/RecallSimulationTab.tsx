import React, { useState } from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CBadge, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSearch } from '@coreui/icons';
import { SimulatedAction } from '../services/simulation.service';
import PreviewDialog from './PreviewDialog';

interface Props {
  actions: SimulatedAction[];
}

const RecallSimulationTab: React.FC<Props> = ({ actions }) => {
  const [selectedAction, setSelectedAction] = useState<SimulatedAction | null>(null);

  if (actions.length === 0) {
    return <div className="text-center p-4 text-muted">Nessun richiamo scaduto da processare oggi.</div>;
  }

  return (
    <>
      <CTable hover responsive align="middle">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Paziente</CTableHeaderCell>
            <CTableHeaderCell>Tipo Richiamo</CTableHeaderCell>
            <CTableHeaderCell>Data Prevista</CTableHeaderCell>
            <CTableHeaderCell>Messaggio</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {actions.map((action, idx) => (
            <CTableRow key={idx}>
              <CTableDataCell>
                <strong>{action.patient_name}</strong>
                <div className="small text-muted">{action.phone}</div>
              </CTableDataCell>
              <CTableDataCell>
                {action.recall_type_names?.map((name, i) => (
                  <CBadge key={i} color="secondary" className="me-1">{name}</CBadge>
                ))}
              </CTableDataCell>
              <CTableDataCell>
                {action.scheduled_date}
              </CTableDataCell>
              <CTableDataCell>
                <div className="text-truncate" style={{ maxWidth: '300px' }}>
                  {action.message}
                </div>
              </CTableDataCell>
              <CTableDataCell>
                <CButton size="sm" color="info" variant="outline" onClick={() => setSelectedAction(action)}>
                  <CIcon icon={cilSearch} />
                </CButton>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>

      <PreviewDialog
        visible={!!selectedAction}
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
      />
    </>
  );
};

export default RecallSimulationTab;
