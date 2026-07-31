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
POSTER_OUT = ROOT / "apps/web/public/marketing/product-demo-poster.jpg"
ARTIFACT = Path("/opt/cursor/artifacts/product-demo.mp4")
ARTIFACT_POSTER = Path("/opt/cursor/artifacts/product-demo-poster.jpg")
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


def brand_bg(accent: tuple[int, int, int] = (0, 198, 255)) -> Image.Image:
    bg = Image.new("RGB", (W, H), (5, 13, 24))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r, a in ((980, 24), (680, 36), (420, 50)):
        gdraw.ellipse(
            (W // 2 - r, H // 2 - r - 30, W // 2 + r, H // 2 + r - 30),
            fill=(*accent, a),
        )
    return Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")


def round_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, ...], radius: int = 28) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def scene_voice(out: Path) -> None:
    """Landscape product card — readable, no empty phone screenshot."""
    bg = brand_bg((0, 255, 135))
    draw = ImageDraw.Draw(bg)
    round_panel(draw, (80, 90, W - 80, H - 90), (10, 22, 40), 36)
    draw.text((140, 130), "VOICE ORGANIZE", fill=(0, 198, 255), font=font(28))
    draw.text((140, 180), "Just talk.", fill=(255, 255, 255), font=font(72))
    draw.text(
        (140, 270),
        "Brain dump out loud — AI turns it into goals, tasks, and your next action.",
        fill=(168, 184, 212),
        font=font(32),
    )

    # Mic badge
    cx, cy, r = 1580, 250, 78
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 198, 255))
    draw.ellipse((cx - 30, cy - 42, cx + 30, cy + 12), outline=(5, 13, 24), width=9)
    draw.rectangle((cx - 9, cy + 14, cx + 9, cy + 38), fill=(5, 13, 24))
    draw.arc((cx - 44, cy + 10, cx + 44, cy + 54), 0, 180, fill=(5, 13, 24), width=9)

    chips = [
        "Launch MotiveLife on App Store",
        "Call dentist",
        "Gym 3x this week",
        "Review subscriptions",
    ]
    x, y = 140, 360
    for chip in chips:
        tw = int(draw.textlength(chip, font=font(28)))
        round_panel(draw, (x, y, x + tw + 48, y + 58), (18, 36, 62), 999)
        draw.text((x + 24, y + 14), chip, fill=(0, 198, 255), font=font(28))
        x += tw + 64

    cards = [
        ("3 goals · 5 tasks created", "Ready on your Today dashboard"),
        ("Linked to Life GPS", "Career north star updated"),
        ("Memory updated", "Preferences saved to your Digital Twin"),
    ]
    y = 480
    for title, sub in cards:
        round_panel(draw, (140, y, W - 140, y + 120), (14, 30, 54), 22)
        draw.ellipse((170, y + 30, 238, y + 98), fill=(0, 255, 135))
        draw.text((204, y + 64), "✓", fill=(5, 13, 24), font=font(40), anchor="mm")
        draw.text((270, y + 32), title, fill=(255, 255, 255), font=font(36))
        draw.text((270, y + 78), sub, fill=(168, 184, 212), font=font(28))
        y += 140
    bg.save(out, "PNG")


