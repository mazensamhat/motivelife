#!/usr/bin/env python3
"""Generate ~45s pencil-sketch module videos for the MotiveLife suite.

Style: graphite on warm paper (no photoreal humans).
Voice: deep Piper male (ryan) + gentle pitch drop.
Outputs: apps/web/public/marketing/modules/{slug}.mp4 + poster jpg.
"""

from __future__ import annotations

import argparse
import math
import random
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path("/workspace")
OUT_PUBLIC = ROOT / "apps/web/public/marketing/modules"
ARTIFACT_DIR = Path("/opt/cursor/artifacts/module-pencil-videos")
WORK = Path("/tmp/module-pencil-videos")
PIPER_DIR = Path("/tmp/piper-voices")
PIPER_MODEL = PIPER_DIR / "en_US-ryan-medium.onnx"
PIPER_BIN = Path.home() / ".local/bin/piper"

W, H = 1920, 1080
FPS = 30
PAPER = (245, 239, 228)
GRAPHITE = (42, 42, 44)
GRAPHITE_MID = (78, 78, 82)
GRAPHITE_SOFT = (120, 118, 112)
ACCENT_INK = (55, 52, 48)

GAP_SEC = 0.75
END_PAD_SEC = 4.5


@dataclass(frozen=True)
class ModuleVideo:
    slug: str
    label: str
    tagline: str
    accent: tuple[int, int, int]
    lines: list[str]
    cta: str


