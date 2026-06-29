import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-forward-950 text-forward-100">
      {children}
    </div>
  );
}
