import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import * as authService from '../services/auth.service.js';

// Why the token was refused, as opposed to why the lookup failed. Only the first is
// the user's problem.
const isRejectedCredential = (error) =>
  ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error?.name) ||
  (error instanceof AppError && error.statusCode === 404);

// Socket.IO middleware: runs once per connection attempt, before the socket is
// allowed to join any room. The browser sends its JWT in the handshake.
export async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    return next(new Error('Unauthorized: Missing token'));
  }

  try {
    const payload = verifyToken(token);
    // Same rule as the HTTP middleware: trust the database, not the token's claims.
    socket.data.user = await authService.getUserById(payload.userId);
    next();
  } catch (error) {
    if (isRejectedCredential(error)) {
      return next(new Error('Unauthorized: Invalid or expired token'));
    }

    // Anything else (a dropped database connection, say) is the server's problem and
    // usually brief. It must NOT be reported as "Unauthorized": the browser takes that
    // word to mean "this token will never work" and stops reconnecting for good, which
    // would leave one unlucky page silently without live updates until it is reloaded.
    console.error('Socket authentication failed unexpectedly:', error);
    next(new Error('Temporarily unavailable, retrying'));
  }
}
