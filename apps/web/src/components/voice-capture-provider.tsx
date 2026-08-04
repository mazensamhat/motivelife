"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import type { VoiceCapturePayload } from "@forward/shared";
import { VoiceCaptureFab } from "./voice-capture-fab";
import { VoiceCaptureSheet } from "./voice-capture-sheet";

/**
 * Global Life Coach mic — hidden on Family Map so the map stays clean
 * (expand / member cards / pan). Coach remains on Today (AI tab) and other pages.
 */
export function VoiceCaptureProvider() {
  const pathname = usePathname();
  const [capture, setCapture] = useState<VoiceCapturePayload | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const hideFab = pathname.startsWith("/family-map");

  return (
    <>
      {!hideFab ? (
        <VoiceCaptureFab
          onCaptured={(result) => {
            setCapture(result.capture);
            setCoachNote(result.coachNote);
          }}
        />
      ) : null}
      <VoiceCaptureSheet capture={capture} coachNote={coachNote} onClose={() => setCapture(null)} />
    </>
  );
}
