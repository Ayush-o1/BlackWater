// Lets services broadcast events without importing the socket server itself.
// The server registers its Socket.IO instance here once at startup. Before that
// (for example in unit tests that never start a server) emitting does nothing.
let io = null;

export function registerSocketServer(socketServer) {
  io = socketServer;
}

export function emitToOrg(orgId, event, payload) {
  io?.to(`organization:${orgId}`).emit(event, payload);
}

export function emitToIncident(incidentId, event, payload) {
  io?.to(`incident:${incidentId}`).emit(event, payload);
}
