import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { unlink, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

function resolveFfmpegPath(): string | null {
  const candidates = [
    ffmpegStatic,
    join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    join(process.cwd(), "..", "..", "node_modules", "ffmpeg-static", "ffmpeg"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const ffmpegPath = resolveFfmpegPath();
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export function isFfmpegAvailable(): boolean {
  return Boolean(ffmpegPath);
}

export type VideoDimensions = { width: number; height: number };

export function videoDimensionsForChannel(channel?: string): VideoDimensions {
  if (channel === "instagram" || channel === "tiktok") {
    return { width: 1080, height: 1920 };
  }
  if (channel === "linkedin" || channel === "facebook") {
    return { width: 1920, height: 1080 };
  }
  return { width: 1080, height: 1080 };
}

async function cleanup(paths: string[]) {
  await Promise.all(paths.map((p) => unlink(p).catch(() => undefined)));
}

/** Ken Burns MP4 with narrated audio track. */
export async function createNarratedKenBurnsVideo(
  pngBuffer: Buffer,
  audioMp3: Buffer,
  durationSec: number,
  dimensions: VideoDimensions
): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("FFMPEG_UNAVAILABLE");
  }

  const id = randomUUID();
  const imgPath = join(tmpdir(), `ml-${id}.png`);
  const audioPath = join(tmpdir(), `ml-${id}.mp3`);
  const outPath = join(tmpdir(), `ml-${id}.mp4`);
  const { width, height } = dimensions;
  const fps = 25;
  const totalFrames = Math.max(1, durationSec * fps);

  await writeFile(imgPath, pngBuffer);
  await writeFile(audioPath, audioMp3);

  try {
    return await new Promise<Buffer>((resolve, reject) => {
      const zoomFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(zoom+0.001,1.25)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;

      ffmpeg()
        .input(imgPath)
        .inputOptions(["-loop 1", `-framerate ${fps}`])
        .input(audioPath)
        .outputOptions([
          "-vf",
          zoomFilter,
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-t",
          String(durationSec),
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-shortest",
          "-movflags",
          "+faststart",
        ])
        .output(outPath)
        .on("end", () => {
          readFile(outPath)
            .then(resolve)
            .catch(reject);
        })
        .on("error", (err) => reject(err))
        .run();
    });
  } finally {
    await cleanup([imgPath, audioPath, outPath]);
  }
}
