-- CreateIndex
CREATE INDEX "Incident_orgId_status_idx" ON "Incident"("orgId", "status");

-- CreateIndex
CREATE INDEX "Incident_creatorId_idx" ON "Incident"("creatorId");

-- CreateIndex
CREATE INDEX "Incident_assigneeId_idx" ON "Incident"("assigneeId");

-- CreateIndex
CREATE INDEX "IncidentUpdate_userId_idx" ON "IncidentUpdate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OnCallMember_scheduleId_userId_key" ON "OnCallMember"("scheduleId", "userId");

