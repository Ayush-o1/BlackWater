# API reference

All endpoints are under `/api` and exchange JSON. The only endpoint outside it is `GET /health`.

## Conventions

**Authentication.** Send `Authorization: Bearer <token>`. Tokens come from `POST /api/auth/login`, `/register` and `/invitations/accept`. The user is looked up on every request, so a role change or a deleted account takes effect immediately.

**Responses.**

```json
{ "success": true, "data": {}, "message": "optional", "pagination": { "nextCursor": "…", "hasMore": true } }
```

Errors always have this shape, with the matching HTTP status:

```json
{ "success": false, "message": "Validation Error: title: Title must be at least 5 characters" }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input, or an action the current state does not allow |
| 401 | Missing, invalid or expired token; unknown email or wrong password at login |
| 403 | The user's role does not allow this |
| 404 | Not found, or belongs to another organization (the two are indistinguishable) |
| 409 | Conflict: email already in use, or it would leave an organization without an admin |
| 410 | Invitation link is invalid, expired or already used |
| 413 | Request body too large |
| 429 | Rate limit exceeded |

**Caching.** Every `/api` response carries `Cache-Control: no-store`; the data is private and differs per user.

**Pagination.** List endpoints return newest first and take `limit` (1 to 100, default 20) and `cursor` (the `nextCursor` of the previous page). Rows with the same creation time are ordered by id, so paging never skips or repeats a row.

**Rate limits.** Per IP and 15 minutes. Registration and the two public invitation endpoints share `AUTH_RATE_LIMIT` (default 20). Login uses the same limit but counts only failed attempts, so people signing in from one shared address do not use each other's allowance. Everything else under `/api` shares `API_RATE_LIMIT` (default 1000, roughly four API calls per page view). Exceeding a limit answers 429.

**Roles.** `VIEWER` reads. `MEMBER` also writes incidents and services. `ADMIN` also manages the organization. In the tables below the role is the minimum needed.

## Auth

| Method and path | Role | Body | Notes |
|---|---|---|---|
| `POST /auth/register` | public | `name`, `email`, `password` (8 to 72 chars), `orgName` | Creates an organization and its first user, an ADMIN. 201 with `{ token, user }`. 409 if the email is taken. |
| `POST /auth/login` | public | `email`, `password` | 200 with `{ token, user }`. |
| `GET /auth/me` | any | | The signed-in user. |

Emails are trimmed and lowercased, so they are case-insensitive.

## Users and organization

| Method and path | Role | Body | Notes |
|---|---|---|---|
| `GET /users` | any | | Members of the organization, paginated. |
| `GET /users/me` | any | | |
| `PATCH /users/me` | any | `name` | |
| `PATCH /users/:id/role` | ADMIN | `role`: `ADMIN`, `MEMBER` or `VIEWER` | 404 for a user of another organization. 409 if this would demote the last admin. |
| `GET /organizations/me` | any | | Includes `_count.users`. |
| `PATCH /organizations/me` | ADMIN | `name` | |
| `DELETE /organizations/me` | ADMIN | `password` (the administrator's own), `confirmName` (the organization's exact name) | Permanently deletes the organization with its users, services, incidents, history and invitations, and cuts its live connections. 403 for a wrong password, 400 for a wrong name; failed attempts count against the login rate limit. Irreversible except from a backup. |

## Invitations

An invitation is a one-time link that lets a person join the administrator's organization. The token is shown once, when the invitation is created; only its SHA-256 hash is stored. Links expire after 7 days. Invitations can only grant `MEMBER` or `VIEWER`.

| Method and path | Role | Body | Notes |
|---|---|---|---|
| `POST /invitations` | ADMIN | `role`: `MEMBER` or `VIEWER` | 201 with `{ id, role, expiresAt, createdAt, createdBy, token }`. The link is `<origin>/invite#<token>`. |
| `GET /invitations` | ADMIN | | Pending invitations (not used, not expired). Never includes tokens. |
| `DELETE /invitations/:id` | ADMIN | | Revokes a pending invitation. |
| `POST /invitations/preview` | public | `token` | `{ organizationName, role, expiresAt }`. 410 if the link is unusable. |
| `POST /invitations/accept` | public | `token`, `name`, `email`, `password` | Creates the user in the inviting organization with the invited role and returns `{ token, user }`. 410 if the link is unusable (unknown, expired and used links give the same answer). 409 if the email is taken; the link is not consumed in that case. |

## Services

A service's `status` is calculated on every read from its open incidents (those not `RESOLVED` or `CLOSED`); the worst one decides:

| Worst open incident | Service status |
|---|---|
| none | `OPERATIONAL` |
| `LOW` or `MEDIUM` | `DEGRADED` |
| `HIGH` | `PARTIAL_OUTAGE` |
| `CRITICAL` | `MAJOR_OUTAGE` |

