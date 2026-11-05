# Database

PostgreSQL, accessed through Prisma. The schema is `prisma/schema.prisma`; the migrations in `prisma/migrations/` are the history of how the database got there.

## Tables

```
Organization 1 ──< User
             1 ──< Service
             1 ──< Incident
             1 ──< Invitation

Incident >──< Service        (join table "_IncidentToService")
Incident 1 ──< IncidentUpdate
Incident 1 ──< TimelineEvent
User     1 ──< Incident (as creator and as assignee)
User     1 ──< IncidentUpdate, TimelineEvent (as actor), Invitation (created, accepted)
```

| Table | Purpose |
|---|---|
| `Organization` | A tenant. |
| `User` | Email (unique, always lowercase), password hash, role, organization. |
| `Service` | Something the organization runs. It has no status column: health is derived from open incidents. |
| `Incident` | Title, description, severity, status, `isPublic` (default false), assignee, creator and the `acknowledgedAt` and `resolvedAt` timestamps. |
| `IncidentUpdate` | A note on an incident; `isPublic` decides whether visitors see it. |
| `TimelineEvent` | The audit trail: one row per change, with `eventType`, JSON `metadata` and a nullable `actorId`. Rows are only ever inserted. |
| `Invitation` | A one-time join link: role, `tokenHash` (unique), `expiresAt`, `usedAt`. |

Enums: `Role` (`ADMIN`, `MEMBER`, `VIEWER`), `IncidentStatus`, `Severity`.

## Multi-tenancy

All tenant data lives in shared tables, and every row carries an `orgId` (directly, or through its incident). Every query filters on the `orgId` of the signed-in user, which comes from the database and never from the request. The database does not enforce this on its own (there is no row-level security), so the rule is enforced in code and covered by cross-organization tests for every resource.

## Integrity rules enforced by the database

- `User.email` is unique. The application lowercases it before every write.
- `Invitation.tokenHash` is unique, and `CHECK ("role" <> 'ADMIN')` makes it impossible to store an invitation that grants ADMIN.
- Deleting an organization cascades to everything it owns.
- `Incident.creatorId` and `IncidentUpdate.userId` restrict deleting a user who has history. `Incident.assigneeId`, `TimelineEvent.actorId` and the invitation user references are set to null instead, so history survives a deleted user (the interface shows such an event as made by "System").

## Concurrency

Changes to an incident run in a transaction that first locks the incident row (`SELECT … FOR UPDATE`), so two people acting at once are handled one after the other and the second is validated against the first one's result. Role changes lock the organization's admin rows, which is what keeps the "at least one admin" rule true when two admins demote each other at the same moment. Accepting an invitation claims it with a single conditional `UPDATE`, so only one of several simultaneous attempts succeeds.

## Indexes

List queries sort by `createdAt DESC, id DESC` within one organization, so `Incident`, `Service` and `User` each have an index on `(orgId, createdAt DESC, id DESC)`. Others: incidents by `(orgId, status)` and `(orgId, isPublic, createdAt DESC)`, timeline events by `(incidentId, createdAt)` and by actor, invitations by `(orgId, createdAt DESC)`, and the incident creator, incident assignee and update author foreign keys.

## Migrations

| Migration | Change |
|---|---|
| `20260605144320_phase2_database_layer` | Initial schema |
| `20260613102001_pagination_indexes` | Composite indexes for list queries |
| `20260722000000_add_missing_indexes_and_oncall_unique_constraint` | Foreign-key indexes |
| `20261105100000_remove_unused_oncall_and_notification_models` | Drops three tables and three enums that no code used |
| `20261105100100_add_incident_visibility_and_timeline_actor` | `Incident.isPublic` (existing incidents become private), `TimelineEvent.actorId`, event-name backfill |
| `20261105100200_derive_service_health` | Drops `Service.status` and its enum |
| `20261105100300_add_invitations` | `Invitation` table |
| `20261105100400_normalize_emails_and_tidy_indexes` | Lowercases emails (stops with a message if two differ only by case), replaces redundant indexes |

### Commands

```bash
npm run prisma:migrate        # development: create a migration from schema changes and apply it
npm run prisma:migrate:prod   # apply pending migrations (deployments and CI); never resets data
npx prisma migrate status     # what is applied
npm run prisma:studio         # browse the data
```

### Rules

- Never edit or delete a migration that has been applied anywhere. Fix mistakes with a new migration.
- Changing `schema.prisma` without a migration leaves the database out of step; commit both together.
- Dropping a column or table destroys data. Check what depends on it first.
- Prisma cannot express everything. Data fixes and constraints such as the invitation `CHECK` are plain SQL written into the migration file by hand, after `prisma migrate dev --create-only`.

To confirm migrations and schema agree, replay them on a scratch database:

```bash
createdb blackwater_shadow
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://localhost:5432/blackwater_shadow --exit-code
```

No output and exit code 0 means they agree.

## Demo data

`npm run prisma:seed` deletes **all** data, then creates one organization with three users (one per role), three services, and three incidents (one private, two published) with realistic timelines. It refuses to run when `NODE_ENV=production`.
