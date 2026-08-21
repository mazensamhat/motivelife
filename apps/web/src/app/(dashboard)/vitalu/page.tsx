import { VitaluHome } from "@/components/vitalu-home";
import { ResponsivePage } from "@/components/responsive-page";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function VitaluPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ResponsivePage width="dashboard" className="space-y-8">
      <VitaluHome />
    </ResponsivePage>
  );
}
