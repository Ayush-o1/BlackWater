# Frontend Architecture

This document explains how the React frontend is structured, how state is managed, and how real-time updates work.

---

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| Vite | 8 | Build tool and dev server |
| TypeScript | ~6 | Type safety |
| Tailwind CSS | v4 | Utility-first styling |
| React Router DOM | v7 | Client-side routing |
| Zustand | v5 | Auth state (persisted to localStorage) |
| TanStack React Query | v5 | Server state, caching, background refetch |
| Axios | v1 | HTTP client |
| Socket.IO Client | v4 | Real-time event subscriptions |
| Lucide React | v1 | Icon library |
| React Hot Toast | v2 | Toast notifications |

---

## Folder Structure

```
frontend/src/
├── App.tsx                     # Route tree — public and protected routes
├── main.tsx                    # App entry point
├── index.css                   # Global CSS base
│
├── api/                        # HTTP call functions (one file per domain)
│   ├── axios.ts                # Axios instance with JWT interceptor + 401 auto-logout
│   ├── auth.api.ts
│   ├── incident.api.ts
│   ├── service.api.ts
│   ├── status.api.ts           # Public status page API calls
│   ├── user.api.ts
│   └── organization.api.ts
│
├── hooks/
│   ├── queries.ts              # All React Query hooks (useQuery + useMutation wrappers)
│   └── useSocketSubscriptions.ts  # Socket connection + event → cache invalidation map
│
├── store/
│   └── useAuthStore.ts         # Zustand store (user, token, isAuthenticated)
│
├── pages/                      # Page-level components (one per route)
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   ├── Incidents.tsx
│   ├── IncidentDetails.tsx
│   ├── Services.tsx
│   ├── ServiceDetails.tsx
│   ├── Settings.tsx
│   ├── AdminStatusPage.tsx     # Internal status page view (authenticated)
│   └── public/
│       ├── StatusOverview.tsx  # Public status page (no auth)
│       └── PublicIncidentDetails.tsx
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx       # Authenticated app shell (sidebar + main area)
│   │   ├── ProtectedRoute.tsx  # Redirects to /login if not authenticated
│   │   └── PublicStatusLayout.tsx  # Layout for public status pages
│   ├── incidents/              # Incident-specific reusable components
│   ├── services/               # Service-specific reusable components
│   ├── settings/               # Settings form components
│   └── ui/                     # Generic UI primitives (Card, Badge, Button, etc.)
│
└── types/                      # Shared TypeScript interfaces
```

---

## Routing

Routes are defined in `App.tsx` using React Router v7. Every page component is loaded via `React.lazy()` and rendered inside a single `<Suspense>` boundary, so each route ships its own JS chunk instead of bloating the initial bundle.

```
/login                          → LoginPage (public)
/register                       → RegisterPage (public)

/                               → Dashboard (protected)
/incidents                      → Incidents list (protected)
/incidents/:id                  → IncidentDetails (protected)
/services                       → Services list (protected)
/services/:id                   → ServiceDetails (protected)
/settings                       → Settings (protected)
/admin/status                   → AdminStatusPage (protected)

/status/:orgId                  → StatusOverview (public, no auth)
/status/:orgId/incidents/:id    → PublicIncidentDetails (public, no auth)

*                               → Redirect to /
```

The `<ProtectedRoute>` component checks `useAuthStore().isAuthenticated`. If false, it redirects to `/login`.

---

## State Management

BlackWater uses two separate state systems for different concerns.

### Zustand — Auth State

`frontend/src/store/useAuthStore.ts`

Manages: `user`, `token`, `isAuthenticated`

Persisted to localStorage using Zustand's `persist` middleware under the key `blackwater-auth-storage`. This means the user stays logged in after a page refresh.

```typescript
// Read state
const { user, token, isAuthenticated } = useAuthStore();

// Set auth after login/register
useAuthStore.getState().setAuth(user, token);

// Logout
useAuthStore.getState().logout();
```

The Axios interceptor reads `useAuthStore.getState().token` directly (not via a React hook) so it works outside of React components.

### TanStack React Query — Server State

`frontend/src/hooks/queries.ts`

