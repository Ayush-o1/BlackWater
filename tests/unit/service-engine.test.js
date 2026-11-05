import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceStatus, Severity } from '@prisma/client';

const prismaMock = {
  service: { findFirst: vi.fn(), update: vi.fn() },
  incident: { findMany: vi.fn() },
};

vi.mock('../../src/database/prisma.js', () => ({ prisma: prismaMock }));

const { recalculateServiceStatus } = await import('../../src/services/health.service.js');

describe('recalculateServiceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const activeSeverities = (...severities) =>
    prismaMock.incident.findMany.mockResolvedValueOnce(
      severities.map((severity) => ({ severity }))
    );

  it.each([
    [[], ServiceStatus.OPERATIONAL],
    [[Severity.LOW], ServiceStatus.DEGRADED],
    [[Severity.MEDIUM], ServiceStatus.DEGRADED],
    [[Severity.HIGH], ServiceStatus.PARTIAL_OUTAGE],
    [[Severity.CRITICAL], ServiceStatus.MAJOR_OUTAGE],
    // Worst active severity wins when several incidents affect the same service.
    [[Severity.LOW, Severity.CRITICAL], ServiceStatus.MAJOR_OUTAGE],
    [[Severity.MEDIUM, Severity.HIGH], ServiceStatus.PARTIAL_OUTAGE],
  ])('maps active severities %j to %s', async (severities, expected) => {
    prismaMock.service.findFirst.mockResolvedValueOnce({ id: 'svc-1', status: ServiceStatus.OPERATIONAL });
    activeSeverities(...severities);

    await recalculateServiceStatus('org-1', 'svc-1');

    if (expected === ServiceStatus.OPERATIONAL) {
      expect(prismaMock.service.update).not.toHaveBeenCalled();
    } else {
      expect(prismaMock.service.update).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { status: expected },
      });
    }
  });

  it('does nothing when the service does not belong to the organization', async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce(null);

    await recalculateServiceStatus('org-1', 'svc-missing');

    expect(prismaMock.incident.findMany).not.toHaveBeenCalled();
    expect(prismaMock.service.update).not.toHaveBeenCalled();
  });

  it('skips the write when the computed status matches the current status', async () => {
    prismaMock.service.findFirst.mockResolvedValueOnce({ id: 'svc-1', status: ServiceStatus.DEGRADED });
    activeSeverities(Severity.LOW);

    await recalculateServiceStatus('org-1', 'svc-1');

    expect(prismaMock.service.update).not.toHaveBeenCalled();
  });
});
