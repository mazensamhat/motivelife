#!/usr/bin/env python3
"""Generate MotiveLife 45s website product demo MP4 (local ffmpeg + edge-tts)."""

from __future__ import annotations

import asyncio
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace")
SHOTS = ROOT / "apps/web/public/marketing/screenshots"
BRAND = ROOT / "apps/web/public/brand"
OUT_DIR = Path("/tmp/demo-video")
PUBLIC_OUT = ROOT / "apps/web/public/marketing/product-demo.mp4"
W, H = 1920, 1080
FPS = 30

SCRIPT = textwrap.dedent(
    """
    Know where your life is headed.
    MotiveLife builds a living AI Digital Twin that understands your calendar, money, health, and goals as one connected system.
    Just talk — say what's on your mind — and your coach organizes it into memory, missions, and next steps.
    Every morning, wake up to one clear briefing of your life and the single action that matters most today.
    See how sleep, stress, career, and money influence each other — then get the next best decision for your future.
    Predictions get sharper the more your Twin learns.
    The future doesn't have to be a guess.
    Build your Digital Twin today at MyMotiveLife.com.
    """
).strip()

VOICE = "en-US-JennyNeural"  # clear product voice
SPEECH_RATE = "-12%"


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:8]), "..." if len(cmd) > 8 else "")
    subprocess.run(cmd, check=True)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def phone_on_canvas(shot: Path, out: Path, label: str) -> None:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    draw = ImageDraw.Draw(bg)

    # Soft cyan radial glow
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

    # Device frame
    pad = 18
    frame = Image.new(
        "RGBA",
        (phone.width + pad * 2, phone.height + pad * 2),
        (10, 25, 48, 255),
    )
    # rounded-ish border via paste
    frame.paste(phone, (pad, pad), phone)
    x = (W - frame.width) // 2
    y = (H - frame.height) // 2 - 10
    bg.paste(frame, (x, y), frame)

    # Lower third label
    bar_h = 88
    draw.rectangle((0, H - bar_h, W, H), fill=(5, 13, 24))
    draw.rectangle((0, H - bar_h, 8, H), fill=(0, 198, 255))
    draw.text((48, H - 62), label, fill=(232, 238, 248), font=font(36))

    bg.save(out, "PNG")


def end_card(out: Path) -> None:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    draw = ImageDraw.Draw(bg)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r, a in ((900, 35), (600, 50)):
        gdraw.ellipse(
            (W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r),
            fill=(0, 114, 255, a),
        )
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(bg)

    logo_path = BRAND / "motivelife-logo.png"
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((420, 160), Image.Resampling.LANCZOS)
        bg.paste(logo, ((W - logo.width) // 2, 250), logo)

    draw.text(
        (W // 2, 480),
        "Know Where Your Life Is Headed.",
        fill=(255, 255, 255),
        font=font(54),
        anchor="mm",
    )
    draw.text(
        (W // 2, 580),
        "Build your AI Digital Twin",
        fill=(0, 198, 255),
        font=font(40),
        anchor="mm",
    )
    draw.text(
        (W // 2, 680),
        "mymotivelife.com",
        fill=(168, 184, 212),
        font=font(34),
        anchor="mm",
    )
    bg.save(out, "PNG")


def title_card(out: Path) -> None:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    draw = ImageDraw.Draw(bg)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r, a in ((800, 40), (480, 55)):
        gdraw.ellipse(
            (W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r),
            fill=(0, 255, 135, a),
        )
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(bg)

    logo_path = BRAND / "motivelife-logo.png"
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((460, 180), Image.Resampling.LANCZOS)
        bg.paste(logo, ((W - logo.width) // 2, 320), logo)

    draw.text(
        (W // 2, 620),
        "Your AI Life Operating System",
        fill=(208, 220, 237),
        font=font(42),
        anchor="mm",
    )
    bg.save(out, "PNG")


async def synthesize_voice(script: str, mp3: Path) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(script, VOICE, rate=SPEECH_RATE)
    await communicate.save(str(mp3))


def ken_burns_clip(image: Path, seconds: float, out: Path, zoom_end: float = 1.12) -> None:
    # zoompan: start slightly zoomed, ease in
    frames = max(1, int(seconds * FPS))
    # z expression: linear zoom from 1.0 to zoom_end
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
            f"{seconds:.2f}",
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
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-c",
            "copy",
            str(out),
        ]
    )


def mux(video: Path, audio: Path, out: Path) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
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
            "-shortest",
            "-movflags",
            "+faststart",
            str(out),
        ]
    )


async def main() -> None:
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
    print("Synthesizing narration…")
    await synthesize_voice(SCRIPT, mp3)

    # Probe audio duration and scale scene lengths to ~match
    probe = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(mp3),
        ],
        text=True,
    ).strip()
    audio_dur = float(probe)
    print(f"Narration duration: {audio_dur:.2f}s")

    # Build a fixed 45s timeline. Fit narration into ~43.5s so the end card has a beat.
    target = 45.0
    narration_window = 43.5
    tempo = max(0.9, min(1.2, audio_dur / narration_window)) if audio_dur > 0 else 1.0
    parts = [4.0, 12.0, 12.0, 11.0]
    end_sec = target - sum(parts)

    clips = []
    specs = [
        (title, parts[0], 1.08),
        (s1, parts[1], 1.14),
        (s2, parts[2], 1.12),
        (s3, parts[3], 1.13),
        (end, end_sec, 1.06),
    ]
    for i, (img, sec, zoom) in enumerate(specs):
        clip = OUT_DIR / f"clip-{i}.mp4"
        ken_burns_clip(img, sec, clip, zoom_end=zoom)
        clips.append(clip)

    silent = OUT_DIR / "silent.mp4"
    concat_clips(clips, silent)

    audio_padded = OUT_DIR / "narration-45.m4a"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp3),
            "-af",
            f"atempo={tempo:.4f},apad=pad_dur={target}",
            "-t",
            f"{target:.2f}",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(audio_padded),
        ]
    )

    final_tmp = OUT_DIR / "product-demo.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(silent),
            "-i",
            str(audio_padded),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-c:a",
            "copy",
            "-t",
            f"{target:.2f}",
            "-movflags",
            "+faststart",
            str(final_tmp),
        ]
    )

    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_bytes(final_tmp.read_bytes())

    final_dur = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(PUBLIC_OUT),
        ],
        text=True,
    ).strip()
    size_mb = PUBLIC_OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {PUBLIC_OUT} ({size_mb:.1f} MB, {float(final_dur):.1f}s)")


if __name__ == "__main__":
    asyncio.run(main())
