#!/usr/bin/env python3
"""Generate MotiveLife ~45s website product demo MP4.

Uses Piper neural TTS (natural) + ffmpeg Ken Burns. Never truncates narration.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace")
SHOTS = ROOT / "apps/web/public/marketing/screenshots"
BRAND = ROOT / "apps/web/public/brand"
OUT_DIR = Path("/tmp/demo-video")
PUBLIC_OUT = ROOT / "apps/web/public/marketing/product-demo.mp4"
ARTIFACT = Path("/opt/cursor/artifacts/product-demo.mp4")
PIPER_DIR = Path("/tmp/piper-voices")
# Warm, natural US female neural voice
PIPER_MODEL = PIPER_DIR / "en_US-hfc_female-medium.onnx"
W, H = 1920, 1080
FPS = 30

LINES = [
    "Know where your life is headed.",
    "MotiveLife builds a living Digital Twin — AI that understands your calendar, money, health, and goals.",
    "Just talk. Say what's on your mind.",
    "Your coach turns it into memory, missions, and next steps.",
    "Each morning you get one clear briefing — and the action that matters most today.",
    "See how sleep, stress, career, and money all connect.",
    "The more your Twin learns, the sharper your predictions become.",
    "Your Digital Twin belongs to you — not advertisers.",
    "The future doesn't have to be a guess.",
    "Build your Digital Twin at MyMotiveLife.com.",
]

GAP_SEC = 0.45
END_PAD_SEC = 3.5


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def phone_on_canvas(shot: Path, out: Path, label: str) -> None:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r, a in ((700, 28), (500, 40), (320, 55)):
        gdraw.ellipse(
            (W // 2 - r, H // 2 - r - 40, W // 2 + r, H // 2 + r - 40),
            fill=(0, 198, 255, a),
        )
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(bg)

    phone = Image.open(shot).convert("RGBA")
    target_h = 980
    scale = target_h / phone.height
    phone = phone.resize((int(phone.width * scale), target_h), Image.Resampling.LANCZOS)
    pad = 18
    frame = Image.new("RGBA", (phone.width + pad * 2, phone.height + pad * 2), (10, 25, 48, 255))
    frame.paste(phone, (pad, pad), phone)
    x = (W - frame.width) // 2
    y = (H - frame.height) // 2 - 10
    bg.paste(frame, (x, y), frame)

    bar_h = 88
    draw.rectangle((0, H - bar_h, W, H), fill=(5, 13, 24))
    draw.rectangle((0, H - bar_h, 8, H), fill=(0, 198, 255))
    draw.text((48, H - 62), label, fill=(232, 238, 248), font=font(36))
    bg.save(out, "PNG")


def end_card(out: Path) -> None:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r, a in ((900, 35), (600, 50)):
        gdraw.ellipse((W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r), fill=(0, 114, 255, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(bg)

    logo_path = BRAND / "motivelife-logo.png"
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((420, 160), Image.Resampling.LANCZOS)
        bg.paste(logo, ((W - logo.width) // 2, 250), logo)

    draw.text((W // 2, 480), "Know Where Your Life Is Headed.", fill=(255, 255, 255), font=font(54), anchor="mm")
    draw.text((W // 2, 580), "Build your AI Digital Twin", fill=(0, 198, 255), font=font(40), anchor="mm")
    draw.text((W // 2, 680), "mymotivelife.com", fill=(168, 184, 212), font=font(34), anchor="mm")
    bg.save(out, "PNG")


def title_card(out: Path) -> None:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r, a in ((800, 40), (480, 55)):
        gdraw.ellipse((W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r), fill=(0, 255, 135, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(bg)

    logo_path = BRAND / "motivelife-logo.png"
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((460, 180), Image.Resampling.LANCZOS)
        bg.paste(logo, ((W - logo.width) // 2, 320), logo)

    draw.text((W // 2, 620), "Your AI Life Operating System", fill=(208, 220, 237), font=font(42), anchor="mm")
    bg.save(out, "PNG")


def ensure_piper_model() -> None:
    if PIPER_MODEL.exists():
        return
    PIPER_DIR.mkdir(parents=True, exist_ok=True)
    print("Downloading Piper voice model…")
    subprocess.run(
        [
            "python3",
            "-m",
            "piper.download_voices",
            "en_US-hfc_female-medium",
            "--download-dir",
            str(PIPER_DIR),
        ],
        check=True,
    )


def synthesize_line_piper(text: str, wav_out: Path) -> None:
    proc = subprocess.run(
        [
            str(Path.home() / ".local/bin/piper"),
            "--model",
            str(PIPER_MODEL),
            "--output_file",
            str(wav_out),
            "--length_scale",
            "1.28",
            "--noise_scale",
            "0.6",
            "--noise_w",
            "0.7",
        ],
        input=text + "\n",
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0 or not wav_out.exists():
        raise RuntimeError(proc.stderr or "piper failed")


def build_narration(mp3_out: Path) -> float:
    ensure_piper_model()
    parts_dir = OUT_DIR / "voice-parts"
    parts_dir.mkdir(parents=True, exist_ok=True)

    wavs: list[Path] = []
    for i, line in enumerate(LINES):
        wav = parts_dir / f"line-{i:02d}.wav"
        print(f"  voice [{i+1}/{len(LINES)}]: {line[:56]}…")
        synthesize_line_piper(line, wav)
        wavs.append(wav)

    silence = OUT_DIR / "gap.wav"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=22050:cl=mono",
            "-t",
            f"{GAP_SEC:.2f}",
            str(silence),
        ]
    )
    end_silence = OUT_DIR / "end-pad.wav"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=22050:cl=mono",
            "-t",
            f"{END_PAD_SEC:.2f}",
            str(end_silence),
        ]
    )

    list_path = OUT_DIR / "audio-concat.txt"
    with list_path.open("w") as f:
        for i, wav in enumerate(wavs):
            f.write(f"file '{wav}'\n")
            if i < len(wavs) - 1:
                f.write(f"file '{silence}'\n")
        f.write(f"file '{end_silence}'\n")

    raw = OUT_DIR / "narration-raw.wav"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            str(raw),
        ]
    )

    # Warm the tone slightly; loudnorm for consistent level — no truncation.
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw),
            "-af",
            "highpass=f=70,lowpass=f=14000,equalizer=f=300:t=q:w=1:g=1.5,equalizer=f=3000:t=q:w=1:g=-1.5,acompressor=threshold=-20dB:ratio=2.5:attack=15:release=180,loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar",
            "48000",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(mp3_out),
        ]
    )
    return probe_duration(mp3_out)


def ken_burns_clip(image: Path, seconds: float, out: Path, zoom_end: float = 1.12) -> None:
    frames = max(1, int(round(seconds * FPS)))
    z_expr = f"min(zoom+{(zoom_end - 1.0) / frames:.8f},{zoom_end})"
    vf = (
        f"scale=8000:-1,"
        f"zoompan=z='{z_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={W}x{H}:fps={FPS},"
        f"format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(image),
            "-vf",
            vf,
            "-t",
            f"{seconds:.3f}",
            "-r",
            str(FPS),
            "-pix_fmt",
            "yuv420p",
            "-an",
            str(out),
        ]
    )


def concat_clips(clips: list[Path], out: Path) -> None:
    lst = OUT_DIR / "concat.txt"
    lst.write_text("".join(f"file '{c}'\n" for c in clips))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    title = OUT_DIR / "card-title.png"
    end = OUT_DIR / "card-end.png"
    s1 = OUT_DIR / "scene-voice.png"
    s2 = OUT_DIR / "scene-today.png"
    s3 = OUT_DIR / "scene-graph.png"

    title_card(title)
    end_card(end)
    phone_on_canvas(SHOTS / "phone-02-voice.png", s1, "Voice Organize → missions & memory")
    phone_on_canvas(SHOTS / "phone-01-today.png", s2, "Daily Life Brief → next best action")
    phone_on_canvas(SHOTS / "phone-03-life-graph.png", s3, "Life Graph → connected future")

    mp3 = OUT_DIR / "narration.mp3"
    print("Synthesizing narration with Piper neural TTS…")
    audio_dur = build_narration(mp3)
    print(f"Full narration (uncut): {audio_dur:.2f}s")

    target = audio_dur
    weights = [0.08, 0.24, 0.24, 0.24, 0.20]
    secs = [max(2.5, target * w) for w in weights]
    scale = target / sum(secs)
    secs = [s * scale for s in secs]

    clips = []
    specs = [
        (title, secs[0], 1.08),
        (s1, secs[1], 1.14),
        (s2, secs[2], 1.12),
        (s3, secs[3], 1.13),
        (end, secs[4], 1.06),
    ]
    for i, (img, sec, zoom) in enumerate(specs):
        print(f"  scene {i}: {sec:.2f}s")
        clip = OUT_DIR / f"clip-{i}.mp4"
        ken_burns_clip(img, sec, clip, zoom_end=zoom)
        clips.append(clip)

    silent = OUT_DIR / "silent.mp4"
    concat_clips(clips, silent)

    final_tmp = OUT_DIR / "product-demo.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(silent),
            "-i",
            str(mp3),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-t",
            f"{audio_dur:.3f}",
            "-movflags",
            "+faststart",
            str(final_tmp),
        ]
    )

    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    data = final_tmp.read_bytes()
    PUBLIC_OUT.write_bytes(data)
    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT.write_bytes(data)

    final_dur = probe_duration(PUBLIC_OUT)
    size_mb = PUBLIC_OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {PUBLIC_OUT} ({size_mb:.1f} MB, {final_dur:.2f}s) — ending fully preserved")


if __name__ == "__main__":
    main()
