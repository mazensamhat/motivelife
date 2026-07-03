/** Stable beliefs — who the user is, not what they did today */
export const LIFE_BELIEF_PRESETS = [
    { id: "family_first", label: "Family first" },
    { id: "health_matters", label: "Health matters" },
    { id: "financial_freedom", label: "Wants financial freedom" },
    { id: "dream_italy", label: "Dreams of moving to Italy" },
    { id: "retire_55", label: "Wants to retire at 55" },
    { id: "flexibility_over_salary", label: "Values flexibility over salary" },
    { id: "introvert", label: "Introvert" },
    { id: "night_owl", label: "Night owl" },
    { id: "build_business", label: "Wants to build a business" },
    { id: "give_back", label: "Wants to give back" },
];
export const DEFAULT_LIFE_PREFERENCES = {
    reminderStyle: "gentle",
    taskLength: "short",
    peakHours: "morning",
    encouragement: true,
    humor: false,
    notifications: "normal",
};
export const LIFE_CONTEXTS = [
    { id: "student", label: "Student", emoji: "🎓" },
    { id: "vacation", label: "Vacation", emoji: "✈️" },
    { id: "new_parent", label: "New Parent", emoji: "👶" },
    { id: "buying_house", label: "Buying a House", emoji: "🏠" },
    { id: "wedding", label: "Wedding", emoji: "💍" },
    { id: "unemployed", label: "Job Search", emoji: "💼" },
    { id: "promotion", label: "Promotion", emoji: "📈" },
    { id: "retirement", label: "Retirement", emoji: "🌅" },
    { id: "starting_business", label: "Starting Business", emoji: "🚀" },
    { id: "moving", label: "Moving", emoji: "📦" },
    { id: "interview", label: "Interview Tomorrow", emoji: "🎯" },
];
/** When a life context is active, these modules float to the top of Today. */
export const CONTEXT_MODULE_PRIORITIES = {
    interview: ["career", "learning", "habits", "health", "money"],
    unemployed: ["career", "learning", "money", "habits", "goals"],
    buying_house: ["money", "career", "goals", "habits", "health"],
    vacation: ["travel", "money", "health", "relationships", "habits"],
    new_parent: ["health", "relationships", "habits", "money", "mindset"],
    wedding: ["money", "relationships", "goals", "health", "career"],
    student: ["learning", "career", "money", "habits", "goals"],
    promotion: ["career", "learning", "health", "relationships", "money"],
    retirement: ["money", "health", "relationships", "habits", "travel"],
    starting_business: ["career", "money", "learning", "goals", "habits"],
    moving: ["money", "health", "relationships", "career", "habits"],
};
export const LIFE_CIRCLE_RELATIONSHIPS = ["FRIEND", "FAMILY"];
export const MAX_LIFE_CIRCLE_MEMBERS = 5;
export const REFERRAL_BONUS_VOICE_UNITS = 5;
