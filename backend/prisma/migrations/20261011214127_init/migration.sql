-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "subscribedLineIds" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "lastNotifiedWeekendDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WeekendDisruption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineId" TEXT NOT NULL,
    "lineName" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "statusSeverityDescription" TEXT NOT NULL,
    "corridorDescription" TEXT NOT NULL,
    "weekendDate" TEXT NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME NOT NULL,
    "sourceLastUpdated" DATETIME NOT NULL,
    "projectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_email_key" ON "Subscription"("email");

-- CreateIndex
CREATE INDEX "Subscription_email_idx" ON "Subscription"("email");

-- CreateIndex
CREATE INDEX "WeekendDisruption_lineId_idx" ON "WeekendDisruption"("lineId");

-- CreateIndex
CREATE INDEX "WeekendDisruption_weekendDate_idx" ON "WeekendDisruption"("weekendDate");
