"use client";

import { useCallback, useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export type ReferenceImage = {
  previewUrl: string;
  base64: string;
  mimeType: string;
  name?: string;
};

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

async function readImageFile(file: File): Promise<ReferenceImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Paste or upload an image (PNG, JPEG, WebP, or GIF).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 3 MB.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Could not read image."));
        return;
      }
      resolve({
        previewUrl: dataUrl,
        base64,
        mimeType: file.type,
        name: file.name || undefined,
      });
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export type ReferenceImageMode = "reimagine" | "polish";

export function MarketingReferenceImage({
  value,
  mode,
  onModeChange,
  onChange,
  onError,
}: {
  value: ReferenceImage | null;
  mode: ReferenceImageMode;
  onModeChange: (mode: ReferenceImageMode) => void;
  onChange: (image: ReferenceImage | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const attachFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        onChange(await readImageFile(file));
        onError("");
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not add image.");
      }
    },
    [onChange, onError]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          void attachFile(item.getAsFile());
          break;
        }
      }
    },
    [attachFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void attachFile(file);
    },
    [attachFile]
  );

  return (
    <div
      id="marketing-screenshot-paste"
      className="mb-4 rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-4 ring-1 ring-cyan-500/15"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
          Step 1
        </span>
        <span className="text-sm font-medium text-white">App screenshot</span>
        <span className="text-xs text-forward-500">(optional — paste before you generate)</span>
      </div>
      <p className="mb-3 text-xs text-forward-400">
        Screenshot a screen in MotiveLife (e.g. Memories), paste with{" "}
        <kbd className="rounded border border-forward-600 bg-forward-950 px-1 text-forward-300">Ctrl+V</kbd>,
        or upload below. AI will <strong className="text-forward-200">re-imagine</strong> it into
        polished post art — not post the raw screenshot.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            {
              id: "reimagine" as const,
              label: "Re-imagine",
              hint: "Premium marketing art from your screen",
            },
            {
              id: "polish" as const,
              label: "Polish",
              hint: "Same layout, cleaner & social-ready",
            },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onModeChange(opt.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              mode === opt.id
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
                : "border-forward-700 text-forward-400 hover:border-forward-600"
            }`}
          >
            <span className="font-medium">{opt.label}</span>
            <span className="mt-0.5 block text-[10px] text-forward-500">{opt.hint}</span>
          </button>
        ))}
      </div>

      {value ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-forward-950/80 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt="App screenshot for marketing"
            className="max-h-40 max-w-[45%] rounded-md border border-forward-800 object-contain"
          />
          <div className="min-w-0 flex-1 text-xs text-forward-400">
            <p className="font-medium text-emerald-300">Screenshot attached</p>
            <p className="mt-1 text-forward-500">
              {value.name ?? "Pasted image"} — will be {mode === "polish" ? "polished" : "re-imagined"}{" "}
              when you generate or click Image.
            </p>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-2 inline-flex items-center gap-1 text-red-300 hover:text-red-200"
            >
              <X size={12} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={zoneRef}
          role="button"
          tabIndex={0}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/40 bg-forward-950/80 px-4 py-10 text-center transition hover:border-cyan-400/60 hover:bg-forward-950"
        >
          <ImagePlus size={32} className="mb-2 text-cyan-400" />
          <p className="text-sm font-medium text-forward-100">Paste screenshot here or click to upload</p>
          <p className="mt-1 text-xs text-forward-500">Win+Shift+S → Ctrl+V · PNG, JPEG, WebP · max 3 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void attachFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
