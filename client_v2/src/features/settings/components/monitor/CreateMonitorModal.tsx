
import React, { useState } from 'react';
import {
    CButton,
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CFormSelect,
    CFormLabel,
    CAlert,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus } from '@coreui/icons';
import MonitorPrestazioniService from '@/services/api/monitorPrestazioni';

interface CreateMonitorModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    monitorableTables: { name: string; description: string }[];
}

const CreateMonitorModal: React.FC<CreateMonitorModalProps> = ({
    visible,
    onClose,
    onSuccess,
    monitorableTables,
}) => {
    const [monitorTableName, setMonitorTableName] = useState(
        monitorableTables.length > 0 ? monitorableTables[0].name : ''
    );
    const monitorType = 'file_watcher';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update default table if the list changes
    React.useEffect(() => {
        if (!monitorTableName && monitorableTables.length > 0) {
            setMonitorTableName(monitorableTables[0].name);
        }
    }, [monitorableTables]);


    const handleCreateMonitor = async () => {
        try {
            setLoading(true);
            setError(null);

            const payload: any = {
                table_name: monitorTableName,
                monitor_type: monitorType,
                auto_start: false,
            };

            // Enrichment logic for 'preventivi'
            if (monitorTableName === 'preventivi') {
                payload.metadata = {
                    enrichment: {
                        source_field: "DB_PRELCOD",
                        target_table: "ELENCO.DBF",
                        target_key_field: "DB_CODE",
                        target_value_field: "DB_ELPACOD",
                        "new_field_name": "id_paziente"
                    }
                };
            }

            const response = await MonitorPrestazioniService.createMonitor(payload);

            if (response.success) {
                onSuccess();
                onClose();
                // Reset defaults
                setMonitorTableName(monitorableTables[0]?.name || '');
            } else {
                setError(response.message || 'Errore nella creazione del monitor');
            }
        } catch (e: any) {
            setError(e?.message || 'Errore nella creazione del monitor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <CModal visible={visible} onClose={onClose}>
            <CModalHeader>
                <CModalTitle>Crea Nuovo Monitor</CModalTitle>
            </CModalHeader>
            <CModalBody>
                {error && <CAlert color="danger">{error}</CAlert>}

                <div className="mb-3">
                    <CFormLabel htmlFor='monitorTableName'>Tabella DBF da Monitorare</CFormLabel>
                    <CFormSelect
                        id='monitorTableName'
                        value={monitorTableName}
                        onChange={(e) => setMonitorTableName(e.target.value)}
                        disabled={loading || monitorableTables.length === 0}>
                        {monitorableTables.length === 0 ? (
                            <option>Caricamento tabelle...</option>
                        ) : (
                            monitorableTables.map(table => (
                                <option key={table.name} value={table.name}>
                                    {table.name} ({table.description})
                                </option>
                            ))
                        )}
                    </CFormSelect>
                </div>
            </CModalBody>
            <CModalFooter>
                <CButton color="secondary" onClick={onClose} disabled={loading}>
                    Annulla
                </CButton>
                <CButton color="primary" onClick={handleCreateMonitor} disabled={loading || !monitorTableName}>
                    <CIcon icon={cilPlus} className="me-1" /> Crea
                </CButton>
            </CModalFooter>
        </CModal>
    );
};

export default CreateMonitorModal;
