// The signed-in session lives in the browser: a JWT plus the user's profile.
// "Remember me" decides where: localStorage survives closing the browser,
// sessionStorage ends with the tab. The server re-checks the token on every
// request, so this is only a convenience copy and never the source of truth for
// what a user may do.

const KEY = 'blackwater.session';

// Storage can throw (private windows, blocked cookies), so every access is guarded.
function readFrom(storage) {
  try {
    const raw = storage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSession() {
  return readFrom(localStorage) ?? readFrom(sessionStorage);
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function saveSession({ token, user }, remember = true) {
  clearSession();
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ token, user }));
  } catch {
    // Nowhere to keep the session; the user will have to sign in again on reload.
  }
}

// Keeps the stored profile (role, name) current without touching the token.
export function updateSessionUser(user) {
  const session = getSession();
  if (!session) return;
  const storage = readFrom(localStorage) ? localStorage : sessionStorage;
  try {
    storage.setItem(KEY, JSON.stringify({ token: session.token, user }));
  } catch {
    /* see saveSession */
  }
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Only same-site paths are accepted as a post-login destination. Anything else
// (https://evil.example, //evil.example) could turn the login page into an open redirect.
export function safeNextPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

// Call at the top of every signed-in page. Returns the session, or sends the
// visitor to the login page (remembering where they were going) and returns null.
export function requireSession() {
  const session = getSession();
  if (session?.token) return session;

  const next = encodeURIComponent(location.pathname + location.search);
  location.replace(`/login?next=${next}`);
  return null;
}

export function signOut() {
  clearSession();
  location.replace('/login');
}

// Who may do what. These only decide which buttons to show; the server enforces
// the same rules on every request.
export const canWrite = (user) => user?.role === 'ADMIN' || user?.role === 'MEMBER';
export const isAdmin = (user) => user?.role === 'ADMIN';
