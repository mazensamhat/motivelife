import { redirect } from "next/navigation";

/** Vitalu owns health. Legacy /health route. */
export default function HealthRedirectPage() {
  redirect("/vitalu");
}
