import { prisma } from "@forward/database";
import { DailyOperatingSystem } from "@/components/daily-operating-system";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DailyOperatingSystem />;
}
