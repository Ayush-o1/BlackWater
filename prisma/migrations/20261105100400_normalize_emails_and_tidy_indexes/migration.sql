-- Emails are stored lowercase from now on, so "A@x.com" and "a@x.com" cannot be
-- two accounts. If existing data already contains such a pair, stop with a clear
-- message instead of silently merging or failing on the unique index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User" GROUP BY lower("email") HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot lowercase emails: two users share the same email ignoring case. Resolve them manually, then rerun the migration.';
  END IF;
END $$;

UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");

-- Indexes: list queries sort by (createdAt DESC, id DESC) within one organization,
-- so each list gets one index in exactly that order. The single-column indexes on
-- orgId, status, severity and createdAt were redundant next to these.

-- DropIndex
DROP INDEX "Incident_createdAt_idx";

-- DropIndex
DROP INDEX "Incident_orgId_createdAt_idx";

-- DropIndex
DROP INDEX "Incident_orgId_idx";

-- DropIndex
DROP INDEX "Incident_severity_idx";

-- DropIndex
DROP INDEX "Incident_status_idx";

-- DropIndex
DROP INDEX "Service_orgId_createdAt_idx";

-- DropIndex
DROP INDEX "Service_orgId_idx";

-- DropIndex
DROP INDEX "User_orgId_createdAt_idx";

-- DropIndex
DROP INDEX "User_orgId_idx";

-- CreateIndex
CREATE INDEX "Incident_orgId_createdAt_id_idx" ON "Incident"("orgId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Incident_orgId_isPublic_createdAt_idx" ON "Incident"("orgId", "isPublic", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Service_orgId_createdAt_id_idx" ON "Service"("orgId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "User_orgId_createdAt_id_idx" ON "User"("orgId", "createdAt" DESC, "id" DESC);
