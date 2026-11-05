-- Incident visibility: every existing incident becomes private. Nothing that was
-- previously visible on a public status page stays visible until an organization
-- member publishes it again; the safe default for a privacy change.
-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- Timeline actor. Existing events keep a NULL actor (the person was never recorded).
-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN     "actorId" TEXT;

-- DropIndex
DROP INDEX "TimelineEvent_incidentId_idx";

-- CreateIndex
CREATE INDEX "TimelineEvent_incidentId_createdAt_idx" ON "TimelineEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_actorId_idx" ON "TimelineEvent"("actorId");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Event names: the demo seed script used different names from the application
-- (CREATED / STATUS_CHANGE / ASSIGNED). Align them so there is one vocabulary.
UPDATE "TimelineEvent" SET "eventType" = 'INCIDENT_CREATED' WHERE "eventType" = 'CREATED';
UPDATE "TimelineEvent" SET "eventType" = 'ASSIGNEE_CHANGED' WHERE "eventType" = 'ASSIGNED';
UPDATE "TimelineEvent"
  SET "eventType" = 'STATUS_CHANGED',
      "metadata" = CASE
        WHEN "metadata" ? 'status' AND NOT ("metadata" ? 'newStatus')
          THEN jsonb_build_object('newStatus', "metadata"->>'status')
        ELSE "metadata"
      END
  WHERE "eventType" = 'STATUS_CHANGE';
