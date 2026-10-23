-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('ADMINISTRATOR', 'RESIDENT', 'SECURITY_GUARD', 'MAINTENANCE_STAFF');

-- CreateEnum
CREATE TYPE "UnitOccupancyType" AS ENUM ('OWNER', 'TENANT', 'FAMILY_MEMBER', 'OCCUPANT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(20),
    "fullName" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "number" VARCHAR(32) NOT NULL,
    "floor" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMembership" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMembershipRole" (
    "communityId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "role" "CommunityRole" NOT NULL,

    CONSTRAINT "CommunityMembershipRole_pkey" PRIMARY KEY ("communityId","membershipId","role")
);

-- CreateTable
CREATE TABLE "CommunityMembershipUnit" (
    "communityId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "occupancy" "UnitOccupancyType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMembershipUnit_pkey" PRIMARY KEY ("communityId","membershipId","unitId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Block_communityId_idx" ON "Block"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_communityId_id_key" ON "Block"("communityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Block_communityId_code_key" ON "Block"("communityId", "code");

-- CreateIndex
CREATE INDEX "Unit_communityId_idx" ON "Unit"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_communityId_id_key" ON "Unit"("communityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_blockId_number_key" ON "Unit"("blockId", "number");

-- CreateIndex
CREATE INDEX "CommunityMembership_userId_idx" ON "CommunityMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMembership_communityId_id_key" ON "CommunityMembership"("communityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMembership_communityId_userId_key" ON "CommunityMembership"("communityId", "userId");

-- CreateIndex
CREATE INDEX "CommunityMembershipRole_communityId_role_idx" ON "CommunityMembershipRole"("communityId", "role");

-- CreateIndex
CREATE INDEX "CommunityMembershipUnit_communityId_unitId_idx" ON "CommunityMembershipUnit"("communityId", "unitId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_communityId_blockId_fkey" FOREIGN KEY ("communityId", "blockId") REFERENCES "Block"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembershipRole" ADD CONSTRAINT "CommunityMembershipRole_communityId_membershipId_fkey" FOREIGN KEY ("communityId", "membershipId") REFERENCES "CommunityMembership"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembershipUnit" ADD CONSTRAINT "CommunityMembershipUnit_communityId_membershipId_fkey" FOREIGN KEY ("communityId", "membershipId") REFERENCES "CommunityMembership"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembershipUnit" ADD CONSTRAINT "CommunityMembershipUnit_communityId_unitId_fkey" FOREIGN KEY ("communityId", "unitId") REFERENCES "Unit"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
