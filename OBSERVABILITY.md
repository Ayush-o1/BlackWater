# Observability & Debugging

This document describes what observability is currently present in BlackWater and what is useful for debugging during development.

---

## Health Check

**Endpoint:** `GET /health`  
**Auth:** None  
**Response:**
```json
{ "status": "UP", "message": "BlackWater API is healthy" }
```

Returns `200 OK` when the server is running. This can be used by load balancers, uptime monitors, or deployment checks to verify the server is accepting connections.

**Note:** This endpoint checks that Express is responding. It does not verify database connectivity. If the database is down but the server is running, this will still return 200.

---

## Console Logging (Development)

The server currently uses `console.log` and `console.error` for operational messages:

| Event | Log message |
|-------|------------|
| Server start | `🚀 Server running in development mode on port 8000` |
| DB connected | `✅ Successfully connected to the database` |
| Socket connected | `🔌 Socket connected: <socketId> (User: <userId>)` |
| Socket disconnected | `🔌 Socket disconnected: <socketId>` |
| Graceful shutdown | Shutdown status messages |
| Unexpected errors | `💥 ERROR: <error details>` (production only) |

**To be improved:** A proper logging library (e.g., Winston or Pino) with structured JSON logs and log levels would make this more useful in any environment beyond local development.

---

## Timeline Events (Audit Trail)

Every significant action on an incident creates an immutable `TimelineEvent` record in the database:

| Event Type | Triggered by |
|-----------|-------------|
| `INCIDENT_CREATED` | Creating a new incident |
| `STATUS_CHANGED` | Changing incident status |
| `ASSIGNEE_CHANGED` | Assigning or reassigning an incident |
| `UPDATE_ADDED` | Posting an incident update |

The timeline is accessible:
- Internally via `GET /incidents/:id` (full metadata included)
- Publicly via `GET /status/incidents/:id` (metadata stripped)

This provides a complete, ordered history of every incident's lifecycle, useful for post-mortems.

---

## Error Responses

All API errors return a consistent JSON structure:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

In development, errors also include:
```json
{
  "status": "error",
  "message": "...",
  "stack": "Error: ...\n    at ...",
  "error": { ... }
}
```

HTTP status codes used:

| Code | Meaning |
|------|---------|
| `400` | Validation error or invalid state transition |
| `401` | Missing, invalid, or expired token |
| `403` | Authenticated but insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g., email already registered) |
| `500` | Unexpected server error |

---

## Database Queries (Debugging)

To see the SQL queries Prisma generates, add `log: ['query']` to the Prisma client instantiation in `src/prisma/client.ts`:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});
```

This is useful during development to verify indexes are being used and queries aren't doing full table scans.

---

## What Is Not Implemented

- **No request/response logging middleware** (e.g., Morgan). Adding Morgan would log every incoming request with method, path, status, and response time.
- **No metrics endpoint** (e.g., Prometheus `/metrics`). Metrics like request rate, error rate, and response times would require this.
- **No database health in health check.** The `/health` endpoint does not ping the database. Adding `await prisma.$queryRaw('SELECT 1')` would make it a true liveness + readiness check.
- **No distributed tracing.** Each request doesn't have a trace ID, so correlating logs across multiple operations is manual.
