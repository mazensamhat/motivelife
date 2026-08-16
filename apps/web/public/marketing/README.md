# MotiveLife website product demo

## Full product demo

```bash
python3 -m piper.download_voices en_US-hfc_female-medium --download-dir /tmp/piper-voices
python3 scripts/generate-product-demo-video.py
```

Output: `apps/web/public/marketing/product-demo.mp4` (1920×1080, narrated with Piper neural TTS).

## Suite pencil stories (TCFSA style, ~45s each)

Matches the graphite overview films on [tcfsa.ca](https://www.tcfsa.ca/):
AI pencil stills, caption banners, teal accents, deep Edge TTS (`en-US-ChristopherNeural`).

Frames live in `modules/frames/`. Regenerate MP4s:

```bash
pip install edge-tts
python3 scripts/generate-module-pencil-videos-tcfsa.py
# optional: python3 scripts/generate-module-pencil-videos-tcfsa.py --only kashu kinzo
```

Outputs: `apps/web/public/marketing/modules/{slug}.mp4` + `{slug}-poster.jpg`.

Website gallery: `/videos` (also embedded on `/cash-flow` and `/family`).
