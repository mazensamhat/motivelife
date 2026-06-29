import { getSession } from "@/lib/session";
import { unauthorized, serverError } from "@/lib/api";
import { exportLifeGraph } from "@/lib/life-graph";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const payload = await exportLifeGraph(session.id, session.name);
    const filename = `motivelife-graph-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[api/life-graph/export]", error);
    return serverError("Could not export Life Graph.");
  }
}
