# MotiveLife website product demo

Regenerate:

```bash
python3 -m piper.download_voices en_US-hfc_female-medium --download-dir /tmp/piper-voices
python3 scripts/generate-product-demo-video.py
```

Output: `apps/web/public/marketing/product-demo.mp4` (1920×1080, narrated with Piper neural TTS).

Uses product screenshots under `screenshots/` plus brand logo. Audio is never truncated — video length follows the full voiceover.
