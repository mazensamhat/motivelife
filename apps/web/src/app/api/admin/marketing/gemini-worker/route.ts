import { requireAdmin } from "@/lib/admin";
import { forbidden, json, unauthorized } from "@/lib/api";
import { pingGeminiBrowserWorker } from "@forward/marketing-agent";
import {
  getGeminiBrowserWorkerSecret,
  getGeminiBrowserWorkerUrl,
  getGoogleAiApiKey,
} from "@/lib/google-ai-config";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  const workerUrl = getGeminiBrowserWorkerUrl();
  const geminiApi = Boolean(getGoogleAiApiKey());

  if (!workerUrl) {
    return json({
      configured: false,
      geminiApi,
      ok: geminiApi,
      detail: geminiApi
        ? "Automatic via Gemini API (GOOGLE_AI_API_KEY)"
        : "Set GOOGLE_AI_API_KEY or GEMINI_BROWSER_WORKER_URL",
    });
  }

  const worker = await pingGeminiBrowserWorker(workerUrl, getGeminiBrowserWorkerSecret());
  return json({
    configured: true,
    geminiApi,
    workerUrl,
    ok: worker.ok && (worker.loggedIn ?? false),
    loggedIn: worker.loggedIn ?? false,
    detail: worker.detail,
  });
}
