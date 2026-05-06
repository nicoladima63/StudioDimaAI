import React, { useState } from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CButton, CTooltip } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSearch, cilFile, cilDescription } from '@coreui/icons';
import { SimulatedAction } from '../services/simulation.service';
import PreviewDialog from './PreviewDialog';

interface Props {
  actions: SimulatedAction[];
}

const EmailSimulationTab: React.FC<Props> = ({ actions }) => {
  const [selectedAction, setSelectedAction] = useState<SimulatedAction | null>(null);

  if (actions.length === 0) {
    return <div className="text-center p-4 text-muted">Nessun bonifico Mediolanum trovato tra le email non lette.</div>;
  }

  return (
    <>
      <CTable hover responsive align="middle">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Email Originale</CTableHeaderCell>
            <CTableHeaderCell>Data</CTableHeaderCell>
            <CTableHeaderCell>Allegato</CTableHeaderCell>
            <CTableHeaderCell>Destinazione Salvataggio</CTableHeaderCell>
            <CTableHeaderCell>Inviato a</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {actions.map((action, idx) => (
            <CTableRow key={idx}>
              <CTableDataCell>
                <strong>{action.original_subject}</strong>
              </CTableDataCell>
              <CTableDataCell>
                {action.original_date}
              </CTableDataCell>
              <CTableDataCell>
                <CIcon icon={cilFile} className="me-2 text-danger" />
                {action.attachment_name}
              </CTableDataCell>
              <CTableDataCell>
                <span className="small font-monospace">{action.save_path}</span>
              </CTableDataCell>
              <CTableDataCell>
                {action.accountant_email?.to}
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

export default EmailSimulationTab;
