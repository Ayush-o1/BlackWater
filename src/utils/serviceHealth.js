import { Severity } from '@prisma/client';

// The single place that decides what a service's health is. Everything that
// shows health (the service list, incident pages, the dashboard, the public
// status page) calls these two functions; nothing else repeats the rules.
// They are pure on purpose (no database, no clock) so they are trivial to test.

export const ServiceStatus = Object.freeze({
  OPERATIONAL: 'OPERATIONAL',
  DEGRADED: 'DEGRADED',
  PARTIAL_OUTAGE: 'PARTIAL_OUTAGE',
  MAJOR_OUTAGE: 'MAJOR_OUTAGE',
});

// Worst to best. The position in this list is the ranking.
const STATUSES_WORST_FIRST = [
  ServiceStatus.MAJOR_OUTAGE,
  ServiceStatus.PARTIAL_OUTAGE,
  ServiceStatus.DEGRADED,
  ServiceStatus.OPERATIONAL,
];

const STATUS_FOR_SEVERITY = {
  [Severity.CRITICAL]: ServiceStatus.MAJOR_OUTAGE,
  [Severity.HIGH]: ServiceStatus.PARTIAL_OUTAGE,
  [Severity.MEDIUM]: ServiceStatus.DEGRADED,
  [Severity.LOW]: ServiceStatus.DEGRADED,
};

// The status of one service, given the severities of its open incidents.
// The worst open incident wins, and no open incidents means OPERATIONAL.
export function statusFromSeverities(severities) {
  return worstStatus(severities.map((severity) => STATUS_FOR_SEVERITY[severity]));
}

// The worst status in a list. Used both for "worst open incident" above and for
// an organization's overall status ("worst service"). An empty list is healthy.
export function worstStatus(statuses) {
  return STATUSES_WORST_FIRST.find((status) => statuses.includes(status)) ?? ServiceStatus.OPERATIONAL;
}
