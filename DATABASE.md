# Database Schema

This document describes all 9 Prisma models in the BlackWater database.

Database: **PostgreSQL**
ORM: **Prisma v5**
Schema file: `prisma/schema.prisma`

---

## Entity Relationship Overview

```
Organization
    │
    ├──< User (orgId FK)
    │       │
    │       ├── createdIncidents
    │       ├── assignedIncidents
    │       ├── incidentUpdates
    │       ├── onCallMemberships
    │       └── notifications
    │
    ├──< Service (orgId FK)
    │       └──< Incident (many-to-many via IncidentToService)
    │
    ├──< Incident (orgId FK)
    │       ├── creatorId → User
    │       ├── assigneeId → User (optional)
    │       ├──< IncidentUpdate
    │       ├──< TimelineEvent
    │       └──< NotificationLog
    │
    └──< OnCallSchedule (orgId FK)
            └──< OnCallMember
                    └── userId → User
```

---

## Enums

### `Role`
Controls what actions a user can perform within an organization.

| Value | Meaning |
|-------|---------|
| `ADMIN` | Full access — can delete services, update org name |
| `MEMBER` | Can create and manage incidents, services |
| `VIEWER` | Read-only access |

### `IncidentStatus`
The lifecycle states of an incident.

| Value | Meaning |
|-------|---------|
| `TRIGGERED` | Incident has been declared, no one has acknowledged it yet |
| `ACKNOWLEDGED` | A team member has acknowledged and is investigating |
| `RESOLVED` | The underlying problem is fixed |
| `CLOSED` | Terminal state — incident is archived, no further changes allowed |

### `Severity`
The business impact of an incident.

| Value | Auto-sets Service To |
|-------|---------------------|
| `CRITICAL` | `MAJOR_OUTAGE` |
| `HIGH` | `PARTIAL_OUTAGE` |
| `MEDIUM` | `DEGRADED` |
| `LOW` | `DEGRADED` |

### `ServiceStatus`
The operational health of a monitored service.

| Value | Meaning |
|-------|---------|
| `OPERATIONAL` | No active incidents affecting this service |
| `DEGRADED` | Minor issues or low/medium severity incidents |
| `PARTIAL_OUTAGE` | High severity incidents — some functionality impaired |
| `MAJOR_OUTAGE` | Critical incident — service significantly impaired |

### `NotificationChannel`
| Value | Meaning |
|-------|---------|
| `EMAIL` | Email notification |
| `SLACK` | Slack message |
| `WEBHOOK` | HTTP webhook POST |

### `NotificationStatus`
| Value | Meaning |
|-------|---------|
| `SENT` | Notification delivered successfully |
| `FAILED` | Delivery failed (error stored in `error` field) |

### `EscalationLevel`
| Value | Meaning |
|-------|---------|
| `PRIMARY` | First person to be paged |
| `SECONDARY` | Paged if primary doesn't respond |

---

## Models

### `Organization`
The top-level tenant. All data is scoped to an organization.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `name` | String | Organization display name |
| `createdAt` | DateTime | Auto-set on create |
| `updatedAt` | DateTime | Auto-updated on every write |

**Relations:** has many `User`, `Service`, `Incident`, `OnCallSchedule`

---

### `User`
An authenticated member of an organization.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `email` | String | Unique across all users |
| `name` | String | Display name |
| `passwordHash` | String | bcrypt hash — never returned in API responses |
| `role` | Role | Default: `MEMBER` (first user in org gets `ADMIN`) |
| `orgId` | String | Foreign key → Organization |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Indexes:** `orgId`, `(orgId, createdAt)`

**Relations:** creates incidents, is assigned incidents, posts updates, belongs to on-call schedules, receives notifications.

---

### `Service`
A monitored infrastructure service or component.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `name` | String | e.g., "API Gateway", "Auth Service" |
| `description` | String? | Optional |
| `status` | ServiceStatus | Default: `OPERATIONAL`. **Managed automatically by ServiceEngine** |
| `orgId` | String | Foreign key → Organization |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Indexes:** `orgId`, `(orgId, createdAt)`

**Important:** The `status` field is not set manually via API — it is recalculated by `ServiceEngine` based on active incidents.

---

### `Incident`
The central model. Represents one infrastructure incident.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `title` | String | Short description of the issue |
| `description` | String? | Optional detailed context |
| `status` | IncidentStatus | Default: `TRIGGERED`. Controlled by state machine |
| `severity` | Severity | Required on creation |
| `orgId` | String | Foreign key → Organization |
| `creatorId` | String | Foreign key → User |
| `assigneeId` | String? | Optional FK → User |
| `createdAt` | DateTime | Also serves as the trigger timestamp |
| `acknowledgedAt` | DateTime? | Set automatically when status → ACKNOWLEDGED |
| `resolvedAt` | DateTime? | Set automatically when status → RESOLVED |
| `updatedAt` | DateTime | |

