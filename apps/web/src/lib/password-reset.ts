import { createHash, randomBytes } from "crypto";
import { prisma } from "@forward/database";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export async function issuePasswordResetToken(userId: string) {
  const { token, tokenHash } = createPasswordResetToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return token;
}

export async function findValidPasswordResetUserId(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, expiresAt: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  return record.userId;
}

export async function clearPasswordResetTokens(userId: string) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}
