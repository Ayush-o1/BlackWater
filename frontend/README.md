# BlackWater Frontend (SPA)

This is the Single Page Application (SPA) client for the BlackWater platform, built for extreme responsiveness and deterministic state rendering.

## Architecture & Technology Stack

*   **Core Framework**: React 18 powered by Vite for rapid development (HMR) and optimized production bundling.
*   **Language**: Strict TypeScript.
*   **Routing**: `react-router-dom` utilizing a feature-centric route structure.
*   **Styling**: Tailwind CSS configured with a highly semantic, token-based design system mapped to raw CSS variables (`index.css`) to support instant theming (Dark/Light modes). UI primitives are inspired by Radix UI for accessibility.

## State Management Philosophy

BlackWater strictly bifurcates state into two distinct categories to prevent prop-drilling and maintain optimal rendering performance.

### 1. Server State (TanStack React Query)
**90% of the application state.**
We utilize React Query for all asynchronous operations, caching, and data synchronization. 
Instead of manually fetching data in `useEffect` blocks and storing it in local `useState`, we define custom hooks (e.g., `useIncidents`, `useServices`) that wrap `useQuery`. This provides native deduping, background refetching, and pagination out of the box.

### 2. Client State (Zustand)
**10% of the application state.**
We utilize Zustand for globally required, synchronous client state that has no backend equivalent.
This is strictly limited to:
- JWT Authentication Payload (User ID, Role, Org ID)
- UI State (e.g., Sidebar toggles, active theme)

## Real-Time Invalidation via WebSockets

The true power of the BlackWater frontend is its WebSocket integration. We completely eliminate client-side HTTP polling.

**The Workflow:**
1. A user establishes a persistent Socket.IO connection upon loading the app.
2. When the backend emits a state change (e.g., `incident:created`), the `SocketProvider` context intercepts it.
3. The provider directly interacts with the React Query `QueryClient` to invalidate specific query keys (e.g., `['incidents']`).
4. React Query silently refetches the updated data in the background and triggers a DOM reconciliation instantly.

This creates a "Zero-Latency" feel for the end-user while minimizing unnecessary network traffic.

## Folder Structure

```text
src/
├── components/
│   ├── ui/          # Highly reusable, dumb UI primitives (Buttons, Badges, Modals)
│   └── layout/      # Shell components (Sidebar, TopNav)
├── hooks/           # TanStack Query custom wrappers
├── lib/             # Utility functions (axios instances, clsx wrappers)
├── pages/           # Route-level container components
├── store/           # Zustand slice definitions
└── types/           # Shared TypeScript interfaces matching backend DTOs
```

## Running Locally

```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev

# Build for production
npm run build
```
