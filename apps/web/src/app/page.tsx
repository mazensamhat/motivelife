import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect(isAdminEmail(session.email) ? "/admin" : "/dashboard");

  return <LandingPage />;
}
