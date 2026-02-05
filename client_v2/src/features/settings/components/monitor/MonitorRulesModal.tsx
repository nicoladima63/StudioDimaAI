import React, { useState, useRef, useEffect } from 'react';
import {
    CButton,
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CRow,
    CCol,
    CAlert
} from '@coreui/react';
import automationApi, { type Action, type AutomationRule } from '@/features/settings/services/automation.service';
import MonitorPrestazioniService from '@/services/api/monitorPrestazioni';
import ListaRegole from './ListaRegole';
import CallbackCard from './CallbackCard';
import TriggerSourceSelector, { Trigger } from './TriggerSourceSelector';

interface MonitorRulesModalProps {
    visible: boolean;
    onClose: () => void;
    monitorId: string | null;
    monitorName: string;
}

const MonitorRulesModal: React.FC<MonitorRulesModalProps> = ({
    visible,
    onClose,
    monitorId,
    monitorName,
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // States for rules and actions
    const [actions, setActions] = useState<Action[]>([]);
    const [rules, setRules] = useState<AutomationRule[]>([]);

    // Edit state
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [trigger, setTrigger] = useState<Trigger | null>(null);
    const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
    const [selectedActionParams, setSelectedActionParams] = useState<any | null>(null);
    const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);

    const selectedActionIdRef = useRef(selectedActionId);
    selectedActionIdRef.current = selectedActionId;

    // Load details on open
    useEffect(() => {
        if (visible && monitorId) {
            loadMonitorDetails(monitorId);
        } else {
            // Reset state on close
            setRules([]);
            setActions([]);
            setError(null);
            setSuccess(null);
            handleCancelEdit();
        }
    }, [visible, monitorId]);

    const loadMonitorDetails = async (id: string) => {
        try {
            setLoading(true);
            const response = await MonitorPrestazioniService.getMonitorDetails(id);
            if (response.success && response.data) {
                setRules(response.data.rules);
                setActions(response.data.actions);
            }
        } catch (e) {
            console.error('Errore caricamento dettagli monitor', e);
            setError('Impossibile caricare i dettagli del monitor.');
        } finally {
            setLoading(false);
        }
    };

    const handleActionChange = (newActionId: number | null) => {
        if (newActionId !== selectedActionIdRef.current) {
            setSelectedActionParams(null);
        }
        setSelectedActionId(newActionId);
    };

    const handleEditRegola = (rule: AutomationRule) => {
        setEditingRule(rule);
        setSelectedActionId(rule.action_id);
        setSelectedActionParams(rule.action_params || {});
        if (rule.trigger_type && rule.trigger_id) {
            setTrigger({ type: rule.trigger_type, id: String(rule.trigger_id), name: rule.trigger_id });
        }
        setIsParamsModalOpen(true);
    };

    const handleCancelEdit = () => {
        setEditingRule(null);
        setTrigger(null);
        setSelectedActionId(null);
        setSelectedActionParams(null);
        setError(null);
        setSuccess(null);
    };

    const handleDirectSaveParams = async (params: any) => {
        if (!editingRule || !selectedActionId) throw new Error("Modalità edit non valida");

        try {
            setLoading(true);
            await automationApi.updateRule(editingRule.id, {
                action_id: selectedActionId,
                action_params: params || {},
            });
            setSuccess('Parametri aggiornati con successo');
            handleCancelEdit();
            if (monitorId) await loadMonitorDetails(monitorId);
        } catch (e: any) {
            setError(e?.message || 'Errore aggiornamento parametri');
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);

        if (editingRule) {
            // Update Logic
            if (!selectedActionId) { setError("Seleziona un'azione."); return; }
            try {
                setLoading(true);
                await automationApi.updateRule(editingRule.id, {
                    action_id: selectedActionId,
                    action_params: selectedActionParams || {},
                });
                setSuccess('Regola aggiornata');
                setEditingRule(null); // Reset edit mode but stay in modal
                setTrigger(null);
                setSelectedActionId(null);
                setSelectedActionParams(null);

                if (monitorId) await loadMonitorDetails(monitorId);
            } catch (e: any) {
                setError(e?.message || 'Errore aggiornamento regola');
            } finally {
                setLoading(false);
            }
        } else {
            // Create Logic
            if (!trigger || !selectedActionId || !monitorId) {
                setError("Seleziona un trigger, un'azione e il monitor.");
                return;
            }
            const selectedAction = actions.find(a => a.id === selectedActionId);

            try {
                setLoading(true);
                await automationApi.createRule({
                    name: `Regola per ${trigger.name} - ${selectedAction?.name}`,
                    description: `Trigger: ${trigger.name}`,
                    trigger_type: trigger.type,
                    trigger_id: trigger.id,
                    action_id: selectedActionId,
                    action_params: selectedActionParams || {},
                    attiva: true,
                    priorita: 10,
                    monitor_id: monitorId,
                });
                setSuccess('Regola creata con successo');
                // Reset form for next entry
                setTrigger(null);
                setSelectedActionId(null);
                setSelectedActionParams(null);

                await loadMonitorDetails(monitorId);
            } catch (e: any) {
                setError(e?.message || 'Errore creazione regola');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleToggleRegola = async (id: number) => {
        try {
            await automationApi.toggleRule(id);
            if (monitorId) await loadMonitorDetails(monitorId);
        } catch (e) { console.error(e); }
    };

    const handleDeleteRegola = async (id: number) => {
        if (!confirm('Eliminare questa regola?')) return;
        try {
            await automationApi.deleteRule(id);
            if (monitorId) await loadMonitorDetails(monitorId);
        } catch (e) { console.error(e); }
    };


    return (
        <CModal visible={visible} onClose={onClose} size="xl" backdrop="static">
            <CModalHeader>
                <CModalTitle>Gestione Regole: {monitorName}</CModalTitle>
            </CModalHeader>
            <CModalBody>
                <div className="mb-3">
                    {error && <CAlert color="danger" dismissible onClose={() => setError(null)}>{error}</CAlert>}
                    {success && <CAlert color="success" dismissible onClose={() => setSuccess(null)}>{success}</CAlert>}
                </div>

                <CRow>
                    {/* Left Column: Rule Editor */}
                    <CCol md={4} className="border-end">
                        <h6 className="mb-3 fw-bold">{editingRule ? 'Modifica Regola' : 'Crea Nuova Regola'}</h6>

                        <TriggerSourceSelector onChange={setTrigger} />

                        <div className="mt-3">
                            <CallbackCard
                                actions={actions}
                                selectedActionId={selectedActionId}
                                onActionChange={handleActionChange}
                                initialParams={selectedActionParams}
                                onParamsChange={setSelectedActionParams}
                                isModalOpen={isParamsModalOpen}
                                setIsModalOpen={setIsParamsModalOpen}
                                {...(editingRule ? { onDirectSave: handleDirectSaveParams } : {})}
                            />
                        </div>

                        {editingRule && (
                            <div className="mt-3">
                                <CButton color="secondary" variant="outline" onClick={handleCancelEdit} className="w-100">
                                    Annulla Modifica
                                </CButton>
                            </div>
                        )}
                    </CCol>

                    {/* Right Column: Rule List */}
                    <CCol md={8}>
                        <h6 className="mb-3 fw-bold ps-2">Regole Attive ({rules.length})</h6>
                        <div className="overflow-auto" style={{ maxHeight: '600px' }}>
                            <ListaRegole
                                rules={rules}
                                onToggle={handleToggleRegola}
                                onDelete={handleDeleteRegola}
                                onEdit={handleEditRegola}
                                loading={loading}
                            />
                        </div>
                    </CCol>
                </CRow>
            </CModalBody>
            <CModalFooter>
                <CButton color="secondary" variant="ghost" onClick={onClose}>Annulla</CButton>
                <CButton
                    color="primary"
                    onClick={handleSave}
                    disabled={(!trigger && !editingRule) || !selectedActionId || loading}
                >
                    Salva Regola
                </CButton>
            </CModalFooter>
        </CModal>
    );
};

export default MonitorRulesModal;
