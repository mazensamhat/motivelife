# MotiveLife website product demo

## Full product demo

```bash
python3 -m piper.download_voices en_US-hfc_female-medium --download-dir /tmp/piper-voices
python3 scripts/generate-product-demo-video.py
```

Output: `apps/web/public/marketing/product-demo.mp4` (1920×1080, narrated with Piper neural TTS).

## Suite pencil stories (~45s each)

Graphite-on-paper films with deep male narration for DayO, LifeVue, KINZO, UPLIFT, Kashu, and VYRA.

```bash
python3 -m piper.download_voices en_US-ryan-medium --download-dir /tmp/piper-voices
python3 scripts/generate-module-pencil-videos.py
# optional: python3 scripts/generate-module-pencil-videos.py --only kashu kinzo
```

Outputs: `apps/web/public/marketing/modules/{slug}.mp4` + `{slug}-poster.jpg`.

Website gallery: `/videos` (also embedded on `/cash-flow` and `/family`).
