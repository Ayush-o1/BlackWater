import { describe, it, expect } from 'vitest';
import { IncidentStatus } from '@prisma/client';
import { IncidentService } from '../../src/modules/incidents/incident.service';
import { AppError } from '../../src/utils/errors/AppError';

// `validateTransition` is a private static method — it's pure state-machine
// logic with no I/O, so we reach past TypeScript's privacy check to unit
// test it directly rather than driving it through a live HTTP+DB round trip.
const validateTransition = (from: IncidentStatus, to: IncidentStatus) =>
  (IncidentService as any).validateTransition(from, to);

describe('IncidentService.validateTransition', () => {
  const allowed: [IncidentStatus, IncidentStatus][] = [
    [IncidentStatus.TRIGGERED, IncidentStatus.ACKNOWLEDGED],
    [IncidentStatus.TRIGGERED, IncidentStatus.RESOLVED],
    [IncidentStatus.ACKNOWLEDGED, IncidentStatus.RESOLVED],
    [IncidentStatus.ACKNOWLEDGED, IncidentStatus.TRIGGERED],
    [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
    [IncidentStatus.RESOLVED, IncidentStatus.TRIGGERED],
  ];

  const rejected: [IncidentStatus, IncidentStatus][] = [
    [IncidentStatus.TRIGGERED, IncidentStatus.CLOSED],
    [IncidentStatus.ACKNOWLEDGED, IncidentStatus.CLOSED],
    [IncidentStatus.CLOSED, IncidentStatus.TRIGGERED],
    [IncidentStatus.CLOSED, IncidentStatus.ACKNOWLEDGED],
    [IncidentStatus.CLOSED, IncidentStatus.RESOLVED],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(() => validateTransition(from, to)).not.toThrow();
  });

  it.each(rejected)('rejects %s -> %s', (from, to) => {
    expect(() => validateTransition(from, to)).toThrow(AppError);
  });

  it('rejects every transition once an incident is CLOSED, including CLOSED -> CLOSED', () => {
    for (const to of Object.values(IncidentStatus)) {
      expect(() => validateTransition(IncidentStatus.CLOSED, to)).toThrow(
        'Incident is closed and cannot be modified'
      );
    }
  });

  it('rejects invalid transitions with a 400 AppError carrying a descriptive message', () => {
    try {
      validateTransition(IncidentStatus.TRIGGERED, IncidentStatus.CLOSED);
      expect.unreachable('expected validateTransition to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(400);
      expect((error as AppError).message).toBe(
        'Invalid state transition from TRIGGERED to CLOSED'
      );
    }
  });
});
