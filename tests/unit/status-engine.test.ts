import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceStatus } from '@prisma/client';

const prismaMock = {
  service: { findMany: vi.fn() },
};

vi.mock('../../src/prisma/client', () => ({ default: prismaMock }));

const { StatusEngine } = await import('../../src/modules/status/status.engine');

describe('StatusEngine.calculateOverallHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [[], ServiceStatus.OPERATIONAL],
    [[ServiceStatus.OPERATIONAL, ServiceStatus.OPERATIONAL], ServiceStatus.OPERATIONAL],
    [[ServiceStatus.OPERATIONAL, ServiceStatus.DEGRADED], ServiceStatus.DEGRADED],
    [[ServiceStatus.DEGRADED, ServiceStatus.PARTIAL_OUTAGE], ServiceStatus.PARTIAL_OUTAGE],
    [[ServiceStatus.PARTIAL_OUTAGE, ServiceStatus.MAJOR_OUTAGE], ServiceStatus.MAJOR_OUTAGE],
    // Worst service status rolls up regardless of ordering.
    [[ServiceStatus.MAJOR_OUTAGE, ServiceStatus.OPERATIONAL, ServiceStatus.DEGRADED], ServiceStatus.MAJOR_OUTAGE],
  ])('rolls up %j to %s', async (statuses, expected) => {
    prismaMock.service.findMany.mockResolvedValueOnce(statuses.map((status) => ({ status })));

    const result = await StatusEngine.calculateOverallHealth('org-1');

    expect(result).toBe(expected);
  });
});
