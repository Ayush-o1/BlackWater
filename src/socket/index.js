import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { authenticateSocket } from './auth.js';
import { registerSocketServer } from './emitter.js';

// Each authenticated socket joins exactly one room: its own organization's.
// Services emit to that room, so a user can only ever hear about their own
// organization. There is deliberately nothing a client can send to join a
// different room.
export function initSocketServer(httpServer) {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  registerSocketServer(io);
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    // Built from the authenticated user's orgId, never from client input.
    socket.join(`organization:${socket.data.user.orgId}`);
  });

  return io;
}
