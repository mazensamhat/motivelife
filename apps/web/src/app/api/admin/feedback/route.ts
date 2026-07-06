import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { json, serverError } from "@/lib/api";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return json({ error: admin.error }, admin.status);

    const items = await prisma.productFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return json({
      feedback: items.map((row) => ({
        id: row.id,
        kind: row.kind,
        message: row.message,
        pagePath: row.pagePath,
        viewport: row.viewport,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        user: row.user,
      })),
    });
  } catch (error) {
    console.error("[api/admin/feedback]", error);
    return serverError("Could not load feedback.");
  }
}
