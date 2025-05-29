import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Episode } from '@shared/schema';

export interface ProcessingUpdate extends Partial<Episode> {
  episodeId: number;
  timestamp?: string;
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  useEffect(() => {
    // Get server URL from environment or default to localhost
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
    
    console.log('Connecting to WebSocket server:', serverUrl);
    
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });
    
    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
    });
    
    socketRef.current.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });
    
    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });
    
    socketRef.current.on('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionError(error.message);
    });
    
    return () => {
      console.log('Cleaning up WebSocket connection');
      socketRef.current?.disconnect();
    };
  }, []);
  
  const subscribeToEpisode = useCallback((episodeId: number, callback: (update: ProcessingUpdate) => void) => {
    if (!socketRef.current || !isConnected) {
      console.warn('WebSocket not connected, cannot subscribe to episode', episodeId);
      return;
    }
    
    console.log('Subscribing to episode updates:', episodeId);
    socketRef.current.emit('subscribe-episode', episodeId);
    socketRef.current.on('processing-update', callback);
    
    return () => {
      console.log('Unsubscribing from episode updates:', episodeId);
      socketRef.current?.emit('unsubscribe-episode', episodeId);
      socketRef.current?.off('processing-update', callback);
    };
  }, [isConnected]);
  
  const subscribeToSystem = useCallback((callback: (event: string, data: any) => void) => {
    if (!socketRef.current || !isConnected) {
      console.warn('WebSocket not connected, cannot subscribe to system updates');
      return;
    }
    
    console.log('Subscribing to system updates');
    socketRef.current.emit('subscribe-system');
    
    // Listen to various system events
    const events = ['queue-updated', 'stats-updated'];
    events.forEach(event => {
      socketRef.current?.on(event, (data) => callback(event, data));
    });
    
    return () => {
      console.log('Unsubscribing from system updates');
      socketRef.current?.emit('unsubscribe-system');
      events.forEach(event => {
        socketRef.current?.off(event);
      });
    };
  }, [isConnected]);
  
  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    subscribeToEpisode,
    subscribeToSystem
  };
} 