-- CreateTable
CREATE TABLE "DisruptionNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disruptionId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "corridor" TEXT NOT NULL,
    "timeframe" TEXT,
    "busRouteJson" TEXT,
    "detailsJson" TEXT,
    "rawFallback" TEXT,
    CONSTRAINT "DisruptionNotice_disruptionId_fkey" FOREIGN KEY ("disruptionId") REFERENCES "WeekendDisruption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DisruptionNotice_disruptionId_idx" ON "DisruptionNotice"("disruptionId");
