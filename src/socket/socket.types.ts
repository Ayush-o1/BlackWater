import { UserWithoutPassword } from '../modules/auth/auth.types';

export interface ServerToClientEvents {
  'incident:created': (payload: { id: string; title: string; severity: string }) => void;
  'incident:assigned': (payload: { id: string; assigneeId: string }) => void;
  'incident:status_changed': (payload: { id: string; status: string }) => void;
  'incident:update_added': (payload: { id: string; updateId: string; isPublic: boolean }) => void;
  'timeline:event_created': (payload: { incidentId: string; eventType: string }) => void;
  'service:created': (payload: { id: string; name: string }) => void;
  'service:updated': (payload: { id: string }) => void;
  'service:status_changed': (payload: { id: string; status: string }) => void;
  'service:deleted': (payload: { id: string }) => void;
  'status:updated': (payload: { orgId: string }) => void;
}

export interface ClientToServerEvents {
  'join:incident': (incidentId: string, callback: (success: boolean) => void) => void;
  'leave:incident': (incidentId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: UserWithoutPassword;
}
