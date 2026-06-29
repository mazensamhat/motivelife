import type { VoicePracticeMode, VoicePracticeScores, VoicePracticeTip } from "@forward/shared";

export { VOICE_PRACTICE_PROMPTS, pickPracticePrompt } from "@forward/shared";
const FILLER_RE =
  /\b(um+|uh+|er+|ah+|hm+|like|you know|sort of|kind of|basically|actually|literally|i mean)\b/gi;

const HEDGE_RE =
  /\b(maybe|perhaps|i think|i guess|somewhat|probably|kind of|sort of|might|could be)\b/gi;

const STRONG_RE =
  /\b(i led|i built|i delivered|i achieved|i increased|i reduced|my result|i'm confident|we grew|i saved)\b/gi;

const STRUCTURE_RE = /\b(first|second|third|finally|because|therefore|as a result|for example)\b/gi;

const WARM_RE =
  /\b(thank|appreciate|grateful|mean(s)? a lot|care about|value|understand|hear you|I feel|I noticed)\b/gi;

const BLAME_RE = /\b(you always|you never|you should|your fault|why don't you)\b/gi;

function isRelationshipMode(mode: VoicePracticeMode) {
  return mode === "date_intro" || mode === "difficult_talk" || mode === "reconnection" || mode === "appreciation";
}

function isLeadershipMode(mode: VoicePracticeMode) {
  return (
    mode === "parenting_moment" ||
    mode === "team_feedback" ||
    mode === "hard_decision" ||
    mode === "motivate_team"
  );
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function countMatches(text: string, re: RegExp) {
  return (text.match(re) ?? []).length;
}

export function scoreVoicePractice(
  transcript: string,
  mode: VoicePracticeMode,
  durationSeconds: number
): { scores: VoicePracticeScores; tips: VoicePracticeTip[]; coachNote: string } {
  const text = transcript.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const duration = Math.max(durationSeconds, Math.ceil(wordCount / 2.5));
  const wpm = wordCount / (duration / 60);

  const fillerWords = countMatches(text, FILLER_RE);
  const fillerRate = wordCount > 0 ? (fillerWords / wordCount) * 100 : 0;

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 4);
  const avgSentenceLen =
    sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length : wordCount;

  let confidence = 68;
  confidence += countMatches(text, STRONG_RE) * 4;
  confidence -= countMatches(text, HEDGE_RE) * 3;
  if (wordCount >= 80) confidence += 8;
  else if (wordCount >= 45) confidence += 4;
  else if (wordCount < 25) confidence -= 12;
  if (mode === "negotiation" && /\b(value|impact|delivered|results|metrics|\d+%)\b/i.test(text)) confidence += 6;
  if (isRelationshipMode(mode)) {
    confidence += countMatches(text, WARM_RE) * 3;
    confidence -= countMatches(text, BLAME_RE) * 8;
    if (mode === "date_intro" && /\?\s*$/.test(text)) confidence += 5;
    if (mode === "appreciation" && /\b(when you|because you|the way you)\b/i.test(text)) confidence += 6;
  }
  if (isLeadershipMode(mode)) {
    confidence += countMatches(text, WARM_RE) * 2;
    confidence -= countMatches(text, BLAME_RE) * 10;
    if (mode === "parenting_moment" && /\b(i see|i understand|let's|together|calm)\b/i.test(text)) confidence += 8;
    if (mode === "team_feedback" && /\b(specific|next time|i noticed|here's what)\b/i.test(text)) confidence += 7;
    if (mode === "hard_decision" && /\b(because|decision|moving forward|priorit)\b/i.test(text)) confidence += 5;
    if (mode === "motivate_team" && /\b(we|us|together|next|learned)\b/i.test(text)) confidence += 6;
  }

  let clarity = 70;
  if (avgSentenceLen >= 10 && avgSentenceLen <= 22) clarity += 10;
  else if (avgSentenceLen > 32) clarity -= 12;
  else if (avgSentenceLen < 6 && wordCount > 20) clarity -= 8;
  clarity += countMatches(text, STRUCTURE_RE) * 3;
  if (sentences.length >= 3) clarity += 5;

  let energy = 65;
  if (wpm >= 115 && wpm <= 165) energy += 12;
  else if (wpm < 90) energy -= 10;
  else if (wpm > 185) energy -= 8;
  energy += countMatches(text, /\b(excited|proud|passion|love|drive|momentum)\b/gi) * 3;
  if (isRelationshipMode(mode)) {
    energy += countMatches(text, WARM_RE) * 2;
    if (wpm >= 100 && wpm <= 150) energy += 6;
  }
  if (isLeadershipMode(mode)) {
    if (wpm >= 95 && wpm <= 145) energy += 8;
    else if (wpm > 170) energy -= 6;
    energy += countMatches(text, /\b(clear|steady|focus|trust|support)\b/gi) * 2;
  }
  if (/\d+/.test(text)) energy += 4;

  confidence -= Math.min(20, fillerRate * 1.2);
  clarity -= Math.min(15, fillerRate * 0.8);

  confidence = clamp(confidence);
  clarity = clamp(clarity);
  energy = clamp(energy);

  const overall = clamp(confidence * 0.4 + clarity * 0.35 + energy * 0.25);

  const tips: VoicePracticeTip[] = [];
  if (fillerRate > 4) {
    tips.push({
      category: "fillers",
      text: `You used about ${fillerWords} filler phrase${fillerWords === 1 ? "" : "s"}. Pause instead of "um" or "like" — silence reads as confidence.`,
    });
  }
  if (confidence < 72) {
    tips.push({
      category: "confidence",
      text: isRelationshipMode(mode)
        ? "Speak from your perspective — \"I feel\" and \"I noticed\" land better than blame or advice."
        : "Lead with a concrete result, then explain how you got there. Drop hedging words like \"I think\" or \"maybe.\"",
    });
  }
  if (clarity < 72) {
    tips.push({
      category: "clarity",
      text: "Use a simple arc: situation → action → result. One idea per sentence.",
    });
  }
  if (energy < 68 || wpm < 100) {
    tips.push({
      category: "energy",
      text: "Pick up the pace slightly and emphasize your strongest metric or outcome at the end.",
    });
  }
  if (mode === "presentation" && !STRUCTURE_RE.test(text)) {
    tips.push({
      category: "structure",
      text: "Open with the headline, then support with one proof point — audiences remember the first and last lines.",
    });
  }
  if (mode === "difficult_talk" && BLAME_RE.test(text)) {
    tips.push({
      category: "warmth",
      text: "Swap \"you always\" for \"I feel when…\" — same truth, less defensiveness.",
    });
  }
  if (mode === "date_intro" && !/\?/.test(text)) {
    tips.push({
      category: "warmth",
      text: "End with one genuine question — curiosity beats a monologue on a date.",
    });
  }
  if (mode === "appreciation" && !/\b(when you|because you|the way you)\b/i.test(text)) {
    tips.push({
      category: "warmth",
      text: "Name one specific thing they did — generic thanks fade; specifics stick.",
    });
  }
  if (mode === "parenting_moment" && BLAME_RE.test(text)) {
    tips.push({
      category: "warmth",
      text: "Kids respond to calm certainty — describe the feeling, then the boundary.",
    });
  }
  if (mode === "team_feedback" && !/\b(next time|specific|i noticed)\b/i.test(text)) {
    tips.push({
      category: "structure",
      text: "Use observation → impact → request: \"When X happened, it affected Y — next time, Z.\"",
    });
  }
  if (mode === "motivate_team" && !/\b(we|learned|next)\b/i.test(text)) {
    tips.push({
      category: "energy",
      text: "Anchor on collective forward motion — what we learned and what we do next.",
    });
  }
  if (tips.length === 0) {
    tips.push({
      category: "confidence",
      text: "Strong take. Run it again and trim 10% of the words for an even sharper delivery.",
    });
  }

  let coachNote = `Overall ${overall}/100 — `;
  if (isRelationshipMode(mode)) {
    if (overall >= 82) coachNote += "warm, clear, and ready to say out loud.";
    else if (overall >= 70) coachNote += "good heart — tighten wording and cut fillers for the real conversation.";
    else coachNote += "start with one honest feeling, one specific detail, then pause.";
  } else if (isLeadershipMode(mode)) {
    if (overall >= 82) coachNote += "steady leadership voice — clear, human, and actionable.";
    else if (overall >= 70) coachNote += "solid tone — slow down and land one concrete next step.";
    else coachNote += "lead with empathy, name the reality, then one clear path forward.";
  } else if (overall >= 82) coachNote += "polished delivery. You're interview-ready on this prompt.";
  else if (overall >= 70) coachNote += "solid foundation. One more rep focusing on fillers will level you up.";
  else coachNote += "good start. Slow down, structure your answer, and lead with your strongest result.";

  return {
    scores: {
      overall,
      confidence,
      clarity,
      energy,
      fillerWords,
      wordsPerMinute: Math.round(wpm),
      fillerRate: Math.round(fillerRate * 10) / 10,
    },
    tips: tips.slice(0, 3),
    coachNote,
  };
}
