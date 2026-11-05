import { Server } from 'socket.io';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';
import { authenticateSocket } from './auth.js';
import { registerSocketServer } from './emitter.js';

// Rooms keep tenants apart: every socket joins only its own organization's
// room, and events are emitted to a room, never broadcast to everyone.
export function initSocketServer(httpServer) {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  registerSocketServer(io);
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { user } = socket.data;

    // The room name is built from the authenticated user's orgId, never from
    // anything the client sends.
    socket.join(`organization:${user.orgId}`);

    // A client may also listen to one incident, but only after the server
    // confirms that incident belongs to the client's own organization.
    socket.on('join:incident', async (incidentId, callback) => {
      try {
        const incident = await prisma.incident.findFirst({
          where: { id: incidentId, orgId: user.orgId },
          select: { id: true },
        });

        if (incident) socket.join(`incident:${incidentId}`);
        callback?.(Boolean(incident));
      } catch {
        callback?.(false);
      }
    });

    socket.on('leave:incident', (incidentId) => {
      socket.leave(`incident:${incidentId}`);
    });
  });

  return io;
}
