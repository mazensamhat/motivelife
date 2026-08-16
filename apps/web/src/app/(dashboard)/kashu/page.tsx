import { KashuHome } from "@/components/kashu-home";
import { ResponsivePage } from "@/components/responsive-page";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function KashuPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ResponsivePage width="module" className="mx-auto max-w-3xl space-y-8">
      <KashuHome />
    </ResponsivePage>
  );
}
