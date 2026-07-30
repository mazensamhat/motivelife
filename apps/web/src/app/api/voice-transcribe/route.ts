import { getOpenAiApiKey } from "@/lib/openai-config";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { recordAiUsage } from "@/lib/ai-usage";

export const runtime = "nodejs";

/** Whisper accepts up to 25MB; keep a safer ceiling for mobile uploads. */
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_PREFIXES = ["audio/", "video/webm", "video/mp4"];

function isAllowedType(type: string): boolean {
  const t = type.toLowerCase();
  if (!t) return true; // iOS sometimes omits type; Whisper still accepts by filename
  return ALLOWED_PREFIXES.some((p) => t.startsWith(p));
}

/**
 * Transcribe recorded speech for browsers without Web Speech API (Safari / iPad / WKWebView).
 * Accepts multipart form field `audio`.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return json(
      { error: "Voice transcription is temporarily unavailable. Please type your message instead." },
      503
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected multipart audio upload.");
  }

  const file = form.get("audio");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return badRequest("Missing audio file.");
  }
  if (file.size < 256) {
    return badRequest("Recording was too short — hold a bit longer and try again.");
  }
  if (file.size > MAX_BYTES) {
    return badRequest("Recording is too large. Try a shorter clip.");
  }
  const type = "type" in file ? String(file.type || "") : "";
  if (!isAllowedType(type)) {
    return badRequest("Unsupported audio format.");
  }

  try {
    const forward = new FormData();
    const name =
      file instanceof File && file.name
        ? file.name
        : `voice.${type.includes("webm") ? "webm" : type.includes("mpeg") ? "mp3" : "m4a"}`;
    forward.append("file", file, name);
    forward.append("model", "whisper-1");
    forward.append("language", "en");
    forward.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forward,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      text?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      const message = payload.error?.message || "Transcription failed.";
      return json({ error: message }, response.status >= 500 ? 502 : 400);
    }

    const transcript = (payload.text ?? "").trim();
    if (transcript.length < 1) {
      return badRequest("No speech detected. Try again closer to the mic.");
    }

    // Track call volume under voice organize (weight 0 — organize caps still apply later).
    await recordAiUsage(session.id, "voice_organize", null, 0).catch(() => undefined);

    return json({ transcript });
  } catch (error) {
    console.error("voice-transcribe", error);
    return serverError("Transcription failed.");
  }
}
