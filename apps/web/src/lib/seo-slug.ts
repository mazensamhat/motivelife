import { prisma } from "@forward/database";

export function slugifySeoTitle(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "article";
}

export async function ensureUniqueMarketingSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugifySeoTitle(base);
  let candidate = root;
  let suffix = 2;

  while (true) {
    const existing = await prisma.marketingPost.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
}
