import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types';
import { SocketEmitter } from './socket.emitter';
import prisma from '../prisma/client';
import { env } from '../config/env';

export let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const initSocketServer = (httpServer: HttpServer) => {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach global IO to the emitter singleton
  SocketEmitter.init(io);

  // Authentication Middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return socket.disconnect(true);

    console.log(`🔌 Socket connected: ${socket.id} (User: ${user.id})`);

    // 1. Automatically join the Organization room
    const orgRoom = `organization:${user.orgId}`;
    socket.join(orgRoom);

    // 2. Client explicitly joins an Incident room
    socket.on('join:incident', async (incidentId, callback) => {
      try {
        // Verify incident belongs to the user's organization
        const incident = await prisma.incident.findFirst({
          where: { id: incidentId, orgId: user.orgId },
          select: { id: true },
        });

        if (incident) {
          socket.join(`incident:${incidentId}`);
          callback(true);
        } else {
          callback(false);
        }
      } catch (err) {
        callback(false);
      }
    });

    socket.on('leave:incident', (incidentId) => {
      socket.leave(`incident:${incidentId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });

    socket.on('error', (err) => {
      console.error(`🔌 Socket error on ${socket.id}:`, err);
    });
  });
};