MODULES: list[ModuleVideo] = [
    ModuleVideo(
        slug="dayo",
        label="DayO",
        tagline="Your day, briefed",
        accent=(180, 90, 40),
        lines=[
            "This is DayO — from the MotiveLife suite.",
            "Not another crowded calendar. Your day, briefed and ready.",
            "Each morning you get one clear mission — the move that matters most.",
            "Say what's on your mind out loud. DayO turns it into goals, tasks, and a next step.",
            "Protect deep work. Cut the noise. Keep the streak you can feel.",
            "When the day shifts, your brief shifts with you — calmly, not chaotically.",
            "Less scrolling. More finishing. One priority you can start now.",
            "Start your day with DayO — on MyMotiveLife.com.",
        ],
        cta="Start your day with DayO",
    ),
    ModuleVideo(
        slug="lifevue",
        label="LifeVue",
        tagline="Your life in one view",
        accent=(20, 120, 140),
        lines=[
            "This is LifeVue — your life in one view.",
            "Money, health, time, and goals — not in five apps, on one map.",
            "A living Digital Twin that learns how your week actually moves.",
            "See how sleep, stress, career, and cash flow pull on each other.",
            "Patterns become clear. Predictions get sharper the more you live.",
            "LifeVue doesn't just show data. It shows connection.",
            "When one domain slips, you see the ripple before it becomes a crisis.",
            "See your whole life with LifeVue — MyMotiveLife.com.",
        ],
        cta="See your life with LifeVue",
    ),
    ModuleVideo(
        slug="kinzo",
        label="KINZO AI",
        tagline="Family intelligence in motion",
        accent=(110, 70, 180),
        lines=[
            "This is KINZO AI — family intelligence in motion.",
            "Not just dots on a map. A household that knows when life is normal — and when it isn't.",
            "Live location, routines, and calm alerts when it actually matters.",
            "Know who is safe. Know when school pickup changes. Know when someone is on the way.",
            "Peace of mind without hovering. Presence without pressure.",
            "KINZO watches the flow of your family so you can stay human.",
            "Logistics intelligence for the people you love.",
            "Protect your household with KINZO — MyMotiveLife.com/family.",
        ],
        cta="Protect your household with KINZO",
    ),
    ModuleVideo(
        slug="uplift",
        label="UPLIFT",
        tagline="Your goals, elevated",
        accent=(180, 120, 30),
        lines=[
            "This is UPLIFT — your goals, elevated.",
            "A north star is useless without a next move you can finish this week.",
            "Big aims become weekly missions. Weekly missions become proof.",
            "Progress compounds when you can see it — not when you only wish for it.",
            "UPLIFT links ambition to action, then keeps you honest.",
            "Less wishing. More shipping. Momentum you can feel.",
            "When you stall, UPLIFT shrinks the scope — and protects the streak.",
            "Elevate your goals with UPLIFT — MyMotiveLife.com.",
        ],
        cta="Elevate your goals with UPLIFT",
    ),
    ModuleVideo(
        slug="kashu",
        label="Kashu",
        tagline="Know what's safe before you spend",
        accent=(16, 130, 100),
        lines=[
            "This is Kashu — Cash-Flow Intelligence.",
            "Know what is safe before you spend — not after the damage.",
            "Safe to Spend equals your balance, minus reserved obligations, minus your safety floor.",
            "Upload statements or enter bills by hand. No bank connect required.",
            "See timing, buffers, and what-if scenarios before money gets tight.",
            "Kashu protects the envelope so payday pressure doesn't blindside you.",
            "Spend with confidence. Hold the floor. Stay ahead of the squeeze.",
            "Protect your cash flow with Kashu — MyMotiveLife.com/cash-flow.",
        ],
        cta="Protect cash flow with Kashu",
    ),
    ModuleVideo(
        slug="vyra",
        label="VYRA AI",
        tagline="Your AI Chief of Staff",
        accent=(140, 60, 180),
        lines=[
            "This is VYRA AI — your personal Chief of Staff.",
            "Not another chat window. Quiet competence that remembers.",
            "Ask once. Get a plan, a priority, and a next action you can trust.",
            "Memory that sticks across days. Decisions that compound across weeks.",
            "VYRA holds context so you don't have to re-explain your life.",
            "When energy drops, it cuts scope. When momentum rises, it aims higher.",
            "Your Digital Twin deserves a chief who stays calm under noise.",
            "Meet VYRA on MyMotiveLife.com — and run your life with a staff.",
        ],
        cta="Meet VYRA — your Chief of Staff",
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


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        (
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
        ),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        ),
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def paper_bg(rng: random.Random, accent: tuple[int, int, int] | None = None) -> Image.Image:
    img = Image.new("RGB", (W, H), PAPER)
    px = img.load()
    for _ in range(18000):
        x = rng.randint(0, W - 1)
        y = rng.randint(0, H - 1)
        n = rng.randint(-10, 8)
        r, g, b = px[x, y]
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))

    # soft fiber streaks
    draw = ImageDraw.Draw(img, "RGBA")
    for _ in range(90):
        x0 = rng.randint(0, W)
        y0 = rng.randint(0, H)
        x1 = x0 + rng.randint(-180, 180)
        y1 = y0 + rng.randint(-40, 40)
        a = rng.randint(8, 22)
        draw.line((x0, y0, x1, y1), fill=(200, 190, 170, a), width=1)

    if accent:
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gdraw = ImageDraw.Draw(glow)
        for radius, alpha in ((720, 18), (420, 28)):
            gdraw.ellipse(
                (W // 2 - radius, H // 2 - radius - 40, W // 2 + radius, H // 2 + radius - 40),
                fill=(*accent, alpha),
            )
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    return img


def sketch_line(
    draw: ImageDraw.ImageDraw,
    pts: list[tuple[float, float]],
    rng: random.Random,
    color: tuple[int, int, int] = GRAPHITE,
    width: int = 3,
    wobble: float = 2.2,
    passes: int = 2,
) -> None:
    if len(pts) < 2:
        return
    for _ in range(passes):
        jittered: list[tuple[float, float]] = []
        for x, y in pts:
            jittered.append((x + rng.uniform(-wobble, wobble), y + rng.uniform(-wobble, wobble)))
        draw.line(jittered, fill=color, width=width, joint="curve")


def sketch_circle(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rng: random.Random,
    color: tuple[int, int, int] = GRAPHITE,
    width: int = 3,
    steps: int = 48,
) -> None:
    pts = []
    for i in range(steps + 1):
        ang = (i / steps) * math.tau
        rr = r + rng.uniform(-1.5, 1.5)
        pts.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr))
    sketch_line(draw, pts, rng, color=color, width=width, wobble=1.2, passes=2)


def hatch(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    rng: random.Random,
    density: int = 14,
    color: tuple[int, int, int] = GRAPHITE_SOFT,
) -> None:
    x0, y0, x1, y1 = box
    for i in range(density):
        t = i / max(1, density - 1)
        x = int(x0 + (x1 - x0) * t)
        sketch_line(
            draw,
            [(x, y0), (x + rng.randint(-8, 8), y1)],
            rng,
            color=color,
            width=1,
            wobble=1.0,
            passes=1,
        )


