-- CreateEnum
CREATE TYPE "ServiceRequestCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'CLEANING', 'SECURITY', 'GENERAL');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" "ServiceRequestCategory" NOT NULL,
    "description" VARCHAR(1000),
    "location" VARCHAR(160) NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_communityId_createdAt_idx" ON "ServiceRequest"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_createdByMembershipId_createdAt_idx" ON "ServiceRequest"("createdByMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_communityId_status_createdAt_idx" ON "ServiceRequest"("communityId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_communityId_createdByMembershipId_fkey" FOREIGN KEY ("communityId", "createdByMembershipId") REFERENCES "CommunityMembership"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