def scene_today(out: Path) -> None:
    bg = brand_bg((0, 114, 255))
    draw = ImageDraw.Draw(bg)
    round_panel(draw, (80, 90, W - 80, H - 90), (8, 18, 34), 36)
    draw.text((140, 130), "DAILY LIFE BRIEF", fill=(0, 198, 255), font=font(28))
    draw.text((140, 180), "Good morning, Mazen.", fill=(255, 255, 255), font=font(56))
    draw.text((140, 255), "Today matters.", fill=(0, 198, 255), font=font(34))
    draw.text(
        (140, 310),
        "Your Chief of Staff reviewed your goals. One move unlocks momentum.",
        fill=(168, 184, 212),
        font=font(30),
    )

    round_panel(draw, (140, 390, 1180, 820), (12, 28, 52), 28)
    draw.text((180, 430), "TODAY HAS ONE PRIORITY", fill=(0, 198, 255), font=font(24))
    draw.text((180, 480), "Ship the App Store listing", fill=(255, 255, 255), font=font(44))
    draw.text((180, 540), "before lunch.", fill=(255, 255, 255), font=font(44))
    draw.text((180, 620), "+12 Life Score if you complete it", fill=(0, 255, 135), font=font(30))
    draw.text((180, 680), "ESTIMATED TIME  ·  45 min", fill=(168, 184, 212), font=font(26))
    round_panel(draw, (180, 740, 620, 800), (0, 255, 135), 999)
    draw.text((230, 754), "▶  Start today's mission", fill=(5, 13, 24), font=font(28))

    # Score ring panel
    round_panel(draw, (1240, 390, W - 140, 820), (12, 28, 52), 28)
    cx, cy, r = 1490, 560, 110
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(30, 50, 80), width=18)
    draw.arc((cx - r, cy - r, cx + r, cy + r), -90, 190, fill=(0, 198, 255), width=18)
    draw.text((cx, cy - 10), "78", fill=(255, 255, 255), font=font(64), anchor="mm")
    draw.text((cx, cy + 50), "Life Score", fill=(168, 184, 212), font=font(26), anchor="mm")
    draw.text((1490, 720), "7-day streak · trending up", fill=(0, 255, 135), font=font(26), anchor="mm")
    draw.text((1490, 770), "+4 this week", fill=(232, 238, 248), font=font(28), anchor="mm")
    bg.save(out, "PNG")


def scene_life_graph(out: Path) -> None:
    bg = brand_bg((0, 198, 255))
    draw = ImageDraw.Draw(bg)
    round_panel(draw, (80, 90, W - 80, H - 90), (8, 18, 34), 36)
    draw.text((140, 130), "LIFE GRAPH", fill=(0, 198, 255), font=font(28))
    draw.text((140, 180), "Your life map, connected.", fill=(255, 255, 255), font=font(52))
    draw.text(
        (140, 255),
        "See how career, health, money, and habits move together.",
        fill=(168, 184, 212),
        font=font(30),
    )

    rows = [
        ("Career", "Next: Ship App Store launch", 82),
        ("Health", "Next: 30-min walk", 71),
        ("Money", "Next: Review subscriptions", 68),
        ("Habits", "Streak: 7 days", 88),
    ]
    y = 340
    for name, nxt, score in rows:
        round_panel(draw, (140, y, 1200, y + 100), (14, 30, 54), 20)
        draw.text((180, y + 18), name, fill=(255, 255, 255), font=font(34))
        draw.text((180, y + 58), nxt, fill=(168, 184, 212), font=font(24))
        draw.text((1120, y + 28), str(score), fill=(0, 198, 255), font=font(44), anchor="mm")
        y += 118

    round_panel(draw, (1260, 340, W - 140, 800), (14, 30, 54), 24)
    cx, cy, r = 1510, 520, 120
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(30, 50, 80), width=20)
    draw.arc((cx - r, cy - r, cx + r, cy + r), -90, 200, fill=(0, 198, 255), width=20)
    draw.text((cx, cy - 8), "78", fill=(255, 255, 255), font=font(72), anchor="mm")
    draw.text((cx, 680), "Overall Life Score", fill=(232, 238, 248), font=font(30), anchor="mm")
    draw.text((cx, 730), "+4 this week · trending up", fill=(0, 255, 135), font=font(26), anchor="mm")

    round_panel(draw, (140, 820, W - 140, 960), (0, 40, 72), 20)
    draw.text((180, 850), "From your Chief of Staff", fill=(0, 198, 255), font=font(24))
    draw.text(
        (180, 895),
        "You moved the needle on career 3 days in a row. Protect mornings for deep work.",
        fill=(245, 248, 252),
        font=font(28),
    )
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
    # Designed landscape product cards — readable in 16:9 (no empty phone photos).
    scene_voice(s1)
    scene_today(s2)
    scene_life_graph(s3)

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

    # Poster: first readable product frame (voice scene), not an empty crop.
    poster_src = s1 if s1.exists() else title
    Image.open(poster_src).convert("RGB").save(POSTER_OUT, "JPEG", quality=90, optimize=True)
    ARTIFACT_POSTER.write_bytes(POSTER_OUT.read_bytes())

    final_dur = probe_duration(PUBLIC_OUT)
    size_mb = PUBLIC_OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {PUBLIC_OUT} ({size_mb:.1f} MB, {final_dur:.2f}s) — ending fully preserved")
    print(f"Wrote poster {POSTER_OUT}")


if __name__ == "__main__":
    main()
