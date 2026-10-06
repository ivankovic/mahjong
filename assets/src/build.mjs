// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: CC-BY-NC-ND-4.0
//
// Draws every tile set. This file is the source of the art, so it is licensed
// as art. Run it with `node assets/src/build.mjs`; it writes one SVG sprite per
// style to assets/themes/<id>.svg and the list of styles to themes.json.
//
// Every sprite has the same 42 faces as <symbol id="<style>-k-<face>">, on a
// 40 x 53 face:
//   c1..c9, b1..b9, d1..d9   the three counting suits
//   wE wS wW wN gR gG gW     the seven honour tiles (winds and dragons)
//   f1..f4                   the first "any matches any" group (flowers)
//   s1..s4                   the second one (seasons)

import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../themes/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/* ---------- SVG helpers ---------- */

const attrs = o => Object.entries(o)
  .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${v}"`).join(' ');
const C = (cx, cy, r, o = {}) => `<circle ${attrs({ cx, cy, r, ...o })}/>`;
const E = (cx, cy, rx, ry, o = {}) => `<ellipse ${attrs({ cx, cy, rx, ry, ...o })}/>`;
const R = (x, y, width, height, o = {}) => `<rect ${attrs({ x, y, width, height, ...o })}/>`;
const P = (d, o = {}) => `<path ${attrs({ d, ...o })}/>`;
const G = (o, ...kids) => `<g ${attrs(o)}>${kids.join('')}</g>`;
const line = (c, w) => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
const r1 = n => Math.round(n * 10) / 10;

// A picture drawn in a 100 x 100 box, placed centred on (cx, cy) at `size` wide.
const place = (pic, cx, cy, size) =>
  `<g transform="translate(${r1(cx - size / 2)} ${r1(cy - size / 2)}) scale(${size / 100})">${pic}</g>`;

// Several shapes with one outline round all of them, as if cut from one piece.
const outlined = (shapes, fill, stroke, w) =>
  shapes({ fill: stroke, stroke, strokeWidth: w * 2, strokeLinejoin: 'round' }) + shapes({ fill });

const starPath = (cx, cy, R, r, n = 5, turn = -90) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (turn + i * 180 / n) * Math.PI / 180, d = i % 2 ? r : R;
    pts.push(`${r1(cx + d * Math.cos(a))} ${r1(cy + d * Math.sin(a))}`);
  }
  return 'M' + pts.join(' L') + ' Z';
};
const spiralPath = (cx, cy, rMax, turns, rMin = 3) => {
  const steps = Math.round(turns * 24), pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * turns * 2 * Math.PI, r = rMin + (rMax - rMin) * t;
    pts.push(`${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`);
  }
  return 'M' + pts.join(' L');
};

/* ---------- How a kids' tile is laid out ---------- */

// Pip positions for 1..9 in a 40 x 44 area under the number band, and the
// width each pip is drawn at.
const PIPS = {
  1: [30, [[20, 22]]],
  2: [18, [[20, 11], [20, 33]]],
  3: [15, [[10, 8], [20, 22], [30, 36]]],
  4: [16, [[11, 11], [29, 11], [11, 33], [29, 33]]],
  5: [14, [[10, 8], [30, 8], [20, 22], [10, 36], [30, 36]]],
  6: [13, [[11, 8], [29, 8], [11, 22], [29, 22], [11, 36], [29, 36]]],
  7: [11.5, [[11, 6.5], [29, 6.5], [8, 22], [20, 22], [32, 22], [11, 37.5], [29, 37.5]]],
  8: [10.5, [[11, 5.5], [29, 5.5], [11, 16.5], [29, 16.5], [11, 27.5], [29, 27.5], [11, 38.5], [29, 38.5]]],
  9: [11.5, [[8, 7], [20, 7], [32, 7], [8, 22], [20, 22], [32, 22], [8, 37], [20, 37], [32, 37]]],
};
const KID_FONT = "Fredoka, 'Trebuchet MS', 'Comic Sans MS', sans-serif";

function kidSet(t) {
  const faces = {};
  const suit = (key, pic, colour) => {
    for (let n = 1; n <= 9; n++) {
      const [size, pts] = PIPS[n];
      faces[key + n] =
        `<text x="20" y="5.2" text-anchor="middle" dominant-baseline="central" style="font-family:${KID_FONT};font-weight:700;font-size:7.5px;fill:${colour}">${n}</text>` +
        pts.map(([x, y]) => place(pic, x, y + 9, size)).join('');
    }
  };
  suit('c', t.suits.c.pic, t.suits.c.colour);
  suit('b', t.suits.b.pic, t.suits.b.colour);
  suit('d', t.suits.d.pic, t.suits.d.colour);
  ['wE', 'wS', 'wW', 'wN', 'gR', 'gG', 'gW'].forEach((k, i) => { faces[k] = place(t.honours[i].pic, 20, 27, 36); });
  const bonus = (key, group) => group.items.forEach((it, i) => {
    faces[key + (i + 1)] =
      `<rect x="3" y="3" width="34" height="47" rx="3" style="fill:none;stroke:${group.colour};stroke-width:1.4"/>` +
      place(it.pic, 20, 27, 29);
  });
  bonus('f', t.flowers);
  bonus('s', t.seasons);
  return faces;
}

/* ---------- Classic ---------- */

function classicSet() {
  const HEX = { ink: '#1b1b1b', red: '#c2291e', green: '#1b7643', blue: '#20509b', plum: '#a02f68', teal: '#136d79' };
  const col = c => `var(--t-${c}, ${HEX[c]})`;
  const glyph = (ch, x, y, size, c, w = 900) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--f-glyph, 'Noto Serif TC', serif);font-weight:${w};font-size:${size}px;fill:${col(c)}">${ch}</text>`;
  const index = (t, c, x = 4, y = 8.5) =>
    `<text x="${x}" y="${y}" style="font-family:var(--f-ui, sans-serif);font-weight:600;font-size:7px;fill:${col(c)}">${t}</text>`;
  const dot = (cx, cy, r, c) =>
    `<circle cx="${cx}" cy="${cy}" r="${r1(r * .82)}" style="fill:none;stroke:${col(c)};stroke-width:${r1(r * .34)}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r1(r * .3)}" style="fill:${col(c)}"/>`;
  const stick = (cx, cy, h, c, w = 4.6) => {
    const x = r1(cx - w / 2), y = r1(cy - h / 2);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" style="fill:${col(c)}"/>` +
      `<line x1="${x}" x2="${r1(x + w)}" y1="${cy}" y2="${cy}" style="stroke:rgba(0,0,0,.35);stroke-width:.9"/>` +
      `<line x1="${cx}" x2="${cx}" y1="${r1(y + 1.6)}" y2="${r1(y + h - 1.6)}" style="stroke:rgba(255,255,255,.4);stroke-width:.8"/>`;
  };
  const frame = c => `<rect x="3.5" y="3.5" width="33" height="46" rx="2.5" style="fill:none;stroke:${col(c)};stroke-width:1"/>`;
  const dots = (list, r) => list.map(([x, y, c]) => dot(x, y, r, c)).join('');
  const NUM = '一二三四五六七八九';
  const faces = {};
  const DOTS = {
    1: dot(20, 26.5, 15, 'blue') + `<circle cx="20" cy="26.5" r="6.5" style="fill:none;stroke:${col('red')};stroke-width:1.2"/>`,
    2: dots([[20, 15, 'green'], [20, 38, 'blue']], 8.5),
    3: dots([[10, 12, 'blue'], [20, 26.5, 'red'], [30, 41, 'green']], 7.4),
    4: dots([[11, 14, 'blue'], [29, 14, 'green'], [11, 39, 'green'], [29, 39, 'blue']], 8),
    5: dots([[10, 12, 'blue'], [30, 12, 'green'], [20, 26.5, 'red'], [10, 41, 'green'], [30, 41, 'blue']], 7.2),
    6: dots([[12, 10, 'green'], [28, 10, 'green'], [12, 29, 'red'], [28, 29, 'red'], [12, 43, 'red'], [28, 43, 'red']], 6.4),
    7: dots([[9, 8, 'green'], [20, 13.5, 'green'], [31, 19, 'green'], [12, 32, 'red'], [28, 32, 'red'], [12, 45, 'red'], [28, 45, 'red']], 5.5),
    8: dots([9, 20.5, 32, 44].flatMap(y => [[12, y, 'blue'], [28, y, 'blue']]), 5.6),
    9: dots([[12, 'blue'], [26.5, 'red'], [41, 'green']].flatMap(([y, c]) => [9, 20, 31].map(x => [x, y, c])), 5.5),
  };
  const BAMBOO = {
    1: stick(20, 27, 40, 'green', 8) +
       `<ellipse cx="11" cy="17" rx="7" ry="2.6" transform="rotate(-35 11 17)" style="fill:${col('green')}"/>` +
       `<ellipse cx="29" cy="33" rx="7" ry="2.6" transform="rotate(-35 29 33)" style="fill:${col('green')}"/>` +
       `<circle cx="20" cy="6.5" r="3" style="fill:${col('red')}"/>`,
    2: stick(20, 14.5, 19, 'green') + stick(20, 38.5, 19, 'blue'),
    3: stick(20, 14.5, 19, 'green') + stick(12, 38.5, 19, 'blue') + stick(28, 38.5, 19, 'blue'),
    4: [[12, 14.5, 'green'], [28, 14.5, 'blue'], [12, 38.5, 'blue'], [28, 38.5, 'green']].map(([x, y, c]) => stick(x, y, 19, c)).join(''),
    5: [[10, 13.5, 'green'], [30, 13.5, 'blue'], [10, 39.5, 'blue'], [30, 39.5, 'green']].map(([x, y, c]) => stick(x, y, 17, c)).join('') + stick(20, 26.5, 17, 'red'),
    6: [9, 20, 31].map(x => stick(x, 14.5, 19, 'green') + stick(x, 38.5, 19, 'blue')).join(''),
    7: stick(20, 9, 13, 'red') + [9, 20, 31].map(x => stick(x, 26.5, 13, 'green') + stick(x, 43, 13, 'green')).join(''),
    8: [7.5, 15.8, 24.2, 32.5].map(x => stick(x, 14.5, 19, 'green', 4.2) + stick(x, 38.5, 19, 'green', 4.2)).join(''),
    9: [9, 20, 31].map(x => [10, 26.5, 43].map(y => stick(x, y, 14, x === 20 ? 'red' : 'green')).join('')).join(''),
  };
  for (let n = 1; n <= 9; n++) {
    faces['c' + n] = index(n, 'ink') + glyph(NUM[n - 1], 20, 16, 19, 'ink') + glyph('萬', 20, 38.5, 21, 'red');
    faces['b' + n] = BAMBOO[n];
    faces['d' + n] = DOTS[n];
  }
  const WIND = { E: '東', S: '南', W: '西', N: '北' };
  for (const w of 'ESWN') faces['w' + w] = index(w, 'ink') + glyph(WIND[w], 20, 28, 28, 'ink');
  faces.gR = glyph('中', 20, 27.5, 31, 'red');
  faces.gG = glyph('發', 20, 27.5, 29, 'green');
  faces.gW = `<rect x="7" y="7.5" width="26" height="38" rx="2" style="fill:none;stroke:${col('blue')};stroke-width:2.6"/>` +
             `<rect x="11.5" y="12" width="17" height="29" rx="1" style="fill:none;stroke:${col('blue')};stroke-width:1"/>`;
  ['梅', '蘭', '菊', '竹'].forEach((ch, i) => { faces['f' + (i + 1)] = frame('plum') + index(i + 1, 'plum', 7, 12) + glyph(ch, 20, 30, 22, 'plum'); });
  ['春', '夏', '秋', '冬'].forEach((ch, i) => { faces['s' + (i + 1)] = frame('teal') + index(i + 1, 'teal', 7, 12) + glyph(ch, 20, 30, 22, 'teal'); });
  return faces;
}

