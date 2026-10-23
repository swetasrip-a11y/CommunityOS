-- CreateEnum
CREATE TYPE "AmenityBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "location" VARCHAR(120),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmenityBooking" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,
    "bookedByMembershipId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AmenityBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmenityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_communityId_id_key" ON "Amenity"("communityId", "id");

-- CreateIndex
CREATE INDEX "Amenity_communityId_isActive_name_idx" ON "Amenity"("communityId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AmenityBooking_communityId_id_key" ON "AmenityBooking"("communityId", "id");

-- CreateIndex
CREATE INDEX "AmenityBooking_communityId_startsAt_idx" ON "AmenityBooking"("communityId", "startsAt");

-- CreateIndex
CREATE INDEX "AmenityBooking_amenityId_status_startsAt_endsAt_idx" ON "AmenityBooking"("amenityId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AmenityBooking_bookedByMembershipId_startsAt_idx" ON "AmenityBooking"("bookedByMembershipId", "startsAt");

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_communityId_amenityId_fkey" FOREIGN KEY ("communityId", "amenityId") REFERENCES "Amenity"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_communityId_bookedByMembershipId_fkey" FOREIGN KEY ("communityId", "bookedByMembershipId") REFERENCES "CommunityMembership"("communityId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
