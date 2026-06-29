export function hasScope(scope: string | null | undefined, required: string) {
  return Boolean(scope?.split(/\s+/).includes(required));
}

export function mergeScopes(existing: string | null | undefined, incoming: string | null | undefined) {
  const set = new Set<string>();
  for (const s of (existing ?? "").split(/\s+/)) {
    if (s) set.add(s);
  }
  for (const s of (incoming ?? "").split(/\s+/)) {
    if (s) set.add(s);
  }
  return [...set].join(" ");
}
