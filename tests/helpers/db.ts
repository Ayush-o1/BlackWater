import prisma from '../../src/prisma/client';

export { prisma };

/**
 * Wipes every row via the Organization cascade. Every table has an
 * (in)direct `onDelete: Cascade` path back to Organization *except*
 * `IncidentUpdate.userId`, which is `onDelete: Restrict` — so that table
 * has to be cleared explicitly before the cascade can reach User rows.
 */
export async function cleanDatabase() {
  await prisma.incidentUpdate.deleteMany({});
  await prisma.organization.deleteMany({});
}
