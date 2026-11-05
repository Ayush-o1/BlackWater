-- OnCallSchedule, OnCallMember and NotificationLog were never used by any code
-- (no routes, services or UI reference them), so they are dropped together with
-- the enums only they used. Earlier migrations that created them are unchanged.

-- DropForeignKey
ALTER TABLE "NotificationLog" DROP CONSTRAINT "NotificationLog_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationLog" DROP CONSTRAINT "NotificationLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "OnCallMember" DROP CONSTRAINT "OnCallMember_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "OnCallMember" DROP CONSTRAINT "OnCallMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "OnCallSchedule" DROP CONSTRAINT "OnCallSchedule_orgId_fkey";

-- DropTable
DROP TABLE "NotificationLog";

-- DropTable
DROP TABLE "OnCallMember";

-- DropTable
DROP TABLE "OnCallSchedule";

-- DropEnum
DROP TYPE "EscalationLevel";

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "NotificationStatus";
