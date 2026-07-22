import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;

export const getSocket = () => socket;

export function useSocketSubscriptions() {
  const { token, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    // Always (re)create the socket when the token changes so a rotated/refreshed
    // token is actually used for the connection's auth handshake, instead of
    // silently keeping a stale token on an already-open socket.
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['websocket'],
    });

    // Map of events to query invalidations
    const eventMapping: Record<string, string[]> = {
      'incident:created': ['incidents', 'statusOverview'],
      'incident:status_changed': ['incidents', 'incidentDetails', 'statusOverview', 'publicIncidentDetails'],
      'incident:update_added': ['incidentDetails', 'publicIncidentDetails'],
      'incident:assigned': ['incidents', 'incidentDetails'],
      'timeline:event_created': ['incidentDetails', 'publicIncidentDetails'],
      'service:status_changed': ['services', 'serviceDetails', 'statusOverview'],
      'service:created': ['services'],
      'status:updated': ['statusOverview', 'publicIncidentDetails'],
    };

    const activeSocket = socket;
    Object.entries(eventMapping).forEach(([event, queryKeys]) => {
      activeSocket.on(event, () => {
        queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      });
    });

    return () => {
      // Remove this effect run's listeners so reconnects/token changes don't
      // stack duplicate handlers on the socket.
      Object.keys(eventMapping).forEach((event) => activeSocket.off(event));
    };
  }, [token, isAuthenticated, queryClient]);
}
