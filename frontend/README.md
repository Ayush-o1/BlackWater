# BlackWater — Frontend

The React SPA for the BlackWater incident management platform.

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
| Axios | v1 | HTTP client with JWT interceptors |
| Socket.IO Client | v4 | Real-time event subscriptions |
| Lucide React | v1 | Icon library |
| React Hot Toast | v2 | Toast notifications |

## Running Locally

```bash
# Install dependencies
npm install

# Start the Vite development server (port 5173)
npm run dev

# Build for production
npm run build
```

> The frontend expects the backend API at `http://localhost:8000` by default. Set `VITE_API_URL` in a `.env` file in this directory to override.

## State Management

Two separate systems are used for different concerns:

- **Zustand** — auth state (`user`, `token`, `isAuthenticated`), persisted to localStorage so the user stays logged in after a page refresh.
- **TanStack React Query** — all server data (incidents, services, users). Provides caching, background refetch, and cache invalidation triggered by Socket.IO events.

## Real-Time Updates

`src/hooks/useSocketSubscriptions.ts` manages a single persistent Socket.IO connection. When the backend emits a state-change event (e.g., `incident:status_changed`), the hook invalidates the relevant React Query cache keys, causing React Query to silently re-fetch the updated data.

## Folder Structure

```
src/
├── App.tsx                     # Route definitions (public + protected)
├── api/                        # Axios API call functions (one file per domain)
│   ├── axios.ts                # Axios instance + JWT request interceptor + 401 auto-logout
│   ├── auth.api.ts
│   ├── incident.api.ts
│   ├── service.api.ts
│   ├── status.api.ts
│   ├── user.api.ts
│   └── organization.api.ts
├── hooks/
│   ├── queries.ts              # All React Query hooks (useQuery + useMutation wrappers)
│   └── useSocketSubscriptions.ts
├── store/
│   └── useAuthStore.ts         # Zustand auth store
├── pages/                      # Page-level components (one per route)
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   ├── Incidents.tsx
│   ├── IncidentDetails.tsx
│   ├── Services.tsx
│   ├── ServiceDetails.tsx
│   ├── Settings.tsx
│   ├── AdminStatusPage.tsx
│   └── public/
│       ├── StatusOverview.tsx
│       └── PublicIncidentDetails.tsx
├── components/
│   ├── layout/                 # App shell (sidebar, protected route wrapper)
│   ├── incidents/
│   ├── services/
│   ├── settings/
│   └── ui/                     # Generic UI primitives (Card, Badge, Button, etc.)
└── types/                      # Shared TypeScript interfaces matching backend DTOs
```
