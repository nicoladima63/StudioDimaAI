/**
 * useWebSocket Hook
 * 
 * Manages WebSocket connection to the backend server for real-time communication.
 * Automatically connects on mount, handles reconnection, and joins user's room.
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    // Don't connect if no user
    if (!user?.id) {
      return;
    }

    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to WebSocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id);
      setIsConnected(true);

      // Join user's personal room
      socket.emit('join', { user_id: user.id });
    });

    socket.on('joined', (data) => {
      console.log('[WebSocket] Joined room:', data.room);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.emit('leave', { user_id: user.id });
        socket.disconnect();
      }
    };
  }, [user?.id]);

  return {
    socket: socketRef.current,
    isConnected,
  };
};
