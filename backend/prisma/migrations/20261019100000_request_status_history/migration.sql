-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_communityId_id_key" ON "ServiceRequest"("communityId", "id");

-- CreateTable
CREATE TABLE "ServiceRequestStatusUpdate" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "updatedByMembershipId" UUID NOT NULL,
    "previousStatus" "ServiceRequestStatus" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestStatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequestStatusUpdate_communityId_requestId_createdAt_idx" ON "ServiceRequestStatusUpdate"("communityId", "requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceRequestStatusUpdate" ADD CONSTRAINT "ServiceRequestStatusUpdate_communityId_requestId_fkey" FOREIGN KEY ("communityId", "requestId") REFERENCES "ServiceRequest"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestStatusUpdate" ADD CONSTRAINT "ServiceRequestStatusUpdate_communityId_updatedByMembershipId_fkey" FOREIGN KEY ("communityId", "updatedByMembershipId") REFERENCES "CommunityMembership"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
