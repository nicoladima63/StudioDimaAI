import React, { useState } from 'react';
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CButton,
  CButtonGroup,
  CBadge,
  CSpinner,
  CToast,
  CToastBody,
  CToaster
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSettings, cilMobile, cilCloudDownload, cilCloudUpload } from '@coreui/icons';
import TemplateEditor from '../components/TemplateEditor';
import templatesService from '../services/templates.service';

const TemplatesPage: React.FC = () => {
  const [activeKey, setActiveKey] = useState<string>('richiamo');
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');

  const showToastMessage = (message: string, color: 'success' | 'danger' | 'warning') => {
    setToastMessage(message);
    setToastColor(color);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      const result = await templatesService.apiBackupTemplates();
      
      if (result.success && result.data) {
        showToastMessage('Backup template creato con successo', 'success');
      } else {
        showToastMessage(result.error || 'Errore creazione backup', 'danger');
      }
    } catch (error) {
      console.error('Errore backup template:', error);
      showToastMessage('Errore creazione backup', 'danger');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Sei sicuro di voler ripristinare i template da backup? Questa operazione sostituirà i template correnti.')) {
      return;
    }

    try {
      setRestoreLoading(true);
      // For now, we'll need to implement file selection logic
      // This is a placeholder for the restore functionality
      showToastMessage('Funzione di ripristino non ancora implementata', 'warning');
    } catch (error) {
      console.error('Errore ripristino template:', error);
      showToastMessage('Errore ripristino template', 'danger');
    } finally {
      setRestoreLoading(false);
    }
  };

  // Default variables for each template type
  const richiamoVariables = [
    'nome_completo',
    'tipo_richiamo', 
    'data_richiamo'
  ];

  const promemoriVariables = [
    'nome_completo',
    'data_appuntamento',
    'ora_appuntamento',
    'tipo_appuntamento',
    'medico'
  ];

  return (
    <CContainer fluid>
      <CRow>
        <CCol>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2>
                <CIcon icon={cilSettings} className="me-2" />
                Gestione Template SMS
              </h2>
              <p className="text-muted mb-0">
                Personalizza i template per SMS di richiamo e promemoria appuntamenti
              </p>
            </div>
            
            <CButtonGroup>
              <CButton
                color="outline-secondary"
                size="sm"
                disabled={backupLoading}
                onClick={handleBackup}
              >
                {backupLoading ? <CSpinner size="sm" /> : <CIcon icon={cilCloudDownload} />}
                <span className="ms-1">Backup</span>
              </CButton>
              <CButton
                color="outline-secondary"
                size="sm"
                disabled={restoreLoading}
                onClick={handleRestore}
              >
                {restoreLoading ? <CSpinner size="sm" /> : <CIcon icon={cilCloudUpload} />}
                <span className="ms-1">Ripristina</span>
              </CButton>
            </CButtonGroup>
          </div>

          <CCard>
            <CCardHeader>
              <CNav variant="tabs" role="tablist">
                <CNavItem>
                  <CNavLink
                    href="#"
                    active={activeKey === 'richiamo'}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveKey('richiamo');
                    }}
                  >
                    <CIcon icon={cilMobile} className="me-2" />
                    SMS Richiami
                    <CBadge color="primary" className="ms-2">
                      Richiamo
                    </CBadge>
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    href="#"
                    active={activeKey === 'promemoria'}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveKey('promemoria');
                    }}
                  >
                    <CIcon icon={cilMobile} className="me-2" />
                    SMS Promemoria
                    <CBadge color="success" className="ms-2">
                      Promemoria
                    </CBadge>
                  </CNavLink>
                </CNavItem>
              </CNav>
            </CCardHeader>

            <CCardBody className="p-0">
              <CTabContent>
                <CTabPane
                  role="tabpanel"
                  aria-labelledby="richiamo-tab"
                  visible={activeKey === 'richiamo'}
                >
                  <div className="p-4">
                    <TemplateEditor
                      tipo="richiamo"
                      title="Template SMS Richiami Pazienti"
                      defaultVariables={richiamoVariables}
                    />
                  </div>
                </CTabPane>

                <CTabPane
                  role="tabpanel"
                  aria-labelledby="promemoria-tab"
                  visible={activeKey === 'promemoria'}
                >
                  <div className="p-4">
                    <TemplateEditor
                      tipo="promemoria"
                      title="Template SMS Promemoria Appuntamenti"
                      defaultVariables={promemoriVariables}
                    />
                  </div>
                </CTabPane>
              </CTabContent>
            </CCardBody>
          </CCard>

          {/* Help Card */}
          <CCard className="mt-4">
            <CCardBody>
              <h6>💡 Suggerimenti per l'uso</h6>
              <ul className="mb-0">
                <li>
                  <strong>Variabili:</strong> Usa le variabili tra parentesi graffe come <code>{'{{nome_completo}}'}</code> per personalizzare i messaggi
                </li>
                <li>
                  <strong>Lunghezza SMS:</strong> I messaggi oltre 160 caratteri vengono divisi in più SMS
                </li>
                <li>
                  <strong>Anteprima:</strong> L'anteprima mostra come apparirà il messaggio con dati di esempio
                </li>
                <li>
                  <strong>Backup:</strong> Crea sempre un backup prima di modifiche importanti
                </li>
                <li>
                  <strong>Reset:</strong> Puoi sempre ripristinare i template ai valori di default
                </li>
              </ul>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Toast Notifications */}
      <CToaster placement="top-end">
        {showToast && (
          <CToast autohide visible color={toastColor}>
            <CToastBody>{toastMessage}</CToastBody>
          </CToast>
        )}
      </CToaster>
    </CContainer>
  );
};

export default TemplatesPage;