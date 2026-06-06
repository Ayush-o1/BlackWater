import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * A globally accessible singleton to emit Socket.IO events.
 * This decouples the Business Services from the direct socket connections.
 */
export class SocketEmitter {
  private static io: TypedServer | null = null;

  static init(ioInstance: TypedServer) {
    this.io = ioInstance;
  }

  /**
   * Emits an event to a specific organization room.
   */
  static toOrg<Ev extends keyof ServerToClientEvents>(
    orgId: string,
    event: Ev,
    ...args: Parameters<ServerToClientEvents[Ev]>
  ) {
    if (!this.io) return;
    this.io.to(`organization:${orgId}`).emit(event, ...args);
  }

  /**
   * Emits an event to a specific incident room.
   */
  static toIncident<Ev extends keyof ServerToClientEvents>(
    incidentId: string,
    event: Ev,
    ...args: Parameters<ServerToClientEvents[Ev]>
  ) {
    if (!this.io) return;
    this.io.to(`incident:${incidentId}`).emit(event, ...args);
  }
}
