import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { getSession } from "@/lib/session";

/** Single definitive homepage story for Google / AI search — Digital Twin + Places/Movement. */
export const metadata: Metadata = {
  title: "MotiveLife — Digital Twin for your life | MyMotiveLife Pro",
  description:
    "MyMotiveLife Pro builds a living Digital Twin of you — calendar, money, health, goals, habits, relationships, places, and movement. See patterns you can’t. MyMotiveFamily understands US.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MyMotiveLife Pro — Your Digital Twin understands ME",
    description:
      "Places and movement are part of your Digital Twin — not just calendar and money. Family is US intelligence. Pro is ME intelligence.",
    url: "/",
  },
};

export default async function HomePage() {
  const session = await getSession();
  // Always Mode of Life — Ops Console is opt-in via the dashboard shield link.
  if (session) redirect("/dashboard");

  return <LandingPage />;
}
