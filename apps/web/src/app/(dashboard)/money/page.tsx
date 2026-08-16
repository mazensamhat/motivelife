import { redirect } from "next/navigation";

/** Money life-module route now lives under Kashu (Cash-Flow Intelligence). */
export default function MoneyPage() {
  redirect("/kashu");
}
