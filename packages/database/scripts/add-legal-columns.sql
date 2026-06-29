-- Add legal consent columns (non-destructive table rebuild)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "birthYear" INTEGER,
    "lifeFocuses" TEXT,
    "activeModules" TEXT,
    "moduleOrder" TEXT,
    "lifeDestination" TEXT,
    "lifeDestinationGoalId" TEXT,
    "beliefs" TEXT,
    "preferences" TEXT,
    "activeContext" TEXT,
    "moduleUsage" TEXT,
    "lifeEngineStreak" INTEGER NOT NULL DEFAULT 0,
    "lifeEngineBestStreak" INTEGER NOT NULL DEFAULT 0,
    "lifeEngineLastDone" DATETIME,
    "lifeEngineFreezes" INTEGER NOT NULL DEFAULT 1,
    "accountabilityPartner" TEXT,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'trial',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "trialEndsAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "termsAcceptedAt" DATETIME,
    "privacyAcceptedAt" DATETIME,
    "legalConsentVersion" TEXT,
    "marketingEmailConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingEmailConsentAt" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountabilityPartner", "activeContext", "activeModules", "beliefs", "birthYear", "createdAt", "email", "id", "lifeDestination", "lifeDestinationGoalId", "lifeEngineBestStreak", "lifeEngineFreezes", "lifeEngineLastDone", "lifeEngineStreak", "lifeFocuses", "moduleOrder", "moduleUsage", "name", "passwordHash", "preferences", "stripeCustomerId", "stripeSubscriptionId", "subscriptionPlan", "subscriptionStatus", "trialEndsAt", "updatedAt") SELECT "accountabilityPartner", "activeContext", "activeModules", "beliefs", "birthYear", "createdAt", "email", "id", "lifeDestination", "lifeDestinationGoalId", "lifeEngineBestStreak", "lifeEngineFreezes", "lifeEngineLastDone", "lifeEngineStreak", "lifeFocuses", "moduleOrder", "moduleUsage", "name", "passwordHash", "preferences", "stripeCustomerId", "stripeSubscriptionId", "subscriptionPlan", "subscriptionStatus", "trialEndsAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