def pencilize(img: Image.Image) -> Image.Image:
    """Slight grit so frames feel hand-drawn, not vector-perfect."""
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(0.72)
    noise = Image.effect_noise((W, H), 12).convert("L")
    noise = ImageEnhance.Brightness(noise).enhance(1.35)
    paper = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, paper, 0.08).filter(ImageFilter.SMOOTH_MORE)


def draw_title_block(
    draw: ImageDraw.ImageDraw,
    rng: random.Random,
    label: str,
    tagline: str,
    y: int = 120,
) -> None:
    draw.text((120, y), label, fill=GRAPHITE, font=font(86))
    # underline sketch
    tw = int(draw.textlength(label, font=font(86)))
    sketch_line(
        draw,
        [(120, y + 100), (120 + tw + 20, y + 108)],
        rng,
        color=GRAPHITE_MID,
        width=3,
        wobble=1.5,
    )
    draw.text((120, y + 130), tagline, fill=GRAPHITE_MID, font=font(36, bold=False))


def scene_title(mod: ModuleVideo, rng: random.Random) -> Image.Image:
    img = paper_bg(rng, mod.accent)
    draw = ImageDraw.Draw(img)
    # margin frame
    sketch_line(draw, [(60, 50), (W - 60, 55), (W - 55, H - 55), (60, H - 50), (60, 50)], rng, width=2)
    draw_title_block(draw, rng, mod.label, mod.tagline, y=340)
    draw.text((120, 560), "MotiveLife suite  ·  pencil story", fill=GRAPHITE_SOFT, font=font(28, bold=False))
    # small brand mark
    sketch_circle(draw, 1700, 200, 48, rng, width=3)
    sketch_line(draw, [(1675, 200), (1700, 225), (1735, 175)], rng, width=4, wobble=1.0)
    return pencilize(img)


