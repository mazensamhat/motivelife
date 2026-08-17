import { VyraHome } from "@/components/vyra-home";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function VyraPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <VyraHome />;
}
