// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Makes docs/themes.gif: the same game in every tile style, one after another,
// with a slow crossfade between them and back to the first.
//
//   npm install
//   npx playwright install chromium   # once
//   npm run demo-gif
//
// FRAMES=some/dir also writes each style's frame and the middle of each fade
// there as PNGs, to look at without a GIF viewer.
//
// It is repeatable: Math.random is seeded, so the deal, the pairs cleared and
// every frame come out the same each run. The game is served straight from
// the working tree, so it shows the styles as they are now.

import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const ROOT = new URL('../', import.meta.url);
const OUT = new URL('docs/themes.gif', ROOT);

// The page is laid out at 1050 x 660, so the bar fits on one line, and drawn
// at 0.7 of that, which keeps the GIF light.
const PAGE_W = 1050, PAGE_H = 660, SCALE = .7;
const W = Math.round(PAGE_W * SCALE), H = Math.round(PAGE_H * SCALE);
const PAIRS = 10;           // pairs cleared first, so the layers show
const HOLD = 2200;          // ms each style stays on screen
const FADE = 900;           // ms each crossfade takes
const STEPS = 9;            // frames in a crossfade

const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', json: 'application/json' };

async function capture() {
  const browser = await chromium.launch();
  // Reduced motion: tiles leave at once and nothing is mid-animation in a shot.
  const page = await browser.newPage({ viewport: { width: PAGE_W, height: PAGE_H }, deviceScaleFactor: SCALE, locale: 'en-GB', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    let a = 20261006; // mulberry32, as in the game
    Math.random = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  });
  await page.route('http://mahjong.local/**', route => {
    let path = new URL(route.request().url()).pathname;
    if (path === '/') path = '/index.html';
    route.fulfill({ body: readFileSync(new URL('.' + path, ROOT)), contentType: TYPES[path.split('.').pop()] });
  });

  // A fresh visitor in English, without the blocked-tile shading, and a deal
  // with no surprise in it.
  await page.goto('http://mahjong.local/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('turtle-mahjong-lang', 'en');
    localStorage.setItem('turtle-mahjong-shade', '0');
  });
  await page.reload();
  await page.waitForSelector('.skin', { state: 'attached' });
  await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('turtle-mahjong-game'));
    S.event = null;
    localStorage.setItem('turtle-mahjong-game', JSON.stringify(S));
  });
  await page.reload();
  await page.waitForSelector('.skin', { state: 'attached' });
  await page.waitForTimeout(800); // web fonts

  for (let k = 0; k < PAIRS; k++) {
    await page.keyboard.press('h');
    const pair = await page.$$eval('.tile.hint', els => els.map(e => +e.dataset.i));
    for (const i of pair) await page.click(`.tile[data-i="${i}"]`, { force: true });
  }
  await page.mouse.move(PAGE_W - 2, PAGE_H - 2);

  const ids = await page.$$eval('.skin', els => els.map(e => e.dataset.id));
  const shots = [];
  for (const id of ids) {
    await page.click('#skinBtn');
    await page.click(`.skin[data-id="${id}"]`);
    await page.mouse.move(PAGE_W - 2, PAGE_H - 2);
    await page.evaluate(() => { document.getElementById('toast').hidden = true; document.activeElement?.blur(); });
    await page.waitForTimeout(400);
    shots.push(PNG.sync.read(await page.screenshot()).data);
    console.log('captured', id);
  }
  await browser.close();
  return shots;
}

// Each frame gets its own 256-colour palette; the held frames are shown once
// with a long delay, the crossfades a few frames at a time.
function encode(shots) {
  const gif = GIFEncoder();
  let first = true;
  const frame = (rgba, delay) => {
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay, ...(first ? { repeat: 0 } : {}) });
    first = false;
  };
  const ease = t => t * t * (3 - 2 * t); // smoothstep: slow out of one, slow into the next
  const mix = new Uint8ClampedArray(W * H * 4);
  const dump = (rgba, name) => {
    if (!process.env.FRAMES) return;
    const png = new PNG({ width: W, height: H });
    png.data = Buffer.from(rgba);
    writeFileSync(`${process.env.FRAMES}/${name}.png`, PNG.sync.write(png));
  };
  shots.forEach((from, k) => {
    frame(from, HOLD);
    dump(from, `${k}-style`);
    const to = shots[(k + 1) % shots.length];
    for (let s = 1; s <= STEPS; s++) {
      const t = ease(s / (STEPS + 1));
      for (let p = 0; p < mix.length; p++) mix[p] = from[p] + (to[p] - from[p]) * t;
      frame(mix, Math.round(FADE / STEPS));
      if (s === Math.ceil(STEPS / 2)) dump(mix, `${k}-fade`);
    }
  });
  gif.finish();
  return gif.bytes();
}

const bytes = encode(await capture());
mkdirSync(new URL('docs/', ROOT), { recursive: true });
writeFileSync(OUT, bytes);
console.log(`wrote docs/themes.gif, ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
