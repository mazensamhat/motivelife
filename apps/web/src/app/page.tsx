import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { getSession } from "@/lib/session";

/** Single definitive homepage story for Google / AI search — Digital Twin + Places/Movement. */
export const metadata: Metadata = {
  title: "MotiveLife — DayO, LifeVue, KINZO, UPLIFT, VYRA",
  description:
    "MotiveLife suite: DayO for your day, LifeVue for your life view, KINZO AI for family intelligence, UPLIFT for goals, VYRA as your AI Chief of Staff.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MotiveLife — Your life operating system",
    description:
      "DayO · LifeVue · KINZO · UPLIFT · VYRA — Digital Twin intelligence for you, family intelligence for US.",
    url: "/",
  },
};

export default async function HomePage() {
  const session = await getSession();
  // Always Mode of Life — Ops Console is opt-in via the dashboard shield link.
  if (session) redirect("/dashboard");

  return <LandingPage />;
}
