import { getSession } from "@/lib/session";
import { unauthorized } from "@/lib/api";
import { databaseErrorMessage } from "@/lib/db-error";
import { getFamilyMapState } from "@/lib/family-map/map-state";
import { getHouseholdLivePulse } from "@/lib/family-map/live-pulse";

export const runtime = "nodejs";
/** Hold the SSE pipe long enough for live drive follow; client reconnects after close. */
export const maxDuration = 60;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Server-Sent Events for Family Map live pins.
 * Cheap pulse each tick; full map payload only when someone actually moved.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = request.signal;
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      const ping = () => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      };

      let lastFp = "";
      const started = Date.now();
      // Leave headroom under maxDuration so Vercel can flush cleanly.
      const deadline = started + 50_000;
      const rotateAt = deadline - 3_000;
      let rotated = false;

      try {
        // Immediate snapshot so the client can drop fast polling right away.
        const initial = await getFamilyMapState(session.id);
        const pulse0 = await getHouseholdLivePulse(session.id);
        lastFp = pulse0.fingerprint;
        send("map", initial);

        while (!signal.aborted && Date.now() < deadline) {
          // 1.5s pulse — was 700ms and re-ran household repair/DDL via ensureHousehold.
          await sleep(1_500, signal);
          if (signal.aborted) break;

          if (!rotated && Date.now() >= rotateAt) {
            rotated = true;
            try {
              send("rotate", { reason: "deadline" });
            } catch {
              // stream already closing
            }
          }

          const pulse = await getHouseholdLivePulse(session.id);
          if (pulse.fingerprint !== lastFp) {
            lastFp = pulse.fingerprint;
            const state = await getFamilyMapState(session.id);
            send("map", state);
          } else {
            ping();
          }
        }
      } catch (error) {
        if ((error as { name?: string } | null)?.name !== "AbortError") {
          console.error("[api/family/map/stream]", error);
          const mapped = databaseErrorMessage(error, "");
          try {
            send("stream-error", {
              message: mapped || "Family Map live stream failed.",
            });
          } catch {
            // stream already closed
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // Client disconnected — loop observes request.signal.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
