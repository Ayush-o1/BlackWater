import { Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { AuthService } from '../modules/auth/auth.service';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const socketAuthMiddleware = async (socket: TypedSocket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Unauthorized: Missing token'));
    }

    const decoded = verifyToken(token);
    const user = await AuthService.getUserById(decoded.userId);

    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Unauthorized: Invalid or expired token'));
  }
};
