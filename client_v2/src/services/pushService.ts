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

            console.log('Service Worker registered:', registration);
            this.serviceWorkerRegistration = registration;

            // Wait for service worker to be ready
            await navigator.serviceWorker.ready;

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
     * Subscribe to push notifications
     */
    async subscribe(): Promise<PushSubscriptionData> {
        // 1. Check support
        if (!this.isSupported()) {
            throw new Error('Push notifications not supported');
        }

        // 2. Request permission
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Notification permission denied');
        }

        // 3. Register service worker if not already registered
        if (!this.serviceWorkerRegistration) {
            await this.registerServiceWorker();
        }

        // 4. Get VAPID public key from server (in standard base64 format)
        const vapidPublicKeyBase64 = await this.getVapidPublicKey();
        // Decode from standard base64 directly using browser API
        const binaryString = window.atob(vapidPublicKeyBase64);
        const applicationServerKey = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            applicationServerKey[i] = binaryString.charCodeAt(i);
        }

        // Handle VAPID key format (DER vs raw EC point)
        let subscription: PushSubscription;

        if (applicationServerKey.length === 91 && applicationServerKey[0] === 0x30) {
            // DER-encoded key: extract the 65-byte EC point (starts at byte 26)
            const ecPoint = applicationServerKey.slice(26, 91);
            console.log('Using DER-encoded VAPID key, extracting EC point');

            subscription = await this.serviceWorkerRegistration!.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: ecPoint
            });
        } else if (applicationServerKey.length === 65 && applicationServerKey[0] === 0x04) {
            // Already raw EC point format
            console.log('Using raw EC point VAPID key');

            subscription = await this.serviceWorkerRegistration!.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
        } else {
            throw new Error(`Invalid VAPID key format: ${applicationServerKey.length} bytes starting with 0x${applicationServerKey[0].toString(16)}`);
        }

        // 6. Convert subscription to our format
        const subscriptionJSON = subscription.toJSON();
        const subscriptionData: PushSubscriptionData = {
            endpoint: subscriptionJSON.endpoint!,
            keys: {
                p256dh: subscriptionJSON.keys!.p256dh!,
                auth: subscriptionJSON.keys!.auth!
            }
        };

        // 7. Send subscription to server
        await apiClient.post('/push/subscribe', {
            subscription: subscriptionData
        });

        console.log('Successfully subscribed to push notifications');
        return subscriptionData;
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
            console.log('No active push subscription found');
            return;
        }

        // Unsubscribe locally
        await subscription.unsubscribe();

        // Notify server
        const subscriptionJSON = subscription.toJSON();
        await apiClient.post('/push/unsubscribe', {
            endpoint: subscriptionJSON.endpoint
        });

        console.log('Successfully unsubscribed from push notifications');
    }

    /**
     * Check if user is currently subscribed
     */
    async isSubscribed(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        try {
            // Wait for service worker to be ready
            await navigator.serviceWorker.ready;

            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                return false;
            }

            const subscription = await registration.pushManager.getSubscription();
            return subscription !== null;
        } catch (error) {
            console.error('Error checking subscription status:', error);
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
        console.log('Test notification sent');
    }
}

// Export singleton instance
export const pushService = new PushService();
export default pushService;
