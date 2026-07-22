import app from './app';
import { env } from './config/env';
import prisma from './prisma/client';

import http from 'http';
import { initSocketServer, io } from './socket/socket.server';

const startServer = async () => {
  try {
    // Attempt to connect to the database to verify credentials
    await prisma.$connect();
    console.log('✅ Successfully connected to the database');

    const httpServer = http.createServer(app);

    // Initialize Socket.IO
    initSocketServer(httpServer);

    const server = httpServer.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    // Graceful shutdown strategy
    const shutdown = async () => {
      console.log('🛑 Shutdown signal received, shutting down gracefully...');
      io?.close();
      server.close(async () => {
        console.log('Closed out remaining server connections');
        await prisma.$disconnect();
        process.exit(0);
      });

      // Force close after 10 seconds if connections are hanging
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Catch anything outside Express's request/response cycle so the process
    // doesn't die silently or in an inconsistent state
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown();
    });

  } catch (error) {
    console.error('❌ Error starting the server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
