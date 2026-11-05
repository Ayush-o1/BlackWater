import { describe, it, expect } from 'vitest';
import { toPublicIncident, toPublicTimeline } from '../../src/utils/publicDto.js';
import { TimelineEventType } from '../../src/utils/timelineEvents.js';

const event = (eventType, metadata = null) => ({
  id: `e-${eventType}`,
  eventType,
  metadata,
  actorId: 'user-secret-id',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('toPublicTimeline', () => {
  it('shows creation and status changes, with statuses but no people', () => {
    const result = toPublicTimeline([
      event(TimelineEventType.INCIDENT_CREATED, { severity: 'HIGH', isPublic: true }),
      event(TimelineEventType.STATUS_CHANGED, { oldStatus: 'TRIGGERED', newStatus: 'ACKNOWLEDGED' }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ oldStatus: 'TRIGGERED', newStatus: 'ACKNOWLEDGED' });
    expect(JSON.stringify(result)).not.toContain('user-secret-id');
  });

  it('drops edits, assignments and visibility changes', () => {
    const result = toPublicTimeline([
      event(TimelineEventType.INCIDENT_EDITED, { changes: { title: { from: 'a', to: 'b' } } }),
      event(TimelineEventType.ASSIGNEE_CHANGED, { to: { id: 'u1', name: 'Priya' } }),
      event(TimelineEventType.VISIBILITY_CHANGED, { isPublic: true }),
    ]);

    expect(result).toEqual([]);
  });

  it('shows an update only when it was posted as public', () => {
    const result = toPublicTimeline([
      event(TimelineEventType.UPDATE_ADDED, { updateId: 'u1', isPublic: false }),
      event(TimelineEventType.UPDATE_ADDED, { updateId: 'u2', isPublic: true }),
      event(TimelineEventType.UPDATE_ADDED, { updateId: 'u3' }),
    ]);

    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('u2'); // update ids are not exposed either
  });

  it('ignores event types it does not know about (new internal events stay private)', () => {
    expect(toPublicTimeline([event('SOMETHING_NEW', { secret: true })])).toEqual([]);
  });
});

describe('toPublicIncident', () => {
  it('copies only the whitelisted fields', () => {
    const result = toPublicIncident({
      id: 'i1',
      title: 'API down',
      description: 'internal details',
      status: 'TRIGGERED',
      severity: 'HIGH',
      isPublic: true,
      orgId: 'o1',
      creatorId: 'c1',
      assigneeId: 'a1',
      acknowledgedAt: null,
      createdAt: new Date(),
      resolvedAt: null,
      affectedServices: [],
    });

    expect(Object.keys(result).sort()).toEqual(
      ['affectedServices', 'createdAt', 'id', 'resolvedAt', 'severity', 'status', 'title']
    );
  });
});