/* ---------- Pictures shared by several styles ---------- */

const sun = (fill = '#ffc93c', ray = '#ffab00', edge = '#d98c00') =>
  Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4;
    return P(`M${r1(50 + 31 * Math.cos(a))} ${r1(50 + 31 * Math.sin(a))} L${r1(50 + 45 * Math.cos(a))} ${r1(50 + 45 * Math.sin(a))}`, line(ray, 7));
  }).join('') + C(50, 50, 24, { fill, stroke: edge, strokeWidth: 3 });

const rainCloud = (edge = '#4f6f94') => {
  const drop = x => P(`M${x} 70 Q${x + 7} 80 ${x} 86 Q${x - 7} 80 ${x} 70 Z`, { fill: '#3f8ce8' });
  return outlined(o => C(34, 44, 16, o) + C(55, 34, 20, o) + C(72, 46, 14, o) + R(22, 42, 56, 18, { rx: 9, ...o }), '#eef3fb', edge, 3) +
    drop(32) + drop(50) + drop(68);
};
const moon = (fill = '#ffe082', edge = '#c9a227') =>
  P('M60 10 A40 40 0 1 0 90 64 A32 32 0 1 1 60 10 Z', { fill, stroke: edge, strokeWidth: 3, strokeLinejoin: 'round' }) +
  P(starPath(78, 24, 9, 4), { fill }) ;
const star = (fill = '#ffd54f', edge = '#c79a00') =>
  P(starPath(50, 54, 44, 19), { fill, stroke: edge, strokeWidth: 4, strokeLinejoin: 'round' });

/* ---------- Dog Park ---------- */

function dogs() {
  const O = '#4a3423';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const bone = outlined(o => G({ transform: 'rotate(-30 50 50)' },
    C(24, 40, 12, o), C(24, 60, 12, o), C(76, 40, 12, o), C(76, 60, 12, o), R(24, 40, 52, 20, o)), '#f3d9a4', '#8b5a2b', 3.5);
  const paw = E(50, 66, 21, 17, { fill: '#8b5a2b' }) +
    C(27, 42, 9, { fill: '#8b5a2b' }) + C(42, 28, 9.5, { fill: '#8b5a2b' }) + C(58, 28, 9.5, { fill: '#8b5a2b' }) + C(73, 42, 9, { fill: '#8b5a2b' });
  const ball = C(50, 50, 40, { fill: '#d4e157', stroke: '#7c8b1a', strokeWidth: 4 }) +
    P('M16 28 Q46 50 16 72', line('#fff', 6)) + P('M84 28 Q54 50 84 72', line('#fff', 6));

  const dog = ({ head, ear, muzzle = head, pointy = false, spots = [], eye = '#1d1d1d', mask = false }) =>
    (pointy ? P('M18 42 L22 6 L46 26 Z', { fill: ear, ...s }) + P('M82 42 L78 6 L54 26 Z', { fill: ear, ...s }) +
      P('M25 30 L26 17 L37 26 Z', { fill: '#f5b5c0' }) + P('M75 30 L74 17 L63 26 Z', { fill: '#f5b5c0' }) : '') +
    E(50, 52, 33, 34, { fill: head, ...s }) +
    (pointy ? '' : E(17, 48, 11, 24, { fill: ear, transform: 'rotate(18 17 48)', ...s }) + E(83, 48, 11, 24, { fill: ear, transform: 'rotate(-18 83 48)', ...s })) +
    (mask ? P('M24 62 Q36 40 50 52 Q64 40 76 62 Q72 86 50 86 Q28 86 24 62 Z', { fill: '#fff' }) : '') +
    spots.map(([x, y, r]) => C(x, y, r, { fill: '#1d1d1d' })).join('') +
    E(50, 69, 17, 13, { fill: muzzle }) +
    C(37, 45, 5.5, { fill: eye }) + C(63, 45, 5.5, { fill: eye }) + C(38.5, 43.5, 1.8, { fill: '#fff' }) + C(64.5, 43.5, 1.8, { fill: '#fff' }) +
    P('M45 74 Q50 86 55 74 Z', { fill: '#f27a8a' }) +
    E(50, 61, 7.5, 5.5, { fill: '#1d1d1d' }) +
    P('M50 65 V70 M50 70 Q44 76 39 71 M50 70 Q56 76 61 71', line('#1d1d1d', 2.5));

  const doghouse = R(20, 46, 60, 44, { fill: '#c99a63', ...s }) + P('M8 50 L50 12 L92 50 Z', { fill: '#d9483b', ...s }) +
    P('M38 90 V68 A12 12 0 0 1 62 68 V90 Z', { fill: '#3a2a1d' }) + R(40, 52, 20, 8, { rx: 2, fill: '#fff3d6' });
  const bowl = C(30, 50, 8, { fill: '#9b6235', ...s }) + C(45, 45, 8, { fill: '#9b6235', ...s }) + C(59, 46, 8, { fill: '#9b6235', ...s }) + C(71, 51, 8, { fill: '#9b6235', ...s }) +
    P('M10 54 H90 L80 86 H20 Z', { fill: '#3f7fd6', ...s }) + R(8, 50, 84, 9, { rx: 4, fill: '#5b97e6', ...s }) + place(bone, 50, 71, 26);
  const hydrant = R(20, 50, 16, 12, { rx: 3, fill: '#e0392f', ...s }) + R(64, 50, 16, 12, { rx: 3, fill: '#e0392f', ...s }) +
    R(46, 10, 8, 9, { rx: 2, fill: '#b52a22', ...s }) + P('M32 40 Q50 8 68 40 Z', { fill: '#e0392f', ...s }) +
    R(34, 38, 32, 46, { rx: 4, fill: '#e0392f', ...s }) + R(28, 80, 44, 11, { rx: 3, fill: '#b52a22', ...s }) +
    C(50, 58, 6, { fill: '#b52a22', ...s });

  const frisbee = E(50, 56, 42, 24, { fill: '#ff7a29', ...s }) + E(50, 52, 27, 13, { fill: '#ff9b54', stroke: '#c95514', strokeWidth: 2.5 });
  const rope = G({ transform: 'rotate(-35 50 50)' },
    R(16, 42, 68, 16, { rx: 8, fill: '#fff', ...s }),
    P('M32 43 L26 57 M45 43 L39 57 M58 43 L52 57 M71 43 L65 57', line('#e0392f', 5)),
    C(14, 50, 12, { fill: '#3f7fd6', ...s }), C(86, 50, 12, { fill: '#3f7fd6', ...s }));
  const duck = E(54, 64, 34, 22, { fill: '#ffd23f', ...s }) + C(38, 36, 17, { fill: '#ffd23f', ...s }) +
    P('M22 34 L8 39 L22 44 Z', { fill: '#ff8a1f', ...s }) + C(34, 32, 3.5, { fill: '#1d1d1d' }) +
    P('M54 58 Q68 50 76 62 Q64 72 54 66 Z', { fill: '#f5b800' });
  const stick = P('M14 80 L86 24', line('#8b5a2b', 12)) + P('M56 48 L68 68', line('#8b5a2b', 8)) +
    E(74, 72, 9, 5, { fill: '#66bb6a', transform: 'rotate(40 74 72)' });
  const leaf = G({ transform: 'rotate(25 50 50)' },
    P('M50 8 C84 26 88 70 50 92 C12 70 16 26 50 8 Z', { fill: '#e8742a', ...s }),
    P('M50 16 V96 M50 40 L34 30 M50 40 L66 30 M50 60 L32 50 M50 60 L68 50', line('#a8461a', 3)));
  const snowflake = [0, 60, 120].map(a => G({ transform: `rotate(${a} 50 50)` },
    P('M50 8 V92 M50 22 L41 13 M50 22 L59 13 M50 78 L41 87 M50 78 L59 87', line('#3d8bd6', 6)))).join('') + C(50, 50, 6, { fill: '#3d8bd6' });

  return {
    id: 'dogs', name: 'Dog Park', preview: 'wS',
    fx: { paw, bone },
    suits: { c: { name: 'bones', pic: bone, colour: '#8b5a2b' }, b: { name: 'paw prints', pic: paw, colour: '#8b5a2b' }, d: { name: 'tennis balls', pic: ball, colour: '#6b7a10' } },
    honours: [
      { name: 'Dalmatian', pic: dog({ head: '#ffffff', ear: '#2b2b2b', spots: [[30, 30, 5], [68, 30, 3.5], [74, 62, 4], [58, 24, 2.5]] }) },
      { name: 'Golden retriever', pic: dog({ head: '#e3a650', ear: '#c4822f', muzzle: '#f4d39b' }) },
      { name: 'Pug', pic: dog({ head: '#e9cb9c', ear: '#3b2a20', muzzle: '#4a3528' }) },
      { name: 'Husky', pic: dog({ head: '#7f8c99', ear: '#7f8c99', pointy: true, mask: true, muzzle: '#fff', eye: '#3d8bfd' }) },
      { name: 'Doghouse', pic: doghouse },
      { name: 'Food bowl', pic: bowl },
      { name: 'Fire hydrant', pic: hydrant },
    ],
    flowers: { group: 'toy', colour: '#e0592a', items: [
      { name: 'Frisbee', pic: frisbee }, { name: 'Rope toy', pic: rope }, { name: 'Rubber duck', pic: duck }, { name: 'Stick', pic: stick }] },
    seasons: { group: 'weather tile', colour: '#2f7de1', items: [
      { name: 'Sunshine', pic: sun() }, { name: 'Rain', pic: rainCloud() }, { name: 'Autumn leaf', pic: leaf }, { name: 'Snowflake', pic: snowflake }] },
  };
}

/* ---------- Chameleon Jungle ---------- */

