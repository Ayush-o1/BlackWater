-- CreateIndex
CREATE INDEX "Incident_orgId_createdAt_idx" ON "Incident"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Service_orgId_createdAt_idx" ON "Service"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "User_orgId_createdAt_idx" ON "User"("orgId", "createdAt");
