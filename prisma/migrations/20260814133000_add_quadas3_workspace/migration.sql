CREATE TABLE "Quadas3Workspace" (
    "reviewId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "Quadas3Workspace_pkey" PRIMARY KEY ("reviewId")
);

ALTER TABLE "Quadas3Workspace"
ADD CONSTRAINT "Quadas3Workspace_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "Review"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
