import React from 'react';
import {
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CButton,
    CAlert,
    CSpinner
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilX, cilWarning, cilCheckCircle, cilInfo } from '@coreui/icons';

export type ActionType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmActionModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    message: string;
    itemName?: string;
    actionType?: ActionType; // 'danger', 'warning', 'info', 'success'
    confirmText?: string;
    cancelText?: string;
    icon?: any; // CoreUI icon
    warning?: string; // Messaggio di avvertimento aggiuntivo
    details?: Array<{ label: string; value: string }>; // Dettagli aggiuntivi da mostrare
    loading?: boolean;
    error?: string | null;
    showWarningFooter?: boolean; // Mostra "Questa azione non può essere annullata"
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    itemName,
    actionType = 'warning',
    confirmText = 'Conferma',
    cancelText = 'Annulla',
    icon,
    warning,
    details = [],
    loading = false,
    error = null,
    showWarningFooter = false
}) => {
    const handleConfirm = async () => {
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            // L'errore sarà gestito dal componente parent tramite la prop error
        }
    };

    // Determina colore e icona in base al tipo di azione
    const getColorClass = () => {
        switch (actionType) {
            case 'danger': return 'text-danger';
            case 'warning': return 'text-warning';
            case 'info': return 'text-info';
            case 'success': return 'text-success';
            default: return 'text-warning';
        }
    };

    const getDefaultIcon = () => {
        switch (actionType) {
            case 'danger': return cilWarning;
            case 'warning': return cilWarning;
            case 'info': return cilInfo;
            case 'success': return cilCheckCircle;
            default: return cilWarning;
        }
    };

    const getButtonColor = () => {
        switch (actionType) {
            case 'danger': return 'danger';
            case 'warning': return 'warning';
            case 'info': return 'info';
            case 'success': return 'success';
            default: return 'warning';
        }
    };

    const displayIcon = icon || getDefaultIcon();

    return (
        <CModal
            visible={visible}
            onClose={onClose}
            backdrop="static"
            size="lg"
        >
            <CModalHeader>
                <CModalTitle className={getColorClass()}>
                    <CIcon icon={displayIcon} className="me-2" />
                    {title}
                </CModalTitle>
            </CModalHeader>

            <CModalBody>
                {error && (
                    <CAlert color="danger" className="mb-3">
                        {error}
                    </CAlert>
                )}

                <div className="text-center mb-4">
                    <div className={`display-1 ${getColorClass()} mb-3`}>
                        <CIcon icon={displayIcon} />
                    </div>

                    <h5 className="mb-3">
                        {message}
                    </h5>

                    {itemName && (
                        <div className="bg-light p-3 rounded mb-3">
                            <strong className="fs-5">{itemName}</strong>
                        </div>
                    )}
                </div>

                {details.length > 0 && (
                    <div className="mb-3">
                        <h6 className="text-muted mb-2">Dettagli:</h6>
                        <div className="bg-light p-3 rounded">
                            {details.map((detail, index) => (
                                <div key={index} className="d-flex justify-content-between mb-1">
                                    <span className="text-muted">{detail.label}:</span>
                                    <strong>{detail.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {warning && (
                    <CAlert color="warning" className="mb-0">
                        <CIcon icon={cilWarning} className="me-2" />
                        <strong>Attenzione:</strong> {warning}
                    </CAlert>
                )}

                {showWarningFooter && (
                    <div className="text-muted small mt-3 text-center">
                        <strong>Questa azione non può essere annullata!</strong>
                    </div>
                )}
            </CModalBody>

            <CModalFooter className="justify-content-center">
                <CButton
                    color="secondary"
                    onClick={onClose}
                    disabled={loading}
                    size="lg"
                >
                    <CIcon icon={cilX} size="sm" className="me-1" />
                    {cancelText}
                </CButton>
                <CButton
                    color={getButtonColor()}
                    onClick={handleConfirm}
                    disabled={loading}
                    size="lg"
                >
                    {loading ? (
                        <>
                            <CSpinner size="sm" className="me-1" />
                            Elaborazione...
                        </>
                    ) : (
                        <>
                            <CIcon icon={displayIcon} size="sm" className="me-1" />
                            {confirmText}
                        </>
                    )}
                </CButton>
            </CModalFooter>
        </CModal>
    );
};

export default ConfirmActionModal;
