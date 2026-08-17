import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { getSession } from "@/lib/session";

/** Single definitive homepage story for Google / AI search — Digital Twin + Places/Movement. */
export const metadata: Metadata = {
  title: "MotiveLife — DayO, LifeVue, KINZO, UPLIFT, Kashu, VYRA",
  description:
    "Six products. One life operating system. DayO runs your day. LifeVue sees your life. KINZO understands your family. UPLIFT moves your goals forward. Kashu understands your money. VYRA connects the intelligence.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MotiveLife — Your life operating system",
    description:
      "Six products. One life operating system. DayO · LifeVue · KINZO · UPLIFT · Kashu · VYRA.",
    url: "/",
  },
};

export default async function HomePage() {
  const session = await getSession();
  // Always Mode of Life — Ops Console is opt-in via the dashboard shield link.
  if (session) redirect("/dashboard");

  return <LandingPage />;
}
