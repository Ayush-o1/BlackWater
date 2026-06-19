# API Documentation

All authenticated routes require the `Authorization: Bearer <token>` header.
All responses are `Content-Type: application/json`.
All request bodies are `Content-Type: application/json`.

---

## Auth

### `POST /auth/register`
Creates a new organization and assigns the registering user as its ADMIN.

**Request body:**
```json
{
  "name": "Alice Admin",
  "email": "alice@example.com",
  "password": "securepassword",
  "orgName": "Acme Corp"
}
```

**Success (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "Alice Admin",
    "email": "alice@example.com",
    "role": "ADMIN",
    "orgId": "uuid"
  }
}
```

**Error cases:**
- `409` — Email already registered

---

### `POST /auth/login`
Authenticates a user and returns a JWT.

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "securepassword"
}
```

**Success (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "Alice Admin",
    "email": "alice@example.com",
    "role": "ADMIN",
    "orgId": "uuid"
  }
}
```

**Error cases:**
- `401` — Invalid credentials (same message whether email or password is wrong — prevents user enumeration)

---

### `GET /auth/me`
Returns the currently authenticated user's profile.

**Auth required:** Yes

**Success (200):**
```json
{
  "id": "uuid",
  "name": "Alice Admin",
  "email": "alice@example.com",
  "role": "ADMIN",
  "orgId": "uuid"
}
```

---

## Incidents

### `GET /incidents`
Lists incidents for the authenticated user's organization. Supports filtering and cursor-based pagination.

**Auth required:** VIEWER+

**Query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `TRIGGERED\|ACKNOWLEDGED\|RESOLVED\|CLOSED` | Filter by status |
| `severity` | `CRITICAL\|HIGH\|MEDIUM\|LOW` | Filter by severity |
| `assigneeId` | string (UUID) | Filter by assigned user |
| `serviceId` | string (UUID) | Filter incidents affecting a specific service |
| `cursor` | string (UUID) | Cursor for next page (from `nextCursor` in previous response) |
| `limit` | number | Default: 20, max: 100 |

**Success (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Elevated Error Rates on API Gateway",
      "status": "ACKNOWLEDGED",
      "severity": "HIGH",
      "createdAt": "2024-01-15T10:00:00Z",
      "creator": { "id": "uuid", "name": "Alice Admin", "email": "alice@example.com" },
      "assignee": { "id": "uuid", "name": "Bob Engineer", "email": "bob@example.com" },
      "affectedServices": [{ "id": "uuid", "name": "API Gateway", "status": "PARTIAL_OUTAGE" }]
    }
  ],
  "pagination": {
    "nextCursor": "uuid-of-last-item",
    "hasMore": true
  }
}
```

---

### `POST /incidents`
Creates a new incident. Status starts as `TRIGGERED`. Affected service statuses are recalculated immediately.

**Auth required:** MEMBER+

**Request body:**
```json
{
  "title": "Database Connection Timeouts",
  "description": "Seeing connection pool exhaustion on the primary DB",
  "severity": "HIGH",
  "serviceIds": ["uuid-of-db-service"]
}
```

`serviceIds` can be an empty array `[]` if no services are linked yet.

**Success (201):**
```json
{
  "id": "uuid",
  "title": "Database Connection Timeouts",
  "status": "TRIGGERED",
  "severity": "HIGH",
  "orgId": "uuid",
  "creatorId": "uuid",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Socket event emitted:** `incident:created` to the organization room.

---

### `GET /incidents/:id`
Returns full incident detail including timeline and all updates.

**Auth required:** VIEWER+

**Success (200):**
```json
{
  "id": "uuid",
  "title": "Database Connection Timeouts",
  "status": "ACKNOWLEDGED",
  "severity": "HIGH",
  "creator": { "id": "uuid", "name": "Alice Admin", "email": "alice@example.com" },
  "assignee": { "id": "uuid", "name": "Bob Engineer", "email": "bob@example.com" },
  "affectedServices": [...],
  "updates": [
    {
      "id": "uuid",
      "message": "Investigating connection pool settings",
      "isPublic": false,
      "createdAt": "2024-01-15T10:05:00Z",
      "user": { "id": "uuid", "name": "Bob Engineer" }
    }
  ],
  "timelineEvents": [
    {
      "id": "uuid",
      "eventType": "INCIDENT_CREATED",
      "metadata": { "severity": "HIGH" },
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "STATUS_CHANGED",
      "metadata": { "oldStatus": "TRIGGERED", "newStatus": "ACKNOWLEDGED" },
      "createdAt": "2024-01-15T10:03:00Z"
    }
  ]
}
```

---

### `PATCH /incidents/:id/status`
Advances the incident through the state machine.

**Auth required:** MEMBER+

**Request body:**
```json
{
  "status": "ACKNOWLEDGED"
}
```

Valid transitions:
- `TRIGGERED` → `ACKNOWLEDGED` or `RESOLVED`
- `ACKNOWLEDGED` → `RESOLVED` or `TRIGGERED`
- `RESOLVED` → `TRIGGERED` or `CLOSED`
- `CLOSED` → nothing (terminal)

**Success (200):** Returns the updated incident object.

**Error cases:**
- `400` — Invalid state transition (e.g., CLOSED → TRIGGERED)

**Socket events emitted:**
- `incident:status_changed` to organization room
- `timeline:event_created` to incident room
- `status:updated` to organization room (triggers public page refresh)

---

### `PATCH /incidents/:id/assign`
Assigns an incident to a user in the same organization.

**Auth required:** MEMBER+

**Request body:**
```json
{
  "assigneeId": "uuid-of-user-in-same-org"
}
```

**Error cases:**
- `400` — Assignee not found in this organization
- `400` — Incident is closed

**Socket events emitted:** `incident:assigned`, `timeline:event_created`

---

### `POST /incidents/:id/updates`
Posts a new update on an incident. Can be internal-only or public-facing.

**Auth required:** MEMBER+

**Request body:**
```json
{
  "message": "Root cause identified — rolling back the rate limit config change.",
  "isPublic": false
}
```

Set `isPublic: true` for updates that should appear on the public status page.

**Success (201):** Returns the created update object.

**Socket events emitted:**
- `incident:update_added` to organization room
- `timeline:event_created` to incident room
- `status:updated` to organization room (only if `isPublic: true`)

---

## Services

### `GET /services`
Lists all services for the organization. Cursor-paginated.

**Auth required:** VIEWER+

**Query parameters:** `cursor`, `limit` (default 20)

**Success (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "API Gateway",
      "description": "Main edge router",
      "status": "PARTIAL_OUTAGE",
      "orgId": "uuid",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { "nextCursor": "uuid", "hasMore": false }
}
```

