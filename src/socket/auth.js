import { verifyToken } from '../utils/jwt.js';
import * as authService from '../services/auth.service.js';

// Socket.IO middleware: runs once per connection attempt, before the socket is
// allowed to join any room. The browser sends its JWT in the handshake.
export async function authenticateSocket(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Unauthorized: Missing token'));
    }

    const payload = verifyToken(token);
    // Same rule as the HTTP middleware: trust the database, not the token's claims.
    socket.data.user = await authService.getUserById(payload.userId);
    next();
  } catch {
    next(new Error('Unauthorized: Invalid or expired token'));
  }
}
