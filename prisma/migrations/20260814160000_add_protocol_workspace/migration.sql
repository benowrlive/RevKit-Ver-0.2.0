CREATE TABLE "ProtocolWorkspace" (
    "reviewId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "ProtocolWorkspace_pkey" PRIMARY KEY ("reviewId")
);

ALTER TABLE "ProtocolWorkspace"
ADD CONSTRAINT "ProtocolWorkspace_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "Review"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
