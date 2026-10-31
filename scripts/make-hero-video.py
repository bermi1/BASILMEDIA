"""Builds the homepage hero video loop from Basil Media photos (no audio, small files).

    python3 scripts/make-hero-video.py

Writes public/media/hero/basil-hero.mp4 (1280x720, desktop), basil-hero-portrait.mp4 (720x1280, phones)
and a poster JPG for each. Every photo is shown WHOLE (never cropped, so no heads are cut) over a soft
blurred copy of itself, with a gentle drift and crossfades. Swap the photos in PHOTOS and re-run.
"""
import subprocess
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
# Note: the live hero now uses real footage (basil-hero-reel*.mp4); this montage is a fallback.
PHOTOS = [
    'img/team/basil-media-team.jpg',
    'img/services/video-crew-conference.jpg',
    'img/team/crew-on-set.jpg',
    'img/services/photographer-event.jpg',
    'img/services/editing-studio.jpg',
    'img/services/event-coverage-team.jpg',
]
FPS, HOLD, FADE = 24, 2.6, 0.7  # seconds each photo is fully visible, seconds of crossfade


def layer(img: Image.Image, w: int, h: int):
    """Blurred cover background (static) and the whole photo contained (scaled per frame)."""
    bg = img.copy()
    s = max(w / bg.width, h / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - w) // 2, (bg.height - h) // 2, (bg.width - w) // 2 + w, (bg.height - h) // 2 + h))
    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(28))).enhance(0.65)
    fit = min(w / img.width, h / img.height)
    return bg, img, fit


def frame(bg, img, fit, w, h, t):
    """t in 0..1 across the photo's time on screen: grow from 94% to 100% of the contained size."""
    s = fit * (0.94 + 0.06 * t)
    fw, fh = round(img.width * s), round(img.height * s)
    out = bg.copy()
    out.paste(img.resize((fw, fh), Image.BILINEAR), ((w - fw) // 2, (h - fh) // 2))
    return out


def build(w: int, h: int, name: str):
    out_dir = PUB / 'media' / 'hero'
    out_dir.mkdir(parents=True, exist_ok=True)
    layers = [layer(Image.open(PUB / p).convert('RGB'), w, h) for p in PHOTOS]
    per = HOLD + FADE
    total = int(per * len(layers) * FPS)
    proc = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
         str(out_dir / f'{name}.mp4')],
        stdin=subprocess.PIPE)
    for f in range(total):
        sec = f / FPS
        i = int(sec // per) % len(layers)
        local = (sec - i * per) / per
        cur = frame(*layers[i], w, h, local)
        into_fade = sec - i * per - HOLD
        if into_fade > 0:  # crossfade into the next photo (the last one fades into the first: seamless loop)
            nxt = frame(*layers[(i + 1) % len(layers)], w, h, 0)
            cur = Image.blend(cur, nxt, min(1, into_fade / FADE))
        if f == 0:
            cur.save(out_dir / f'{name}-poster.jpg', quality=80)
        proc.stdin.write(cur.tobytes())
    proc.stdin.close()
    proc.wait()
    print(name, (out_dir / f'{name}.mp4').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    build(1280, 720, 'basil-hero-montage')
    build(720, 1280, 'basil-hero-montage-portrait')
