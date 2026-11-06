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

  socket.on('connect', () => {
    setState('live');
    // Every connection, the first included, refreshes every subscriber once. A page
    // loads its data first and connects after, so a change made in that gap (or while
    // the connection was down) was announced to nobody listening. The cost is one
    // extra fetch per page view; the alternative is a page that silently shows
    // stale data until the next event.
    handlers.forEach((entry) => entry.run());
  });
  // Socket.IO reconnects by itself after a lost connection, but not when the server
  // closed it on purpose (it does that when the organization is deleted). Saying
  // "Reconnecting" then would be untrue: nothing is going to reconnect.
  socket.on('disconnect', (reason) => setState(reason === 'io server disconnect' ? 'offline' : 'connecting'));

  let retryDelayMs = 1000;
  socket.on('connect_error', (error) => {
    // A rejected token will not get better by retrying; the next API call
    // handles the sign-out.
    if (String(error?.message).includes('Unauthorized')) {
      socket.disconnect();
      setState('offline');
      return;
    }

    // Anything else is the server having a moment (the handshake could not reach its
    // database, say). Socket.IO reconnects by itself after a lost connection but NOT
    // after the server's handshake refuses one, so retry here, backing off, or the page
    // would stay on "Reconnecting" and show stale data until it is reloaded.
    if (!socket.active) {
      setState('connecting');
      setTimeout(() => socket.connect(), retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 15_000);
    }
  });
  socket.on('connect', () => {
    retryDelayMs = 1000;
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
