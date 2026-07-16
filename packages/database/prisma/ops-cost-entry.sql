-- Ops cost ledger (MotiveLife Admin → Operating costs)
-- Run in Supabase → SQL Editor against the SAME project as Vercel DATABASE_URL.
-- Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "OpsCostBrand" AS ENUM (
    'motivelife',
    'motivefx',
    'motiveiq',
    'motivepulse',
    'shared'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpsCostCategory" AS ENUM (
    'openai',
    'vercel',
    'supabase',
    'stripe_fees',
    'resend',
    'marketing_ads',
    'marketing_boosts',
    'youtube_boost',
    'instagram_boost',
    'facebook_boost',
    'linkedin_boost',
    'marketing_scm',
    'marketing_sco',
    'network',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- If an earlier push created OpsCostCategory without marketing boost values:
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'youtube_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'instagram_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'facebook_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'linkedin_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'marketing_scm';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'marketing_sco';

DO $$ BEGIN
  CREATE TYPE "OpsCostSource" AS ENUM (
    'auto_openai',
    'auto_stripe',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OpsCostEntry" (
  "id" TEXT NOT NULL,
  "brand" "OpsCostBrand" NOT NULL,
  "category" "OpsCostCategory" NOT NULL,
  "source" "OpsCostSource" NOT NULL,
  "amountCad" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "occurredOn" DATE NOT NULL,
  "vendor" TEXT,
  "description" TEXT,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpsCostEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OpsCostEntry_source_externalId_key"
  ON "OpsCostEntry"("source", "externalId");

CREATE INDEX IF NOT EXISTS "OpsCostEntry_occurredOn_brand_category_idx"
  ON "OpsCostEntry"("occurredOn", "brand", "category");
