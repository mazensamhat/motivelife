import type { AppMessageKey } from "@forward/shared";
import type { NavGroup, NavIconKey, NavItem } from "./generation";

const NAV_KEYS: Partial<Record<NavIconKey, { label: AppMessageKey; subtitle?: AppMessageKey }>> = {
  home: { label: "nav.dayo", subtitle: "nav.dayo.sub" },
  life_hub: { label: "nav.lifevue", subtitle: "nav.lifevue.sub" },
  family: { label: "nav.kinzo", subtitle: "nav.kinzo.sub" },
  kashu: { label: "nav.kashu", subtitle: "nav.kashu.sub" },
  money: { label: "nav.kashu", subtitle: "nav.kashu.sub" },
  vitalu: { label: "nav.vitalu", subtitle: "nav.vitalu.sub" },
  health: { label: "nav.vitalu", subtitle: "nav.vitalu.sub" },
  goals: { label: "nav.uplift", subtitle: "nav.uplift.sub" },
  ai: { label: "nav.vyra", subtitle: "nav.vyra.sub" },
  intelligence: { label: "nav.motiveiq", subtitle: "nav.motiveiq.sub" },
  memory: { label: "nav.motiveiq", subtitle: "nav.motiveiq.sub" },
  feed: { label: "nav.signals", subtitle: "nav.signals.sub" },
  connect: { label: "nav.connect", subtitle: "nav.connect.sub" },
  settings: { label: "nav.settings", subtitle: "nav.settings.sub" },
  more: { label: "nav.settings", subtitle: "nav.settings.sub" },
  tasks: { label: "nav.tasks" },
  learning: { label: "nav.learning" },
  career: { label: "nav.career" },
  habits: { label: "nav.habits" },
  relationships: { label: "nav.relationships" },
};

const GROUP_KEYS: Record<string, AppMessageKey> = {
  "Main Apps": "nav.group.main",
  Intelligence: "nav.group.intelligence",
};

export function localizeNavItems(items: NavItem[], t: (key: AppMessageKey) => string): NavItem[] {
  return items.map((item) => {
    const keys = NAV_KEYS[item.icon];
    if (!keys) return item;
    return {
      ...item,
      label: t(keys.label),
      subtitle: keys.subtitle ? t(keys.subtitle) : item.subtitle,
    };
  });
}

export function localizeNavGroups(
  groups: NavGroup[],
  t: (key: AppMessageKey) => string
): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    label: GROUP_KEYS[group.label] ? t(GROUP_KEYS[group.label]) : group.label,
  }));
}
