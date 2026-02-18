/**
 * Push Notification Toggle Component
 * Allows users to enable/disable browser push notifications
 */

import React from 'react';
import {
    CButton,
    CSpinner,
    CTooltip,
    CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBell, cilWarning, cilX } from '@coreui/icons';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationToggleProps {
    showLabel?: boolean;
    size?: 'sm' | 'lg';
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
}

const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({
    showLabel = true,
    size,
    onError,
    onSuccess
}) => {
    const {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe
    } = usePushNotifications();

    const handleToggle = async () => {
        try {
            if (isSubscribed) {
                await unsubscribe();
                onSuccess?.('Notifiche push disattivate');
            } else {
                await subscribe();
                onSuccess?.('Notifiche push attivate! Riceverai avvisi importanti anche quando il browser e chiuso.');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Errore durante la gestione delle notifiche';
            onError?.(errorMessage);
        }
    };

    // Not supported
    if (!isSupported) {
        return (
            <CTooltip content="Il tuo browser non supporta le notifiche push">
                <CButton color="secondary" disabled size={size}>
                    <CIcon icon={cilX} className="me-2" />
                    {showLabel && 'Non supportato'}
                </CButton>
            </CTooltip>
        );
    }

    // Permission denied
    if (permission === 'denied') {
        return (
            <CTooltip content="Hai negato il permesso per le notifiche. Abilitalo nelle impostazioni del browser.">
                <CButton color="danger" disabled size={size}>
                    <CIcon icon={cilX} className="me-2" />
                    {showLabel && 'Permesso negato'}
                </CButton>
            </CTooltip>
        );
    }

    // Get button props based on state
    const getButtonProps = () => {
        if (isSubscribed) {
            return {
                color: 'success',
                icon: cilBell,
                label: 'Notifiche attive',
                tooltip: 'Disattiva le notifiche push'
            };
        } else {
            return {
                color: 'warning',
                icon: cilWarning,
                label: 'Attiva notifiche',
                tooltip: 'Ricevi avvisi anche quando il browser e chiuso'
            };
        }
    };

    const buttonProps = getButtonProps();

    return (
        <>
            <CTooltip content={buttonProps.tooltip}>
                <CButton
                    color={buttonProps.color}
                    onClick={handleToggle}
                    disabled={isLoading}
                    size={size}
                >
                    {isLoading ? (
                        <CSpinner size="sm" className="me-2" />
                    ) : (
                        <CIcon icon={buttonProps.icon} className="me-2" />
                    )}
                    {showLabel && buttonProps.label}
                    {isSubscribed && (
                        <CBadge color="light" className="ms-2">ON</CBadge>
                    )}
                </CButton>
            </CTooltip>

            {error && (
                <small className="text-danger d-block mt-1">
                    {error}
                </small>
            )}
        </>
    );
};

export default PushNotificationToggle;
