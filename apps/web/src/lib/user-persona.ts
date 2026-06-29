import {
  DEFAULT_LIFE_PREFERENCES,
  type LifeBelief,
  type LifeContextState,
  type LifePreference,
} from "@forward/shared";

export interface UserPersona {
  beliefs: LifeBelief[];
  preferences: LifePreference;
}

export function parseUserPersona(input: {
  beliefs?: string | null;
  preferences?: string | null;
}): UserPersona {
  let beliefs: LifeBelief[] = [];
  let preferences: LifePreference = { ...DEFAULT_LIFE_PREFERENCES };

  try {
    if (input.beliefs) beliefs = JSON.parse(input.beliefs);
  } catch {
    /* defaults */
  }
  try {
    if (input.preferences) preferences = { ...DEFAULT_LIFE_PREFERENCES, ...JSON.parse(input.preferences) };
  } catch {
    /* defaults */
  }

  return { beliefs, preferences };
}

export function hasBelief(persona: UserPersona, id: string): boolean {
  return persona.beliefs.some((b) => b.id === id);
}

export function beliefLabels(persona: UserPersona, limit = 3): string[] {
  return persona.beliefs.slice(0, limit).map((b) => b.label);
}

export function estimateTaskMinutes(preferences: LifePreference): number {
  if (preferences.taskLength === "short") return 15;
  if (preferences.taskLength === "long") return 45;
  return 25;
}

type CoachingModule = "money" | "health" | "learning" | "career" | "relationships";

export function beliefCoachingHook(persona: UserPersona, module: CoachingModule): string | null {
  if (module === "money") {
    if (hasBelief(persona, "financial_freedom")) {
      return "Every step here moves you toward financial freedom.";
    }
    if (hasBelief(persona, "retire_55")) {
      return "Small savings habits today buy you years earlier at 55.";
    }
    if (hasBelief(persona, "dream_italy")) {
      return "Redirect one dining night — Italy fund grows quietly.";
    }
    if (hasBelief(persona, "family_first")) {
      return "Protect family time while tightening money leaks.";
    }
  }

  if (module === "health") {
    if (hasBelief(persona, "health_matters")) {
      return "You said health matters — this week proves it to yourself.";
    }
    if (hasBelief(persona, "family_first")) {
      return "Energy for your family starts with one consistent habit.";
    }
    if (hasBelief(persona, "night_owl")) {
      return "Built for your rhythm — no 5am guilt required.";
    }
  }

  if (module === "learning") {
    if (hasBelief(persona, "build_business")) {
      return "Each session is a brick in the business you're building.";
    }
    if (hasBelief(persona, "flexibility_over_salary")) {
      return "Skills compound into the flexibility you value.";
    }
    if (hasBelief(persona, "introvert")) {
      return "Solo deep work — no networking theater required.";
    }
    if (hasBelief(persona, "family_first")) {
      return "Study and social goals still protect what matters most at home.";
    }
  }

  if (module === "career") {
    if (hasBelief(persona, "flexibility_over_salary")) {
      return "Prep for roles that match flexibility, not just title.";
    }
    if (hasBelief(persona, "build_business")) {
      return "Interview skills transfer to pitching investors and customers.";
    }
    if (hasBelief(persona, "introvert")) {
      return "Confidence prep without forcing an extrovert persona.";
    }
    if (hasBelief(persona, "family_first")) {
      return "Career moves that protect family time — not grind for grind's sake.";
    }
  }

  if (module === "relationships") {
    if (hasBelief(persona, "family_first")) {
      return "Family first — this week proves it in small daily actions.";
    }
    if (hasBelief(persona, "introvert")) {
      return "One-on-one connection beats big social events — play to your style.";
    }
    if (hasBelief(persona, "give_back")) {
      return "Showing up for others is how you give back consistently.";
    }
  }

  const labels = beliefLabels(persona, 1);
  if (labels.length > 0) {
    return `Aligned with "${labels[0]}" — one day at a time.`;
  }

  return null;
}
