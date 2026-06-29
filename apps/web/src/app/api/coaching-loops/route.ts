import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, premiumRequired } from "@/lib/api";
import { isPremiumUser } from "@/lib/subscription";
import {
  buildCareerImprovementStack,
  buildHealthImprovementStack,
  buildLearningImprovementStack,
  buildMoneyImprovementStack,
  buildRelationshipsImprovementStack,
  getActiveCoachingLoops,
  startCareerCoachingLoop,
  startHealthCoachingLoop,
  startLearningCoachingLoop,
  startMoneyCoachingLoop,
  startRelationshipsCoachingLoop,
} from "@/lib/adaptive-coaching";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const [money, health, learning, career, relationships, loops] = await Promise.all([
    buildMoneyImprovementStack(session.id),
    buildHealthImprovementStack(session.id),
    buildLearningImprovementStack(session.id),
    buildCareerImprovementStack(session.id),
    buildRelationshipsImprovementStack(session.id),
    getActiveCoachingLoops(session.id),
  ]);

  return json({ money, health, learning, career, relationships, loops });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  if (!(await isPremiumUser(session.id))) {
    return premiumRequired("Adaptive coaching loops require MotiveLife Pro.");
  }

  const body = (await request.json()) as { action?: string };

  if (body.action === "start_money_challenge") {
    const stack = await buildMoneyImprovementStack(session.id);
    if (!stack.improve) return badRequest("Add money items first");
    const loopId = await startMoneyCoachingLoop(session.id, stack);
    return json({ loopId });
  }

  if (body.action === "start_health_challenge") {
    const stack = await buildHealthImprovementStack(session.id);
    if (!stack.improve) return badRequest("Add health items or habits first");
    const loopId = await startHealthCoachingLoop(session.id, stack);
    return json({ loopId });
  }

  if (body.action === "start_learning_challenge") {
    const stack = await buildLearningImprovementStack(session.id);
    if (!stack.improve) return badRequest("Add a learning item first");
    const loopId = await startLearningCoachingLoop(session.id, stack);
    return json({ loopId });
  }

  if (body.action === "start_career_challenge") {
    const stack = await buildCareerImprovementStack(session.id);
    if (!stack.improve) return badRequest("Add a career goal or job application first");
    const loopId = await startCareerCoachingLoop(session.id, stack);
    return json({ loopId });
  }

  if (body.action === "start_relationships_challenge") {
    const stack = await buildRelationshipsImprovementStack(session.id);
    if (!stack.improve) return badRequest("Add a connection or relationships goal first");
    const loopId = await startRelationshipsCoachingLoop(session.id, stack);
    return json({ loopId });
  }

  return badRequest("Unknown action");
}
