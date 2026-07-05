import { prisma } from "@forward/database";
import { getStripe } from "@/lib/stripe";
import { getGeminiPlatformStatus, GEMINI_RATE_LIMITS_URL, GEMINI_USAGE_URL } from "@/lib/gemini-status";
import { isOpenAiEnabled } from "@/lib/openai-config";

export type PlatformCheck = { ok: boolean; label: string; detail?: string };

export type PlatformCard = {
  id: string;
  name: string;
  status: "healthy" | "warn" | "error" | "unknown";
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  checklist: PlatformCheck[];
  dashboardUrl: string | null;
  billingUrl: string | null;
};

function sanitizeSupabaseRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  if (!/^[a-z0-9]{8,32}$/i.test(cleaned)) return null;
  return cleaned;
}

function parseSupabaseProjectRef(): string | null {
  const explicit = sanitizeSupabaseRef(process.env.SUPABASE_PROJECT_REF);
  if (explicit) return explicit;

  const url = process.env.DATABASE_URL?.trim() ?? process.env.DIRECT_URL?.trim() ?? "";
  const poolerMatch = url.match(/postgres\.([a-z0-9]+):/i);
  if (poolerMatch?.[1]) return sanitizeSupabaseRef(poolerMatch[1]);

  const directMatch = url.match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (directMatch?.[1]) return sanitizeSupabaseRef(directMatch[1]);

  return null;
}

async function stripeCard(): Promise<PlatformCard> {
  const stripe = getStripe();
  const checklist: PlatformCheck[] = [];
  let metrics: Array<{ label: string; value: string }> = [];
  let status: PlatformCard["status"] = "unknown";
  let summary = "Not configured";

  if (!stripe) {
    return {
      id: "stripe",
      name: "Stripe",
      status: "error",
      summary: "STRIPE_SECRET_KEY missing",
      metrics: [],
      checklist: [{ ok: false, label: "STRIPE_SECRET_KEY set" }],
      dashboardUrl: "https://dashboard.stripe.com",
      billingUrl: "https://dashboard.stripe.com/settings/billing",
    };
  }

  try {
    const mode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test";
    const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
    const trialing = await stripe.subscriptions.list({ status: "trialing", limit: 100 });
    const balance = await stripe.balance.retrieve().catch(() => null);

    metrics = [
      { label: "Mode", value: mode },
      { label: "Active subs", value: String(subs.data.length) },
      { label: "Trialing", value: String(trialing.data.length) },
    ];
    const b = balance?.available?.[0];
    metrics.push({
      label: "Balance",
      value: b
        ? `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`
        : "0.00 (none pending payout)",
    });

    checklist.push({ ok: true, label: "API connection OK" });
    checklist.push({
      ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
      label: "Webhook secret set",
    });
    status = "healthy";
    summary = `${subs.data.length} active · ${mode} mode`;
  } catch (e) {
    status = "error";
    summary = e instanceof Error ? e.message.slice(0, 80) : "Stripe API error";
    checklist.push({ ok: false, label: "API connection", detail: summary });
  }

  return {
    id: "stripe",
    name: "Stripe",
    status,
    summary,
    metrics,
    checklist,
    dashboardUrl: "https://dashboard.stripe.com",
    billingUrl: "https://dashboard.stripe.com/settings/billing",
  };
}

async function supabaseCard(): Promise<PlatformCard> {
  const ref = parseSupabaseProjectRef();
  const checklist: PlatformCheck[] = [];
  let status: PlatformCard["status"] = "unknown";
  let summary = ref ? `Project ${ref}` : "DATABASE_URL not parsed";

  try {
    await prisma.$queryRaw`SELECT 1`;
    checklist.push({ ok: true, label: "Database reachable" });
    status = "healthy";
    summary = ref ? `Connected · ${ref}` : "Connected";
  } catch (e) {
    status = "error";
    summary = e instanceof Error ? e.message.slice(0, 80) : "DB error";
    checklist.push({ ok: false, label: "Database reachable", detail: summary });
  }

  checklist.push({
    ok: Boolean(ref),
    label: "Project ref detected",
    detail: ref ?? "Set SUPABASE_PROJECT_REF or use standard Supabase DATABASE_URL",
  });

  const dashboardUrl = ref
    ? `https://supabase.com/dashboard/project/${ref}`
    : "https://supabase.com/dashboard/projects";
  const billingUrl = "https://supabase.com/dashboard/account/billing";

  let userCount = "—";
  try {
    userCount = String(await prisma.user.count());
  } catch {
    /* ignore */
  }

  return {
    id: "supabase",
    name: "Supabase",
    status,
    summary,
    metrics: [
      { label: "Project", value: ref ?? "—" },
      { label: "Users", value: userCount },
    ],
    checklist,
    dashboardUrl,
    billingUrl,
  };
}

