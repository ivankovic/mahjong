# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright", "pillow"]
# ///
"""Make docs/themes.gif: the same game in every tile style, one after another,
with a slow crossfade between them and back to the first.

    uv run tools/demo_gif.py

The versions it runs with are pinned in demo_gif.py.lock next to it, and it
installs the headless browser it needs on the first run.

It is repeatable: Math.random is seeded, so the deal, the pairs cleared and
every frame come out the same each run. The game is served straight from the
working tree, so it shows the styles as they are now. FRAMES=some/dir also
writes each style's frame and the middle of each fade there as PNGs.
"""

import io
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "themes.gif"

# The page is laid out at 1050 x 660, so the bar fits on one line, and drawn
# at 0.7 of that, which keeps the GIF light.
PAGE_W, PAGE_H, SCALE = 1050, 660, 0.7
PAIRS = 10    # pairs cleared first, so the layers show
HOLD = 2200   # ms each style stays on screen
FADE = 900    # ms each crossfade takes
STEPS = 9     # frames in a crossfade

TYPES = {"html": "text/html", "js": "text/javascript", "css": "text/css", "svg": "image/svg+xml", "json": "application/json"}

SEED_RANDOM = """
  let a = 20261006; // mulberry32, as in the game
  Math.random = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
"""


def serve(route):
    path = route.request.url.split("mahjong.local", 1)[1].split("?")[0]
    if path == "/":
        path = "/index.html"
    route.fulfill(body=(ROOT / path.lstrip("/")).read_bytes(), content_type=TYPES[path.rsplit(".", 1)[1]])


def capture():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Reduced motion: tiles leave at once and nothing is mid-animation in a shot.
        page = browser.new_page(viewport={"width": PAGE_W, "height": PAGE_H}, device_scale_factor=SCALE,
                                locale="en-GB", reduced_motion="reduce")
        page.add_init_script(SEED_RANDOM)
        page.route("http://mahjong.local/**", serve)

        # A fresh visitor in English, without the blocked-tile shading, and a
        # deal with no surprise in it.
        page.goto("http://mahjong.local/")
        page.evaluate("""() => {
          localStorage.clear();
          localStorage.setItem('turtle-mahjong-lang', 'en');
          localStorage.setItem('turtle-mahjong-shade', '0');
        }""")
        page.reload()
        page.wait_for_selector(".skin", state="attached")
        page.evaluate("""() => {
          const S = JSON.parse(localStorage.getItem('turtle-mahjong-game'));
          S.event = null;
          localStorage.setItem('turtle-mahjong-game', JSON.stringify(S));
        }""")
        page.reload()
        page.wait_for_selector(".skin", state="attached")
        page.wait_for_timeout(800)  # web fonts

        for _ in range(PAIRS):
            page.keyboard.press("h")
            for i in page.eval_on_selector_all(".tile.hint", "els => els.map(e => +e.dataset.i)"):
                page.click(f'.tile[data-i="{i}"]', force=True)
        page.mouse.move(PAGE_W - 2, PAGE_H - 2)

        shots = []
        for style in page.eval_on_selector_all(".skin", "els => els.map(e => e.dataset.id)"):
            page.click("#skinBtn")
            page.click(f'.skin[data-id="{style}"]')
            page.mouse.move(PAGE_W - 2, PAGE_H - 2)
            page.evaluate("() => { document.getElementById('toast').hidden = true; document.activeElement?.blur(); }")
            page.wait_for_timeout(400)
            shots.append(Image.open(io.BytesIO(page.screenshot())).convert("RGB"))
            print("captured", style)
        browser.close()
        return shots


def encode(shots):
    """Held frames are shown once with a long delay, the crossfades a few
    frames at a time; each frame gets its own 256-colour palette."""
    dump = os.environ.get("FRAMES")
    frames, durations = [], []
    ease = lambda t: t * t * (3 - 2 * t)  # smoothstep: slow out of one, slow into the next
    for k, shot in enumerate(shots):
        frames.append(shot)
        durations.append(HOLD)
        if dump:
            shot.save(Path(dump) / f"{k}-style.png")
        nxt = shots[(k + 1) % len(shots)]
        for s in range(1, STEPS + 1):
            mix = Image.blend(shot, nxt, ease(s / (STEPS + 1)))
            frames.append(mix)
            durations.append(round(FADE / STEPS))
            if dump and s == (STEPS + 1) // 2:
                mix.save(Path(dump) / f"{k}-fade.png")
    # Fast octree: no visible blotches in the gradients, and it compresses far
    # better than median cut, whose near-identical colours defeat LZW.
    paletted = [f.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE) for f in frames]
    OUT.parent.mkdir(exist_ok=True)
    paletted[0].save(OUT, save_all=True, append_images=paletted[1:], duration=durations, loop=0)
    print(f"wrote docs/themes.gif, {OUT.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    # The browser that matches this Playwright; a no-op once it is there.
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    encode(capture())
