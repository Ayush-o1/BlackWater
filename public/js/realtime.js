import { getToken } from './auth.js';

// One Socket.IO connection per page. The server only ever says "something
// changed" (an event with an id); the page reacts by fetching fresh data through
// the normal API, so what a user sees is always what the API would return to them.

const handlers = new Set();
let socket = null;
let state = 'offline'; // 'live' | 'connecting' | 'offline'
const stateListeners = new Set();

function setState(next) {
  state = next;
  stateListeners.forEach((listener) => listener(state));
}

export function onConnectionChange(listener) {
  stateListeners.add(listener);
  listener(state);
}

function connect() {
  // /socket.io/socket.io.js (loaded by the page) defines the global `io`.
  if (socket || typeof window.io !== 'function') return;

  setState('connecting');
  socket = window.io({ auth: { token: getToken() }, transports: ['websocket'] });
  let hasConnectedBefore = false;

  socket.on('connect', () => {
    setState('live');
    // Changes made while the connection was down were never announced, so
    // after a reconnect every subscriber refetches once.
    if (hasConnectedBefore) handlers.forEach((entry) => entry.run());
    hasConnectedBefore = true;
  });
  socket.on('disconnect', () => setState('connecting'));
  socket.on('connect_error', (error) => {
    // A rejected token will not get better by retrying; the next API call
    // handles the sign-out.
    if (String(error?.message).includes('Unauthorized')) {
      socket.disconnect();
      setState('offline');
    }
  });
}

// Calls `reload` when any of the named events arrives. Bursts of events (one
// action can emit several) collapse into a single reload.
export function subscribe(events, reload, delayMs = 250) {
  connect();

  let timer = null;
  const entry = {
    run() {
      clearTimeout(timer);
      timer = setTimeout(reload, delayMs);
    },
  };
  handlers.add(entry);

  const registered = events.map((event) => {
    socket?.on(event, entry.run);
    return event;
  });

  return () => {
    handlers.delete(entry);
    registered.forEach((event) => socket?.off(event, entry.run));
  };
}
