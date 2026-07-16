-- Ops cost ledger (MotiveLife Admin → Operating costs)
-- Run in Supabase → SQL Editor against the SAME project as Vercel DATABASE_URL.
-- Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "OpsCostBrand" AS ENUM (
    'motivelife', 'motivefx', 'motiveiq', 'motivepulse', 'shared'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpsCostCategory" AS ENUM (
    'openai', 'vercel', 'vercel_blob', 'supabase', 'stripe_fees',
    'resend', 'twilio', 'google_ai', 'replicate', 'serper', 'xai',
    'cloudflare', 'buffer', 'zernio',
    'marketing_ads', 'marketing_boosts',
    'youtube_boost', 'instagram_boost', 'facebook_boost', 'linkedin_boost', 'tiktok_boost',
    'marketing_scm', 'marketing_sco',
    'revenuecat', 'apple_store', 'google_play', 'eas',
    'domains', 'network', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'vercel_blob';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'twilio';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'google_ai';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'replicate';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'serper';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'xai';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'cloudflare';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'buffer';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'zernio';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'youtube_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'instagram_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'facebook_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'linkedin_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'tiktok_boost';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'marketing_scm';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'marketing_sco';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'revenuecat';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'apple_store';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'google_play';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'eas';
ALTER TYPE "OpsCostCategory" ADD VALUE IF NOT EXISTS 'domains';

DO $$ BEGIN
  CREATE TYPE "OpsCostSource" AS ENUM (
    'auto_openai',
    'auto_openai_org',
    'auto_stripe',
    'auto_resend',
    'auto_meta_ads',
    'auto_twilio',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "OpsCostSource" ADD VALUE IF NOT EXISTS 'auto_openai_org';
ALTER TYPE "OpsCostSource" ADD VALUE IF NOT EXISTS 'auto_resend';
ALTER TYPE "OpsCostSource" ADD VALUE IF NOT EXISTS 'auto_meta_ads';
ALTER TYPE "OpsCostSource" ADD VALUE IF NOT EXISTS 'auto_twilio';

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
