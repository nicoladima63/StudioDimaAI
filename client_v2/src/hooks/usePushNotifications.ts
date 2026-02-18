/**
 * React Hook for Push Notifications
 * Provides easy access to push notification state and actions
 */

import { useState, useEffect, useCallback } from 'react';
import pushService from '@/services/pushService';

interface UsePushNotificationsReturn {
    isSupported: boolean;
    permission: NotificationPermission;
    isSubscribed: boolean;
    isLoading: boolean;
    error: string | null;
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
    sendTestNotification: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
    const [isSupported] = useState(() => pushService.isSupported());
    const [permission, setPermission] = useState<NotificationPermission>(() =>
        pushService.getPermission()
    );
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check subscription status on mount
    useEffect(() => {
        const checkSubscription = async () => {
            if (!isSupported) return;

            try {
                const subscribed = await pushService.isSubscribed();
                setIsSubscribed(subscribed);
            } catch (err) {
                console.error('Error checking subscription:', err);
            }
        };

        checkSubscription();
    }, [isSupported]);

    // Subscribe to push notifications
    const subscribe = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await pushService.subscribe();
            setIsSubscribed(true);
            setPermission(pushService.getPermission());
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe';
            setError(errorMessage);
            console.error('Subscribe error:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await pushService.unsubscribe();
            setIsSubscribed(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe';
            setError(errorMessage);
            console.error('Unsubscribe error:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Send test notification
    const sendTestNotification = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await pushService.sendTestNotification();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to send test notification';
            setError(errorMessage);
            console.error('Test notification error:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe,
        sendTestNotification
    };
}
