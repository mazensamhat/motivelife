type SendResult = { ok: true } | { ok: false; error: string };

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  return { accountSid, authToken, from };
}

export function isSmsConfigured() {
  const { accountSid, authToken, from } = twilioConfig();
  return Boolean(accountSid && authToken && from);
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const { accountSid, authToken, from } = twilioConfig();
  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "SMS is not configured (Twilio env vars missing)" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[sms] Twilio error:", res.status, text);
    return { ok: false, error: text || `Twilio HTTP ${res.status}` };
  }

  return { ok: true };
}

export async function sendVerificationCodeSms(to: string, code: string, purpose: string) {
  const label =
    purpose === "reset"
      ? "password reset"
      : purpose === "login"
        ? "sign-in verification"
        : "MotiveLife verification";
  const body = `Your MotiveLife ${label} code is ${code}. It expires in 10 minutes.`;
  const result = await sendSms(to, body);

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.log(`[sms] Dev fallback code for ${to}: ${code}`);
    return { ok: true as const };
  }

  return result;
}
