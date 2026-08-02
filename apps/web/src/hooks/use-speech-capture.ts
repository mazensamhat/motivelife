import { useCallback, useEffect, useRef, useState } from "react";
import {
  canUseMediaRecorder,
  canUseSpeechRecognition,
  pickRecorderMimeType,
  transcribeAudioBlob,
} from "@/lib/voice-audio-capture";

export type SpeechCaptureEngine = "speech" | "media" | "none";

/**
 * Voice capture with Web Speech when available, MediaRecorder→Whisper on iPad/Safari/WKWebView.
 */
export function useSpeechCapture() {
  const [engine, setEngine] = useState<SpeechCaptureEngine>("none");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef("");
  const finalTextRef = useRef("");
  const engineRef = useRef<SpeechCaptureEngine>("none");
  const wantListenRef = useRef(false);

  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);

  useEffect(() => {
    const speechOk = canUseSpeechRecognition();
    const mediaOk = canUseMediaRecorder();
    const next: SpeechCaptureEngine = speechOk ? "speech" : mediaOk ? "media" : "none";
    engineRef.current = next;
    setEngine(next);
    setSupported(next !== "none");

    if (!speechOk) return;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimChunk = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalChunk += part;
        else interimChunk += part;
      }
      if (interimChunk) setInterim(interimChunk);
      if (finalChunk) {
        setFinalText((prev) => `${prev}${finalChunk}`.trim());
        setInterim("");
      }
    };

    recognition.onerror = () => {
      if (!wantListenRef.current) return;
      setListening(false);
    };
    recognition.onend = () => {
      // Some browsers end continuous sessions early — restart while recording.
      if (wantListenRef.current && engineRef.current === "speech") {
        try {
          recognition.start();
          return;
        } catch {
          /* ignore double-start */
        }
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      wantListenRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const cleanupMedia = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  const start = useCallback(async () => {
    setError(null);
    setFinalText("");
    setInterim("");
    finalTextRef.current = "";
    wantListenRef.current = true;

    if (engineRef.current === "speech" && recognitionRef.current) {
      setListening(true);
      try {
        recognitionRef.current.start();
      } catch {
        setListening(false);
        wantListenRef.current = false;
      }
      return;
    }

    if (engineRef.current !== "media") {
      setError("Voice capture isn’t available on this device.");
      wantListenRef.current = false;
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (!wantListenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const mime = pickRecorderMimeType();
      mimeRef.current = mime;
      chunksRef.current = [];
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      // Timeslice helps some iOS builds flush audio chunks during long holds.
      recorder.start(1000);
      setListening(true);
      setInterim("Listening…");
    } catch (err) {
      wantListenRef.current = false;
      setListening(false);
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone permission is required for voice."
          : "Could not access the microphone."
      );
    }
  }, []);

  const stop = useCallback(async (): Promise<string> => {
    wantListenRef.current = false;

    if (engineRef.current === "speech") {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      await new Promise((r) => window.setTimeout(r, 350));
      const text = finalTextRef.current.trim();
      setInterim("");
      return text;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setListening(false);
      cleanupMedia();
      return finalTextRef.current.trim();
    }

    setListening(false);
    setTranscribing(true);
    setInterim("Transcribing…");

    const blob = await new Promise<Blob>((resolve) => {
      const finish = () => {
        const type = mimeRef.current || recorder.mimeType || "audio/mp4";
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.onstop = finish;
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else finish();
      } catch {
        finish();
      }
    });

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];

    try {
      if (blob.size < 256) {
        setError("Recording was too short — speak a bit longer, then tap stop.");
        setInterim("");
        setTranscribing(false);
        return "";
      }
      const text = await transcribeAudioBlob(blob, blob.type || mimeRef.current);
      setFinalText(text);
      finalTextRef.current = text;
      setInterim("");
      setTranscribing(false);
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcription failed.";
      setError(message);
      setInterim("");
      setTranscribing(false);
      return "";
    }
  }, [cleanupMedia]);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
    setError(null);
    finalTextRef.current = "";
  }, []);

  const transcript = `${finalText}${interim && engine === "speech" ? ` ${interim}` : ""}`.trim();
  const statusText = transcribing
    ? "Transcribing…"
    : listening
      ? engine === "media"
        ? interim || "Listening…"
        : transcript || "Speak naturally…"
      : "";

  return {
    supported,
    engine,
    listening,
    transcribing,
    error,
    transcript: engine === "media" && listening ? "" : transcript || (transcribing ? "" : finalText),
    statusText,
    start,
    stop,
    reset,
  };
}
