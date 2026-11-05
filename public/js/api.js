import { clearSession, getToken } from './auth.js';

// A failed request. `status` is the HTTP status, or 0 when the server could not
// be reached at all.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(path, query) {
  const url = new URL(`/api${path}`, location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    // Empty filters ("" or undefined) are simply left out of the URL.
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  return url;
}

async function request(method, path, { body, query } = {}) {
  const token = getToken();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* an empty or non-JSON body leaves payload as null */
  }

  if (!response.ok) {
    // The token was rejected (expired, or the account is gone): drop it and go
    // to the login page. A 401 from the login form itself has no token, so it
    // is shown as a normal "wrong password" message instead.
    if (response.status === 401 && token) {
      clearSession();
      location.replace('/login?expired=1');
    }
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status);
  }

  return { data: payload?.data ?? null, pagination: payload?.pagination ?? null, message: payload?.message };
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
  delete: (path) => request('DELETE', path),
};

// Reads every page of a cursor-paginated list. For places that need the whole
// list (a dropdown of all services) rather than a "Load more" button.
export async function getAll(path, query = {}) {
  const items = [];
  let cursor;

  do {
    const { data, pagination } = await api.get(path, { ...query, limit: 100, cursor });
    items.push(...data);
    cursor = pagination?.hasMore ? pagination.nextCursor : null;
  } while (cursor);

  return items;
}
