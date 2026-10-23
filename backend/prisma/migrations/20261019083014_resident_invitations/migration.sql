-- CreateTable
CREATE TABLE "CommunityInvitation" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "redeemedByUserId" UUID,
    "codeHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "redeemedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvitation_codeHash_key" ON "CommunityInvitation"("codeHash");

-- CreateIndex
CREATE INDEX "CommunityInvitation_communityId_createdAt_idx" ON "CommunityInvitation"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityInvitation_unitId_idx" ON "CommunityInvitation"("unitId");

-- AddForeignKey
ALTER TABLE "CommunityInvitation" ADD CONSTRAINT "CommunityInvitation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvitation" ADD CONSTRAINT "CommunityInvitation_communityId_unitId_fkey" FOREIGN KEY ("communityId", "unitId") REFERENCES "Unit"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvitation" ADD CONSTRAINT "CommunityInvitation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvitation" ADD CONSTRAINT "CommunityInvitation_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
