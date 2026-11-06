// Lets services broadcast events without importing the socket server itself.
// The server registers its Socket.IO instance here once at startup. Before that
// (for example in tests that never start a server) emitting does nothing.
let io = null;

export function registerSocketServer(socketServer) {
  io = socketServer;
}

// Events go to one organization's room only, so tenants never hear each other.
export function emitToOrg(orgId, event, payload = {}) {
  io?.to(`organization:${orgId}`).emit(event, payload);
}

// Used when an organization is deleted: its members must stop receiving anything.
// Closing the connection also makes any reconnect attempt fail authentication,
// because their accounts no longer exist.
export function disconnectOrg(orgId) {
  io?.in(`organization:${orgId}`).disconnectSockets(true);
}