All server data (incidents, services, users, etc.) is managed through React Query. This gives:
- Automatic caching with configurable stale time
- Background refetch on window focus (disabled in this app via `refetchOnWindowFocus: false`)
- Easy cache invalidation after mutations
- Loading and error states out of the box

**Query key naming convention:**
| Key | Data |
|-----|------|
| `['incidents', params]` | Incident list |
| `['incidentDetails', id]` | Single incident |
| `['services']` | Service list |
| `['serviceDetails', id]` | Single service |
| `['users']` | User list |
| `['currentUser']` | Current user |
| `['organization']` | Current org |
| `['statusOverview', orgId]` | Public status overview |
| `['publicIncidentDetails', orgId, id]` | Public incident detail |

---

## HTTP Client (Axios)

`frontend/src/api/axios.ts`

A single Axios instance (`apiClient`) is created with:
- `baseURL` from `VITE_API_URL` env variable, defaulting to `http://localhost:8000`
- Request interceptor: reads the JWT from Zustand and attaches it as `Authorization: Bearer <token>` to every request.
- Response interceptor: if any response returns `401`, it calls `logout()` and redirects to `/login`. This handles expired tokens globally without per-request handling.

---

## Real-Time Updates (Socket.IO)

`frontend/src/hooks/useSocketSubscriptions.ts`

This hook is mounted once in the app layout and manages the WebSocket connection lifecycle.

**Connection logic:**
- If user is authenticated (`isAuthenticated && token`), a socket is created and connected.
- The JWT is passed in the `auth` handshake so the server can authenticate the socket.
- If the user logs out, the socket is disconnected.

**Event → cache invalidation mapping:**

When a socket event arrives, the hook invalidates the affected React Query caches. React Query then automatically re-fetches the stale data.

```typescript
const eventMapping = {
  'incident:created':        ['incidents', 'statusOverview'],
  'incident:status_changed': ['incidents', 'incidentDetails', 'statusOverview', 'publicIncidentDetails'],
  'incident:update_added':   ['incidentDetails', 'publicIncidentDetails'],
  'incident:assigned':       ['incidents', 'incidentDetails'],
  'timeline:event_created':  ['incidentDetails', 'publicIncidentDetails'],
  'service:status_changed':  ['services', 'serviceDetails', 'statusOverview'],
  'service:created':         ['services'],
  'status:updated':          ['statusOverview', 'publicIncidentDetails'],
};
```

**Important:** The socket is created as a module-level singleton (`let socket: Socket | null`), not inside the hook. This prevents duplicate connections when the hook re-renders.

---

## Public Status Page

The public status page (`/status/:orgId`) is a completely separate UI from the internal dashboard. It:
- Uses the `<PublicStatusLayout>` wrapper (not `<AppLayout>`)
- Does not require authentication
- Calls the `/status` API endpoints (no auth required on the server either)
- Still subscribes to socket events through `useSocketSubscriptions` — if the user happens to be logged in, real-time updates work on the public page too

The `orgId` is extracted from the URL params (`useParams`), so each organization's status page has a unique, shareable URL: `/status/<orgId>`.

---

## Key Design Decisions

### Why Zustand for auth and React Query for server state?

These two concerns are fundamentally different:
- **Auth state** is a small, persistent, synchronous piece of client state. Zustand handles it simply with localStorage persistence out of the box.
- **Server state** (incidents, services) is async, stale, shared, and frequently needs re-fetching. React Query is specifically designed for this pattern.

Mixing both in a single store (e.g., Redux) would over-engineer auth and under-engineer server state.

### Why cursor pagination instead of offset pagination?

The incident list uses cursor-based pagination (`?cursor=<uuid>&limit=20`) instead of `?page=2&limit=20`.

Cursor pagination is more correct for real-time data: with offset pagination, if a new incident is created while you're on page 2, the items shift and you'd see duplicates or skip items. Cursors always point to a specific row regardless of insertions.

### Why two separate `isPublic` update types?

When an incident is ongoing, engineers need to post internal notes ("memory usage at 95%, pod restart likely") that teammates can see but customers cannot. The same incident also needs customer-facing updates ("We are investigating elevated error rates"). The `isPublic` flag on `IncidentUpdate` supports both on a single incident thread, with the public API filtering to `isPublic: true` only.
