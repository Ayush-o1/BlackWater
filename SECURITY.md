# Security

This document describes the security measures implemented in BlackWater and their known limitations.

---

## Authentication

**Password storage:**
- Passwords are hashed using `bcrypt` with 10 salt rounds before storage.
- The raw password is never stored, logged, or returned in any response.
- The `sanitizeUser()` helper in `AuthService` strips `passwordHash` before returning user objects.

**JWT tokens:**
- Tokens are signed with a `JWT_SECRET` loaded from environment variables (validated at startup).
- The payload contains `{ userId, orgId, role }`.
- Default expiry is `1d` (configurable via `JWT_EXPIRES_IN` env var).
- On every protected request, the token is verified AND the user is fetched from the database. This catches cases where a user was deleted after the token was issued.

**Login security:**
- Both "email not found" and "incorrect password" return the same error message (`Invalid credentials`). This prevents user enumeration attacks.

---

## Authorization (RBAC)

Every protected route has an explicit role requirement enforced by `requireRole()` middleware:

| Role | Capabilities |
|------|-------------|
| `VIEWER` | Read-only access to incidents and services |
| `MEMBER` | Can create and manage incidents and services |
| `ADMIN` | Full access, including deleting services and updating org settings |

The first user who registers an organization is automatically assigned the `ADMIN` role.

Multi-tenancy: all data is scoped by `orgId`. Every database query includes `where: { orgId: user.orgId }` to prevent cross-organization data access.

---

## HTTP Security Headers

[Helmet.js](https://helmetjs.github.io/) is applied as the first middleware in `app.ts`. It sets the following headers by default:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 0`
- `Strict-Transport-Security` (for HTTPS)
- `Referrer-Policy`
- `Content-Security-Policy`
- Others

---

## Input Validation

Every API route uses a `validateRequest(zodSchema)` middleware that validates `req.body`, `req.query`, and `req.params` against a Zod schema. Invalid requests are rejected with `400` before reaching any business logic. Error messages include field paths (e.g., `body.email: Invalid email format`).

---

## Public Status Page Data Isolation

The `/status` endpoints are intentionally public (no auth). A `StatusDTO` layer strips all internal-only fields before returning data:

- No `description` of incidents
- No `assigneeId` or `creatorId`
- No `userId` from `IncidentUpdate`
- No `metadata` from `TimelineEvent` (contains internal UUIDs)
- Only updates with `isPublic: true` are returned

---

## Error Handling in Production

The global error handler in `error.middleware.ts` behaves differently based on environment:

- **Development:** Returns full error details including stack trace.
- **Production:** Returns a generic `Something went wrong!` message for unexpected errors. Only `AppError` instances with `isOperational: true` expose their message to the client.

This prevents leaking database error messages, stack traces, or internal paths to end users in production.

---

## WebSocket Security

Socket.IO connections require JWT authentication via a socket handshake middleware:
- The token is read from `socket.handshake.auth.token` or the `Authorization` header.
- Unauthorized connections are rejected before the `connection` event fires.
- Before a client can join an incident room, the server verifies the incident belongs to the user's organization.

---

## Known Limitations

1. **No refresh token.** The JWT is a single token with a fixed expiry. When it expires, the user must log in again. There is no silent refresh.

2. **JWT is not revocable.** If a token is compromised, it remains valid until it expires. A proper token blacklist or short expiry window + refresh token pattern would mitigate this.

3. **No HTTPS enforcement in the app itself.** HTTPS should be handled at the infrastructure level (reverse proxy, load balancer).

4. **JWT is stored in `localStorage` on the frontend**, not an `httpOnly` cookie, so it is readable by any script that achieves XSS on the page. No such XSS vector was found during this audit, but this remains a defense-in-depth gap inherent to the current auth architecture.

5. **No CSRF protection.** The API is stateless (JWT-based) so CSRF doesn't apply to the REST API, but if cookies were used in the future, this would need to be addressed.

Resolved since the last audit pass:
- `/auth/*` endpoints are now rate-limited (20 requests / 15 min per IP), with a looser baseline limit (300 / 15 min) applied to the whole API.
- CORS (both HTTP and Socket.IO) is now restricted to the origin(s) configured in `CORS_ORIGIN`, instead of allowing any origin.