**Indexes:** `orgId`, `status`, `severity`, `createdAt`, `(orgId, createdAt)`

The `createdAt`, `acknowledgedAt`, and `resolvedAt` timestamps together enable calculation of **MTTA** (Mean Time to Acknowledge) and **MTTR** (Mean Time to Resolve) — common SRE metrics.

**Relations:** many-to-many with `Service` (via `_IncidentToService` join table), has many `IncidentUpdate`, `TimelineEvent`, `NotificationLog`.

---

### `IncidentUpdate`
A text update posted on an incident by a team member.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `incidentId` | String | FK → Incident (cascade delete) |
| `userId` | String | FK → User (who posted it) |
| `message` | String (TEXT) | The update content |
| `isPublic` | Boolean | Default: `false`. If `true`, shown on public status page |
| `createdAt` | DateTime | |

**Index:** `incidentId`

**Key design decision:** `isPublic` allows engineering teams to post both internal notes ("Looks like a memory leak — investigating pod restart") and public-facing updates ("We are investigating elevated error rates") on the same incident. The public API only returns updates where `isPublic = true`.

---

### `TimelineEvent`
An immutable audit log entry for everything that happens to an incident.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `incidentId` | String | FK → Incident (cascade delete) |
| `eventType` | String | e.g., `INCIDENT_CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `UPDATE_ADDED` |
| `metadata` | Json? | Stores the before/after delta for the event |
| `createdAt` | DateTime | |

**Index:** `incidentId`

**Example metadata values:**
```json
// STATUS_CHANGED
{ "oldStatus": "TRIGGERED", "newStatus": "ACKNOWLEDGED" }

// ASSIGNEE_CHANGED
{ "oldAssigneeId": null, "newAssigneeId": "uuid-of-new-assignee" }

// INCIDENT_CREATED
{ "severity": "HIGH" }

// UPDATE_ADDED
{ "updateId": "uuid", "isPublic": true }
```

**Note:** The public status API strips the `metadata` field to avoid leaking internal user IDs or other references.

---

### `OnCallSchedule`
A named on-call rotation schedule for an organization.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `name` | String | Schedule name |
| `orgId` | String | FK → Organization |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Index:** `orgId`

> **To be verified:** The on-call schedule data model is fully defined in the schema, but the API endpoints for creating and managing schedules are not yet implemented. The model exists to support this future feature.

---

### `OnCallMember`
Links a user to an on-call schedule with an escalation level.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `scheduleId` | String | FK → OnCallSchedule (cascade delete) |
| `userId` | String | FK → User (cascade delete) |
| `escalationLevel` | EscalationLevel | `PRIMARY` or `SECONDARY` |
| `createdAt` | DateTime | |

**Indexes:** `scheduleId`, `userId`

---

### `NotificationLog`
An immutable record of every notification attempt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key |
| `incidentId` | String? | Optional FK → Incident (set to null if incident is deleted) |
| `userId` | String | FK → User (cascade delete) |
| `channel` | NotificationChannel | `EMAIL`, `SLACK`, or `WEBHOOK` |
| `status` | NotificationStatus | `SENT` or `FAILED` |
| `error` | String? | Null if sent, error message if failed |
| `sentAt` | DateTime | |

**Indexes:** `incidentId`, `userId`

> **To be verified:** The notification model is fully defined, but the notification sending logic (email, Slack, webhook integrations) is not yet implemented in the service layer. The model is designed to log attempts once that feature is built.

---

## Database Indexes

Indexes are placed on columns that appear in frequent query predicates:

| Table | Indexed Columns | Reason |
|-------|----------------|--------|
| User | `orgId` | All user queries are scoped to an org |
| User | `(orgId, createdAt)` | Time-sorted user listing |
| Service | `orgId` | All service queries are scoped to an org |
| Incident | `orgId` | All incident queries are scoped to an org |
| Incident | `status` | Filtering active vs. resolved incidents |
| Incident | `severity` | Filtering by severity |
| Incident | `createdAt` | Time-series queries |
| Incident | `(orgId, createdAt)` | Most common query: incidents for an org, sorted by time |
| IncidentUpdate | `incidentId` | Fetching all updates for one incident |
| TimelineEvent | `incidentId` | Fetching full timeline for one incident |
| OnCallMember | `scheduleId`, `userId` | Schedule membership lookups |
| NotificationLog | `incidentId`, `userId` | Notification history lookups |

---

## Seed Data

Running `npx prisma db seed` creates:

- 1 organization: `BlackWater Demo Corp`
- 2 users: `admin@BlackWater.com` (ADMIN), `bob@BlackWater.com` (MEMBER) — both with password `password123`
- 3 services: API Gateway (DEGRADED), Authentication Service (OPERATIONAL), Primary DB Cluster (OPERATIONAL)
- 1 resolved historical incident (7 days ago)
- 1 active incident (ACKNOWLEDGED severity HIGH) on API Gateway, with 2 updates (1 internal, 1 public)
- Timeline events for each incident
