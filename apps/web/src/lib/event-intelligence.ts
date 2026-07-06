import type {
  LifeCircleMemberPayload,
  TimelineBlockCoaching,
  TimelineEventType,
  TimelineIntelligenceSection,
  TimelinePrepItem,
} from "@forward/shared";

export type EventIntelligenceContext = {
  lifeCircle: LifeCircleMemberPayload[];
  applications: {
    id: string;
    company: string;
    role: string;
    status: string;
    interviewAt: Date | null;
    prepChecklist: TimelinePrepItem[] | null;
    nextStep: string | null;
  }[];
  healthItems: { title: string; type: string }[];
  gymStreak: number | null;
  gymStreakBehind: boolean;
};

export function classifyCalendarEvent(title: string): {
  lifeArea: import("@forward/shared").LifeArea;
  eventType: TimelineEventType;
} {
  const t = title.toLowerCase();
  if (/interview|screening|recruiter|hiring/i.test(t)) {
    return { lifeArea: "career", eventType: "interview" };
  }
  if (/gym|workout|fitness|\brun\b|yoga|lift/i.test(t)) {
    return { lifeArea: "health", eventType: "gym" };
  }
  if (/doctor|dentist|therapy|medical|checkup|physio/i.test(t)) {
    return { lifeArea: "health", eventType: "doctor" };
  }
  if (/lunch|dinner|breakfast|brunch|coffee|meal/i.test(t)) {
    return { lifeArea: "relationships", eventType: "lunch" };
  }
  if (/birthday|anniversary/i.test(t)) {
    return { lifeArea: "relationships", eventType: "birthday" };
  }
  if (/vacation|flight|trip|travel|airport|pto/i.test(t)) {
    return { lifeArea: "home", eventType: "travel" };
  }
  if (/review|1:1|standup|meeting|sync|call|presentation/i.test(t)) {
    return { lifeArea: "career", eventType: "meeting" };
  }
  if (/budget|bank|invest|tax|finance/i.test(t)) {
    return { lifeArea: "money", eventType: "generic" };
  }
  if (/learn|class|course|study|workshop/i.test(t)) {
    return { lifeArea: "learning", eventType: "generic" };
  }
  return { lifeArea: "career", eventType: "generic" };
}

function parsePrepChecklist(raw: string | null | undefined): TimelinePrepItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Array<{ label?: string; done?: boolean }>;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((p) => p.label)
      .map((p) => ({ label: p.label!, done: Boolean(p.done) }));
  } catch {
    return null;
  }
}

export function parseApplicationPrep(raw: string | null | undefined): TimelinePrepItem[] | null {
  return parsePrepChecklist(raw);
}