| Method and path | Role | Body | Notes |
|---|---|---|---|
| `GET /services` | any | | Paginated, with `status`. |
| `POST /services` | MEMBER | `name` (2 to 200), `description?` | Any `status` in the body is ignored. |
| `GET /services/:id` | any | | Also `incidents`: the 10 most recent that affected it. |
| `PATCH /services/:id` | MEMBER | `name?`, `description?` | At least one field. |
| `DELETE /services/:id` | ADMIN | | Removed from past incidents; the incidents are kept. |

## Incidents

Statuses and the moves between them:

| From | To |
|---|---|
| `TRIGGERED` | `ACKNOWLEDGED`, `RESOLVED` |
| `ACKNOWLEDGED` | `RESOLVED`, `TRIGGERED` |
| `RESOLVED` | `TRIGGERED` (reopen), `CLOSED` |
| `CLOSED` | none |

`acknowledgedAt` and `resolvedAt` are set when those statuses are reached and cleared when the incident returns to `TRIGGERED`. A closed incident cannot be edited, assigned, updated or reopened; it can still be unpublished.

| Method and path | Role | Body | Notes |
|---|---|---|---|
| `GET /incidents` | any | query: `status`, `severity`, `assigneeId`, `serviceId`, `cursor`, `limit` | Paginated, with creator, assignee and affected services (with health). |
| `POST /incidents` | MEMBER | `title` (5 to 200), `severity`, `description?`, `serviceIds?`, `isPublic?` | Private unless `isPublic` is true. Every service must belong to the organization. |
| `GET /incidents/:id` | any | | Adds `updates` (with author) and `timelineEvents` (with `actor`). |
| `PATCH /incidents/:id` | MEMBER | any of `title`, `description` (or `null`), `severity`, `serviceIds` | At least one field. Fields that do not change write nothing. |
| `PATCH /incidents/:id/assign` | MEMBER | `assigneeId`, or `null` to unassign | The assignee must be in the organization. |
| `PATCH /incidents/:id/status` | MEMBER | `status` | 400 for a move the table above does not allow. |
| `PATCH /incidents/:id/visibility` | MEMBER | `isPublic` | Publishes or unpublishes. |
| `POST /incidents/:id/updates` | MEMBER | `message` (1 to 5000), `isPublic?` | A public update is visible on the status page only while the incident is public. |

Severities: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

Every successful change adds a timeline event with the authenticated user as `actor`:

| `eventType` | `metadata` |
|---|---|
| `INCIDENT_CREATED` | `{ severity, isPublic }` |
| `INCIDENT_EDITED` | `{ changes: { title?, severity?, description?, services? } }` with before and after values |
| `STATUS_CHANGED` | `{ oldStatus, newStatus }` |
| `ASSIGNEE_CHANGED` | `{ from, to }`, each `{ id, name }` or `null` |
| `UPDATE_ADDED` | `{ updateId, isPublic }` |
| `VISIBILITY_CHANGED` | `{ isPublic }` |

Concurrent changes to one incident are applied one after another, each checked against the latest state.

## Dashboard

`GET /dashboard` (any role) returns `{ overallStatus, serviceCount, activeIncidentCount, criticalIncidentCount, recentActiveIncidents }`, counted across the whole organization, private incidents included.

## Public status

No authentication. Every request needs `?orgId=<organization id>`; an unknown id answers 404 on every endpoint. Only incidents with `isPublic: true` exist as far as these endpoints are concerned: a private incident answers 404, exactly like a missing one. Health shown here is calculated from published incidents only, so a private incident never changes it.

| Method and path | Notes |
|---|---|
| `GET /status` | `{ organization: { name }, overallStatus, services, activeIncidents }` |
| `GET /status/services` | `{ services, lastUpdated }` |
| `GET /status/incidents` | Published incidents, paginated; optional `status` filter. |
| `GET /status/incidents/:id` | The incident, its public updates and a public timeline. |

Public incidents contain only `id`, `title`, `status`, `severity`, `createdAt`, `resolvedAt` and `affectedServices`. The public timeline lists creation, status changes (old and new status only) and public updates; edits, assignments, visibility changes and everything about people are never included.

## Health check

`GET /health` returns `{ "status": "UP", "database": "UP", "commit": "<sha>" }`, or 503 with `DOWN` when the database cannot be reached. `commit` is the commit the platform says is running (`COMMIT_SHA`, else Render's `RENDER_GIT_COMMIT`), or `null` when it does not say; it is what lets a deployment check tell a new release from the previous one.

## Real-time events (Socket.IO)

Connect to the same origin with the token: `io({ auth: { token } })`. Connections without a valid token are rejected. A socket joins only its own organization's room. Events carry only an id; clients refetch what they display.

| Event | Sent when |
|---|---|
| `incident:created` | An incident is declared |
| `incident:updated` | Status, assignee, details, notes or visibility change |
| `service:changed` | A service is created, edited or deleted |
| `team:changed` | Someone joins or a role changes |

Events are sent after the database change has committed. Rejected changes send nothing.
