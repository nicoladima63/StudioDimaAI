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

      // Show toast notification
      // Use standard styling and duration
      const toastOptions = {
        duration: 4000, // 4 seconds
        // Custom icon if needed, but standard ones are fine. 
        // If we want a bell for generic 'info' we can add it, but standard types are better.
      };

      if (data.type === 'error') {
        toast.error(data.message, toastOptions);
      } else if (data.type === 'success') {
        toast.success(data.message, toastOptions);
      } else if (data.type === 'warning') {
        toast(data.message, { ...toastOptions, icon: '⚠️' });
      } else {
        // Info/Default
         toast(data.message, { ...toastOptions, icon: 'ℹ️' });
      }

      // Show browser notification if permitted
      if (permission === 'granted') {
        showBrowserNotification(data);
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
