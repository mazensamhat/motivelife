import { getSession } from "@/lib/session";
import { buildVoiceWeeklyRecap } from "@/lib/voice-weekly-recap";
import { isPremiumUser } from "@/lib/subscription";
import { json, unauthorized, serverError, premiumRequired, startOfWeek, endOfWeek } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!(await isPremiumUser(session.id))) {
      return premiumRequired("Voice weekly recap requires MotiveLife Pro.");
    }

    const recap = await buildVoiceWeeklyRecap(session.id, startOfWeek(), endOfWeek());
    return json({ recap });
  } catch (error) {
    console.error("[api/voice-recap]", error);
    return serverError("Voice recap unavailable.");
  }
}
