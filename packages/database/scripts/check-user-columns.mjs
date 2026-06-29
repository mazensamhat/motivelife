import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw`PRAGMA table_info(User)`;
const legal = rows.filter((c) =>
  ["termsAcceptedAt", "privacyAcceptedAt", "legalConsentVersion", "marketingEmailConsent"].includes(
    c.name
  )
);
console.log("legal columns:", legal);
console.log("total columns:", rows.length);

try {
  const existing = await prisma.user.findUnique({
    where: { email: "samhatmazen@gmail.com" },
    select: { id: true, email: true },
  });
  console.log("findUnique ok:", existing ?? "no user");
} catch (e) {
  console.error("findUnique FAILED:", e.message);
}

await prisma.$disconnect();
