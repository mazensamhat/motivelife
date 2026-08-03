import { getSession } from "@/lib/session";
import { getMemberForUser } from "@/lib/family-map/household";
import { resolveFamilyEntitlements } from "@/lib/family-map/entitlements";

/** Returns entitlements for the viewer's household, or null if not in one. */
export async function getViewerFamilyEntitlements() {
  const session = await getSession();
  if (!session) return { session: null, entitlements: null, member: null } as const;
  const member = await getMemberForUser(session.id);
  if (!member) return { session, entitlements: null, member: null } as const;
  const entitlements = await resolveFamilyEntitlements({
    ownerUserId: member.household.ownerUserId,
    viewerUserId: session.id,
  });
  return { session, entitlements, member } as const;
}