function chameleons() {
  const O = '#1f3a24';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const leaf = P('M50 6 C84 24 88 72 50 94 C12 72 16 24 50 6 Z', { fill: '#43a047', stroke: O, strokeWidth: 4 }) +
    P('M50 16 V86', line('#c8e6c9', 4));
  const ladybug = C(50, 22, 14, { fill: '#212121' }) + C(50, 56, 36, { fill: '#e53935', stroke: O, strokeWidth: 4 }) +
    P('M50 22 V92', line('#212121', 4)) +
    C(34, 46, 7, { fill: '#212121' }) + C(66, 46, 7, { fill: '#212121' }) + C(36, 72, 6, { fill: '#212121' }) + C(64, 72, 6, { fill: '#212121' });
  const tail = P(spiralPath(50, 50, 40, 2.6), line('#1e9e78', 9));

  const chameleon = (main, belly, spot) =>
    P('M4 88 Q50 78 96 90', line('#8d6e63', 7)) +
    P(spiralPath(76, 70, 13, 1.6, 2), line(main, 7)) +
    P('M40 60 L34 84 M62 60 L68 84', line(main, 7)) +
    P('M24 32 L28 12 L40 26 Z', { fill: main, ...s }) +
    P('M16 48 Q20 22 50 24 Q82 26 86 50 Q84 68 54 68 Q26 68 16 48 Z', { fill: main, ...s }) +
    P('M24 54 Q52 64 82 54', line(belly, 5)) +
    C(54, 38, 4, { fill: spot }) + C(67, 45, 3.5, { fill: spot }) + C(44, 47, 3, { fill: spot }) + C(74, 34, 3, { fill: spot }) +
    C(28, 40, 9, { fill: belly, stroke: O, strokeWidth: 3 }) + C(26, 40, 4, { fill: '#1b1b1b' }) +
    P('M13 50 Q19 55 27 52', line(O, 2.5));

  const butterfly = E(32, 36, 21, 18, { fill: '#3d8ef0', transform: 'rotate(-20 32 36)', ...s }) + E(68, 36, 21, 18, { fill: '#3d8ef0', transform: 'rotate(20 68 36)', ...s }) +
    E(35, 66, 15, 13, { fill: '#7cb9ff', ...s }) + E(65, 66, 15, 13, { fill: '#7cb9ff', ...s }) +
    C(30, 34, 5, { fill: '#fff' }) + C(70, 34, 5, { fill: '#fff' }) +
    E(50, 52, 5, 26, { fill: O }) + P('M48 28 Q42 12 34 10 M52 28 Q58 12 66 10', line(O, 2.5));
  const mushroom = R(38, 50, 24, 38, { rx: 8, fill: '#fff3e0', ...s }) + P('M8 58 Q12 12 50 12 Q88 12 92 58 Z', { fill: '#e53935', ...s }) +
    C(32, 34, 6, { fill: '#fff' }) + C(56, 26, 7, { fill: '#fff' }) + C(72, 44, 5, { fill: '#fff' }) + C(46, 47, 5, { fill: '#fff' });
  const rainbow = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa']
    .map((c, i) => { const r = 42 - i * 6; return P(`M${50 - r} 76 A${r} ${r} 0 0 1 ${50 + r} 76`, { fill: 'none', stroke: c, strokeWidth: 6.5 }); }).join('') +
    outlined(o => C(12, 78, 9, o) + C(22, 80, 7, o), '#fff', '#90a4ae', 2) + outlined(o => C(88, 78, 9, o) + C(78, 80, 7, o), '#fff', '#90a4ae', 2);
  const flower = (n, petal, centre, rx = 13, ry = 22) =>
    Array.from({ length: n }, (_, i) => E(50, 28, rx, ry, { fill: petal, stroke: O, strokeWidth: 3, transform: `rotate(${r1(i * 360 / n)} 50 50)` })).join('') +
    C(50, 50, 11, { fill: centre, stroke: O, strokeWidth: 3 });

  return {
    id: 'chameleons', name: 'Chameleon Jungle', preview: 'wS',
    fx: { leaf, ladybug },
    suits: { c: { name: 'leaves', pic: leaf, colour: '#2e7d32' }, b: { name: 'ladybirds', pic: ladybug, colour: '#c62828' }, d: { name: 'curly tails', pic: tail, colour: '#00796b' } },
    honours: [
      { name: 'Green chameleon', pic: chameleon('#5cc64f', '#d7f5a3', '#2e8b3a') },
      { name: 'Orange chameleon', pic: chameleon('#ff8f2e', '#ffe0a8', '#c9480f') },
      { name: 'Blue chameleon', pic: chameleon('#3d8ef0', '#c6e3ff', '#1d5fb8') },
      { name: 'Pink chameleon', pic: chameleon('#e05ac8', '#ffd1f3', '#9c2a8a') },
      { name: 'Butterfly', pic: butterfly },
      { name: 'Mushroom', pic: mushroom },
      { name: 'Rainbow', pic: rainbow },
    ],
    flowers: { group: 'flower', colour: '#d81b60', items: [
      { name: 'Red hibiscus', pic: flower(5, '#ef3e5c', '#ffd54f') },
      { name: 'Purple orchid', pic: flower(6, '#ab47bc', '#fff59d', 12, 20) },
      { name: 'Sunflower', pic: flower(12, '#ffca28', '#6d4c41', 7, 20) },
      { name: 'Peach blossom', pic: flower(4, '#ff8a65', '#fff176', 16, 22) }] },
    seasons: { group: 'sky tile', colour: '#1e88e5', items: [
      { name: 'Sun', pic: sun() }, { name: 'Rain cloud', pic: rainCloud(O) }, { name: 'Moon', pic: moon() }, { name: 'Star', pic: star() }] },
  };
}

/* ---------- Coral Reef ---------- */

