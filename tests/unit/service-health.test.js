import { describe, it, expect } from 'vitest';
import { Severity } from '@prisma/client';
import { ServiceStatus, statusFromSeverities, worstStatus } from '../../src/utils/serviceHealth.js';

describe('statusFromSeverities', () => {
  it.each([
    [[], ServiceStatus.OPERATIONAL],
    [[Severity.LOW], ServiceStatus.DEGRADED],
    [[Severity.MEDIUM], ServiceStatus.DEGRADED],
    [[Severity.HIGH], ServiceStatus.PARTIAL_OUTAGE],
    [[Severity.CRITICAL], ServiceStatus.MAJOR_OUTAGE],
    // The worst open incident decides, whatever the order.
    [[Severity.LOW, Severity.CRITICAL], ServiceStatus.MAJOR_OUTAGE],
    [[Severity.CRITICAL, Severity.LOW], ServiceStatus.MAJOR_OUTAGE],
    [[Severity.MEDIUM, Severity.HIGH], ServiceStatus.PARTIAL_OUTAGE],
    [[Severity.LOW, Severity.LOW, Severity.MEDIUM], ServiceStatus.DEGRADED],
  ])('maps open severities %j to %s', (severities, expected) => {
    expect(statusFromSeverities(severities)).toBe(expected);
  });
});

describe('worstStatus', () => {
  it.each([
    [[], ServiceStatus.OPERATIONAL],
    [[ServiceStatus.OPERATIONAL, ServiceStatus.OPERATIONAL], ServiceStatus.OPERATIONAL],
    [[ServiceStatus.OPERATIONAL, ServiceStatus.DEGRADED], ServiceStatus.DEGRADED],
    [[ServiceStatus.DEGRADED, ServiceStatus.PARTIAL_OUTAGE], ServiceStatus.PARTIAL_OUTAGE],
    [[ServiceStatus.PARTIAL_OUTAGE, ServiceStatus.MAJOR_OUTAGE], ServiceStatus.MAJOR_OUTAGE],
    [[ServiceStatus.MAJOR_OUTAGE, ServiceStatus.OPERATIONAL, ServiceStatus.DEGRADED], ServiceStatus.MAJOR_OUTAGE],
  ])('rolls %j up to %s', (statuses, expected) => {
    expect(worstStatus(statuses)).toBe(expected);
  });
});
