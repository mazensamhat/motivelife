import { createHash, randomBytes, randomInt } from "crypto";
import { prisma } from "@forward/database";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generateVerificationCode() {
  return String(randomInt(100000, 999999));
}

export async function issuePhoneVerification(params: {
  userId?: string;
  phoneNumber: string;
  purpose: "signup" | "login" | "reset";
}) {
  const code = generateVerificationCode();
  const challengeId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);

  if (params.userId) {
    await prisma.phoneVerification.deleteMany({
      where: { userId: params.userId, purpose: params.purpose },
    });
  }

  await prisma.phoneVerification.create({
    data: {
      userId: params.userId ?? null,
      phoneNumber: params.phoneNumber,
      purpose: params.purpose,
      challengeId,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  return { challengeId, code, expiresAt };
}

export async function verifyPhoneCode(challengeId: string, code: string) {
  const record = await prisma.phoneVerification.findUnique({
    where: { challengeId },
    select: {
      id: true,
      userId: true,
      phoneNumber: true,
      purpose: true,
      codeHash: true,
      expiresAt: true,
    },
  });

  if (!record || record.expiresAt < new Date()) return null;
  if (hashCode(code) !== record.codeHash) return null;

  await prisma.phoneVerification.delete({ where: { id: record.id } });

  return record;
}

export async function clearPhoneVerifications(userId: string) {
  await prisma.phoneVerification.deleteMany({ where: { userId } });
}
