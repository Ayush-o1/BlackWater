import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { initSocketServer } from './socket/index.js';

async function startServer() {
  try {
    // Fail fast if the database is unreachable instead of on the first request.
    await prisma.$connect();
    console.log('Connected to the database');

    const httpServer = http.createServer(app);
    const io = initSocketServer(httpServer);

    httpServer.listen(env.PORT, () => {
      console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    // On shutdown, stop accepting connections, let in-flight requests finish,
    // then release the database pool. The timer is a safety net for hung connections.
    const shutdown = () => {
      console.log('Shutdown signal received, shutting down gracefully...');
      io.close();
      httpServer.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
      setTimeout(() => {
        console.error('Could not close connections in time, forcing shutdown');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled promise rejection:', reason);
    });

    // After an uncaught exception the process state is unreliable, so exit
    // cleanly rather than keep serving requests.
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      shutdown();
    });
  } catch (error) {
    console.error('Error starting the server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
