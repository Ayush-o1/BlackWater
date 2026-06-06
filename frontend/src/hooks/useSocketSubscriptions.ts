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

    if (!socket) {
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

      Object.entries(eventMapping).forEach(([event, queryKeys]) => {
        socket?.on(event, () => {
          queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
        });
      });
    }

    return () => {
      // We don't necessarily disconnect on unmount of the hook to keep connection alive 
      // globally, but we clean up if auth state changes above.
    };
  }, [token, isAuthenticated, queryClient]);
}
