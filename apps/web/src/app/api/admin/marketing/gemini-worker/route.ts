import { requireAdmin } from "@/lib/admin";
import { forbidden, json, unauthorized } from "@/lib/api";
import { pingGeminiBrowserWorker } from "@forward/marketing-agent";
import {
  getGeminiBrowserWorkerSecret,
  getGeminiBrowserWorkerUrl,
} from "@/lib/google-ai-config";
import { getGeminiPlatformStatus } from "@/lib/gemini-status";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  const gemini = await getGeminiPlatformStatus();
  const workerUrl = getGeminiBrowserWorkerUrl();

  if (!workerUrl) {
    return json({
      configured: gemini.configured,
      geminiApi: gemini.configured,
      ok: gemini.apiOk,
      tierLabel: gemini.tierLabel,
      imageModel: gemini.imageModel,
      detail: gemini.summary,
    });
  }

  const worker = await pingGeminiBrowserWorker(workerUrl, getGeminiBrowserWorkerSecret());
  return json({
    configured: true,
    geminiApi: gemini.configured,
    workerUrl,
    ok: gemini.apiOk || (worker.ok && (worker.loggedIn ?? false)),
    loggedIn: worker.loggedIn ?? false,
    tierLabel: gemini.tierLabel,
    imageModel: gemini.imageModel,
    detail: gemini.apiOk ? gemini.summary : worker.detail ?? gemini.summary,
  });
}
