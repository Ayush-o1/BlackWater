import { PrismaClient } from '@prisma/client';

// Add prisma to the Node.js global type
interface CustomNodeJsGlobal {
  prisma: PrismaClient;
}

declare const global: CustomNodeJsGlobal;

// Prevent multiple instances of Prisma Client in development due to hot reloading
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;
