import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react';
import CallbackCard from '../components/monitor/CallbackCard';
import { automationService, type Action } from '../services/automation.service';
import toast from 'react-hot-toast';

const MonitoringSettings: React.FC = () => {
  // --- STATI DEL COMPONENTE ---

  // Stato per la lista di azioni disponibili (caricate dal backend)
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stato per l'azione attualmente selezionata nella UI
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);

  // Stato per i parametri dell'azione selezionata
  const [actionParams, setActionParams] = useState<any>({});

  // --- STATO PER IL MODALE (LA PARTE CHE RISOLVE IL BUG) ---
  // 1. Definiamo uno stato per controllare se il modale dei parametri è aperto o chiuso.
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);

  // Effetto per caricare le azioni disponibili al montaggio del componente
  useEffect(() => {
    const fetchActions = async () => {
      try {
        setIsLoading(true);
        const fetchedActions = await automationService.getActions();
        setActions(fetchedActions);
      } catch (error) {
        console.error("Failed to fetch actions:", error);
        toast.error('Impossibile comunicare con il server per caricare le azioni.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActions();
  }, []);

  // Funzione per gestire il cambio di azione nella dropdown
  const handleActionChange = (actionId: number | null) => {
    setSelectedActionId(actionId);
    // Quando l'azione cambia, resettiamo i parametri
    setActionParams({});
  };

  // Funzione per salvare i parametri configurati nel modale
  const handleParamsChange = (newParams: any) => {
    setActionParams(newParams);
    toast.success('Parametri salvati correttamente!');
  };

  if (isLoading) {
    return <CSpinner color="primary" />;
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>Impostazioni di Monitoraggio e Automazione</strong>
          </CCardHeader>
          <CCardBody>
            <p className="text-medium-emphasis small">
              Seleziona un'azione da eseguire quando una condizione di monitoraggio viene soddisfatta.
            </p>
            <CallbackCard
              actions={actions}
              selectedActionId={selectedActionId}
              onActionChange={handleActionChange}
              initialParams={actionParams}
              onParamsChange={handleParamsChange}
              // 2. Passiamo lo stato e la funzione al componente figlio.
              // Questo è il fix: ora `CallbackCard` riceve le props che si aspetta.
              isModalOpen={isParamsModalOpen}
              setIsModalOpen={setIsParamsModalOpen}
            />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default MonitoringSettings;