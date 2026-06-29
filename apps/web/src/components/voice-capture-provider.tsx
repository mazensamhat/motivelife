"use client";

import { useState } from "react";
import type { VoiceCapturePayload } from "@forward/shared";
import { VoiceCaptureFab } from "./voice-capture-fab";
import { VoiceCaptureSheet } from "./voice-capture-sheet";

export function VoiceCaptureProvider() {
  const [capture, setCapture] = useState<VoiceCapturePayload | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);

  return (
    <>
      <VoiceCaptureFab
        onCaptured={(result) => {
          setCapture(result.capture);
          setCoachNote(result.coachNote);
        }}
      />
      <VoiceCaptureSheet capture={capture} coachNote={coachNote} onClose={() => setCapture(null)} />
    </>
  );
}