function reef() {
  const O = '#173a5e';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const fish = P('M66 50 L92 28 L92 72 Z', { fill: '#ff8a1f', ...s, strokeWidth: 4 }) +
    E(44, 50, 34, 24, { fill: '#ff8a1f', stroke: O, strokeWidth: 4 }) +
    P('M42 30 Q36 50 42 70', line('#fff', 7)) + C(24, 44, 5, { fill: O });
  const shell = R(40, 82, 20, 11, { rx: 3, fill: '#f8a5c2', ...s }) +
    P('M50 90 L12 44 Q16 8 50 8 Q84 8 88 44 Z', { fill: '#f8a5c2', ...s }) +
    P('M50 86 L28 16 M50 86 L42 10 M50 86 L58 10 M50 86 L72 16', line('#d9658f', 3));
  const starfish = P(starPath(50, 54, 46, 20), { fill: '#ffa62b', stroke: '#c4660a', strokeWidth: 4, strokeLinejoin: 'round' }) +
    [[50, 24], [26, 46], [74, 46], [36, 74], [64, 74], [50, 54]].map(([x, y]) => C(x, y, 3.5, { fill: '#ffd59a' })).join('');

  const octopus = [22, 36, 50, 64, 78].map((x, i) => P(`M${x} 52 Q${x + (i % 2 ? 10 : -10)} 72 ${x + (i % 2 ? -2 : 4)} 90`, line('#9c5cd4', 9))).join('') +
    E(50, 40, 32, 30, { fill: '#9c5cd4', ...s }) +
    C(39, 42, 7, { fill: '#fff' }) + C(61, 42, 7, { fill: '#fff' }) + C(40, 43, 3.5, { fill: O }) + C(62, 43, 3.5, { fill: O }) +
    P('M42 56 Q50 63 58 56', line(O, 3));
  const turtle = E(22, 38, 13, 7, { fill: '#8bc34a', transform: 'rotate(-35 22 38)', ...s }) + E(78, 38, 13, 7, { fill: '#8bc34a', transform: 'rotate(35 78 38)', ...s }) +
    E(26, 76, 11, 6, { fill: '#8bc34a', transform: 'rotate(35 26 76)', ...s }) + E(74, 76, 11, 6, { fill: '#8bc34a', transform: 'rotate(-35 74 76)', ...s }) +
    C(50, 16, 11, { fill: '#8bc34a', ...s }) + C(46, 13, 2, { fill: O }) + C(54, 13, 2, { fill: O }) +
    E(50, 56, 30, 34, { fill: '#4caf50', ...s }) +
    P('M50 40 L62 48 L62 62 L50 70 L38 62 L38 48 Z M50 22 V40 M62 48 L78 42 M62 62 L78 70 M38 48 L22 42 M38 62 L22 70 M50 70 V90', { ...line('#2e7d32', 3) });
  const crab = P('M24 58 L8 64 M24 66 L10 76 M28 72 L16 86 M76 58 L92 64 M76 66 L90 76 M72 72 L84 86', line('#c62828', 4)) +
    P('M30 50 L20 36 M70 50 L80 36', line('#c62828', 5)) +
    P('M8 30 A12 12 0 1 1 28 26 L18 30 Z', { fill: '#e53935', ...s }) + P('M92 30 A12 12 0 1 0 72 26 L82 30 Z', { fill: '#e53935', ...s }) +
    P('M42 44 V30 M58 44 V30', line(O, 3)) +
    E(50, 60, 30, 20, { fill: '#e53935', ...s }) +
    C(42, 27, 5, { fill: '#fff', stroke: O, strokeWidth: 2 }) + C(58, 27, 5, { fill: '#fff', stroke: O, strokeWidth: 2 }) +
    C(42, 27, 2.2, { fill: O }) + C(58, 27, 2.2, { fill: O }) + P('M42 64 Q50 70 58 64', line(O, 3));
  const jelly = [26, 40, 54, 68].map(x => P(`M${x + 2} 52 Q${x - 6} 64 ${x + 2} 74 Q${x + 10} 84 ${x + 2} 94`, line('#f06292', 4))).join('') +
    P('M14 52 Q14 12 50 12 Q86 12 86 52 Q77 60 68 52 Q59 60 50 52 Q41 60 32 52 Q23 60 14 52 Z', { fill: '#f8bbd0', stroke: '#c2185b', strokeWidth: 3, strokeLinejoin: 'round' }) +
    C(40, 34, 3.5, { fill: O }) + C(60, 34, 3.5, { fill: O }) + P('M44 42 Q50 47 56 42', line(O, 2.5)) +
    E(33, 41, 4, 2.5, { fill: '#f48fb1' }) + E(67, 41, 4, 2.5, { fill: '#f48fb1' });
  const whale = P('M44 28 Q40 14 32 10 M46 28 Q50 12 58 8 M45 28 V8', line('#64b5f6', 4)) +
    P('M10 62 Q12 32 50 32 Q78 32 82 54 L94 42 L92 72 L80 64 Q70 82 40 82 Q12 82 10 62 Z', { fill: '#3f7fd6', ...s }) +
    P('M14 66 Q40 82 74 68 Q50 78 14 66 Z', { fill: '#bbdefb' }) + C(28, 54, 4, { fill: O }) + P('M14 62 Q20 66 26 64', line(O, 2.5));
  const shark = P('M6 56 Q30 34 66 40 L74 20 L80 44 Q88 46 96 36 L92 56 L96 74 Q88 64 80 66 Q50 80 6 56 Z', { fill: '#90a4ae', ...s }) +
    P('M10 58 Q40 72 78 64 Q50 78 10 58 Z', { fill: '#fff' }) + C(24, 50, 3.5, { fill: O }) + P('M12 60 Q20 66 30 62', line(O, 2.5)) +
    P('M44 46 V58 M50 46 V58', line('#78909c', 2));
  const puffer = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6, x = 50 + 34 * Math.cos(a), y = 52 + 34 * Math.sin(a), b = a + Math.PI / 2;
    return P(`M${r1(x + 6 * Math.cos(b))} ${r1(y + 6 * Math.sin(b))} L${r1(50 + 46 * Math.cos(a))} ${r1(52 + 46 * Math.sin(a))} L${r1(x - 6 * Math.cos(b))} ${r1(y - 6 * Math.sin(b))} Z`, { fill: '#e0a800', stroke: O, strokeWidth: 2, strokeLinejoin: 'round' });
  }).join('') + C(50, 52, 33, { fill: '#ffd54f', ...s }) +
    C(38, 44, 7, { fill: '#fff' }) + C(62, 44, 7, { fill: '#fff' }) + C(39, 45, 3.5, { fill: O }) + C(63, 45, 3.5, { fill: O }) +
    C(50, 64, 5, { fill: '#e57373', stroke: O, strokeWidth: 2 });

  const coral = P('M50 92 V62 M50 72 L32 50 V30 M50 66 L68 44 V22 M32 50 L18 40 M68 52 L84 44 M32 36 L24 24 M68 34 L78 26', line('#ff6f91', 10)) +
    E(50, 92, 22, 5, { fill: '#c2185b' });
  const seaweed = P('M30 94 Q18 72 32 54 Q46 34 30 10', line('#43a047', 9)) + P('M52 94 Q64 72 50 52 Q38 34 54 16', line('#66bb6a', 9)) +
    P('M72 94 Q60 78 74 62 Q86 48 74 36', line('#2e7d32', 8));
  const anemone = Array.from({ length: 9 }, (_, i) => {
    const a = -160 + i * 17.5, rad = a * Math.PI / 180, x = 50 + 40 * Math.cos(rad), y = 72 + 46 * Math.sin(rad);
    return P(`M50 74 Q${r1(50 + 20 * Math.cos(rad - .3))} ${r1(72 + 26 * Math.sin(rad - .3))} ${r1(x)} ${r1(y)}`, line('#b39ddb', 6)) + C(r1(x), r1(y), 4.5, { fill: '#ffeb3b' });
  }).join('') + E(50, 80, 26, 12, { fill: '#7e57c2', ...s });
  const fan = P('M50 90 L14 40 Q30 8 50 8 Q70 8 86 40 Z', { fill: '#ffa726', ...s }) +
    P('M50 88 L24 30 M50 88 L42 12 M50 88 L58 12 M50 88 L76 30 M22 44 Q50 30 78 44 M32 60 Q50 50 68 60', line('#e65100', 2.5));
  const chest = P('M14 46 V34 Q14 18 50 18 Q86 18 86 34 V46 Z', { fill: '#b8682f', ...s }) + R(14, 44, 72, 42, { rx: 4, fill: '#a0522d', ...s }) +
    R(14, 44, 72, 7, { fill: '#ffca28' }) + R(44, 46, 12, 15, { rx: 2, fill: '#ffca28', ...s, strokeWidth: 2.5 }) +
    C(30, 14, 6, { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 2 }) + C(64, 12, 6, { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 2 });
  const anchor = C(50, 16, 8, line('#546e7a', 6)) + P('M50 24 V88 M32 38 H68 M16 64 Q20 88 50 88 Q80 88 84 64', line('#546e7a', 8)) +
    P('M10 66 L16 56 L22 66 Z M78 66 L84 56 L90 66 Z', { fill: '#546e7a', stroke: '#546e7a', strokeWidth: 3, strokeLinejoin: 'round' });
  const crown = P('M14 76 L18 28 L36 52 L50 20 L64 52 L82 28 L86 76 Z', { fill: '#ffca28', ...s }) + R(14, 72, 72, 14, { rx: 3, fill: '#ffb300', ...s }) +
    C(50, 60, 6, { fill: '#e53935' }) + C(30, 64, 4.5, { fill: '#1e88e5' }) + C(70, 64, 4.5, { fill: '#43a047' }) + C(50, 79, 3.5, { fill: '#fff' });
  const pearl = P('M10 60 Q50 100 90 60 Z', { fill: '#f8a5c2', ...s }) + P('M14 54 Q50 2 86 54 Q50 44 14 54 Z', { fill: '#f3b6cf', ...s }) +
    C(50, 62, 15, { fill: '#fafafa', stroke: '#b0bec5', strokeWidth: 3 }) + C(45, 57, 4, { fill: '#fff' });

  return {
    id: 'reef', name: 'Coral Reef', preview: 'wE',
    fx: {
      fish,
      bubble: C(50, 50, 42, { fill: 'rgba(255,255,255,.3)', stroke: '#4fb3e0', strokeWidth: 3 }) +
        C(50, 50, 37, { fill: 'none', stroke: '#ffffff', strokeWidth: 6 }) +
        P('M27 42 A24 24 0 0 1 43 25', line('#fff', 8)),
    },
    suits: { c: { name: 'fish', pic: fish, colour: '#e65100' }, b: { name: 'shells', pic: shell, colour: '#c2185b' }, d: { name: 'starfish', pic: starfish, colour: '#b45309' } },
    honours: [
      { name: 'Octopus', pic: octopus }, { name: 'Sea turtle', pic: turtle }, { name: 'Crab', pic: crab }, { name: 'Jellyfish', pic: jelly },
      { name: 'Whale', pic: whale }, { name: 'Shark', pic: shark }, { name: 'Pufferfish', pic: puffer },
    ],
    flowers: { group: 'sea plant', colour: '#d81b60', items: [
      { name: 'Pink coral', pic: coral }, { name: 'Seaweed', pic: seaweed }, { name: 'Sea anemone', pic: anemone }, { name: 'Fan coral', pic: fan }] },
    seasons: { group: 'treasure', colour: '#b8860b', items: [
      { name: 'Treasure chest', pic: chest }, { name: 'Anchor', pic: anchor }, { name: 'Crown', pic: crown }, { name: 'Pearl', pic: pearl }] },
  };
}

/* ---------- Haunted Night ---------- */

