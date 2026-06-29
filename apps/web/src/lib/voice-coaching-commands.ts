import type { VoiceCaptureAppliedAction, VoiceCoachingCommand } from "@forward/shared";
import { VOICE_COACHING_COMMAND_LABELS, VOICE_COACHING_HREF } from "@forward/shared";
import { detectVoiceCoachingCommands } from "@forward/ai";
import {
  buildCareerImprovementStack,
  buildHealthImprovementStack,
  buildLearningImprovementStack,
  buildMoneyImprovementStack,
  buildRelationshipsImprovementStack,
  startCareerCoachingLoop,
  startHealthCoachingLoop,
  startLearningCoachingLoop,
  startMoneyCoachingLoop,
  startRelationshipsCoachingLoop,
} from "./adaptive-coaching";

async function runCommand(
  userId: string,
  command: VoiceCoachingCommand
): Promise<VoiceCaptureAppliedAction | null> {
  switch (command) {
    case "start_career_challenge": {
      const stack = await buildCareerImprovementStack(userId);
      if (!stack.improve) return null;
      const loopId = await startCareerCoachingLoop(userId, stack);
      return {
        type: "coaching",
        label: `Started: ${stack.improve.challengeTitle}`,
        entityId: loopId,
        href: VOICE_COACHING_HREF[command],
      };
    }
    case "start_money_challenge": {
      const stack = await buildMoneyImprovementStack(userId);
      if (!stack.improve) return null;
      const loopId = await startMoneyCoachingLoop(userId, stack);
      return {
        type: "coaching",
        label: `Started: ${stack.improve.challengeTitle}`,
        entityId: loopId,
        href: VOICE_COACHING_HREF[command],
      };
    }
    case "start_health_challenge": {
      const stack = await buildHealthImprovementStack(userId);
      if (!stack.improve) return null;
      const loopId = await startHealthCoachingLoop(userId, stack);
      return {
        type: "coaching",
        label: `Started: ${stack.improve.challengeTitle}`,
        entityId: loopId,
        href: VOICE_COACHING_HREF[command],
      };
    }
    case "start_learning_challenge": {
      const stack = await buildLearningImprovementStack(userId);
      if (!stack.improve) return null;
      const loopId = await startLearningCoachingLoop(userId, stack);
      return {
        type: "coaching",
        label: `Started: ${stack.improve.challengeTitle}`,
        entityId: loopId,
        href: VOICE_COACHING_HREF[command],
      };
    }
    case "start_relationships_challenge": {
      const stack = await buildRelationshipsImprovementStack(userId);
      if (!stack.improve) return null;
      const loopId = await startRelationshipsCoachingLoop(userId, stack);
      return {
        type: "coaching",
        label: `Started: ${stack.improve.challengeTitle}`,
        entityId: loopId,
        href: VOICE_COACHING_HREF[command],
      };
    }
    default:
      return null;
  }
}

export async function applyVoiceCoachingCommands(
  userId: string,
  transcript: string
): Promise<VoiceCaptureAppliedAction[]> {
  const commands = detectVoiceCoachingCommands(transcript);
  if (commands.length === 0) return [];

  const applied: VoiceCaptureAppliedAction[] = [];
  for (const command of commands.slice(0, 2)) {
    const result = await runCommand(userId, command);
    if (result) {
      applied.push(result);
    } else {
      applied.push({
        type: "coaching",
        label: `${VOICE_COACHING_COMMAND_LABELS[command]} — add module data first, then try again`,
        href: VOICE_COACHING_HREF[command],
      });
    }
  }
  return applied;
}
