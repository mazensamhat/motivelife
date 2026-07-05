import { prisma } from "@forward/database";
import { getStripe } from "@/lib/stripe";
import { getGoogleAiApiKey } from "@/lib/google-ai-config";
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

function parseSupabaseProjectRef(): string | null {
  const url = process.env.DATABASE_URL?.trim() ?? process.env.DIRECT_URL?.trim() ?? "";
  const match = url.match(/postgres\.([a-z0-9]+):/i);
  return match?.[1] ?? process.env.SUPABASE_PROJECT_REF?.trim() ?? null;
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

  const dashboardUrl = ref ? `https://supabase.com/dashboard/project/${ref}` : "https://supabase.com/dashboard";
  const billingUrl = ref
    ? `https://supabase.com/dashboard/project/${ref}/settings/billing`
    : "https://supabase.com/dashboard/account/billing";

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

  if (token && projectId) {
    try {
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

  const dashTeam = teamId ? `/${teamId}` : "";
  return {
    id: "vercel",
    name: "Vercel",
    status,
    summary,
    metrics,
    checklist,
    dashboardUrl: projectId
      ? `https://vercel.com${dashTeam}/${process.env.VERCEL_PROJECT_NAME ?? ""}/settings`
      : "https://vercel.com/dashboard",
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
  const gemini = getGoogleAiApiKey();
  const openai = isOpenAiEnabled();
  const replicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
  const provider = process.env.MARKETING_IMAGE_PROVIDER?.trim() || "auto";

  return {
    id: "ai",
    name: "AI providers",
    status: gemini || openai ? "healthy" : "warn",
    summary: gemini
      ? `Gemini ready · image mode ${provider}`
      : openai
        ? `OpenAI ready · image mode ${provider}`
        : "No image API — use Browser assist in Marketing Agent",
    metrics: [
      { label: "Gemini", value: gemini ? "on" : "off" },
      { label: "OpenAI", value: openai ? "on" : "off" },
      { label: "Replicate video", value: replicate ? "on" : "off" },
    ],
    checklist: [
      { ok: Boolean(gemini), label: "GOOGLE_AI_API_KEY (marketing images)" },
      { ok: openai, label: "OPENAI_API_KEY (copy + optional images)" },
      { ok: replicate, label: "REPLICATE_API_TOKEN (narrated video)" },
    ],
    dashboardUrl: "https://aistudio.google.com/apikey",
    billingUrl: "https://platform.openai.com/settings/organization/billing",
  };
}

export async function getPlatformMonitorSnapshot() {
  const [stripe, supabase, vercel] = await Promise.all([
    stripeCard(),
    supabaseCard(),
    vercelCard(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    platforms: [stripe, supabase, vercel, resendCard(), aiCard()],
  };
}

export type PlatformMonitorSnapshot = Awaited<ReturnType<typeof getPlatformMonitorSnapshot>>;