function halloween() {
  const O = '#1d1029';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const pumpkin = P('M48 24 Q50 8 62 6', line('#4e7d2a', 7)) +
    E(32, 58, 22, 32, { fill: '#ff8f1f', ...s }) + E(68, 58, 22, 32, { fill: '#ff8f1f', ...s }) + E(50, 58, 21, 34, { fill: '#ffa53d', ...s });
  const bat = E(50, 50, 10, 13, { fill: '#4a2a6a', ...s }) +
    P('M44 46 Q36 34 28 38 Q20 28 4 32 Q14 42 12 56 Q22 50 28 60 Q34 52 44 60 Z', { fill: '#4a2a6a', ...s }) +
    P('M56 46 Q64 34 72 38 Q80 28 96 32 Q86 42 88 56 Q78 50 72 60 Q66 52 56 60 Z', { fill: '#4a2a6a', ...s }) +
    P('M43 40 L42 30 L48 37 Z M57 40 L58 30 L52 37 Z', { fill: '#4a2a6a', ...s, strokeWidth: 2 }) +
    C(46, 46, 2.6, { fill: '#ffd54f' }) + C(54, 46, 2.6, { fill: '#ffd54f' });
  const w = y => 32 * (y - 8) / 80;
  const band = (y0, y1, fill) => P(`M${r1(50 - w(y0))} ${y0} L${r1(50 + w(y0))} ${y0} L${r1(50 + w(y1))} ${y1} L${r1(50 - w(y1))} ${y1} Z`, { fill });
  const corn = band(8, 36, '#fffaf0') + band(36, 64, '#ff8f1f') + band(64, 88, '#ffcc33') +
    P(`M50 8 L${r1(50 + w(88))} 88 L${r1(50 - w(88))} 88 Z`, { fill: 'none', stroke: O, strokeWidth: 4, strokeLinejoin: 'round' });

  const ghost = P('M20 88 V44 Q20 12 50 12 Q80 12 80 44 V88 L70 80 L60 88 L50 80 L40 88 L30 80 Z', { fill: '#fbfbff', ...s }) +
    E(40, 42, 5, 7, { fill: O }) + E(60, 42, 5, 7, { fill: O }) + E(50, 60, 6, 8, { fill: O });
  const cat = P('M18 42 L22 8 L44 28 Z', { fill: '#2a2238', ...s }) + P('M82 42 L78 8 L56 28 Z', { fill: '#2a2238', ...s }) +
    E(50, 56, 34, 32, { fill: '#2a2238', ...s }) +
    E(36, 52, 8, 10, { fill: '#9be15d' }) + E(64, 52, 8, 10, { fill: '#9be15d' }) + E(36, 52, 2.5, 8, { fill: '#111' }) + E(64, 52, 2.5, 8, { fill: '#111' }) +
    P('M46 64 H54 L50 69 Z', { fill: '#f48fb1' }) +
    P('M30 68 L10 64 M30 72 L12 76 M70 68 L90 64 M70 72 L88 76', line('#c9c3d6', 2));
  const skull = outlined(o => C(50, 42, 32, o) + R(32, 58, 36, 28, { rx: 8, ...o }), '#f4f1e8', O, 3.5) +
    E(37, 46, 9, 10, { fill: O }) + E(63, 46, 9, 10, { fill: O }) + P('M50 58 L45 67 H55 Z', { fill: O }) +
    P('M41 74 V85 M50 74 V85 M59 74 V85', line(O, 3));
  const monster = R(8, 60, 14, 9, { rx: 2, fill: '#9e9e9e', ...s }) + R(78, 60, 14, 9, { rx: 2, fill: '#9e9e9e', ...s }) +
    R(20, 20, 60, 70, { rx: 7, fill: '#7cc35a', ...s }) +
    P('M20 38 V22 Q20 14 28 14 H72 Q80 14 80 22 V38 L72 31 L64 38 L56 31 L48 38 L40 31 L32 38 L26 31 Z', { fill: O }) +
    C(38, 52, 6.5, { fill: '#fff' }) + C(62, 52, 6.5, { fill: '#fff' }) + C(38, 53, 3, { fill: O }) + C(62, 53, 3, { fill: O }) +
    P('M36 74 H64', line(O, 4)) + P('M42 70 V78 M50 70 V78 M58 70 V78', line(O, 2.5));
  const cauldron = P('M26 84 L20 94 M74 84 L80 94', line(O, 6)) +
    E(50, 64, 36, 26, { fill: '#2b2b3a', ...s }) + E(50, 42, 38, 9, { fill: '#3b3b4f', ...s }) + E(50, 42, 31, 5.5, { fill: '#76ff03' }) +
    C(40, 30, 6, { fill: '#9cff57', stroke: O, strokeWidth: 2 }) + C(58, 22, 4.5, { fill: '#9cff57', stroke: O, strokeWidth: 2 }) + C(54, 34, 5, { fill: '#9cff57', stroke: O, strokeWidth: 2 });
  const spider = P('M50 2 V36', line('#9e9e9e', 2)) +
    [46, 54, 62, 70].map((y, i) => P(`M44 ${y} Q${26 - i * 2} ${y - 14} 12 ${y + 6} M56 ${y} Q${74 + i * 2} ${y - 14} 88 ${y + 6}`, line(O, 4))).join('') +
    E(50, 64, 16, 18, { fill: '#2a2238', ...s }) + C(50, 42, 10, { fill: '#2a2238', ...s }) +
    C(46, 42, 2.6, { fill: '#ff5252' }) + C(54, 42, 2.6, { fill: '#ff5252' });
  const hat = P('M24 78 Q40 60 46 8 Q60 40 78 78 Z', { fill: '#673ab7', ...s }) + E(50, 78, 44, 10, { fill: '#5e35b1', ...s }) +
    P('M27 70 Q50 77 75 70 L72 61 Q50 68 30 61 Z', { fill: '#ff9800' }) + R(44, 62, 12, 10, { fill: 'none', stroke: '#ffd54f', strokeWidth: 3 });

  const lolly = R(47, 50, 6, 44, { rx: 3, fill: '#fff', stroke: O, strokeWidth: 2.5 }) + C(50, 36, 27, { fill: '#ff5fa2', ...s }) +
    P(spiralPath(50, 36, 21, 2.2, 2), line('#fff', 4.5));
  const sweet = P('M28 50 L8 32 L8 68 Z', { fill: '#ffb300', ...s }) + P('M72 50 L92 32 L92 68 Z', { fill: '#ffb300', ...s }) +
    E(50, 50, 25, 19, { fill: '#ff7043', ...s }) + P('M40 34 Q34 50 40 66 M52 32 Q46 50 52 68 M64 35 Q58 50 64 65', line('#fff3e0', 3));
  const choc = R(20, 12, 60, 76, { rx: 6, fill: '#6d4c41', ...s }) + P('M50 14 V54 M22 26 H78 M22 40 H78', line('#4e342e', 3)) +
    R(20, 54, 60, 34, { rx: 4, fill: '#e53935', ...s }) + P('M28 66 H72 M28 76 H60', line('#ffcdd2', 3.5));
  const cupcake = P('M24 56 H76 L68 90 H32 Z', { fill: '#4fc3f7', ...s }) + P('M36 58 L40 88 M50 58 V88 M64 58 L60 88', line('#0288d1', 2.5)) +
    P('M20 58 Q14 40 32 38 Q34 20 50 22 Q66 20 68 38 Q86 40 80 58 Z', { fill: '#f48fb1', ...s }) + C(50, 17, 7, { fill: '#e53935', ...s }) +
    P('M34 46 L38 44 M58 32 L62 34 M64 48 L68 46 M44 36 L46 40', line('#fff176', 3));
  const web = Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4;
    return P(`M50 50 L${r1(50 + 46 * Math.cos(a))} ${r1(50 + 46 * Math.sin(a))}`, line('#9fa8da', 2.5));
  }).join('') + [14, 26, 38].map(r => P(Array.from({ length: 9 }, (_, i) => {
    const a = i * Math.PI / 4;
    return `${i ? 'L' : 'M'}${r1(50 + r * Math.cos(a))} ${r1(50 + r * Math.sin(a))}`;
  }).join(' '), line('#9fa8da', 2.5))).join('') + C(66, 64, 6, { fill: O });
  const broom = P('M84 8 L44 60', line('#8d6e63', 7)) + P('M42 54 L16 90 L46 94 L58 66 Z', { fill: '#ffca28', ...s }) +
    P('M38 58 L56 70', line('#e65100', 6)) + P('M26 84 L36 70 M36 90 L44 74', line('#c79a00', 2.5));
  const candle = R(36, 42, 28, 48, { rx: 3, fill: '#f5f5f5', ...s }) + P('M36 50 Q42 60 46 50 Q50 64 56 50', { fill: 'none', stroke: '#e0e0e0', strokeWidth: 3 }) +
    P('M50 42 V34', line(O, 2.5)) + P('M50 12 Q62 26 50 36 Q38 26 50 12 Z', { fill: '#ffb300', stroke: '#e65100', strokeWidth: 2 }) +
    E(50, 92, 26, 4, { fill: '#9575cd' });

  return {
    id: 'halloween', name: 'Haunted Night', preview: 'c1',
    fx: { bat, pumpkin, web },
    suits: { c: { name: 'pumpkins', pic: pumpkin, colour: '#e65100' }, b: { name: 'bats', pic: bat, colour: '#4a2a6a' }, d: { name: 'candy corns', pic: corn, colour: '#b45309' } },
    honours: [
      { name: 'Ghost', pic: ghost }, { name: 'Black cat', pic: cat }, { name: 'Skull', pic: skull }, { name: 'Monster', pic: monster },
      { name: 'Cauldron', pic: cauldron }, { name: 'Spider', pic: spider }, { name: 'Witch hat', pic: hat },
    ],
    flowers: { group: 'treat', colour: '#e91e63', items: [
      { name: 'Lollipop', pic: lolly }, { name: 'Wrapped sweet', pic: sweet }, { name: 'Chocolate bar', pic: choc }, { name: 'Cupcake', pic: cupcake }] },
    seasons: { group: 'night tile', colour: '#5e35b1', items: [
      { name: 'Moon', pic: moon('#ffd54f', '#b8860b') }, { name: 'Spider web', pic: web }, { name: 'Broom', pic: broom }, { name: 'Candle', pic: candle }] },
  };
}

/* ---------- Shared by the newer styles ---------- */

// A flower of n petals round a centre, in the 100 x 100 box.
const bloom = (n, petal, centre, rx, ry, edge) =>
  Array.from({ length: n }, (_, i) => E(50, 50 - ry * .9, rx, ry, { fill: petal, stroke: edge, strokeWidth: 2.5, transform: `rotate(${r1(i * 360 / n)} 50 50)` })).join('') +
  C(50, 50, rx * .9, { fill: centre, stroke: edge, strokeWidth: 2.5 });

/* ---------- Cat Corner ---------- */

