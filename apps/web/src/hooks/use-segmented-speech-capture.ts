import { useCallback, useEffect, useRef, useState } from "react";
import {
  canUseMediaRecorder,
  canUseSpeechRecognition,
  pickRecorderMimeType,
  transcribeAudioBlob,
} from "@/lib/voice-audio-capture";
import type { SpeechCaptureEngine } from "@/hooks/use-speech-capture";

const PAUSE_MS = 2500;

/**
 * Segmented capture for ambient mode.
 * Web Speech: pause-based segments. MediaRecorder fallback: one segment after Whisper.
 */
export function useSegmentedSpeechCapture() {
  const [engine, setEngine] = useState<SpeechCaptureEngine>("none");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [segments, setSegments] = useState<string[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef("");
  const currentSegmentRef = useRef("");
  const lastFinalAtRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const finalTextRef = useRef("");
  const engineRef = useRef<SpeechCaptureEngine>("none");
  const wantListenRef = useRef(false);

  const flushSegment = useCallback(() => {
    const chunk = currentSegmentRef.current.trim();
    if (chunk.length > 8) {
      setSegments((prev) => [...prev, chunk]);
    }
    currentSegmentRef.current = "";
  }, []);

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
        currentSegmentRef.current = `${currentSegmentRef.current}${finalChunk}`.trim();
        setFinalText((prev) => `${prev}${finalChunk}`.trim());
        setInterim("");
        lastFinalAtRef.current = Date.now();
      }
    };

    recognition.onerror = () => {
      if (!wantListenRef.current) return;
      setListening(false);
    };
    recognition.onend = () => {
      if (wantListenRef.current && engineRef.current === "speech") {
        try {
          recognition.start();
          return;
        } catch {
          /* ignore */
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

  useEffect(() => {
    if (!listening || engine !== "speech") {
      if (pauseTimerRef.current) {
        window.clearInterval(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      return;
    }

    pauseTimerRef.current = window.setInterval(() => {
      if (!lastFinalAtRef.current) return;
      if (Date.now() - lastFinalAtRef.current >= PAUSE_MS && currentSegmentRef.current.trim().length > 8) {
        flushSegment();
        lastFinalAtRef.current = null;
      }
    }, 400);

    return () => {
      if (pauseTimerRef.current) window.clearInterval(pauseTimerRef.current);
    };
  }, [listening, engine, flushSegment]);

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
    setSegments([]);
    currentSegmentRef.current = "";
    lastFinalAtRef.current = null;
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
        audio: { echoCancellation: true, noiseSuppression: true },
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
      flushSegment();
      await new Promise((r) => window.setTimeout(r, 350));
      return finalTextRef.current.trim();
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
        setError("Recording was too short — hold a bit longer.");
        setInterim("");
        setTranscribing(false);
        return "";
      }
      const text = await transcribeAudioBlob(blob, blob.type || mimeRef.current);
      setFinalText(text);
      finalTextRef.current = text;
      if (text.trim().length > 8) setSegments([text.trim()]);
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
  }, [cleanupMedia, flushSegment]);

  const transcript = `${finalText}${interim && engine === "speech" ? ` ${interim}` : ""}`.trim();

  return {
    supported,
    engine,
    listening,
    transcribing,
    error,
    transcript: engine === "media" && listening ? "" : transcript || finalText,
    segments,
    start,
    stop,
  };
}
