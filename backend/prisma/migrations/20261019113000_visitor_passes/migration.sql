-- CreateEnum
CREATE TYPE "VisitorPassStatus" AS ENUM ('EXPECTED', 'CHECKED_IN', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "VisitorPurpose" AS ENUM ('PERSONAL_VISIT', 'DELIVERY', 'SERVICE');

-- CreateTable
CREATE TABLE "VisitorPass" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "checkedInByUserId" UUID,
    "checkedOutByUserId" UUID,
    "visitorName" VARCHAR(120) NOT NULL,
    "purpose" "VisitorPurpose" NOT NULL,
    "expectedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "VisitorPassStatus" NOT NULL DEFAULT 'EXPECTED',
    "checkedInAt" TIMESTAMPTZ(3),
    "checkedOutAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VisitorPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitorPass_communityId_id_key" ON "VisitorPass"("communityId", "id");

-- CreateIndex
CREATE INDEX "VisitorPass_communityId_expectedAt_idx" ON "VisitorPass"("communityId", "expectedAt");

-- CreateIndex
CREATE INDEX "VisitorPass_createdByMembershipId_expectedAt_idx" ON "VisitorPass"("createdByMembershipId", "expectedAt");

-- CreateIndex
CREATE INDEX "VisitorPass_communityId_status_expectedAt_idx" ON "VisitorPass"("communityId", "status", "expectedAt");

-- AddForeignKey
ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_communityId_unitId_fkey" FOREIGN KEY ("communityId", "unitId") REFERENCES "Unit"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_communityId_createdByMembershipId_fkey" FOREIGN KEY ("communityId", "createdByMembershipId") REFERENCES "CommunityMembership"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_checkedOutByUserId_fkey" FOREIGN KEY ("checkedOutByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
