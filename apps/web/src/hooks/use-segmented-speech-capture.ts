import { useCallback, useEffect, useRef, useState } from "react";

const PAUSE_MS = 2500;

export function useSegmentedSpeechCapture() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentSegmentRef = useRef("");
  const lastFinalAtRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<number | null>(null);

  const flushSegment = useCallback(() => {
    const chunk = currentSegmentRef.current.trim();
    if (chunk.length > 8) {
      setSegments((prev) => [...prev, chunk]);
    }
    currentSegmentRef.current = "";
  }, []);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
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

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  useEffect(() => {
    if (!listening) {
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
  }, [listening, flushSegment]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setFinalText("");
    setInterim("");
    setSegments([]);
    currentSegmentRef.current = "";
    lastFinalAtRef.current = null;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    flushSegment();
  }, [flushSegment]);

  const transcript = `${finalText}${interim ? ` ${interim}` : ""}`.trim();

  return { supported, listening, transcript, segments, start, stop };
}