function extractPersonName(title: string): string | null {
  const withMatch = title.match(/\bwith\s+([A-Za-z][A-Za-z\s.'-]{1,30})/i);
  if (withMatch?.[1]) return withMatch[1].trim();

  const oneOnOne = title.match(/\b1:1\s+(?:with\s+)?([A-Za-z][A-Za-z.'-]+)/i);
  if (oneOnOne?.[1]) return oneOnOne[1].trim();

  const callMatch = title.match(/\bcall\s+(?:with\s+)?([A-Za-z][A-Za-z.'-]+)/i);
  if (callMatch?.[1]) return callMatch[1].trim();

  const family = title.match(/\b(mom|dad|mother|father|wife|husband|son|daughter)\b/i);
  if (family?.[1]) return family[1];

  return null;
}

function extractCompanyName(title: string): string | null {
  const atMatch = title.match(/\bat\s+([A-Z][A-Za-z0-9&.\s]{2,40})/);
  if (atMatch?.[1]) return atMatch[1].trim().replace(/\s+(interview|screening)$/i, "");

  const interviewMatch = title.match(/^([A-Z][A-Za-z0-9&.\s]{2,30})\s+interview/i);
  if (interviewMatch?.[1]) return interviewMatch[1].trim();

  return null;
}

function matchLifeCircle(
  person: string | null,
  members: LifeCircleMemberPayload[]
): LifeCircleMemberPayload | null {
  if (!person) return null;
  const needle = person.toLowerCase();
  return (
    members.find((m) => m.displayName.toLowerCase() === needle) ??
    members.find((m) => m.displayName.toLowerCase().startsWith(needle)) ??
    members.find((m) => m.displayName.toLowerCase().includes(needle)) ??
    null
  );
}

function matchApplication(
  title: string,
  start: Date,
  applications: EventIntelligenceContext["applications"]
) {
  const companyHint = extractCompanyName(title)?.toLowerCase();
  const dayMs = 86400000;

  if (companyHint) {
    const byCompany = applications.find((a) => a.company.toLowerCase().includes(companyHint));
    if (byCompany) return byCompany;
  }

  return (
    applications.find((a) => {
      if (!a.interviewAt) return false;
      return Math.abs(a.interviewAt.getTime() - start.getTime()) < dayMs * 2;
    }) ?? null
  );
}

function prepPercentFromItems(items: TimelinePrepItem[] | null | undefined): number {
  if (!items?.length) return 72;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

function buildRelationshipSections(
  title: string,
  members: LifeCircleMemberPayload[]
): TimelineIntelligenceSection[] {
  const person = extractPersonName(title);
  const member = matchLifeCircle(person, members);
  if (!member) return [];

  const rel = member.relationship === "FAMILY" ? "Family" : "Friend";
  return [
    {
      title: "Relationship layer",
      items: [
        `${rel}: ${member.displayName}`,
        "After this event, capture one note in MotiveLife so future briefs get smarter.",
        member.relationship === "FAMILY"
          ? "Ask about something personal — health, plans, or a recent win."
          : "Mention a shared goal or follow up on your last conversation.",
      ],
    },
  ];
}

export function enrichCalendarEventCoaching(
  title: string,
  eventType: TimelineEventType,
  start: Date,
  ctx: EventIntelligenceContext
): TimelineBlockCoaching {
  const sections: TimelineIntelligenceSection[] = [];
  let prepItems: TimelinePrepItem[] | undefined;
  let prepPercent = 60;
  let headline = "Protected time — treat it intentionally.";
  let subline: string | undefined;
  let aiBriefReady = false;
  let scoreImpact = 4;
  let careerApplicationId: string | undefined;

  switch (eventType) {
    case "interview": {
      const app = matchApplication(title, start, ctx.applications);
      const company = app?.company ?? extractCompanyName(title) ?? "the company";
      if (app?.id) careerApplicationId = app.id;
      prepItems =
        app?.prepChecklist ??
        [
          { label: "Review resume & portfolio", done: false },
          { label: "Research company news (5 min)", done: false },
          { label: "Practice 2 likely questions", done: false },
        ];
      prepPercent = prepPercentFromItems(prepItems);
      headline = `Interview at ${company} — preparation ${prepPercent}% ready.`;
      subline = app?.role ? `Role: ${app.role}` : undefined;
      aiBriefReady = true;
      scoreImpact = 4;
      sections.push({
        title: "Career layer",
        items: [
          `Company: ${company}`,
          app?.status ? `Pipeline status: ${app.status.replace(/_/g, " ").toLowerCase()}` : "Add this company in Career to track prep.",
          app?.nextStep ? `Next step: ${app.nextStep}` : "Recommended: 15-minute mock interview",
        ],
      });
      break;
    }
    case "meeting": {
      const isReview = /performance|review|promotion/i.test(title);
      headline = isReview
        ? "Career milestone — lead with wins and growth areas."
        : "Meeting brief — clarify your desired outcome.";
      prepItems = [
        { label: "Review agenda / last notes", done: false },
        { label: "Define your ask or decision", done: false },
      ];
      prepPercent = isReview ? 85 : 70;
      aiBriefReady = isReview;
      scoreImpact = 2;
      sections.push({
        title: "Talking points",
        items: [
          "What changed since you last met?",
          "One win to mention, one blocker to resolve.",
          "Confirm next actions before you leave.",
        ],
      });
      sections.push(...buildRelationshipSections(title, ctx.lifeCircle));
      break;
    }
    case "gym": {
      headline = ctx.gymStreakBehind
        ? "You're behind on workouts — today restores momentum."
        : "Movement protects focus for the rest of your day.";
      subline =
        ctx.gymStreak != null && ctx.gymStreak > 0
          ? `Current streak: ${ctx.gymStreak} day${ctx.gymStreak === 1 ? "" : "s"}.`
          : "AI recommends a moderate session based on your schedule.";
      prepPercent = ctx.gymStreakBehind ? 55 : 80;
      scoreImpact = 5;
      sections.push({
        title: "Workout recommendation",
        items: [
          "20–35 min moderate effort (strength or cardio).",
          "Hydrate before and after.",
          "Log the session to keep your health score climbing.",
        ],
      });
      break;
    }
    case "doctor": {
      headline = "Health appointment — arrive with questions ready.";
      prepItems = [
        { label: "List symptoms & medications", done: false },
        { label: "Insurance / ID ready", done: false },
        { label: "Write 2 questions to ask", done: false },
      ];
      prepPercent = 65;
      scoreImpact = 3;
      const healthNotes =
        ctx.healthItems.length > 0
          ? ctx.healthItems.slice(0, 3).map((h) => h.title)
          : ["Track how you've been feeling this week", "Note sleep and energy patterns"];
      sections.push({ title: "Health notes", items: healthNotes });
      break;
    }
    case "lunch": {
      headline = "AI suggestion: 15-minute walk afterwards.";
      subline = "Light movement after eating supports afternoon focus.";
      prepPercent = 90;
      scoreImpact = 2;
      sections.push(...buildRelationshipSections(title, ctx.lifeCircle));
      if (sections.length === 0) {
        sections.push({
          title: "Social energy",
          items: ["Protect the conversation — phone on silent.", "Walk after if you can (+Health)."],
        });
      }
      break;
    }
    case "birthday": {
      headline = "Celebration on your calendar — plan ahead.";
      prepPercent = 75;
      scoreImpact = 2;
      sections.push({
        title: "Gift & reminder",
        items: [
          "Set a reminder to message or call.",
          "Consider a small gift or shared experience.",
          extractPersonName(title)
            ? `Check Life Circle for notes about ${extractPersonName(title)}.`
            : "Add them to Life Circle for smarter future prompts.",
        ],
      });
      sections.push(...buildRelationshipSections(title, ctx.lifeCircle));
      break;
    }
    case "travel": {
      headline = "Trip coming up — reduce last-minute friction.";
      prepItems = [
        { label: "Confirm flights / lodging", done: false },
        { label: "Packing list started", done: false },
        { label: "Out-of-office message drafted", done: false },
      ];
      prepPercent = 50;
      scoreImpact = 2;
      sections.push({
        title: "Travel checklist",
        items: ["Weather check for destination", "Chargers, meds, ID", "Budget buffer for surprises"],
      });
      break;
    }
    default:
      scoreImpact = 3;
      prepPercent = 60;
  }

  return {
    headline,
    subline,
    prepItems,
    aiBriefReady,
    scoreImpact,
    eventType,
    careerApplicationId,
    careerHref: careerApplicationId ? `/career?app=${careerApplicationId}` : undefined,
    intelligence: {
      prepPercent,
      confidenceLabel:
        eventType === "interview" ? `${prepPercent}% prepared` : undefined,
      sections,
    },
  };
}
