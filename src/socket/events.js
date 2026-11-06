// Event names sent from the server to browsers. Events carry only ids: a client
// that hears one refetches the data it is showing. The socket is a doorbell,
// not a data channel, so a client can never see data it could not fetch itself.
export const SocketEvent = Object.freeze({
  INCIDENT_CREATED: 'incident:created',
  INCIDENT_UPDATED: 'incident:updated', // status, assignee, edit, note or visibility changed
  SERVICE_CHANGED: 'service:changed', // created, renamed or deleted
  TEAM_CHANGED: 'team:changed', // someone joined, a role or a name changed, or the organization was renamed
});
