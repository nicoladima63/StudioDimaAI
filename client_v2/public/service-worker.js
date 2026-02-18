/**
 * Service Worker for Push Notifications
 * Handles push events and notification clicks
 */

// Install event - cache assets if needed
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

// Activate event - cleanup old caches if needed
self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Push event - receive and display notification
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    if (!event.data) {
        console.warn('Push event has no data');
        return;
    }

    try {
        const data = event.data.json();
        console.log('Push data:', data);

        const options = {
            body: data.body || 'Hai una nuova notifica',
            icon: data.icon || '/vite.svg',
            badge: data.badge || '/vite.svg',
            tag: data.tag || 'default-notification',
            data: {
                url: data.data?.url || '/',
                timestamp: Date.now()
            },
            requireInteraction: data.requireInteraction || false,
            vibrate: data.vibrate || [200, 100, 200],
            actions: data.actions || []
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Studio Dima AI', options)
        );
    } catch (error) {
        console.error('Error processing push notification:', error);
    }
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification.tag);

    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if none exists
                if (self.clients.openWindow) {
                    return self.clients.openWindow(url);
                }
            })
    );
});

// Message event - handle messages from main app
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
