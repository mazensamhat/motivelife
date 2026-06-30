import { prisma } from "@forward/database";
import { formatCompProExpiry } from "@/lib/comp-access";
import { requireAdmin } from "@/lib/admin";
import { json, serverError, unauthorized, forbidden } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200);

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        proExpiresAt: true,
        disabledAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        createdAt: true,
        lastSeenAt: true,
        _count: { select: { tasks: true, goals: true } },
      },
    });

    return json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.subscriptionPlan,
        status: u.subscriptionStatus,
        trialEndsAt: u.trialEndsAt?.toISOString() ?? null,
        proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
        proAccessLabel:
          u.subscriptionPlan === "plus" && !u.stripeSubscriptionId
            ? formatCompProExpiry(u.proExpiresAt)
            : u.stripeSubscriptionId
              ? "Stripe"
              : null,
        disabled: Boolean(u.disabledAt),
        disabledAt: u.disabledAt?.toISOString() ?? null,
        hasStripe: Boolean(u.stripeCustomerId),
        hasSubscription: Boolean(u.stripeSubscriptionId),
        tasks: u._count.tasks,
        goals: u._count.goals,
        createdAt: u.createdAt.toISOString(),
        lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[admin/users]", error);
    return serverError("Could not load users.");
  }
}
