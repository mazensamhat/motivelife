import { VitaluHome } from "@/components/vitalu-home";
import { ResponsivePage } from "@/components/responsive-page";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function VitaluPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ResponsivePage width="module" className="mx-auto max-w-3xl space-y-8">
      <VitaluHome />
    </ResponsivePage>
  );
}
