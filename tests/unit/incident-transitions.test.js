import { describe, it, expect } from 'vitest';
import { IncidentStatus } from '@prisma/client';
import { validateTransition } from '../../src/services/incident.service.js';
import { AppError } from '../../src/utils/AppError.js';

describe('validateTransition', () => {
  const allowed = [
    [IncidentStatus.TRIGGERED, IncidentStatus.ACKNOWLEDGED],
    [IncidentStatus.TRIGGERED, IncidentStatus.RESOLVED],
    [IncidentStatus.ACKNOWLEDGED, IncidentStatus.RESOLVED],
    [IncidentStatus.ACKNOWLEDGED, IncidentStatus.TRIGGERED],
    [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
    [IncidentStatus.RESOLVED, IncidentStatus.TRIGGERED],
  ];

  const rejected = [
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
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe(
        'Invalid state transition from TRIGGERED to CLOSED'
      );
    }
  });
});
