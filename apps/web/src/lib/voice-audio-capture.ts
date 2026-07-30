/** Client helpers for iOS/iPad-safe audio capture (MediaRecorder). */

const MIME_CANDIDATES = [
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

export function canUseSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export function canUseMediaRecorder(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function extensionForMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/mp4" || base === "audio/aac" || base === "audio/x-m4a") return "m4a";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/wav" || base === "audio/wave") return "wav";
  if (base.includes("webm")) return "webm";
  return "m4a";
}

export async function transcribeAudioBlob(blob: Blob, mimeType: string): Promise<string> {
  const form = new FormData();
  const ext = extensionForMime(mimeType || blob.type || "audio/mp4");
  form.append("audio", blob, `voice.${ext}`);

  const res = await fetch("/api/voice-transcribe", {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { transcript?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not transcribe audio.");
  }
  return (data.transcript ?? "").trim();
}
