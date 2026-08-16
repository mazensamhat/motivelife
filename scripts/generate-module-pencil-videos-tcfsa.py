#!/usr/bin/env python3
"""TCFSA-style MotiveLife suite videos.

Matches https://www.tcfsa.ca/ overview films:
- AI graphite pencil stills on warm paper
- Soft Ken Burns
- Bottom caption banners + teal underline accents
- Corner brand mark
- Deep professional Edge TTS (Christopher, slowed/pitched)
- ~45 seconds each
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
from dataclasses import dataclass
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace")
FRAMES = ROOT / "apps/web/public/marketing/modules/frames"
OUT_PUBLIC = ROOT / "apps/web/public/marketing/modules"
BRAND_LOGO = ROOT / "apps/web/public/brand/motivelife-logo.png"
ARTIFACT_DIR = Path("/opt/cursor/artifacts/module-pencil-videos")
WORK = Path("/tmp/module-tcfsa-videos")

W, H = 1920, 1080
FPS = 30
TEAL = (32, 140, 150)
VOICE = "en-US-ChristopherNeural"
VOICE_RATE = "-12%"
VOICE_PITCH = "-10Hz"


@dataclass(frozen=True)
class ModuleFilm:
    slug: str
    label: str
    tagline: str
    captions: list[str]  # one per scene + opener feel
    script: str
    frame_names: list[str]


FILMS: list[ModuleFilm] = [
    ModuleFilm(
        slug="dayo",
        label="DayO",
        tagline="Your day, briefed",
        captions=[
            "your day, briefed",
            "just talk — it becomes action",
            "one morning mission",
        ],
        script=(
            "When your day starts crowded, you want one clear brief — not another noisy calendar. "
            "This is DayO, from MotiveLife. "
            "Each morning you get the mission that matters most — the move that unlocks the rest of the day. "
            "Say what's on your mind out loud, and DayO turns it into goals, tasks, and a next step. "
            "Protect deep work. Cut the noise. Keep the streak you can feel. "
            "When the day shifts, your brief shifts with you — calmly, not chaotically. "
            "Less scrolling. More finishing. One priority you can start now. "
            "Start your day with DayO, on MyMotiveLife.com."
        ),
        frame_names=["ml-dayo-01.png", "ml-dayo-02.png", "ml-dayo-03.png"],
    ),
    ModuleFilm(
        slug="lifevue",
        label="LifeVue",
        tagline="Your life in one view",
        captions=[
            "your life in one view",
            "a living digital twin",
            "patterns become clear",
        ],
        script=(
            "When life is scattered across apps, you want one view that actually connects. "
            "This is LifeVue. "
            "Money, health, time, and goals — on one map. "
            "A living Digital Twin that learns how your week really moves. "
            "See how sleep, stress, career, and cash flow pull on each other. "
            "Patterns become clear. Predictions get sharper the more you live. "
            "When one domain slips, you see the ripple before it becomes a crisis. "
            "See your whole life with LifeVue, on MyMotiveLife.com."
        ),
        frame_names=["ml-lifevue-01.png", "ml-lifevue-02.png", "ml-lifevue-03.png"],
    ),
    ModuleFilm(
        slug="kinzo",
        label="KINZO AI",
        tagline="Family intelligence in motion",
        captions=[
            "family intelligence in motion",
            "calm alerts when it matters",
            "peace without hovering",
        ],
        script=(
            "When family life is in motion, you want intelligence — not just dots on a map. "
            "This is KINZO AI. "
            "Live location, routines, and calm alerts when it actually matters. "
            "Know who is safe. Know when school pickup changes. Know when someone is on the way. "
            "Peace of mind without hovering. Presence without pressure. "
            "KINZO watches the flow of your household so you can stay human. "
            "Protect your family with KINZO, at MyMotiveLife.com/family."
        ),
        frame_names=["ml-kinzo-01.png", "ml-kinzo-02.png", "ml-kinzo-03.png"],
    ),
    ModuleFilm(
        slug="uplift",
        label="UPLIFT",
        tagline="Your goals, elevated",
        captions=[
            "your goals, elevated",
            "north star to next move",
            "momentum you can see",
        ],
        script=(
            "When goals stay vague, you want a next move you can finish this week. "
            "This is UPLIFT. "
            "A north star is useless without a climb you can take today. "
            "Big aims become weekly missions. Weekly missions become proof. "
            "Progress compounds when you can see it — not when you only wish for it. "
            "UPLIFT links ambition to action, then keeps you honest. "
            "When you stall, it shrinks the scope and protects the streak. "
            "Less wishing. More shipping. Momentum you can feel. "
            "Elevate your goals with UPLIFT, on MyMotiveLife.com."
        ),
        frame_names=["ml-uplift-01.png", "ml-uplift-02.png", "ml-uplift-03.png"],
    ),
    ModuleFilm(
        slug="kashu",
        label="Kashu",
        tagline="Know what's safe before you spend",
        captions=[
            "know what's safe before you spend",
            "safe to spend, clearly",
            "timing, buffers, what-if",
        ],
        script=(
            "When money gets tight, you want to know what is safe before you spend — not after. "
            "This is Kashu, Cash-Flow Intelligence from MotiveLife. "
            "Safe to Spend equals your balance, minus reserved obligations, minus your safety floor. "
            "Upload statements or enter bills by hand. No bank connect required. "
            "See timing, buffers, and what-if scenarios before payday pressure blindsides you. "
            "Spend with confidence. Hold the floor. Stay ahead of the squeeze. "
            "Protect your cash flow with Kashu, at MyMotiveLife.com/cash-flow."
        ),
        frame_names=["ml-kashu-01.png", "ml-kashu-02.png", "ml-kashu-03.png"],
    ),
    ModuleFilm(
        slug="vyra",
        label="VYRA AI",
        tagline="Your AI Chief of Staff",
        captions=[
            "your AI chief of staff",
            "ask once — get the plan",
            "memory that sticks",
        ],
        script=(
            "When decisions pile up, you want a chief of staff — not another chat window. "
            "This is VYRA AI. "
            "Ask once. Get a plan, a priority, and a next action you can trust. "
            "Memory that sticks across days. Decisions that compound across weeks. "
            "VYRA holds context so you don't have to re-explain your life. "
            "When energy drops, it cuts scope. When momentum rises, it aims higher. "
            "Meet VYRA on MyMotiveLife.com — and run your life with quiet competence."
        ),
        frame_names=["ml-vyra-01.png", "ml-vyra-02.png", "ml-vyra-03.png"],
    ),
]


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


def font(size: int, italic: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if italic:
        candidates.extend(
            [
                "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
            ]
        )
    candidates.extend(
        [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def fit_cover(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    scale = max(W / img.width, H / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - W) // 2
    top = (nh - H) // 2
    return img.crop((left, top, left + W, top + H))


def soft_fade(img: Image.Image) -> Image.Image:
    """TCFSA-like soft wipe toward empty paper on bottom-right."""
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    paper = (245, 239, 228)
    for i in range(420):
        alpha = int(255 * (i / 420) ** 1.35 * 0.72)
        x0 = W - 420 + i
        draw.rectangle((x0, 0, W, H), fill=(*paper, alpha))
    for i in range(260):
        alpha = int(255 * (i / 260) ** 1.2 * 0.55)
        y0 = H - 260 + i
        draw.rectangle((0, y0, W, H), fill=(*paper, alpha))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def add_brand_mark(img: Image.Image) -> Image.Image:
    base = img.convert("RGBA")
    if BRAND_LOGO.exists():
        logo = Image.open(BRAND_LOGO).convert("RGBA")
        logo.thumbnail((220, 72), Image.Resampling.LANCZOS)
        # darken slightly for paper contrast
        mark = Image.new("RGBA", (logo.width + 24, logo.height + 16), (245, 239, 228, 170))
        mark.paste(logo, (12, 8), logo)
        base.alpha_composite(mark, (W - mark.width - 48, 36))
    else:
        draw = ImageDraw.Draw(base)
        draw.text((W - 280, 48), "MotiveLife", fill=(60, 60, 62, 220), font=font(28))
    return base.convert("RGB")


def add_caption(img: Image.Image, caption: str) -> Image.Image:
    base = img.convert("RGBA")
    banner = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(banner)
    f = font(42, italic=True)
    # measure
    bbox = draw.textbbox((0, 0), caption, font=f)
    tw = bbox[2] - bbox[0]
    pad_x, pad_y = 36, 22
    bw = tw + pad_x * 2
    bh = (bbox[3] - bbox[1]) + pad_y * 2
    x0, y0 = 72, H - 140
    draw.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), radius=10, fill=(255, 252, 247, 200))
    draw.text((x0 + pad_x, y0 + pad_y - 4), caption, fill=(42, 42, 44, 255), font=f)
    # teal underline accent
    draw.rectangle((x0 + pad_x, y0 + bh - 14, x0 + pad_x + min(160, tw // 2), y0 + bh - 10), fill=(*TEAL, 230))
    return Image.alpha_composite(base, banner).convert("RGB")


def compose_scene(src: Path, caption: str, out: Path) -> None:
    img = fit_cover(Image.open(src))
    img = soft_fade(img)
    img = add_brand_mark(img)
    img = add_caption(img, caption)
    img.save(out, "PNG")


def end_card(film: ModuleFilm, out: Path) -> None:
    img = Image.new("RGB", (W, H), (245, 239, 228))
    # paper grain
    noise = Image.effect_noise((W, H), 10).convert("L")
    img = Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.06)
    draw = ImageDraw.Draw(img)
    draw.text((W // 2, 360), film.label, fill=(42, 42, 44), font=font(78), anchor="mm")
    draw.text((W // 2, 460), film.tagline, fill=(90, 88, 84), font=font(36, italic=True), anchor="mm")
    draw.rectangle((W // 2 - 80, 510, W // 2 + 80, 516), fill=TEAL)
    draw.text((W // 2, 580), "mymotivelife.com", fill=(42, 42, 44), font=font(40), anchor="mm")
    img = add_brand_mark(img)
    img.save(out, "PNG")


async def synthesize_edge(text: str, mp3_out: Path) -> None:
    communicate = edge_tts.Communicate(text, VOICE, rate=VOICE_RATE, pitch=VOICE_PITCH)
    await communicate.save(str(mp3_out))


def polish_audio(raw_mp3: Path, out_mp3: Path) -> float:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw_mp3),
            "-af",
            (
                "highpass=f=70,lowpass=f=10000,"
                "equalizer=f=120:t=q:w=1:g=2.5,equalizer=f=250:t=q:w=1:g=1.5,"
                "equalizer=f=3500:t=q:w=1:g=-1.5,"
                "acompressor=threshold=-18dB:ratio=2.5:attack=12:release=180,"
                "loudnorm=I=-16:TP=-1.5:LRA=10,"
                "apad=pad_dur=2.5"
            ),
            "-ar",
            "48000",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(out_mp3),
        ]
    )
    return probe_duration(out_mp3)


def ken_burns(image: Path, seconds: float, out: Path, zoom_end: float = 1.08) -> None:
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
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{c}'\n" for c in clips))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])


def render_film(film: ModuleFilm) -> Path:
    work = WORK / film.slug
    work.mkdir(parents=True, exist_ok=True)
    print(f"\n=== {film.label} ({film.slug}) — TCFSA style ===")

    scene_pngs: list[Path] = []
    for i, (frame_name, caption) in enumerate(zip(film.frame_names, film.captions)):
        src = FRAMES / frame_name
        if not src.exists():
            raise FileNotFoundError(src)
        out = work / f"scene-{i}.png"
        compose_scene(src, caption, out)
        scene_pngs.append(out)

    end = work / "end.png"
    end_card(film, end)

    raw_voice = work / "voice-raw.mp3"
    print("  synthesizing deep Edge TTS (Christopher)…")
    asyncio.run(synthesize_edge(film.script, raw_voice))
    mp3 = work / "narration.mp3"
    audio_dur = polish_audio(raw_voice, mp3)
    print(f"  narration: {audio_dur:.2f}s")

    # 3 scenes + end card
    weights = [0.28, 0.28, 0.28, 0.16]
    secs = [max(4.0, audio_dur * w) for w in weights]
    scale = audio_dur / sum(secs)
    secs = [s * scale for s in secs]

    clips: list[Path] = []
    specs = [
        (scene_pngs[0], secs[0], 1.09),
        (scene_pngs[1], secs[1], 1.08),
        (scene_pngs[2], secs[2], 1.10),
        (end, secs[3], 1.04),
    ]
    for i, (img, sec, zoom) in enumerate(specs):
        print(f"  scene {i}: {sec:.2f}s")
        clip = work / f"clip-{i}.mp4"
        ken_burns(img, sec, clip, zoom_end=zoom)
        clips.append(clip)

    silent = work / "silent.mp4"
    concat_clips(clips, silent)

    final_tmp = work / f"{film.slug}.mp4"
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
            "-shortest",
            "-movflags",
            "+faststart",
            str(final_tmp),
        ]
    )

    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    public_mp4 = OUT_PUBLIC / f"{film.slug}.mp4"
    public_poster = OUT_PUBLIC / f"{film.slug}-poster.jpg"
    public_mp4.write_bytes(final_tmp.read_bytes())
    Image.open(scene_pngs[0]).convert("RGB").save(public_poster, "JPEG", quality=90, optimize=True)
    (ARTIFACT_DIR / f"{film.slug}.mp4").write_bytes(public_mp4.read_bytes())
    (ARTIFACT_DIR / f"{film.slug}-poster.jpg").write_bytes(public_poster.read_bytes())

    dur = probe_duration(public_mp4)
    mb = public_mp4.stat().st_size / (1024 * 1024)
    print(f"  wrote {public_mp4} ({mb:.1f} MB, {dur:.1f}s)")
    return public_mp4


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", default=None)
    args = parser.parse_args()
    selected = {s.lower() for s in args.only} if args.only else None
    WORK.mkdir(parents=True, exist_ok=True)
    for film in FILMS:
        if selected and film.slug not in selected:
            continue
        render_film(film)
    print("\nDone — TCFSA-style suite films ready.")


if __name__ == "__main__":
    main()
