import { redirect } from "next/navigation";
import { normalizeFamilyInviteCode } from "@/lib/family-map/invite-link";

/** Short share alias → canonical family join path */
export default async function ShortFamilyJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = normalizeFamilyInviteCode(raw);
  redirect(`/family/join/${encodeURIComponent(code || raw)}`);
}
