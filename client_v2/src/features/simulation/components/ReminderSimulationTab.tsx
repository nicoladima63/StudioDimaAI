import React, { useState } from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CBadge, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSearch } from '@coreui/icons';
import { SimulatedAction } from '@/features/simulation/services/simulation.service';
import PreviewDialog from './PreviewDialog';

interface Props {
  actions: SimulatedAction[];
}

const ReminderSimulationTab: React.FC<Props> = ({ actions }) => {
  const [selectedAction, setSelectedAction] = useState<SimulatedAction | null>(null);

  if (actions.length === 0) {
    return <div className="text-center p-4 text-muted">Nessun reminder da inviare per oggi.</div>;
  }

  return (
    <>
      <CTable hover responsive align="middle">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Paziente</CTableHeaderCell>
            <CTableHeaderCell>Tipo</CTableHeaderCell>
            <CTableHeaderCell>Canale</CTableHeaderCell>
            <CTableHeaderCell>Data/Ora Appt</CTableHeaderCell>
            <CTableHeaderCell>Messaggio</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {actions.map((action, idx) => (
            <CTableRow key={idx}>
              <CTableDataCell>
                <strong>{action.patient_name}</strong>
                <div className="small text-muted">ID: {action.patient_id}</div>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={action.type === '24h' ? 'info' : action.type === '2h' ? 'warning' : 'primary'}>
                  {action.type}
                </CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={action.channel === 'whatsapp' ? 'success' : 'secondary'}>
                  {action.channel}
                </CBadge>
              </CTableDataCell>
              <CTableDataCell>
                {action.appointment_date} - {action.appointment_time}
              </CTableDataCell>
              <CTableDataCell>
                <div className="text-truncate" style={{ maxWidth: '200px' }}>
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

export default ReminderSimulationTab;
