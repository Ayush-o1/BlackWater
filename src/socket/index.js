import { Server } from 'socket.io';
import { authenticateSocket } from './auth.js';
import { registerSocketServer } from './emitter.js';

// Each authenticated socket joins exactly one room: its own organization's.
// Services emit to that room, so a user can only ever hear about their own
// organization. There is deliberately nothing a client can send to join a
// different room.
export function initSocketServer(httpServer) {
  // No CORS settings: the page and the socket are served from the same origin.
  // The connection is authenticated by the token in the handshake, not by
  // cookies, so another website cannot make a visitor's browser connect as them.
  const io = new Server(httpServer);

  registerSocketServer(io);
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    // Built from the authenticated user's orgId, never from client input.
    socket.join(`organization:${socket.data.user.orgId}`);
  });

  return io;
}