def scene_end(mod: ModuleVideo, rng: random.Random) -> Image.Image:
    img = paper_bg(rng, mod.accent)
    draw = ImageDraw.Draw(img)
    sketch_line(draw, [(60, 50), (W - 60, 55), (W - 55, H - 55), (60, H - 50), (60, 50)], rng, width=2)
    draw.text((W // 2, 340), mod.label, fill=GRAPHITE, font=font(78), anchor="mm")
    draw.text((W // 2, 440), mod.cta, fill=GRAPHITE_MID, font=font(40), anchor="mm")
    sketch_line(draw, [(660, 500), (1260, 508)], rng, color=GRAPHITE_SOFT, width=2)
    draw.text((W // 2, 580), "mymotivelife.com", fill=GRAPHITE, font=font(44), anchor="mm")
    draw.text((W // 2, 680), "Sketch the life you want. Live it with MotiveLife.", fill=GRAPHITE_SOFT, font=font(28, bold=False), anchor="mm")
    return pencilize(img)


# --- module-specific pencil scenes ---


def scene_dayo_brief(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (180, 90, 40))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Morning brief", "One mission. No noise.", 80)
    # notepad
    sketch_line(draw, [(180, 280), (1100, 280), (1100, 920), (180, 920), (180, 280)], rng, width=3)
    hatch(draw, (200, 300, 1080, 360), rng, density=8)
    draw.text((220, 320), "TODAY", fill=GRAPHITE, font=font(40))
    items = [
        "Ship the App Store listing",
        "Protect 90 minutes of deep work",
        "Walk after lunch",
    ]
    y = 420
    for i, item in enumerate(items):
        sketch_circle(draw, 250, y + 18, 16, rng, width=2)
        if i == 0:
            sketch_line(draw, [(240, y + 18), (250, y + 28), (265, y + 8)], rng, width=3, wobble=0.8)
        draw.text((290, y), item, fill=GRAPHITE if i == 0 else GRAPHITE_MID, font=font(34, bold=i == 0))
        y += 90
    # sun / day glyph
    sketch_circle(draw, 1450, 480, 110, rng, width=3)
    for i in range(8):
        ang = i * math.tau / 8
        sketch_line(
            draw,
            [
                (1450 + math.cos(ang) * 130, 480 + math.sin(ang) * 130),
                (1450 + math.cos(ang) * 170, 480 + math.sin(ang) * 170),
            ],
            rng,
            width=3,
        )
    draw.text((1450, 720), "DayO", fill=GRAPHITE, font=font(48), anchor="mm")
    return pencilize(img)


def scene_dayo_voice(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (180, 90, 40))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Just talk", "Voice becomes action", 80)
    # mic
    sketch_line(draw, [(860, 360), (860, 520), (1060, 520), (1060, 360)], rng, width=4)
    sketch_circle(draw, 960, 340, 70, rng, width=4)
    sketch_line(draw, [(960, 520), (960, 600)], rng, width=4)
    sketch_line(draw, [(880, 600), (1040, 600)], rng, width=4)
    # waveform
    pts = []
    for i in range(40):
        x = 220 + i * 36
        amp = 40 + 80 * abs(math.sin(i * 0.45))
        pts.append((x, 780 - amp))
        pts.append((x, 780 + amp * 0.35))
    sketch_line(draw, pts, rng, color=GRAPHITE_MID, width=2, wobble=1.5, passes=1)
    draw.text((220, 880), "goals · tasks · next step", fill=GRAPHITE_SOFT, font=font(32, bold=False))
    return pencilize(img)


def scene_lifevue_map(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (20, 120, 140))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Life map", "Everything connected", 70)
    nodes = [
        (480, 420, "Health"),
        (960, 320, "Career"),
        (1440, 420, "Money"),
        (700, 720, "Habits"),
        (1220, 720, "Time"),
        (960, 540, "You"),
    ]
    center = (960, 540)
    for x, y, _ in nodes[:-1]:
        sketch_line(draw, [center, (x, y)], rng, color=GRAPHITE_SOFT, width=2, wobble=1.2)
    for x, y, label in nodes:
        sketch_circle(draw, x, y, 54 if label != "You" else 70, rng, width=3)
        if label == "You":
            hatch(draw, (x - 40, y - 40, x + 40, y + 40), rng, density=10)
        draw.text((x, y + 90), label, fill=GRAPHITE, font=font(28), anchor="mm")
    return pencilize(img)


def scene_lifevue_twin(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (20, 120, 140))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Digital Twin", "Patterns → predictions", 70)
    # twin silhouette suggestion (abstract, not a face)
    sketch_circle(draw, 520, 480, 90, rng, width=3)
    sketch_line(draw, [(520, 570), (520, 820)], rng, width=4)
    sketch_line(draw, [(420, 640), (620, 640)], rng, width=3)
    sketch_line(draw, [(520, 820), (450, 960)], rng, width=3)
    sketch_line(draw, [(520, 820), (590, 960)], rng, width=3)
    # signal bars
    bars = [("Sleep", 0.7), ("Stress", 0.45), ("Focus", 0.82), ("Cash", 0.6)]
    x0 = 820
    for i, (name, v) in enumerate(bars):
        x = x0 + i * 240
        h = int(280 * v)
        sketch_line(draw, [(x, 820), (x, 820 - h), (x + 90, 820 - h), (x + 90, 820), (x, 820)], rng, width=3)
        hatch(draw, (x + 8, 820 - h, x + 82, 820), rng, density=max(4, int(10 * v)))
        draw.text((x + 45, 860), name, fill=GRAPHITE_MID, font=font(26), anchor="mm")
    return pencilize(img)


def scene_kinzo_map(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (110, 70, 180))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Family map", "Intelligence in motion", 70)
    # street grid
    for i in range(6):
        y = 320 + i * 110
        sketch_line(draw, [(120, y), (1800, y + rng.randint(-6, 6))], rng, color=GRAPHITE_SOFT, width=2, wobble=1)
    for i in range(8):
        x = 200 + i * 220
        sketch_line(draw, [(x, 280), (x + rng.randint(-10, 10), 980)], rng, color=GRAPHITE_SOFT, width=2, wobble=1)
    # family pins
    pins = [(520, 480, "Home"), (980, 560, "School"), (1380, 430, "Work"), (1180, 760, "On the way")]
    for x, y, label in pins:
        sketch_line(draw, [(x, y - 70), (x, y)], rng, width=3)
        sketch_circle(draw, x, y - 95, 28, rng, width=3)
        draw.text((x, y + 30), label, fill=GRAPHITE, font=font(26), anchor="mm")
    return pencilize(img)


def scene_kinzo_calm(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (110, 70, 180))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Calm alerts", "Peace without hovering", 70)
    # phone outline
    sketch_line(draw, [(720, 280), (1200, 280), (1200, 980), (720, 980), (720, 280)], rng, width=4)
    sketch_line(draw, [(860, 310), (1060, 310)], rng, width=3)
    messages = [
        "Maya arrived at school · on time",
        "Dad left work · ETA 18 min",
        "Quiet evening · everyone home",
    ]
    y = 400
    for msg in messages:
        sketch_line(draw, [(780, y), (1140, y), (1140, y + 110), (780, y + 110), (780, y)], rng, width=2)
        draw.text((800, y + 35), msg, fill=GRAPHITE, font=font(26, bold=False))
        y += 150
    return pencilize(img)


def scene_uplift_mountain(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (180, 120, 30))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "North star", "Goals elevated", 70)
    # mountain
    sketch_line(
        draw,
        [(160, 880), (520, 420), (780, 640), (1100, 300), (1500, 720), (1760, 880)],
        rng,
        width=4,
        wobble=2.5,
    )
    hatch(draw, (900, 360, 1300, 880), rng, density=18, color=GRAPHITE_SOFT)
    # flag on peak
    sketch_line(draw, [(1100, 300), (1100, 210)], rng, width=3)
    sketch_line(draw, [(1100, 210), (1180, 235), (1100, 260)], rng, width=3)
    draw.text((1100, 940), "Mission → weekly → done", fill=GRAPHITE_MID, font=font(34), anchor="mm")
    return pencilize(img)


def scene_uplift_ladder(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (180, 120, 30))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Momentum", "Progress you can see", 70)
    steps = ["Wish", "Plan", "Ship", "Compound"]
    for i, label in enumerate(steps):
        x0 = 220 + i * 400
        y0 = 820 - i * 110
        sketch_line(draw, [(x0, y0), (x0 + 300, y0), (x0 + 300, y0 + 90), (x0, y0 + 90), (x0, y0)], rng, width=3)
        hatch(draw, (x0 + 10, y0 + 10, x0 + 290, y0 + 80), rng, density=6 + i * 2)
        draw.text((x0 + 150, y0 + 30), label, fill=GRAPHITE, font=font(36), anchor="mm")
        if i < len(steps) - 1:
            sketch_line(draw, [(x0 + 300, y0 + 45), (x0 + 380, y0 - 40)], rng, width=3)
    return pencilize(img)


def scene_kashu_safe(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (16, 130, 100))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Safe to Spend", "Before you tap pay", 70)
    # formula boxes
    boxes = [
        (200, 360, "Balance"),
        (620, 360, "− Reserved"),
        (1040, 360, "− Floor"),
        (1460, 360, "= Safe"),
    ]
    for x, y, label in boxes:
        sketch_line(draw, [(x, y), (x + 280, y), (x + 280, y + 160), (x, y + 160), (x, y)], rng, width=3)
        draw.text((x + 140, y + 60), label, fill=GRAPHITE, font=font(32), anchor="mm")
    sketch_line(draw, [(200, 620), (1740, 628)], rng, color=GRAPHITE_SOFT, width=2)
    draw.text((960, 700), "Know what is safe before you spend.", fill=GRAPHITE, font=font(40), anchor="mm")
    draw.text((960, 780), "Statement upload · manual bills · no bank connect", fill=GRAPHITE_MID, font=font(30, bold=False), anchor="mm")
    # shield
    sketch_line(draw, [(960, 860), (880, 900), (880, 980), (960, 1020), (1040, 980), (1040, 900), (960, 860)], rng, width=3)
    return pencilize(img)


def scene_kashu_timing(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (16, 130, 100))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Cash timing", "Buffers & what-if", 70)
    # timeline
    sketch_line(draw, [(180, 560), (1740, 560)], rng, width=4)
    events = [
        (320, "Payday"),
        (700, "Rent"),
        (1080, "Bills"),
        (1460, "Safe window"),
    ]
    for x, label in events:
        sketch_line(draw, [(x, 530), (x, 590)], rng, width=3)
        sketch_circle(draw, x, 560, 14, rng, width=2)
        draw.text((x, 640), label, fill=GRAPHITE, font=font(28), anchor="mm")
    # buffer band
    sketch_line(draw, [(1080, 420), (1460, 420), (1460, 500), (1080, 500), (1080, 420)], rng, width=2)
    hatch(draw, (1090, 430, 1450, 490), rng, density=12, color=(16, 130, 100))
    draw.text((1270, 450), "buffer", fill=GRAPHITE, font=font(28), anchor="mm")
    draw.text((960, 820), "See the squeeze before it hits.", fill=GRAPHITE_MID, font=font(34), anchor="mm")
    return pencilize(img)


def scene_vyra_desk(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (140, 60, 180))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Chief of Staff", "Quiet competence", 70)
    # desk / papers
    sketch_line(draw, [(200, 880), (1720, 880)], rng, width=4)
    sketch_line(draw, [(420, 400), (900, 400), (900, 780), (420, 780), (420, 400)], rng, width=3)
    draw.text((460, 440), "Ask once", fill=GRAPHITE, font=font(36))
    notes = ["Priority", "Plan", "Next action"]
    y = 520
    for n in notes:
        sketch_line(draw, [(470, y), (500, y + 20), (530, y - 5)], rng, width=3, wobble=0.8)
        draw.text((560, y - 10), n, fill=GRAPHITE_MID, font=font(32, bold=False))
        y += 70
    # orbit / AI mark
    sketch_circle(draw, 1300, 560, 120, rng, width=3)
    sketch_circle(draw, 1300, 560, 70, rng, width=2)
    sketch_circle(draw, 1300, 560, 18, rng, width=3)
    for i in range(5):
        ang = i * math.tau / 5
        sketch_line(
            draw,
            [
                (1300 + math.cos(ang) * 70, 560 + math.sin(ang) * 70),
                (1300 + math.cos(ang) * 120, 560 + math.sin(ang) * 120),
            ],
            rng,
            width=2,
        )
    draw.text((1300, 740), "VYRA", fill=GRAPHITE, font=font(40), anchor="mm")
    return pencilize(img)


def scene_vyra_ask(rng: random.Random) -> Image.Image:
    img = paper_bg(rng, (140, 60, 180))
    draw = ImageDraw.Draw(img)
    draw_title_block(draw, rng, "Memory that sticks", "Decisions that compound", 70)
    bubbles = [
        (280, 360, 720, 520, "What should I protect this week?"),
        (900, 420, 1680, 620, "Guard mornings. Ship one mission. Review cash on Thursday."),
        (280, 680, 900, 840, "And if energy drops?"),
        (980, 700, 1680, 900, "Cut scope. Keep the streak. Move the rest to Friday."),
    ]
    for x0, y0, x1, y1, text in bubbles:
        sketch_line(draw, [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)], rng, width=2)
        draw.text((x0 + 30, y0 + 40), text, fill=GRAPHITE, font=font(28, bold=False))
    return pencilize(img)


SCENES = {
    "dayo": [scene_dayo_brief, scene_dayo_voice],
    "lifevue": [scene_lifevue_map, scene_lifevue_twin],
    "kinzo": [scene_kinzo_map, scene_kinzo_calm],
    "uplift": [scene_uplift_mountain, scene_uplift_ladder],
    "kashu": [scene_kashu_safe, scene_kashu_timing],
    "vyra": [scene_vyra_desk, scene_vyra_ask],
}


def ensure_piper() -> None:
    if PIPER_MODEL.exists():
        return
    PIPER_DIR.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "python3",
            "-m",
            "piper.download_voices",
            "en_US-ryan-medium",
            "--download-dir",
            str(PIPER_DIR),
        ],
        check=True,
    )


def synthesize_line(text: str, wav_out: Path) -> None:
    proc = subprocess.run(
        [
            str(PIPER_BIN),
            "--model",
            str(PIPER_MODEL),
            "--output_file",
            str(wav_out),
            "--length_scale",
            "1.48",
            "--noise_scale",
            "0.55",
            "--noise_w",
            "0.65",
        ],
        input=text + "\n",
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0 or not wav_out.exists():
        raise RuntimeError(proc.stderr or "piper failed")


def build_narration(mod: ModuleVideo, work: Path) -> tuple[Path, float]:
    ensure_piper()
    parts = work / "voice"
    parts.mkdir(parents=True, exist_ok=True)
    wavs: list[Path] = []
    for i, line in enumerate(mod.lines):
        wav = parts / f"line-{i:02d}.wav"
        print(f"    voice [{i+1}/{len(mod.lines)}]: {line[:60]}")
        synthesize_line(line, wav)
        wavs.append(wav)

    silence = work / "gap.wav"
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
    end_silence = work / "end-pad.wav"
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

    lst = work / "audio-concat.txt"
    with lst.open("w") as f:
        for i, wav in enumerate(wavs):
            f.write(f"file '{wav}'\n")
            if i < len(wavs) - 1:
                f.write(f"file '{silence}'\n")
        f.write(f"file '{end_silence}'\n")

    raw = work / "narration-raw.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(raw)])

    # Deepen: slight pitch drop + warm EQ + loudnorm
    mp3 = work / "narration.mp3"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw),
            "-af",
            (
                "asetrate=22050*0.88,aresample=48000,atempo=1.05,"
                "highpass=f=60,lowpass=f=9000,"
                "equalizer=f=120:t=q:w=1:g=3,equalizer=f=250:t=q:w=1:g=2,"
                "equalizer=f=3500:t=q:w=1:g=-2,"
                "acompressor=threshold=-18dB:ratio=2.8:attack=12:release=200,"
                "loudnorm=I=-16:TP=-1.5:LRA=10"
            ),
            "-ar",
            "48000",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(mp3),
        ]
    )
    return mp3, probe_duration(mp3)


def ken_burns(image: Path, seconds: float, out: Path, zoom_end: float = 1.1) -> None:
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


def crossfade_concat(clips: list[Path], out: Path, fade: float = 0.35) -> None:
    """Simple concat (hard cuts) — reliable and keeps exact duration."""
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{c}'\n" for c in clips))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])


def render_module(mod: ModuleVideo) -> Path:
    work = WORK / mod.slug
    work.mkdir(parents=True, exist_ok=True)
    rng = random.Random(hash(mod.slug) & 0xFFFFFFFF)

    print(f"\n=== {mod.label} ({mod.slug}) ===")
    title = work / "title.png"
    end = work / "end.png"
    scene_title(mod, rng).save(title, "PNG")
    scene_end(mod, rng).save(end, "PNG")

    scene_paths: list[Path] = []
    for i, fn in enumerate(SCENES[mod.slug]):
        p = work / f"scene-{i}.png"
        fn(random.Random(rng.randint(0, 10_000_000))).save(p, "PNG")
        scene_paths.append(p)

    print("  synthesizing deep narration…")
    mp3, audio_dur = build_narration(mod, work)
    print(f"  narration: {audio_dur:.2f}s")

    # Aim ~45s; pad or slightly compress scene timing to match audio
    target = max(42.0, min(52.0, audio_dur))
    # title, scene0, scene1, end
    weights = [0.12, 0.32, 0.32, 0.24]
    secs = [max(3.0, target * w) for w in weights]
    scale = audio_dur / sum(secs)
    secs = [s * scale for s in secs]

    clips: list[Path] = []
    specs = [
        (title, secs[0], 1.06),
        (scene_paths[0], secs[1], 1.12),
        (scene_paths[1], secs[2], 1.11),
        (end, secs[3], 1.05),
    ]
    for i, (img, sec, zoom) in enumerate(specs):
        print(f"  scene {i}: {sec:.2f}s")
        clip = work / f"clip-{i}.mp4"
        ken_burns(img, sec, clip, zoom_end=zoom)
        clips.append(clip)

    silent = work / "silent.mp4"
    crossfade_concat(clips, silent)

    final_tmp = work / f"{mod.slug}.mp4"
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
            "22",
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
    public_mp4 = OUT_PUBLIC / f"{mod.slug}.mp4"
    public_poster = OUT_PUBLIC / f"{mod.slug}-poster.jpg"
    public_mp4.write_bytes(final_tmp.read_bytes())
    Image.open(scene_paths[0]).convert("RGB").save(public_poster, "JPEG", quality=88, optimize=True)
    (ARTIFACT_DIR / f"{mod.slug}.mp4").write_bytes(public_mp4.read_bytes())
    (ARTIFACT_DIR / f"{mod.slug}-poster.jpg").write_bytes(public_poster.read_bytes())

    dur = probe_duration(public_mp4)
    mb = public_mp4.stat().st_size / (1024 * 1024)
    print(f"  wrote {public_mp4} ({mb:.1f} MB, {dur:.1f}s)")
    return public_mp4


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--only",
        nargs="*",
        default=None,
        help="Optional slug list (dayo lifevue kinzo uplift kashu vyra)",
    )
    args = parser.parse_args()
    selected = {s.lower() for s in args.only} if args.only else None

    WORK.mkdir(parents=True, exist_ok=True)
    for mod in MODULES:
        if selected and mod.slug not in selected:
            continue
        render_module(mod)
    print("\nDone.")


if __name__ == "__main__":
    main()
