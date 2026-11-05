// The kinds of change recorded in an incident's timeline. The timeline is the
// audit trail, so every state-changing incident operation writes exactly one of
// these, in the same transaction as the change itself.
export const TimelineEventType = Object.freeze({
  INCIDENT_CREATED: 'INCIDENT_CREATED',
  INCIDENT_EDITED: 'INCIDENT_EDITED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNEE_CHANGED: 'ASSIGNEE_CHANGED',
  UPDATE_ADDED: 'UPDATE_ADDED',
  VISIBILITY_CHANGED: 'VISIBILITY_CHANGED',
});
