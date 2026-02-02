/**
 * useRealtimeNotifications Hook
 * 
 * Manages real-time notifications via WebSocket and Browser Notifications API.
 * Listens for new notifications from the server and displays them to the user.
 */

import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { useNotificationStore } from '@/store/notifications.store';
import toast from 'react-hot-toast';

interface NotificationPayload {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  created_at: string;
  is_read: boolean;
}

export const useRealtimeNotifications = () => {
  const { socket, isConnected } = useWebSocket();
  const { incrementUnread } = useNotificationStore();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        // Auto-request permission on first load
        Notification.requestPermission().then((perm) => {
          setPermission(perm);
        });
      }
    }
  }, []);

  // Listen for new notifications via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    const handleNewNotification = (data: NotificationPayload) => {
      console.log('[Realtime] New notification:', data);

      // Increment unread count in store
      incrementUnread();

      // Show toast notification (persistent until clicked)
      const toastType = data.type === 'error' ? 'error' : data.type === 'success' ? 'success' : 'default';
      
      // Extract task ID from message for navigation
      const taskMatch = data.message.match(/Task #(\d+)/);
      const taskId = taskMatch ? taskMatch[1] : null;
      
      const toastOptions = {
        duration: Infinity, // Persistent
        icon: '🔔',
        onClick: () => {
          // Navigate to task page on click
          if (data.link) {
            window.location.href = data.link;
          } else if (taskId) {
            window.location.href = `/works/${taskId}`;
          } else {
            window.location.href = '/tasks';
          }
        },
      };
      
      if (toastType === 'error') {
        toast.error(data.message, toastOptions);
      } else if (toastType === 'success') {
        toast.success(data.message, toastOptions);
      } else {
        toast(data.message, toastOptions);
      }

      // Show browser notification (always, for better visibility)
      console.log('[Realtime] Permission status:', permission);
      console.log('[Realtime] Document hidden:', document.hidden);
      
      if (permission === 'granted') {
        showBrowserNotification(data);
      } else if (permission === 'default') {
        console.log('[Realtime] Requesting notification permission...');
        Notification.requestPermission().then((perm) => {
          setPermission(perm);
          if (perm === 'granted') {
            showBrowserNotification(data);
          }
        });
      } else {
        console.log('[Realtime] Notification permission denied');
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, isConnected, permission, incrementUnread]);

  const showBrowserNotification = (data: NotificationPayload) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('StudioDima - Nuova Notifica', {
        body: data.message,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `notification-${data.id}`,
        requireInteraction: true, // Persistent - stays until user clicks
      });

      // Handle click on notification - navigate to task page
      notification.onclick = () => {
        window.focus();
        
        // Navigate to the task page (extract task ID from link or message)
        if (data.link) {
          // If link is provided, use it
          window.location.href = data.link;
        } else {
          // Try to extract task ID from message and navigate to tasks page
          const taskMatch = data.message.match(/Task #(\d+)/);
          if (taskMatch) {
            const taskId = taskMatch[1];
            window.location.href = `/works/${taskId}`;
          } else {
            // Fallback to tasks list
            window.location.href = '/tasks';
          }
        }
        
        notification.close();
      };
    }
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      return perm === 'granted';
    }
    return false;
  };

  return {
    isConnected,
    permission,
    requestPermission,
  };
};
