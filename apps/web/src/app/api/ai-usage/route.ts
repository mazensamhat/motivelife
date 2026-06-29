import { getSession } from "@/lib/session";
import { getAiUsageSummary } from "@/lib/ai-usage";
import { getSubscriptionTier } from "@/lib/subscription";
import { json, unauthorized, serverError } from "@/lib/api";
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const [usage, tier] = await Promise.all([
      getAiUsageSummary(session.id),
      getSubscriptionTier(session.id),
    ]);

    return json({ usage, tier });
  } catch (error) {
    console.error("[api/ai-usage]", error);
    return serverError("AI usage unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}
