import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) redirect("/dashboard");

  return <AdminDashboard adminEmail={session.email} adminName={session.name} />;
}

export const metadata = {
  title: "MotiveLife Ops Console",
  robots: { index: false, follow: false },
};
