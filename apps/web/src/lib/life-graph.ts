import { prisma } from "@forward/database";
import type { GraphNodeType, GraphRelation, LifeGraphPayload } from "@forward/shared";

export async function linkGraphEdge(
  userId: string,
  from: { type: GraphNodeType; id: string },
  to: { type: GraphNodeType; id: string },
  relation: GraphRelation = "LINKED_TO",
  label?: string
) {
  const existing = await prisma.lifeGraphEdge.findFirst({
    where: {
      userId,
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
    },
  });
  if (existing) return existing;

  return prisma.lifeGraphEdge.create({
    data: {
      userId,
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
      relation,
      label,
    },
  });
}

export async function autoLinkGoalToDestination(userId: string, goalId: string, goalTitle: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifeDestination: true, lifeDestinationGoalId: true },
  });

  if (user?.lifeDestinationGoalId === goalId) {
    await linkGraphEdge(
      userId,
      { type: "GOAL", id: goalId },
      { type: "DESTINATION", id: "life-gps" },
      "ENABLES",
      `Progress toward ${user.lifeDestination}`
    );
  }

  if (user?.lifeDestination && goalTitle.toLowerCase().includes(user.lifeDestination.toLowerCase().slice(0, 6))) {
    await linkGraphEdge(
      userId,
      { type: "GOAL", id: goalId },
      { type: "DESTINATION", id: "life-gps" },
      "FUNDS",
      user.lifeDestination
    );
  }
}

export async function autoLinkMoneyToGoal(userId: string, moneyItemId: string, goalId: string | null) {
  if (!goalId) return;
  await linkGraphEdge(
    userId,
    { type: "MONEY_ITEM", id: moneyItemId },
    { type: "GOAL", id: goalId },
    "FUNDS",
    "Savings toward goal"
  );
}

export async function ensureDefaultGraphLinks(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifeDestination: true, lifeDestinationGoalId: true },
  });

  if (user?.lifeDestinationGoalId) {
    await autoLinkGoalToDestination(userId, user.lifeDestinationGoalId, "");
  }

  const savings = await prisma.moneyItem.findFirst({
    where: { userId, type: "SAVINGS" },
    orderBy: { updatedAt: "desc" },
  });

  if (savings && user?.lifeDestinationGoalId) {
    await autoLinkMoneyToGoal(userId, savings.id, user.lifeDestinationGoalId);
  } else if (savings && user?.lifeDestination) {
    await linkGraphEdge(
      userId,
      { type: "MONEY_ITEM", id: savings.id },
      { type: "DESTINATION", id: "life-gps" },
      "FUNDS",
      user.lifeDestination
    );
  }
}

export async function getLifeGraph(userId: string): Promise<LifeGraphPayload> {
  await ensureDefaultGraphLinks(userId);

  const [user, edges, goals, moneyItems] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { lifeDestination: true, lifeDestinationGoalId: true },
    }),
    prisma.lifeGraphEdge.findMany({ where: { userId }, take: 40 }),
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, title: true },
      take: 8,
    }),
    prisma.moneyItem.findMany({
      where: { userId },
      select: { id: true, title: true },
      take: 6,
    }),
  ]);

  const nodeMap = new Map<string, { type: GraphNodeType; id: string; label: string }>();

  if (user?.lifeDestination) {
    nodeMap.set("DESTINATION:life-gps", {
      type: "DESTINATION",
      id: "life-gps",
      label: user.lifeDestination,
    });
  }

  for (const g of goals) {
    nodeMap.set(`GOAL:${g.id}`, { type: "GOAL", id: g.id, label: g.title });
  }
  for (const m of moneyItems) {
    nodeMap.set(`MONEY_ITEM:${m.id}`, { type: "MONEY_ITEM", id: m.id, label: m.title });
  }

  for (const e of edges) {
    if (!nodeMap.has(`${e.fromType}:${e.fromId}`)) {
      nodeMap.set(`${e.fromType}:${e.fromId}`, {
        type: e.fromType as GraphNodeType,
        id: e.fromId,
        label: e.label ?? e.fromId,
      });
    }
    if (!nodeMap.has(`${e.toType}:${e.toId}`)) {
      nodeMap.set(`${e.toType}:${e.toId}`, {
        type: e.toType as GraphNodeType,
        id: e.toId,
        label: e.label ?? e.toId,
      });
    }
  }

  return {
    destination: user?.lifeDestination
      ? { id: "life-gps", label: user.lifeDestination }
      : null,
    nodes: [...nodeMap.values()],
    edges: edges.map((e) => ({
      id: e.id,
      fromType: e.fromType as GraphNodeType,
      fromId: e.fromId,
      toType: e.toType as GraphNodeType,
      toId: e.toId,
      relation: e.relation as GraphRelation,
      label: e.label,
    })),
  };
}

/** User-owned export — trust signal + portability */
export async function exportLifeGraph(userId: string, userName: string | null) {
  const [graph, moments, userRow] = await Promise.all([
    getLifeGraph(userId),
    prisma.lifeMoment.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        domain: true,
        occurredAt: true,
        scoreDelta: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { beliefs: true, preferences: true, lifeDestination: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    app: "motivelife.ai",
    user: { name: userName },
    lifeDestination: userRow?.lifeDestination ?? graph.destination?.label ?? null,
    beliefs: userRow?.beliefs ? JSON.parse(userRow.beliefs) : [],
    preferences: userRow?.preferences ? JSON.parse(userRow.preferences) : null,
    graph,
    lifeMoments: moments.map((m) => ({
      ...m,
      occurredAt: m.occurredAt.toISOString(),
    })),
  };
}
