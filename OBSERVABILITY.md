# Observability & Debugging

This document describes the observability capabilities currently available in BlackWater and what would be required to extend them.

---

## Health Check

**Endpoint:** `GET /health`  
**Auth:** None  
**Response:**
```json
{ "status": "UP", "message": "BlackWater API is healthy" }
```

Returns `200 OK` when the Express server is accepting connections. Used by load balancers, uptime monitors, and deployment health checks.

**Note:** This endpoint verifies that Express is responsive. It does not check database connectivity. If the database is unavailable but the server is running, this still returns `200`. To add a database ping:

```typescript
// src/app.ts — enhanced health check
app.get('/health', async (req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.status(200).json({ status: 'UP', message: 'BlackWater API is healthy' });
});
```

---

## Console Logging

The server emits structured console messages for key operational events:

| Event | Message |
|-------|---------|
| Server start | `🚀 Server running in {env} mode on port {port}` |
| DB connected | `✅ Successfully connected to the database` |
| Socket connected | `🔌 Socket connected: {socketId} (User: {userId})` |
| Socket disconnected | `🔌 Socket disconnected: {socketId}` |
| Graceful shutdown | `🛑 Shutdown signal received, shutting down gracefully...` |
| Startup error | `❌ Error starting the server: {error}` |

**Recommended improvement:** Replace `console.log` / `console.error` with a structured logging library (Pino or Winston) that emits JSON log lines with level, timestamp, and correlation fields. This makes logs queryable in any log aggregation platform.

---

## Debugging Database Queries

To log the SQL queries Prisma generates, add the `log` option to the Prisma Client in `src/prisma/client.ts`:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});
```

This shows the exact SQL, parameters, and query duration for every operation — useful for verifying indexes are being hit and detecting N+1 queries.

---

## Incident Audit Timeline

Every significant action on an incident creates an immutable `TimelineEvent` record:

| Event Type | Triggered By |
|-----------|-------------|
| `INCIDENT_CREATED` | Creating a new incident |
| `STATUS_CHANGED` | Advancing the state machine |
| `ASSIGNEE_CHANGED` | Assigning or reassigning an incident |
| `UPDATE_ADDED` | Posting an incident update |

Timeline access:
- **Internal:** `GET /incidents/:id` — full timeline including metadata
- **Public:** `GET /status/incidents/:id` — timeline with metadata stripped (no internal UUIDs)

The `acknowledgedAt` and `resolvedAt` timestamps on the `Incident` model support MTTA (Mean Time to Acknowledge) and MTTR (Mean Time to Resolve) calculations.

---

## Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

In development (`NODE_ENV=development`), errors also include the stack trace:
```json
{
  "status": "error",
  "message": "...",
  "stack": "Error: ...\n    at ...",
  "error": { ... }
}
```

In production, only `AppError` instances with `isOperational: true` expose their message to the client. All other errors return a generic `Something went wrong!` response to prevent leaking internal details.

**HTTP status codes:**

| Code | Meaning |
|------|---------|
| `400` | Validation error or invalid state transition |
| `401` | Missing, invalid, or expired JWT |
| `403` | Insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g., email already registered) |
| `500` | Unexpected server error |

---

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals:

1. Stops accepting new connections (`server.close()`)
2. Waits for active connections to drain
3. Disconnects the Prisma client cleanly (`prisma.$disconnect()`)
4. Force-exits after 10 seconds if connections haven't drained

This prevents data corruption or incomplete writes when the process is terminated mid-request.

---

## What Is Not Implemented

| Gap | Resolution |
|-----|-----------|
| No request/response logging | Add `morgan` middleware to log method, path, status code, and response time per request |
| No metrics endpoint | Add a Prometheus `/metrics` endpoint using `prom-client` for request rate, error rate, latency histograms |
| Database not included in health check | Add `prisma.$queryRaw\`SELECT 1\`` to `/health` for a true readiness probe |
| No distributed tracing | Add OpenTelemetry to trace requests across the middleware → service → database chain |
| No centralized log aggregation | Ship logs to Datadog, Loki, or CloudWatch using a transport layer on the logger |
