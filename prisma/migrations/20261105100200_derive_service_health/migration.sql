-- A service's health is now calculated from its open incidents whenever it is
-- read, so the stored copy is removed. Nothing is lost: the value was always
-- derivable, and the stored copy could go stale between an incident change and
-- the recalculation that followed it.

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "status";

-- DropEnum
DROP TYPE "ServiceStatus";
