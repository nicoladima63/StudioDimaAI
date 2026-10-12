/**
 * Push Notification Service
 * Handles browser push notification subscriptions and permissions
 */

import apiClient from '@/services/api/client';

export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

// Timeout per passaggio: senza, un passaggio bloccato lascia l'utente senza alcun feedback
const PERMISSION_TIMEOUT_MS = 60000;
const SERVICE_WORKER_TIMEOUT_MS = 15000;
const PUSH_SUBSCRIBE_TIMEOUT_MS = 20000;
const STATUS_CHECK_TIMEOUT_MS = 10000;

/**
 * Reject with the given message if the promise does not settle in time
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Extract base64 key from PEM format
 */
function extractBase64FromPEM(pem: string): string {
    // Remove PEM headers/footers and all whitespace (including literal \n strings)
    return pem
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\\n/g, '')  // Remove literal \n strings
        .replace(/\n/g, '')   // Remove actual newlines
        .replace(/\r/g, '')   // Remove carriage returns
        .replace(/\s/g, '')   // Remove all other whitespace
        .trim();
}

class PushService {
    private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

    /**
     * Check if push notifications are supported
     */
    isSupported(): boolean {
        return 'serviceWorker' in navigator &&
               'PushManager' in window &&
               'Notification' in window;
    }

    /**
     * Get current permission status
     */
    getPermission(): NotificationPermission {
        if (!('Notification' in window)) {
            return 'denied';
        }
        return Notification.permission;
    }

