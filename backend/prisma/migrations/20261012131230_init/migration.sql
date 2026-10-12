-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "lastNotifiedWeekendDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SubscriptionLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    CONSTRAINT "SubscriptionLine_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "Subscription_unsubscribeToken_key" ON "Subscription"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "SubscriptionLine_lineId_idx" ON "SubscriptionLine"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionLine_subscriptionId_lineId_key" ON "SubscriptionLine"("subscriptionId", "lineId");

-- CreateIndex
CREATE INDEX "WeekendDisruption_lineId_idx" ON "WeekendDisruption"("lineId");

-- CreateIndex
CREATE INDEX "WeekendDisruption_weekendDate_idx" ON "WeekendDisruption"("weekendDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeekendDisruption_lineId_weekendDate_corridorDescription_key" ON "WeekendDisruption"("lineId", "weekendDate", "corridorDescription");
