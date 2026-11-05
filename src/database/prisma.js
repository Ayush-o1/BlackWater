import { PrismaClient } from '@prisma/client';

// One client for the whole process: each PrismaClient owns a connection pool,
// so creating several would waste database connections.
export const prisma = new PrismaClient();