function cats() {
  const O = '#3d2c3e';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const yarn = P('M80 72 Q96 82 86 96', line('#ec6f9b', 4)) + C(50, 52, 36, { fill: '#ec6f9b', ...s }) +
    P('M22 34 Q50 50 30 82 M34 20 Q64 44 52 88 M60 18 Q82 46 78 74 M16 54 Q50 40 84 50', line('#b83b6c', 3));
  const fishbone = P('M8 34 L30 50 L8 66 Z', { fill: '#8fa3b8', ...s }) + P('M28 50 H72', line('#8fa3b8', 5)) +
    [38, 50, 62].map(x => P(`M${x} 34 Q${x + 5} 50 ${x} 66`, line('#8fa3b8', 4))).join('') +
    C(80, 50, 14, { fill: '#8fa3b8', ...s }) + C(84, 46, 3, { fill: O });
  const pink = { fill: '#f48fb1', stroke: '#c2185b', strokeWidth: 3 };
  const paw = E(50, 64, 21, 17, pink) + E(27, 40, 8.5, 10, pink) + E(42, 26, 8.5, 10, pink) + E(58, 26, 8.5, 10, pink) + E(73, 40, 8.5, 10, pink);

  const cat = ({ fur, marks = '', eye = '#8bc34a', muzzle = fur, whisker = O }) =>
    P('M16 50 L20 8 L46 28 Z', { fill: fur, ...s }) + P('M84 50 L80 8 L54 28 Z', { fill: fur, ...s }) +
    P('M24 34 L25 18 L38 28 Z', { fill: '#f8bbd0' }) + P('M76 34 L75 18 L62 28 Z', { fill: '#f8bbd0' }) +
    E(50, 56, 36, 32, { fill: fur, ...s }) + marks + E(50, 70, 17, 12, { fill: muzzle }) +
    E(35, 52, 7, 8.5, { fill: eye, stroke: O, strokeWidth: 2 }) + E(65, 52, 7, 8.5, { fill: eye, stroke: O, strokeWidth: 2 }) +
    E(35, 52, 2.4, 7, { fill: '#1b1b1b' }) + E(65, 52, 2.4, 7, { fill: '#1b1b1b' }) +
    P('M45 63 H55 L50 69 Z', { fill: '#f06292' }) + P('M50 69 Q46 75 41 72 M50 69 Q54 75 59 72', line(whisker, 2.4)) +
    P('M30 66 L8 62 M30 71 L10 76 M70 66 L92 62 M70 71 L90 76', line(whisker, 1.8));
  const ginger = cat({ fur: '#f0a04b', muzzle: '#fbe0bf',
    marks: P('M40 26 L42 36 M50 24 V36 M60 26 L58 36', line('#c86f1d', 4)) + P('M15 54 H25 M16 62 H25 M85 54 H75 M84 62 H75', line('#c86f1d', 3)) });
  const black = cat({ fur: '#3a3342', eye: '#fdd835', whisker: '#d7ccc8' });
  const grey = cat({ fur: '#9aa3ad', muzzle: '#eceff1', eye: '#4fc3f7' });
  const calico = cat({ fur: '#ffffff', eye: '#ffb300',
    marks: P('M18 44 Q24 28 42 30 Q42 44 26 52 Z', { fill: '#f0a04b' }) + P('M58 28 Q76 28 84 46 Q70 50 60 40 Z', { fill: '#3a3342' }) });
  const box = P('M32 44 L36 22 L48 36 Z', { fill: '#9aa3ad', ...s }) + P('M68 44 L64 22 L52 36 Z', { fill: '#9aa3ad', ...s }) +
    E(50, 48, 22, 14, { fill: '#9aa3ad', ...s }) + C(42, 42, 3.5, { fill: O }) + C(58, 42, 3.5, { fill: O }) +
    P('M14 46 L4 32 L30 32 L36 46 Z', { fill: '#e0b47c', ...s }) + P('M86 46 L96 32 L70 32 L64 46 Z', { fill: '#e0b47c', ...s }) +
    R(14, 46, 72, 44, { fill: '#d2a46a', ...s }) + R(44, 46, 12, 44, { fill: '#e8cfa0' });
  const mouse = P('M78 62 Q96 60 92 80 Q88 94 74 88', line('#f48fb1', 3)) +
    E(52, 60, 30, 20, { fill: '#9e9e9e', ...s }) + C(42, 40, 10, { fill: '#bdbdbd', ...s }) + C(42, 40, 5, { fill: '#f8bbd0' }) +
    C(32, 54, 3, { fill: O }) + C(22, 62, 4, { fill: '#f48fb1' }) + P('M26 64 L12 60 M26 67 L13 70', line(O, 1.5));
  const fishy = E(46, 0, 12, 8, { fill: '#ff8a1f' }) + P('M56 0 L66 -7 L66 7 Z', { fill: '#ff8a1f' }) + C(40, -2, 1.8, { fill: O });
  const bowl = P('M32 22 Q4 40 14 72 Q26 94 50 94 Q74 94 86 72 Q96 40 68 22 Z', { fill: '#b3e5fc', stroke: '#4fa3d6', strokeWidth: 3.5 }) +
    P('M16 40 Q50 48 84 40', line('#e1f5fe', 3)) + E(50, 22, 19, 5, { fill: 'none', stroke: '#4fa3d6', strokeWidth: 3.5 }) +
    G({ transform: 'translate(0 62)' }, fishy) + C(30, 86, 4, { fill: '#a1887f' }) + C(40, 88, 3.5, { fill: '#8d6e63' }) + C(64, 87, 4, { fill: '#a1887f' }) +
    C(66, 44, 3, { fill: '#fff', opacity: .8 }) + C(72, 36, 2, { fill: '#fff', opacity: .8 });

  const feather = P('M14 90 L60 32', line('#8d6e63', 5)) + P('M60 32 Q66 26 68 20', line(O, 1.5)) +
    E(70, 18, 7, 18, { fill: '#4fc3f7', transform: 'rotate(30 70 18)', ...s, strokeWidth: 2 }) +
    E(80, 28, 6, 16, { fill: '#ffca28', transform: 'rotate(65 80 28)', ...s, strokeWidth: 2 }) +
    E(62, 14, 5, 14, { fill: '#e57373', transform: 'rotate(-10 62 14)', ...s, strokeWidth: 2 });
  const jingle = C(50, 54, 34, { fill: '#e53935', ...s }) + C(50, 54, 12, { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 2.5 }) +
    P('M20 40 Q50 30 80 40 M18 64 Q50 78 82 64 M34 24 Q28 54 36 86 M66 24 Q72 54 64 86', line('#b71c1c', 3)) + C(42, 38, 4, { fill: '#ffcdd2' });
  const catnip = P('M30 64 H70 L64 92 H36 Z', { fill: '#d4794a', ...s }) +
    P('M50 64 V30 M50 48 L32 34 M50 42 L68 26', line('#2e7d32', 3.5)) +
    [[50, 22, 0], [30, 30, -40], [70, 22, 40], [36, 46, -60], [64, 40, 60]].map(([x, y, a]) =>
      E(x, y, 9, 13, { fill: '#66bb6a', stroke: '#2e7d32', strokeWidth: 2.5, transform: `rotate(${a} ${x} ${y})` })).join('');
  const post = R(16, 84, 68, 10, { rx: 3, fill: '#a1887f', ...s }) + R(40, 24, 20, 62, { fill: '#d7b98a', ...s }) +
    P('M40 34 L60 30 M40 46 L60 42 M40 58 L60 54 M40 70 L60 66 M40 82 L60 78', line('#a1887f', 2.5)) +
    R(24, 14, 52, 11, { rx: 3, fill: '#8d6e63', ...s }) + P('M70 25 V40', line(O, 1.5)) + C(70, 46, 6, { fill: '#e53935', ...s, strokeWidth: 2 });
  const milk = R(38, 12, 24, 16, { fill: '#ffffff', ...s }) + R(36, 6, 28, 9, { rx: 3, fill: '#42a5f5', ...s }) +
    R(28, 26, 44, 66, { rx: 12, fill: '#ffffff', ...s }) + R(28, 50, 44, 20, { fill: '#90caf9' }) + place(paw, 50, 60, 16);
  const tuna = E(50, 78, 34, 10, { fill: '#90a4ae', ...s }) + R(16, 34, 68, 44, { fill: '#64b5f6', ...s }) +
    E(50, 34, 34, 10, { fill: '#cfd8dc', ...s }) + E(50, 34, 26, 6, { fill: 'none', stroke: '#90a4ae', strokeWidth: 2 }) +
    G({ transform: 'translate(4 58)' }, fishy);
  const shrimp = P('M76 26 Q40 14 26 44 Q18 70 44 80', line('#ff8a65', 18)) + P('M76 26 Q40 14 26 44 Q18 70 44 80', line('#ffab91', 7)) +
    P('M44 80 L58 70 L58 90 Z', { fill: '#ff7043', stroke: '#d84315', strokeWidth: 2.5, strokeLinejoin: 'round' }) +
    P('M54 20 L50 36 M34 30 L44 40 M24 50 L38 52 M28 66 L40 62', line('#d84315', 2.5)) +
    C(72, 24, 3, { fill: O }) + P('M78 22 Q92 10 96 18 M80 26 Q94 22 96 30', line('#d84315', 1.8));
  const cookie = C(50, 50, 38, { fill: '#d7a86e', ...s }) + place(paw.replace(/#f48fb1/g, '#6d4c41').replace(/#c2185b/g, '#4e342e'), 50, 52, 52) +
    C(26, 34, 2.5, { fill: '#a1743f' }) + C(76, 66, 2.5, { fill: '#a1743f' }) + C(30, 72, 2, { fill: '#a1743f' });

  return {
    id: 'cats', name: 'Cat Corner', preview: 'wE',
    fx: { paw, yarn },
    suits: { c: { name: 'balls of yarn', pic: yarn, colour: '#b83b6c' }, b: { name: 'fish bones', pic: fishbone, colour: '#546e7a' }, d: { name: 'cat paws', pic: paw, colour: '#c2185b' } },
    honours: [
      { name: 'Ginger cat', pic: ginger }, { name: 'Black cat', pic: black }, { name: 'Grey cat', pic: grey }, { name: 'Calico cat', pic: calico },
      { name: 'Cardboard box', pic: box }, { name: 'Toy mouse', pic: mouse }, { name: 'Fishbowl', pic: bowl },
    ],
    flowers: { group: 'cat toy', colour: '#8e24aa', items: [
      { name: 'Feather wand', pic: feather }, { name: 'Jingle ball', pic: jingle }, { name: 'Catnip', pic: catnip }, { name: 'Scratching post', pic: post }] },
    seasons: { group: 'treat', colour: '#ef6c00', items: [
      { name: 'Milk', pic: milk }, { name: 'Tuna', pic: tuna }, { name: 'Shrimp', pic: shrimp }, { name: 'Paw cookie', pic: cookie }] },
  };
}

/* ---------- Enchanted Land ---------- */

function fantasy() {
  const O = '#3b2752';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const starPip = P(starPath(50, 54, 44, 19), { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 4, strokeLinejoin: 'round' }) + C(42, 46, 4, { fill: '#fff8e1' });
  const gem = P('M18 38 L34 14 H66 L82 38 L50 88 Z', { fill: '#4fc3f7', stroke: '#1565c0', strokeWidth: 4, strokeLinejoin: 'round' }) +
    P('M18 38 H82 M34 14 L42 38 L50 88 M66 14 L58 38 L50 88 M42 38 L50 14 L58 38', line('#1565c0', 2.5)) + P('M28 32 L34 24', line('#e1f5fe', 4));
  const potion = R(40, 14, 20, 22, { fill: '#e1bee7', ...s }) + R(37, 6, 26, 11, { rx: 3, fill: '#a1887f', ...s }) +
    C(50, 62, 30, { fill: '#f3e5f5', ...s }) + P('M23 66 Q50 56 77 66 A27 27 0 0 1 23 66 Z', { fill: '#ab47bc' }) +
    C(42, 76, 3, { fill: '#e1bee7' }) + C(56, 70, 2.5, { fill: '#e1bee7' }) + E(38, 50, 4, 7, { fill: '#fff', opacity: .8 });
  const sparkle = P(starPath(50, 50, 46, 10, 4), { fill: '#fff59d', stroke: '#f9a825', strokeWidth: 2, strokeLinejoin: 'round' });

  const unicorn = P('M60 24 Q88 26 90 56 Q92 76 84 92', line('#f48fb1', 9)) + P('M62 32 Q84 40 82 66', line('#81d4fa', 8)) +
    P('M58 30 Q72 44 74 72', line('#ce93d8', 8)) +
    P('M36 30 Q46 20 60 24 Q76 30 76 56 L80 92 H44 L48 70 Q30 72 22 64 Q14 56 20 46 Q26 38 36 30 Z', { fill: '#ffffff', ...s }) +
    P('M40 30 L32 2 L48 26 Z', { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 2.5, strokeLinejoin: 'round' }) +
    P('M37 18 L44 16 M35 11 L41 9', line('#c79a00', 1.8)) +
    P('M54 26 L58 10 L64 26 Z', { fill: '#ffffff', ...s }) + P('M44 26 Q52 16 60 22', line('#f48fb1', 6)) +
    C(42, 44, 4.5, { fill: O }) + C(43.5, 42.5, 1.5, { fill: '#fff' }) + E(24, 58, 2.5, 2, { fill: O }) + E(34, 56, 6, 3.5, { fill: '#f8bbd0' });
  const dragon = P('M18 44 L2 20 L28 32 Z', { fill: '#43a047', ...s }) + P('M82 44 L98 20 L72 32 Z', { fill: '#43a047', ...s }) +
    P('M32 26 L28 8 L42 22 Z', { fill: '#fff59d', ...s }) + P('M68 26 L72 8 L58 22 Z', { fill: '#fff59d', ...s }) +
    E(50, 52, 34, 30, { fill: '#66bb6a', ...s }) + E(50, 72, 22, 15, { fill: '#a5d6a7', ...s }) +
    C(37, 46, 8, { fill: '#fff', ...s, strokeWidth: 2.5 }) + C(63, 46, 8, { fill: '#fff', ...s, strokeWidth: 2.5 }) +
    C(38, 47, 4, { fill: O }) + C(62, 47, 4, { fill: O }) + E(43, 66, 2.5, 2, { fill: O }) + E(57, 66, 2.5, 2, { fill: O }) +
    P('M38 76 Q50 86 62 76', line(O, 3)) + P('M44 78 L46 83 L48 79 Z M56 78 L54 83 L52 79 Z', { fill: '#fff' }) +
    P('M44 24 Q50 30 56 24', line('#2e7d32', 3));
  const fairy = E(30, 42, 16, 24, { fill: '#b3e5fc', stroke: '#4fc3f7', strokeWidth: 2, transform: 'rotate(-25 30 42)', opacity: .9 }) +
    E(70, 42, 16, 24, { fill: '#b3e5fc', stroke: '#4fc3f7', strokeWidth: 2, transform: 'rotate(25 70 42)', opacity: .9 }) +
    E(34, 66, 10, 14, { fill: '#e1bee7', stroke: '#ba68c8', strokeWidth: 2, transform: 'rotate(25 34 66)', opacity: .9 }) +
    E(66, 66, 10, 14, { fill: '#e1bee7', stroke: '#ba68c8', strokeWidth: 2, transform: 'rotate(-25 66 66)', opacity: .9 }) +
    P('M50 46 L32 90 H68 Z', { fill: '#f48fb1', ...s }) + C(50, 34, 13, { fill: '#ffe0b2', ...s }) +
    P('M37 33 Q38 16 50 18 Q63 16 64 33 Q58 24 50 26 Q42 24 37 33 Z', { fill: '#ffb74d', stroke: O, strokeWidth: 2 }) +
    C(45, 36, 2, { fill: O }) + C(55, 36, 2, { fill: O }) + P('M46 41 Q50 44 54 41', line(O, 2)) +
    P('M62 62 L82 44', line('#8d6e63', 3)) + P(starPath(84, 42, 9, 4), { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 1.5 });
  const gnome = R(32, 64, 36, 28, { rx: 9, fill: '#1e88e5', ...s }) + C(50, 54, 14, { fill: '#ffe0b2', ...s }) +
    P('M34 56 Q34 88 50 94 Q66 88 66 56 Q50 68 34 56 Z', { fill: '#fafafa', ...s }) +
    P('M28 50 L54 4 L72 50 Z', { fill: '#e53935', ...s }) + C(50, 58, 6, { fill: '#ffab91', ...s, strokeWidth: 2 }) +
    C(43, 51.5, 2.2, { fill: O }) + C(57, 51.5, 2.2, { fill: O });
  const castle = R(12, 40, 20, 52, { fill: '#ce93d8', ...s }) + R(68, 40, 20, 52, { fill: '#ce93d8', ...s }) +
    R(28, 54, 44, 38, { fill: '#e1bee7', ...s }) + R(40, 30, 20, 30, { fill: '#ce93d8', ...s }) +
    P('M8 42 L22 14 L36 42 Z', { fill: '#7e57c2', ...s }) + P('M64 42 L78 14 L92 42 Z', { fill: '#7e57c2', ...s }) + P('M36 32 L50 4 L64 32 Z', { fill: '#7e57c2', ...s }) +
    P('M42 92 V76 A8 8 0 0 1 58 76 V92 Z', { fill: '#5e35b1' }) + R(18, 54, 8, 10, { rx: 4, fill: '#fff59d' }) + R(74, 54, 8, 10, { rx: 4, fill: '#fff59d' }) +
    R(46, 40, 8, 10, { rx: 4, fill: '#fff59d' });
  const ball = P('M28 90 L36 74 H64 L72 90 Z', { fill: '#8d6e63', ...s }) + C(50, 46, 30, { fill: '#b39ddb', ...s }) +
    P(spiralPath(52, 48, 16, 1.6, 2), line('#ede7f6', 3)) + E(38, 34, 8, 4, { fill: '#fff', opacity: .8, transform: 'rotate(-35 38 34)' }) +
    P(starPath(84, 20, 8, 3, 4), { fill: '#fff59d' }) + P(starPath(16, 26, 6, 2.5, 4), { fill: '#fff59d' });
  const book = P('M12 82 Q32 76 50 86 Q68 76 88 82 V90 Q68 84 50 94 Q32 84 12 90 Z', { fill: '#7e57c2', ...s }) +
    P('M50 36 Q32 26 12 32 V82 Q32 76 50 86 Z', { fill: '#fff8e1', ...s }) + P('M50 36 Q68 26 88 32 V82 Q68 76 50 86 Z', { fill: '#fff8e1', ...s }) +
    P('M20 44 Q32 40 42 46 M20 54 Q32 50 42 56 M20 64 Q32 60 42 66 M58 46 Q68 40 80 44 M58 56 Q68 50 80 54', line('#bcaaa4', 2.5)) +
    P(starPath(50, 16, 9, 4), { fill: '#ffd54f' }) + P(starPath(32, 22, 5, 2), { fill: '#ce93d8' }) + P(starPath(70, 20, 6, 2.5), { fill: '#4fc3f7' });
  const mushroom = (cap, dot) => R(38, 50, 24, 38, { rx: 8, fill: '#fff3e0', ...s }) + P('M8 58 Q12 12 50 12 Q88 12 92 58 Z', { fill: cap, ...s }) +
    C(32, 34, 6, { fill: dot }) + C(56, 26, 7, { fill: dot }) + C(72, 44, 5, { fill: dot }) + C(46, 47, 5, { fill: dot });
  const wand = tip => P('M18 88 L60 46', line('#5d4037', 7)) + P('M18 88 L28 78', line('#ffd54f', 7)) + tip;
  const heart = 'M70 50 C48 34 54 12 70 24 C86 12 92 34 70 50 Z';

  return {
    id: 'fantasy', name: 'Enchanted Land', preview: 'wE',
    fx: { star: starPip, sparkle, dust: outlined(o => C(30, 58, 18, o) + C(52, 42, 24, o) + C(73, 56, 18, o) + R(18, 56, 66, 20, { rx: 10, ...o }), '#f3e5f5', '#ba68c8', 3) +
      P(starPath(36, 50, 7, 2.5, 4), { fill: '#f9a825' }) + P(starPath(62, 44, 9, 3, 4), { fill: '#f9a825' }) + P(starPath(70, 64, 6, 2, 4), { fill: '#f9a825' }) },
    suits: { c: { name: 'stars', pic: starPip, colour: '#b07d0c' }, b: { name: 'gems', pic: gem, colour: '#1565c0' }, d: { name: 'potions', pic: potion, colour: '#8e24aa' } },
    honours: [
      { name: 'Unicorn', pic: unicorn }, { name: 'Dragon', pic: dragon }, { name: 'Fairy', pic: fairy }, { name: 'Gnome', pic: gnome },
      { name: 'Castle', pic: castle }, { name: 'Crystal ball', pic: ball }, { name: 'Spell book', pic: book },
    ],
    flowers: { group: 'magic mushroom', colour: '#d81b60', items: [
      { name: 'Red mushroom', pic: mushroom('#e53935', '#fff') }, { name: 'Blue mushroom', pic: mushroom('#42a5f5', '#e3f2fd') },
      { name: 'Purple mushroom', pic: mushroom('#ab47bc', '#f3e5f5') }, { name: 'Golden mushroom', pic: mushroom('#ffb300', '#fff8e1') }] },
    seasons: { group: 'magic wand', colour: '#00897b', items: [
      { name: 'Star wand', pic: wand(P(starPath(68, 30, 22, 9), { fill: '#ffd54f', stroke: '#c79a00', strokeWidth: 3, strokeLinejoin: 'round' })) },
      { name: 'Heart wand', pic: wand(P(heart, { fill: '#f06292', stroke: '#ad1457', strokeWidth: 3 })) },
      { name: 'Moon wand', pic: wand(P('M74 10 A24 24 0 1 0 92 44 A18 18 0 1 1 74 10 Z', { fill: '#fff176', stroke: '#c9a227', strokeWidth: 3 })) },
      { name: 'Flower wand', pic: wand(place(bloom(5, '#ba68c8', '#fff59d', 12, 18, O), 70, 30, 44)) }] },
  };
}

/* ---------- Mountain Trail ---------- */

function mountain() {
  const O = '#22313f';
  const s = { stroke: O, strokeWidth: 3.5, strokeLinejoin: 'round' };
  const pine = R(44, 74, 12, 18, { fill: '#6d4c41', ...s }) +
    P('M50 6 L72 36 H62 L80 58 H66 L86 80 H14 L34 58 H20 L38 36 H28 Z', { fill: '#2e7d32', ...s });
  const peak = P('M6 88 L50 12 L94 88 Z', { fill: '#78909c', ...s }) + P('M50 12 L64 36 L56 32 L50 40 L44 32 L36 36 Z', { fill: '#fff' });
  const fire = P('M18 88 L82 72 M18 72 L82 88', line('#6d4c41', 10)) +
    P('M50 10 Q76 40 66 60 Q62 74 50 74 Q38 74 34 60 Q24 40 50 10 Z', { fill: '#ff7043', ...s }) +
    P('M50 36 Q62 52 57 62 Q50 70 43 62 Q38 52 50 36 Z', { fill: '#ffd54f' });
  const eyes = (y, x) => C(50 - x, y, 4.5, { fill: O }) + C(50 + x, y, 4.5, { fill: O }) + C(51.5 - x, y - 1.5, 1.5, { fill: '#fff' }) + C(51.5 + x, y - 1.5, 1.5, { fill: '#fff' });

  const bear = C(22, 28, 11, { fill: '#8d6e63', ...s }) + C(78, 28, 11, { fill: '#8d6e63', ...s }) + C(22, 28, 5, { fill: '#bcaaa4' }) + C(78, 28, 5, { fill: '#bcaaa4' }) +
    E(50, 56, 34, 32, { fill: '#8d6e63', ...s }) + E(50, 70, 16, 12, { fill: '#d7ccc8' }) + eyes(50, 13) +
    E(50, 63, 7, 5, { fill: O }) + P('M50 68 V73 M50 73 Q45 78 41 74 M50 73 Q55 78 59 74', line(O, 2.4));
  const fox = P('M16 46 L18 6 L44 30 Z', { fill: '#ef6c00', ...s }) + P('M84 46 L82 6 L56 30 Z', { fill: '#ef6c00', ...s }) +
    P('M22 34 L22 16 L34 28 Z', { fill: '#4e342e' }) + P('M78 34 L78 16 L66 28 Z', { fill: '#4e342e' }) +
    P('M12 40 Q50 20 88 40 Q82 70 50 92 Q18 70 12 40 Z', { fill: '#ff8a3d', ...s }) +
    P('M16 50 Q34 62 50 92 Q30 80 16 50 Z M84 50 Q66 62 50 92 Q70 80 84 50 Z', { fill: '#fff' }) +
    eyes(50, 15) + C(50, 86, 5, { fill: O });
  const deer = P('M38 26 L30 4 M33 12 L22 10 M36 18 L26 22 M62 26 L70 4 M67 12 L78 10 M64 18 L74 22', line('#8d6e63', 5)) +
    E(24, 38, 12, 6, { fill: '#b07a4f', transform: 'rotate(-30 24 38)', ...s }) + E(76, 38, 12, 6, { fill: '#b07a4f', transform: 'rotate(30 76 38)', ...s }) +
    E(50, 58, 22, 32, { fill: '#b07a4f', ...s }) + E(50, 80, 13, 10, { fill: '#e0c3a3' }) + eyes(50, 11) + E(50, 80, 6, 4, { fill: O }) +
    C(40, 34, 2.5, { fill: '#f3e3cf' }) + C(60, 34, 2.5, { fill: '#f3e3cf' });
  const eagle = P('M20 96 Q30 66 54 62 Q80 62 90 96 Z', { fill: '#6d4c41', ...s }) +
    P('M30 64 Q26 30 52 22 Q78 20 80 46 Q80 62 66 70 Q50 74 30 64 Z', { fill: '#fafafa', ...s }) +
    P('M32 40 Q12 38 10 54 Q14 62 22 56 Q24 50 34 50 Z', { fill: '#ffc107', ...s }) +
    C(44, 38, 4.5, { fill: O }) + C(45, 37, 1.4, { fill: '#fff' }) + P('M36 32 Q46 27 56 33', line(O, 2.5));
  const tent = P('M4 88 H96', line('#558b2f', 4)) + P('M8 86 L50 14 L92 86 Z', { fill: '#ff9800', ...s }) +
    P('M50 14 L38 86 H62 Z', { fill: '#e65100', ...s }) + P('M50 14 L46 6 M50 14 L54 6', line(O, 2.5));
  const cabin = R(66, 20, 10, 20, { fill: '#795548', ...s }) + R(16, 46, 68, 42, { fill: '#a1673b', ...s }) +
    P('M16 56 H84 M16 66 H84 M16 76 H84', line('#6d4321', 2.5)) + P('M6 50 L50 16 L94 50 Z', { fill: '#5d4037', ...s }) +
    R(26, 58, 16, 14, { fill: '#ffe082', ...s, strokeWidth: 2.5 }) + R(56, 62, 16, 26, { fill: '#4e342e', ...s, strokeWidth: 2.5 });
  const canoe = P('M4 74 Q16 68 28 74 T52 74 T76 74 T100 74', line('#4fc3f7', 3)) + P('M66 26 L44 84', line('#8d6e63', 4)) + E(42, 88, 4, 7, { fill: '#8d6e63', transform: 'rotate(20 42 88)' }) +
    P('M6 52 Q50 86 94 52 Q50 62 6 52 Z', { fill: '#d84315', ...s }) + P('M20 60 Q50 74 80 60', line('#ffab91', 2.5));
  const spike = (c, d) => P('M50 94 V30', line('#43a047', 4)) + [26, 34, 42, 50, 58, 66, 74].map((y, i) =>
    C(50 + (i % 2 ? 7 : -7) * (1 - i / 10), y, 7 - i * .5, { fill: i % 2 ? c : d, stroke: O, strokeWidth: 1.5 })).join('') + E(38, 84, 10, 4, { fill: '#66bb6a', transform: 'rotate(-30 38 84)' });
  const cluster = (p, c) => P('M50 96 V70 M50 80 L30 66 M50 80 L70 68', line('#2e7d32', 4)) +
    [[32, 40], [64, 34], [50, 62]].map(([x, y]) => place(bloom(5, p, c, 9, 14, O), x, y, 46)).join('');
  const backpack = R(26, 24, 48, 66, { rx: 12, fill: '#2e7d32', ...s }) + P('M26 40 Q50 28 74 40 V24 Q50 10 26 24 Z', { fill: '#1b5e20', ...s }) +
    R(34, 58, 32, 22, { rx: 6, fill: '#43a047', ...s }) + P('M18 40 Q14 64 22 86 M82 40 Q86 64 78 86', line('#5d4037', 4)) + C(50, 40, 3, { fill: '#ffd54f' });
  const compass = C(50, 50, 38, { fill: '#eceff1', stroke: '#90a4ae', strokeWidth: 6 }) + P('M50 18 L58 50 H42 Z', { fill: '#e53935' }) + P('M42 50 H58 L50 82 Z', { fill: '#90a4ae' }) +
    C(50, 50, 4, { fill: O }) + P('M50 14 V20 M50 80 V86 M14 50 H20 M80 50 H86', line(O, 2.5));
  const lantern = P('M38 24 Q50 2 62 24', line(O, 3)) + R(34, 22, 32, 8, { rx: 3, fill: '#455a64', ...s }) +
    R(34, 30, 32, 48, { rx: 6, fill: '#ffe082', ...s }) + P('M50 44 Q58 54 54 62 Q50 66 46 62 Q42 54 50 44 Z', { fill: '#ff9800' }) +
    P('M42 30 V78 M58 30 V78', line('#455a64', 2)) + R(30, 78, 40, 10, { rx: 3, fill: '#455a64', ...s });
  const map = P('M10 22 L36 14 L64 22 L90 14 V78 L64 86 L36 78 L10 86 Z', { fill: '#fff3c4', ...s }) + P('M36 14 V78 M64 22 V86', line('#d7c48a', 2)) +
    P('M18 70 Q36 50 52 58 Q70 66 78 34', { fill: 'none', stroke: '#e53935', strokeWidth: 3, strokeDasharray: '5 4', strokeLinecap: 'round' }) +
    P('M72 26 L84 38 M84 26 L72 38', line('#e53935', 4)) + P('M16 30 L26 22 L30 32 Z', { fill: '#81c784' });
  const pinecone = P('M50 20 V10', line('#5d4037', 4)) + E(50, 56, 24, 34, { fill: '#8d6e63', ...s }) +
    P('M30 40 Q50 50 70 40 M27 56 Q50 66 73 56 M32 72 Q50 80 68 72 M50 24 V86', line('#5d4037', 3));
  const fog = outlined(o => C(30, 58, 18, o) + C(52, 42, 24, o) + C(73, 56, 18, o) + R(18, 56, 66, 20, { rx: 10, ...o }), '#eceff1', '#90a4ae', 3) +
    P('M22 84 H70 M32 92 H82', line('#b0bec5', 4));

  return {
    id: 'mountain', name: 'Mountain Trail', preview: 'wE',
    fx: { pinecone, star: P(starPath(50, 50, 44, 18), { fill: '#fff59d' }), fog },
    suits: { c: { name: 'pine trees', pic: pine, colour: '#2e7d32' }, b: { name: 'mountains', pic: peak, colour: '#546e7a' }, d: { name: 'campfires', pic: fire, colour: '#e65100' } },
    honours: [
      { name: 'Bear', pic: bear }, { name: 'Fox', pic: fox }, { name: 'Deer', pic: deer }, { name: 'Eagle', pic: eagle },
      { name: 'Tent', pic: tent }, { name: 'Log cabin', pic: cabin }, { name: 'Canoe', pic: canoe },
    ],
    flowers: { group: 'wildflower', colour: '#8e24aa', items: [
      { name: 'Lupine', pic: spike('#9575cd', '#7e57c2') }, { name: 'Buttercup', pic: cluster('#fdd835', '#f57f17') },
      { name: 'Forget-me-not', pic: cluster('#64b5f6', '#fff176') }, { name: 'Poppy', pic: bloom(4, '#e53935', '#212121', 18, 22, O) }] },
    seasons: { group: 'hiking gear', colour: '#00897b', items: [
      { name: 'Backpack', pic: backpack }, { name: 'Compass', pic: compass }, { name: 'Lantern', pic: lantern }, { name: 'Map', pic: map }] },
  };
}

/* ---------- Write the sprites and the list ---------- */

const HEADER = `<!--
SPDX-FileCopyrightText: 2026 Marko Ivankovic
SPDX-License-Identifier: CC-BY-NC-ND-4.0

Generated by assets/src/build.mjs; edit that, not this.
-->
`;
// fx: the small pictures that fly off a matched pair, as <symbol id="<style>-fx-<name>">
// on a 100 x 100 box.
const writeSprite = (id, faces, fx = {}) => {
  const body = [
    ...Object.entries(faces).map(([f, svg]) => `  <symbol id="${id}-k-${f}" viewBox="0 0 40 53">${svg}</symbol>`),
    ...Object.entries(fx).map(([n, svg]) => `  <symbol id="${id}-fx-${n}" viewBox="0 0 100 100">${svg}</symbol>`),
  ].join('\n');
  writeFileSync(new URL(`${id}.svg`, OUT), `${HEADER}<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n<defs>\n${body}\n</defs>\n</svg>\n`);
};

const manifest = [];
const classicFx = {
  lantern: P('M50 2 V14', line('#b8860b', 3)) + R(38, 12, 24, 8, { rx: 2, fill: '#d4a017' }) +
    E(50, 50, 34, 30, { fill: '#d62828', stroke: '#8b1a1a', strokeWidth: 3 }) + C(50, 50, 12, { fill: '#ffb703', opacity: .55 }) +
    P('M50 20 V80 M34 24 Q24 50 34 76 M66 24 Q76 50 66 76', line('#8b1a1a', 2.5)) +
    R(38, 78, 24, 8, { rx: 2, fill: '#d4a017' }) + P('M50 86 V98 M45 88 V97 M55 88 V97', line('#d4a017', 3)),
  spark: P(starPath(50, 50, 46, 12, 4), { fill: '#f2c94c' }),
  cloud: outlined(o => C(30, 58, 18, o) + C(52, 42, 24, o) + C(73, 56, 18, o) + R(18, 56, 66, 20, { rx: 10, ...o }), '#ffffff', '#8fa6bd', 3),
};
writeSprite('classic', classicSet(), classicFx);
manifest.push({
  id: 'classic', name: 'Classic', preview: 'gR', fx: Object.keys(classicFx),
  suits: { c: 'characters', b: 'bamboo', d: 'dots' },
  honours: ['East wind', 'South wind', 'West wind', 'North wind', 'Red dragon', 'Green dragon', 'White dragon'],
  flowers: { group: 'flower', items: ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'] },
  seasons: { group: 'season', items: ['Spring', 'Summer', 'Autumn', 'Winter'] },
});
for (const t of [dogs(), cats(), chameleons(), reef(), fantasy(), mountain(), halloween()]) {
  writeSprite(t.id, kidSet(t), t.fx);
  manifest.push({
    id: t.id, name: t.name, preview: t.preview, fx: Object.keys(t.fx),
    suits: Object.fromEntries(Object.entries(t.suits).map(([k, v]) => [k, v.name])),
    honours: t.honours.map(h => h.name),
    flowers: { group: t.flowers.group, items: t.flowers.items.map(i => i.name) },
    seasons: { group: t.seasons.group, items: t.seasons.items.map(i => i.name) },
  });
}
writeFileSync(new URL('themes.json', OUT), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote', manifest.map(t => t.id).join(', '));