    /**
     * Request notification permission from user
     */
    async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            throw new Error('Notifications not supported');
        }

        const permission = await Notification.requestPermission();
        return permission;
    }

    /**
     * Register service worker
     */
    async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Workers not supported');
        }

        try {
            const registration = await navigator.serviceWorker.register(
                '/service-worker.js',
                { scope: '/' }
            );

            this.serviceWorkerRegistration = registration;

            // Wait for service worker to be ready
            await withTimeout(
                navigator.serviceWorker.ready,
                SERVICE_WORKER_TIMEOUT_MS,
                'Service worker non attivo: ricarica la pagina e riprova'
            );

            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            throw error;
        }
    }

    /**
     * Get VAPID public key from server
     */
    async getVapidPublicKey(): Promise<string> {
        const response = await apiClient.get('/push/public-key');

        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get VAPID public key');
        }

        return response.data.publicKey;
    }

    /**
     * Convert the server VAPID key (standard base64, DER or raw EC point) to the raw EC point
     */
    private async getApplicationServerKey(): Promise<Uint8Array<ArrayBuffer>> {
        const vapidPublicKeyBase64 = await this.getVapidPublicKey();
        // Decode from standard base64 directly using browser API
        const binaryString = window.atob(vapidPublicKeyBase64);
        const key = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            key[i] = binaryString.charCodeAt(i);
        }

        if (key.length === 91 && key[0] === 0x30) {
            // DER-encoded key: extract the 65-byte EC point (starts at byte 26)
            return key.slice(26, 91);
        }
        if (key.length === 65 && key[0] === 0x04) {
            // Already raw EC point format
            return key;
        }
        throw new Error(`Invalid VAPID key format: ${key.length} bytes starting with 0x${key[0].toString(16)}`);
    }

    /**
     * Create the browser subscription, replacing a stale one made with a different key
     */
    private async createBrowserSubscription(
        registration: ServiceWorkerRegistration,
        applicationServerKey: Uint8Array<ArrayBuffer>
    ): Promise<PushSubscription> {
        const subscribe = () => withTimeout(
            registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            }),
            PUSH_SUBSCRIBE_TIMEOUT_MS,
            'Il browser non riesce a contattare il servizio push (controlla rete, DNS o firewall)'
        );

        try {
            return await subscribe();
        } catch (error) {
            // Esiste una sottoscrizione fatta con un'altra chiave VAPID: va annullata prima
            if (error instanceof DOMException && error.name === 'InvalidStateError') {
                const existing = await registration.pushManager.getSubscription();
                if (existing) {
                    await existing.unsubscribe();
                    return await subscribe();
                }
            }
            throw error;
        }
    }

    /**
     * Send a browser subscription to the server
     */
    private async saveSubscription(subscription: PushSubscription): Promise<PushSubscriptionData> {
        const subscriptionJSON = subscription.toJSON();
        if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
            throw new Error('Sottoscrizione del browser incompleta');
        }

        const subscriptionData: PushSubscriptionData = {
            endpoint: subscriptionJSON.endpoint,
            keys: {
                p256dh: subscriptionJSON.keys.p256dh,
                auth: subscriptionJSON.keys.auth
            }
        };

        try {
            await apiClient.post('/push/subscribe', {
                subscription: subscriptionData
            });
        } catch (error) {
            const detail = (error as { message?: string })?.message || 'errore sconosciuto';
            throw new Error(`Sottoscrizione creata nel browser ma non salvata sul server: ${detail}`);
        }

        return subscriptionData;
    }

    /**
     * Subscribe to push notifications
     */
    async subscribe(): Promise<PushSubscriptionData> {
        // 1. Check support
        if (!this.isSupported()) {
            throw new Error('Notifiche push non supportate da questo browser');
        }

        // 2. Request permission
        const permission = await withTimeout(
            this.requestPermission(),
            PERMISSION_TIMEOUT_MS,
            'Nessuna risposta alla richiesta di permesso del browser'
        );
        if (permission === 'denied') {
            throw new Error('Permesso notifiche negato: abilitalo dalle impostazioni del sito');
        }
        if (permission !== 'granted') {
            throw new Error('Permesso notifiche non concesso: conferma la richiesta del browser');
        }

        // 3. Register service worker if not already registered
        if (!this.serviceWorkerRegistration) {
            await this.registerServiceWorker();
        }
        const registration = this.serviceWorkerRegistration!;

        // 4. Get VAPID key from server and create the browser subscription
        const applicationServerKey = await this.getApplicationServerKey();
        const subscription = await this.createBrowserSubscription(registration, applicationServerKey);

        // 5. Send subscription to server
        return await this.saveSubscription(subscription);
    }

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe(): Promise<void> {
        if (!this.serviceWorkerRegistration) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                this.serviceWorkerRegistration = registration;
            }
        }

        if (!this.serviceWorkerRegistration) {
            throw new Error('No service worker registration found');
        }

        const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();

        if (!subscription) {
            return;
        }

        // Unsubscribe locally
        await subscription.unsubscribe();

        // Notify server
        const subscriptionJSON = subscription.toJSON();
        await apiClient.post('/push/unsubscribe', {
            endpoint: subscriptionJSON.endpoint
        });
    }

    /**
     * Check if user is currently subscribed.
     * The browser subscription is only valid if the server holds it too: when the browser
     * has one that the server lost, it is sent again so the two sides stay aligned.
     */
    async isSubscribed(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        try {
            // Wait for service worker to be ready
            await withTimeout(
                navigator.serviceWorker.ready,
                STATUS_CHECK_TIMEOUT_MS,
                'Service worker non attivo'
            );

            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                return false;
            }

            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                return false;
            }

            return await this.ensureSavedOnServer(subscription);
        } catch (error) {
            console.error('Error checking subscription status:', error);
            return false;
        }
    }

    /**
     * Make sure the server holds the given browser subscription
     */
    private async ensureSavedOnServer(subscription: PushSubscription): Promise<boolean> {
        let savedOnServer: boolean;
        try {
            const response = await apiClient.post('/push/status', {
                endpoint: subscription.endpoint
            });
            savedOnServer = Boolean(response.data.subscribed);
        } catch (error) {
            // Verifica impossibile (rete, server non raggiungibile): ci si fida del browser
            console.error('Error verifying subscription on server:', error);
            return true;
        }

        if (savedOnServer) {
            return true;
        }

        try {
            await this.saveSubscription(subscription);
            return true;
        } catch (error) {
            console.error('Error re-syncing subscription with server:', error);
            return false;
        }
    }

    /**
     * Get current subscription
     */
    async getSubscription(): Promise<PushSubscription | null> {
        if (!this.isSupported()) {
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                return null;
            }

            return await registration.pushManager.getSubscription();
        } catch (error) {
            console.error('Error getting subscription:', error);
            return null;
        }
    }

    /**
     * Send test notification (for debugging)
     */
    async sendTestNotification(): Promise<void> {
        await apiClient.post('/push/test');
    }
}

// Export singleton instance
export const pushService = new PushService();
export default pushService;