async function vercelCard(): Promise<PlatformCard> {
  const token = process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? process.env.VERCEL_URL;

  const checklist: PlatformCheck[] = [
    { ok: Boolean(token), label: "VERCEL_TOKEN set (optional — enables live deploy status)" },
    { ok: Boolean(projectId), label: "VERCEL_PROJECT_ID set" },
    { ok: Boolean(appUrl?.startsWith("https://")), label: "Production HTTPS URL configured" },
  ];

  let status: PlatformCard["status"] = appUrl ? "healthy" : "warn";
  let summary = appUrl ?? "Running on Vercel";
  const metrics: Array<{ label: string; value: string }> = [
    { label: "App URL", value: appUrl ?? "—" },
    { label: "Env", value: process.env.VERCEL_ENV ?? "local" },
  ];

  let dashboardUrl = "https://vercel.com/dashboard";

  if (token && projectId) {
    try {
      const projectQs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
      const projectRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}${projectQs}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      });
      if (projectRes.ok) {
        const project = (await projectRes.json()) as { name?: string; link?: { project?: string } };
        if (project.link?.project) {
          dashboardUrl = project.link.project;
        } else if (project.name) {
          dashboardUrl = `https://vercel.com/dashboard/${encodeURIComponent(project.name)}`;
        }
      }

      const qs = new URLSearchParams({ projectId, limit: "1" });
      if (teamId) qs.set("teamId", teamId);
      const res = await fetch(`https://api.vercel.com/v6/deployments?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          deployments?: Array<{ url?: string; state?: string; createdAt?: number }>;
        };
        const dep = data.deployments?.[0];
        if (dep) {
          metrics.push({ label: "Latest deploy", value: dep.state ?? "—" });
          summary = `${dep.state ?? "unknown"} · ${dep.url ?? projectId}`;
          status = dep.state === "READY" ? "healthy" : dep.state === "ERROR" ? "error" : "warn";
          checklist.push({ ok: dep.state === "READY", label: `Last deployment: ${dep.state}` });
        }
      } else {
        checklist.push({ ok: false, label: "Vercel API", detail: `HTTP ${res.status}` });
        status = "warn";
      }
    } catch (e) {
      checklist.push({
        ok: false,
        label: "Vercel API",
        detail: e instanceof Error ? e.message.slice(0, 60) : "Failed",
      });
      status = "warn";
    }
  }

  return {
    id: "vercel",
    name: "Vercel",
    status,
    summary,
    metrics,
    checklist,
    dashboardUrl,
    billingUrl: "https://vercel.com/account/billing",
  };
}

function resendCard(): PlatformCard {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return {
    id: "resend",
    name: "Resend (email)",
    status: key ? "healthy" : "warn",
    summary: key ? "API key configured" : "RESEND_API_KEY not set",
    metrics: [{ label: "From", value: from ?? "—" }],
    checklist: [
      { ok: Boolean(key), label: "RESEND_API_KEY set" },
      { ok: Boolean(from), label: "EMAIL_FROM set" },
    ],
    dashboardUrl: "https://resend.com/emails",
    billingUrl: "https://resend.com/settings/billing",
  };
}

function aiCard(): PlatformCard {
  const worker = process.env.GEMINI_BROWSER_WORKER_URL?.trim();
  const openai = isOpenAiEnabled();
  const replicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());

  return {
    id: "ai",
    name: "Other AI",
    status: openai || worker || replicate ? "healthy" : "unknown",
    summary: openai ? "OpenAI configured" : worker ? "Browser worker configured" : "Optional backends",
    metrics: [
      { label: "OpenAI", value: openai ? "on" : "off" },
      { label: "Gemini worker", value: worker ? "on" : "off" },
      { label: "Replicate video", value: replicate ? "on" : "off" },
    ],
    checklist: [
      { ok: openai, label: "OPENAI_API_KEY (copy + optional images)" },
      { ok: Boolean(worker), label: "GEMINI_BROWSER_WORKER_URL (local Playwright)" },
      { ok: replicate, label: "REPLICATE_API_TOKEN (narrated video)" },
    ],
    dashboardUrl: "https://platform.openai.com/settings/organization/billing",
    billingUrl: "https://platform.openai.com/settings/organization/billing",
  };
}

async function googleAiCard(): Promise<PlatformCard> {
  const gemini = await getGeminiPlatformStatus();

  return {
    id: "google-ai",
    name: "Google AI (Gemini)",
    status: !gemini.configured ? "warn" : gemini.apiOk ? "healthy" : "error",
    summary: gemini.summary,
    metrics: gemini.metrics,
    checklist: gemini.checklist,
    dashboardUrl: GEMINI_USAGE_URL,
    billingUrl: GEMINI_RATE_LIMITS_URL,
  };
}

export async function getPlatformMonitorSnapshot() {
  const [stripe, supabase, vercel, googleAi] = await Promise.all([
    stripeCard(),
    supabaseCard(),
    vercelCard(),
    googleAiCard(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    platforms: [stripe, supabase, vercel, googleAi, resendCard(), aiCard()],
  };
}

export type PlatformMonitorSnapshot = Awaited<ReturnType<typeof getPlatformMonitorSnapshot>>;