---

### `POST /services`
Registers a new service. Status starts as `OPERATIONAL`.

**Auth required:** MEMBER+

**Request body:**
```json
{
  "name": "Payment Service",
  "description": "Handles payment processing"
}
```

**Socket event emitted:** `service:created` to organization room.

---

### `GET /services/:id`
Returns service detail including the 10 most recent incidents.

**Auth required:** VIEWER+

**Success (200):** Service object with `incidents` array (up to 10 most recent).

---

### `PATCH /services/:id`
Updates a service's name and/or description. Does not change status (that's automatic).

**Auth required:** MEMBER+

**Request body:**
```json
{
  "name": "Payment Processing Service",
  "description": "Updated description"
}
```

**Socket event emitted:** `service:updated` to organization room.

---

### `DELETE /services/:id`
Deletes a service. This also removes the link between the service and any incidents.

**Auth required:** ADMIN

**Socket event emitted:** `service:deleted` to organization room.

---

## Users

### `GET /users`
Lists all users in the authenticated user's organization.

**Auth required:** Yes

**Success (200):** Array of user objects (no passwordHash).

---

### `GET /users/me`
Returns the current user's profile.

---

### `PATCH /users/me`
Updates the current user's display name.

**Request body:**
```json
{
  "name": "Alice Updated"
}
```

---

## Organizations

### `GET /organizations/me`
Returns the current user's organization details.

---

### `PATCH /organizations/me`
Updates the organization name.

**Auth required:** ADMIN

**Request body:**
```json
{
  "name": "Acme Corporation"
}
```

---

## Public Status API (No Auth Required)

These routes power the public status page. All responses are filtered through `StatusDTO` to remove internal fields.

### `GET /status?orgId=<uuid>`
Returns the full public overview: organization name, overall health, all services, and active incidents.

**Success (200):**
```json
{
  "organization": { "name": "Acme Corp" },
  "overallStatus": "PARTIAL_OUTAGE",
  "services": [
    { "id": "uuid", "name": "API Gateway", "description": "...", "status": "PARTIAL_OUTAGE" },
    { "id": "uuid", "name": "Auth Service", "description": "...", "status": "OPERATIONAL" }
  ],
  "activeIncidents": [
    {
      "id": "uuid",
      "title": "Elevated Error Rates on API Gateway",
      "status": "ACKNOWLEDGED",
      "severity": "HIGH",
      "createdAt": "2024-01-15T10:00:00Z",
      "resolvedAt": null,
      "affectedServices": [{ "id": "uuid", "name": "API Gateway", "status": "PARTIAL_OUTAGE" }]
    }
  ]
}
```

**What is stripped:** `description` (internal), `assigneeId`, `creatorId`, `passwordHash`, update author info.

---

### `GET /status/services?orgId=<uuid>`
Returns service list with current statuses and a `lastUpdated` timestamp.

---

### `GET /status/incidents?orgId=<uuid>`
Lists incidents (paginated). Supports `status` and cursor parameters.

---

### `GET /status/incidents/:id?orgId=<uuid>`
Returns public incident detail: title, status, severity, timeline (event types + timestamps, no metadata), and public updates only.

---

## Health Check

### `GET /health`
Simple liveness check. No auth required.

**Response:**
```json
{
  "status": "UP",
  "message": "BlackWater API is healthy"
}
```

---

## Socket.IO Events

### Connection
Connect with JWT in the auth handshake:
```javascript
const socket = io('http://localhost:8000', {
  auth: { token: 'your-jwt-token' }
});
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join:incident` | `(incidentId: string, callback: (success: boolean) => void)` | Join the incident-specific room |
| `leave:incident` | `(incidentId: string)` | Leave the incident room |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `incident:created` | `{ id, title, severity }` | New incident declared |
| `incident:assigned` | `{ id, assigneeId }` | Incident assigned to user |
| `incident:status_changed` | `{ id, status }` | Incident status changed |
| `incident:update_added` | `{ id, updateId, isPublic }` | New update posted |
| `timeline:event_created` | `{ incidentId, eventType }` | New timeline event |
| `service:created` | `{ id, name }` | New service registered |
| `service:updated` | `{ id }` | Service name/description changed |
| `service:status_changed` | `{ id, status }` | Service health changed (from ServiceEngine) |
| `service:deleted` | `{ id }` | Service deleted |
| `status:updated` | `{ orgId }` | Broad signal for public page to refresh |

### Room Model
- Organization room: `organization:<orgId>` — all authenticated users in an org join this automatically.
- Incident room: `incident:<incidentId>` — clients join explicitly via `join:incident` event.
