// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: AGPL-3.0-or-later

(() => {
  const $ = s => document.querySelector(s);
  const board = $('#board'), wrap = $('#wrap');

  /* ---------- Turtle layout, in half-tile units ---------- */
  const LAYOUT = [];
  const add = (x, y, z) => LAYOUT.push({ x2: Math.round(x * 2), y2: Math.round(y * 2), z });
  [[1, 12], [3, 10], [2, 11], [1, 12], [1, 12], [2, 11], [3, 10], [1, 12]]
    .forEach(([a, b], y) => { for (let x = a; x <= b; x++) add(x, y, 0); });
  add(0, 3.5, 0); add(13, 3.5, 0); add(14, 3.5, 0);
  for (let y = 1; y <= 6; y++) for (let x = 4; x <= 9; x++) add(x, y, 1);
  for (let y = 2; y <= 5; y++) for (let x = 5; x <= 8; x++) add(x, y, 2);
  for (let y = 3; y <= 4; y++) for (let x = 6; x <= 7; x++) add(x, y, 3);
  add(6.5, 3.5, 4);
  const N = LAYOUT.length; // 144

  LAYOUT.forEach(a => {
    a.above = []; a.left = []; a.right = [];
    LAYOUT.forEach((b, j) => {
      if (a === b) return;
      const dx = b.x2 - a.x2, dy = b.y2 - a.y2;
      if (b.z > a.z && Math.abs(dx) < 2 && Math.abs(dy) < 2) a.above.push(j);
      if (b.z === a.z && Math.abs(dy) < 2) {
        if (dx === -2) a.left.push(j);
        if (dx === 2) a.right.push(j);
      }
    });
  });
  const isFree = (i, present) => {
    const p = LAYOUT[i];
    if (p.above.some(j => present[j])) return false;
    return !p.left.some(j => present[j]) || !p.right.some(j => present[j]);
  };

  /* ---------- Tile set ---------- */
  const KINDS = [];
  for (const s of ['c', 'b', 'd']) for (let n = 1; n <= 9; n++) KINDS.push(s + n);
  KINDS.push('wE', 'wS', 'wW', 'wN', 'gR', 'gG', 'gW');
  const keyOf = f => f[0] === 'f' ? 'F' : f[0] === 's' ? 'S' : f;

  // The faces are drawn per style in assets/themes/<style>.svg, one
  // <symbol id="<style>-k-<face>"> each; themes.json names the styles and faces.
  const HONOURS = ['wE', 'wS', 'wW', 'wN', 'gR', 'gG', 'gW'];
  let THEMES = [], theme = null;
  // Words come from src/i18n.js: tr() is the current language, tt() the
  // current style's words in it.
  const LANGS = ['en', 'de', 'hr'];
  let lang = 'en';
  const tr = () => I18N[lang];
  const tt = () => tr().themes[theme.id];
  const nameOf = f => {
    const k = f[0], v = f.slice(1), w = tt();
    if (k in w.suits) return w.suits[k] + ' ' + v;
    if (k === 'f') return w.flowers[v - 1];
    if (k === 's') return w.seasons[v - 1];
    return w.honours[HONOURS.indexOf(f)];
  };

  /* ---------- Dealing ---------- */
  const mulberry32 = a => () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const shuffle = (arr, rng) => {
    for (let i = arr.length - 1; i > 0; i--) { const j = rng() * (i + 1) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };

  // Places pairs by playing the board backwards from full: each pair goes on two tiles
  // that are free at the same moment, so the reverse order is always a solution.
  function assign(indices, pairs, rng) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const present = new Uint8Array(N);
      indices.forEach(i => present[i] = 1);
      const out = {};
      let ok = true;
      for (const pr of shuffle(pairs.slice(), rng)) {
        const free = indices.filter(i => present[i] && isFree(i, present));
        if (free.length < 2) { ok = false; break; }
        const a = free[rng() * free.length | 0];
        let b; do b = free[rng() * free.length | 0]; while (b === a);
        out[a] = pr[0]; out[b] = pr[1];
        present[a] = present[b] = 0;
      }
      if (ok) return out;
    }
    return null;
  }

  function deal(seed) {
    const rng = mulberry32(seed);
    const pairs = [];
    KINDS.forEach(k => pairs.push([k, k], [k, k]));
    const fl = shuffle(['f1', 'f2', 'f3', 'f4'], rng), se = shuffle(['s1', 's2', 's3', 's4'], rng);
    pairs.push([fl[0], fl[1]], [fl[2], fl[3]], [se[0], se[1]], [se[2], se[3]]);
    const all = [...Array(N).keys()];
    const out = assign(all, pairs, rng);
    return all.map(i => out[i]);
  }

  /* ---------- State ---------- */
  let S, sel = null, hint = [], hintTimer = 0, hintCycle = 0, lastTick = 0, paused = false;

  function fresh(seed) {
    const faces = deal(seed);
    return { seed, faces, present: Array(N).fill(1), history: [], elapsed: 0, started: false, over: false, event: planEvent(seed, faces) };
  }

  // At most one surprise per deal, picked from the deal number so that a
  // restart brings the same one back. `at` is how many tiles must be cleared
  // before it happens.
  function planEvent(seed, faces) {
    const rng = mulberry32(seed * 7919 + 17), r = rng();
    if (r < .25) return null;
    if (r < .5) {
      const k = KINDS[rng() * KINDS.length | 0];
      const four = shuffle(faces.map((f, i) => f === k ? i : -1).filter(i => i >= 0), rng);
      return { type: 'golden', tiles: four.slice(0, 2), done: false };
    }
    return { type: r < .75 ? 'helper' : 'mischief', at: 2 * (12 + (rng() * 30 | 0)), done: false, covered: [] };
  }
  const STORE = 'turtle-mahjong-game', BEST = 'turtle-mahjong-best', SHADE = 'turtle-mahjong-shade',
    SKIN = 'turtle-mahjong-style', LANG = 'turtle-mahjong-lang';
  const load = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const valid = s => s && Array.isArray(s.faces) && s.faces.length === N && Array.isArray(s.present) && s.present.length === N;

  /* ---------- Tiles in the DOM ---------- */
  const tiles = LAYOUT.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.i = i;
    el.setAttribute('role', 'button');
    el.style.cssText = `--x:${p.x2};--y:${p.y2};--z:${p.z};z-index:${p.z * 1000 + p.y2 * 40 + p.x2}`;
    el.innerHTML = '<div class="top"><svg viewBox="0 0 40 53" aria-hidden="true"><use></use></svg></div>';
    board.appendChild(el);
    return el;
  });

  function freeTiles() {
    const out = [];
    for (let i = 0; i < N; i++) if (S.present[i] && isFree(i, S.present)) out.push(i);
    return out;
  }
  function openGroups() {
    const g = {};
    freeTiles().forEach(i => (g[keyOf(S.faces[i])] ||= []).push(i));
    return Object.values(g).filter(a => a.length > 1);
  }
  const countPairs = () => openGroups().reduce((n, a) => n + a.length * (a.length - 1) / 2, 0);
  const leftCount = () => S.present.reduce((a, b) => a + b, 0);

  const fmt = ms => {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  };

  function render() {
    const free = new Set(freeTiles());
    tiles.forEach((el, i) => {
      const on = !!S.present[i], f = S.faces[i];
      el.classList.toggle('out', !on);
      if (on) el.classList.remove('leaving', 'queued');
      el.classList.toggle('blocked', on && !free.has(i));
      el.classList.toggle('sel', sel === i);
      el.classList.toggle('hint', hint.includes(i));
      const ev = S.event;
      el.classList.toggle('golden', on && !!ev && ev.type === 'golden' && !ev.done && ev.tiles.includes(i));
      const covered = on && !!ev && ev.type === 'mischief' && ev.covered.includes(i);
      el.classList.toggle('covered', covered);
      if (covered) {
        const ref = `#${theme.id}-${EVENTS.mischief[theme.id]}`;
        let c = el.querySelector('.cover');
        if (!c) {
          c = document.createElement('span');
          c.className = 'cover';
          c.innerHTML = '<svg aria-hidden="true"><use width="100%" height="100%"></use></svg>';
          el.appendChild(c);
        }
        c.querySelector('use').setAttribute('href', ref);
      }
      const ref = '#' + theme.id + '-k-' + f;
      if (el._ref !== ref) {
        el.querySelector('use').setAttribute('href', ref);
        el.setAttribute('aria-label', nameOf(f));
        el._ref = ref;
      }
    });
    $('#undoBtn').disabled = !S.history.length;
    $('#hintBtn').disabled = $('#shuffleBtn').disabled = S.over || leftCount() === 0;
    save();
  }
  const save = () => store(STORE, JSON.stringify(S));

  /* ---------- Notices ---------- */
  function notice(title, body, actions) {
    $('#nTitle').textContent = title;
    $('#nBody').textContent = body;
    const row = $('#nActions');
    row.innerHTML = '';
    actions.forEach(([label, fn, primary]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (primary ? ' primary' : ''); b.textContent = label;
      b.onclick = () => { hideNotice(); fn(); };
      row.appendChild(b);
    });
    $('#notice').hidden = false;
    row.firstChild?.focus();
  }
  const hideNotice = () => { $('#notice').hidden = true; };

  function checkEnd() {
    const left = leftCount();
    if (left === 0) {
      S.over = true; S.started = false;
      const best = Number(load(BEST)) || 0;
      const isBest = !best || S.elapsed < best;
      if (isBest) store(BEST, String(S.elapsed));
      celebrate(() => notice(tr().cleared, tr().clearedBody(fmt(S.elapsed), fmt(best), isBest),
        [[tr().newDeal, newDeal, true], [tr().replay, restart]]));
    } else if (countPairs() === 0) {
      notice(tr().stuck, tr().stuckBody(left),
        [[tr().shuffleTiles, shuffleTiles, true], [tr().undo, undo], [tr().newDeal, newDeal]]);
    }
  }

  /* ---------- Clearing a pair ---------- */
  // The tiles' own exit is the style's `.tile.out.leaving` animation in
  // style.css. On top of that, a few of the style's fx pictures fly off each
  // tile; `kind` picks how (the .fx-<kind> animations) and where they head,
  // in half-tile widths.
  const FX = {
    dogs: { kind: 'burst', count: 5, aim: () => { const a = Math.random() * 2 * Math.PI, d = 1.4 + Math.random(); return [Math.cos(a) * d, Math.sin(a) * d]; } },
    chameleons: { kind: 'fall', count: 3, aim: () => [(Math.random() - .5) * 3, 1.5 + Math.random() * 1.5] },
    reef: { kind: 'rise', count: 5, aim: () => [(Math.random() - .5) * 1.4, -(2 + Math.random() * 1.6)] },
    halloween: { kind: 'fly', count: 3, aim: () => [(Math.random() - .5) * 4, -(1 + Math.random() * 1.5)] },
    cats: { kind: 'burst', count: 5, aim: () => { const a = Math.random() * 2 * Math.PI, d = 1.4 + Math.random(); return [Math.cos(a) * d, Math.sin(a) * d]; } },
    fantasy: { kind: 'burst', count: 6, aim: () => { const a = Math.random() * 2 * Math.PI, d = 1.2 + Math.random() * 1.4; return [Math.cos(a) * d, Math.sin(a) * d]; } },
    mountain: { kind: 'fall', count: 3, aim: () => [1 + Math.random() * 2, 1.2 + Math.random() * 1.5] },
  };
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  function leave(ids) {
    if (calm.matches) return;
    const fx = theme.fx.length && FX[theme.id];
    ids.forEach(i => {
      const el = tiles[i];
      el.classList.add('leaving');
      el.addEventListener('animationend', function done(e) {
        if (e.target !== el) return;
        el.classList.remove('leaving');
        el.removeEventListener('animationend', done);
      });
      if (!fx) return;
      const x = el.offsetLeft + el.offsetWidth / 2, y = el.offsetTop + el.offsetHeight / 2;
      for (let k = 0; k < fx.count; k++) {
        const [dx, dy] = fx.aim(), p = document.createElement('span');
        p.className = 'fx fx-' + fx.kind;
        p.style.cssText = `left:${x}px;top:${y}px;--dx:${dx.toFixed(2)};--dy:${dy.toFixed(2)};` +
          `--rot:${Math.round(Math.random() * 540 - 270)}deg;--delay:${Math.round(Math.random() * 150)}ms`;
        p.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#${theme.id}-fx-${theme.fx[k % theme.fx.length]}"></use></svg>`;
        p.addEventListener('animationend', e => { if (e.target === p) p.remove(); });
        board.appendChild(p);
      }
    });
  }

  /* ---------- Clearing the board ---------- */
  // Each style's celebration: [symbol, how it moves, how many, size in half-tile
  // widths]. Symbols are the style's fx-* pictures or its own tile faces.
  const PARTY = {
    classic: [['fx-lantern', 'rise', 12, 3], ['fx-spark', 'rain', 30, 1.2]],
    dogs: [['k-wE', 'bounce', 2, 4], ['k-wS', 'bounce', 2, 4], ['k-wW', 'bounce', 2, 4], ['k-wN', 'bounce', 2, 4],
      ['fx-bone', 'rain', 18, 1.8], ['fx-paw', 'rain', 18, 1.6]],
    chameleons: [['k-wE', 'bounce', 2, 4.5], ['k-wS', 'bounce', 2, 4.5], ['k-wW', 'bounce', 2, 4.5], ['k-wN', 'bounce', 2, 4.5],
      ['k-gR', 'rise', 8, 3], ['fx-leaf', 'rain', 22, 1.8], ['fx-ladybug', 'rain', 8, 1.5]],
    reef: [['fx-fish', 'swim', 24, 2], ['k-gR', 'swim', 2, 7], ['k-wE', 'rise', 3, 4], ['k-wN', 'rise', 3, 4], ['fx-bubble', 'rise', 36, 1.6]],
    halloween: [['fx-bat', 'swarm', 30, 2.6], ['k-wE', 'rise', 5, 4], ['fx-pumpkin', 'bounce', 8, 2.6]],
    cats: [['k-wE', 'bounce', 2, 4.5], ['k-wS', 'bounce', 2, 4.5], ['k-wW', 'bounce', 2, 4.5], ['k-wN', 'bounce', 2, 4.5],
      ['k-gG', 'swim', 8, 3], ['fx-paw', 'rain', 20, 1.6], ['fx-yarn', 'bounce', 6, 2.4]],
    fantasy: [['k-wE', 'bounce', 3, 5], ['k-wS', 'swim', 3, 5], ['k-wW', 'rise', 5, 3.6], ['fx-star', 'rain', 24, 1.6], ['fx-sparkle', 'rise', 24, 1.4]],
    mountain: [['k-wN', 'swim', 4, 5], ['k-wE', 'bounce', 2, 4.5], ['k-wS', 'bounce', 2, 4.5], ['k-wW', 'bounce', 2, 4.5],
      ['fx-star', 'rain', 26, 1.2], ['fx-pinecone', 'bounce', 6, 2]],
  };
  let partyTimer = 0;
  function celebrate(then) {
    const layer = $('#party'), parts = PARTY[theme.id];
    if (calm.matches || !parts) { then(); return; }
    const W = layer.clientWidth, H = layer.clientHeight;
    const ux = parseFloat(board.style.getPropertyValue('--ux')) || 20;
    const rnd = (a, b) => a + Math.random() * (b - a);
    parts.forEach(([sym, kind, count, size]) => {
      for (let k = 0; k < count; k++) {
        const s = size * ux;
        let x0, y0, x1, y1, ym, dur = rnd(2.4, 3.6);
        if (kind === 'rain') { x0 = rnd(0, W); y0 = -s; x1 = x0 + rnd(-60, 60); y1 = H + s; }
        else if (kind === 'rise') { x0 = rnd(0, W); y0 = H + s; x1 = x0 + rnd(-80, 80); y1 = -s; dur = rnd(3, 4.5); }
        else if (kind === 'swim') { x0 = W + s; y0 = rnd(.1, .9) * H; x1 = -s * 1.5; y1 = y0 + rnd(-40, 40); }
        else if (kind === 'swarm') { x0 = -s; y0 = rnd(.3, 1) * H; x1 = W + s; y1 = y0 - rnd(.3, .8) * H; dur = rnd(1.8, 2.8); }
        else { x0 = rnd(.05, .95) * W; y0 = H + s * .2; ym = rnd(.1, .45) * H; x1 = x0 + rnd(-.2, .2) * W; y1 = H + s; dur = rnd(1.6, 2.2); }
        ym ??= (y0 + y1) / 2;
        const p = document.createElement('span'), px = v => Math.round(v - s / 2) + 'px';
        p.className = 'party-bit party-' + kind;
        p.style.cssText = `width:${s}px;height:${s}px;--x0:${px(x0)};--y0:${px(y0)};--xm:${px((x0 + x1) / 2)};--ym:${px(ym)};` +
          `--x1:${px(x1)};--y1:${px(y1)};animation-duration:${dur.toFixed(2)}s;animation-delay:${rnd(0, 1.8).toFixed(2)}s`;
        p.innerHTML = `<svg aria-hidden="true"><use href="#${theme.id}-${sym}" width="100%" height="100%"></use></svg>`;
        p.addEventListener('animationend', e => { if (e.target === p) p.remove(); });
        layer.appendChild(p);
      }
    });
    partyTimer = setTimeout(then, 1600);
  }

  /* ---------- Actions ---------- */
  function startClock() {
    if (!S.started && !S.over) { S.started = true; lastTick = performance.now(); }
  }
  function clearHint() {
    clearTimeout(hintTimer);
    hint = [];
  }

  function onTile(i) {
    if (!S.present[i] || S.over) return;
    startClock();
    clearHint();
    if (tiles[i].classList.contains('covered')) { uncover(i); return; }
    if (!isFree(i, S.present)) {
      const el = tiles[i];
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      if (sel !== null) { sel = null; render(); }
      return;
    }
    if (sel === i) sel = null;
    else if (sel !== null && keyOf(S.faces[sel]) === keyOf(S.faces[i])) {
      takePair(sel, i);
      return;
    } else sel = i;
    render();
  }

  function takePair(a, b) {
    S.present[a] = S.present[b] = 0;
    S.history.push({ t: 'pair', a, b });
    leave([a, b]);
    if (sel === a || sel === b) sel = null;
    const ev = S.event;
    const struck = ev && ev.type === 'golden' && !ev.done && (ev.tiles.includes(a) || ev.tiles.includes(b));
    if (struck) ev.done = true;
    render();
    checkEnd();
    if (S.over) return;
    if (struck) {
      toast(() => tt().golden[1]);
      pairUp();
    }
    surprise();
  }

  // PAIR UP, the golden pair's reward: every pair that is open right now
  // clears itself, one after another. They leave the game at once, so nothing
  // can be clicked mid-way; .queued keeps each on screen, lit up, until its turn.
  function pairUp() {
    const covered = S.event?.covered || [], pairs = [];
    openGroups().forEach(g => {
      const free = g.filter(i => !covered.includes(i));
      for (let k = 0; k + 1 < free.length; k += 2) pairs.push([free[k], free[k + 1]]);
    });
    if (!pairs.length) return;
    clearHint(); sel = null;
    pairs.forEach(([a, b]) => { S.present[a] = S.present[b] = 0; });
    S.history.push({ t: 'pairs', list: pairs });
    const gap = calm.matches ? 0 : 220;
    pairs.flat().forEach(i => tiles[i].classList.add('queued'));
    render();
    pairs.forEach(([a, b], k) => setTimeout(() => {
      if (S.present[a] || S.present[b]) return; // undone meanwhile
      tiles[a].classList.remove('queued'); tiles[b].classList.remove('queued');
      leave([a, b]);
    }, 300 + k * gap));
    setTimeout(() => { checkEnd(); if (!S.over) surprise(); }, 300 + pairs.length * gap);
  }

  /* ---------- Surprises ---------- */
  // Who comes to help, and what covers the tiles in mischief: the style's own
  // fx-* or k-* symbols. What the toasts say is in src/i18n.js.
  const EVENTS = {
    helper: { classic: 'fx-lantern', dogs: 'k-wS', chameleons: 'k-wE', reef: 'k-wE', halloween: 'k-wE', cats: 'k-wE', fantasy: 'k-wS', mountain: 'k-wN' },
    mischief: { classic: 'fx-cloud', dogs: 'fx-paw', chameleons: 'fx-leaf', reef: 'fx-bubble', halloween: 'fx-web', cats: 'fx-yarn', fantasy: 'fx-dust', mountain: 'fx-fog' },
  };

  let toastTimer = 0;
  // `say` returns the text, so a toast still showing follows a change of
  // language or style.
  let toastSay = null;
  function toast(say, ms = 4200) {
    const t = $('#toast');
    toastSay = say;
    t.textContent = say();
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  const retoast = () => { if (toastSay && !$('#toast').hidden) $('#toast').textContent = toastSay(); };

  // Called after every pair: starts a helper or mischief once enough is cleared.
  function surprise() {
    const ev = S.event;
    if (!ev || ev.done || ev.running || ev.type === 'golden' || N - leftCount() < ev.at) return;
    if (ev.type === 'helper') helper();
    else mischief();
  }

  function helper() {
    const ev = S.event, groups = openGroups().map(g => g.filter(i => !ev.covered.includes(i))).filter(g => g.length > 1);
    if (!groups.length) return; // try again after the next pair
    const [a, b] = groups[Math.random() * groups.length | 0];
    const who = EVENTS.helper[theme.id];
    ev.running = true;
    const layer = $('#party'), box = layer.getBoundingClientRect();
    const centre = i => { const r = tiles[i].getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; };
    const [ax, ay] = centre(a), [bx, by] = centre(b);
    const ux = parseFloat(board.style.getPropertyValue('--ux')) || 20, s = 5 * ux;
    const go = () => {
      ev.running = false;
      ev.done = true;
      if (S.present[a] && S.present[b] && isFree(a, S.present) && isFree(b, S.present)) takePair(a, b);
    };
    toast(() => tt().helper);
    if (calm.matches) { go(); return; }
    const p = document.createElement('span');
    p.className = 'helper';
    p.style.cssText = `width:${s}px;height:${s}px`;
    p.innerHTML = `<svg aria-hidden="true"><use href="#${theme.id}-${who}" width="100%" height="100%"></use></svg>`;
    layer.appendChild(p);
    const at = (x, y) => `translate(${Math.round(x - s / 2)}px, ${Math.round(y - s / 2)}px)`;
    const fromLeft = (ax + bx) / 2 > box.width / 2;
    const edge = fromLeft ? -s : box.width + s;
    const run = p.animate([
      { transform: at(edge, ay) },
      { transform: at(ax, ay), offset: .35 },
      { transform: at(bx, by), offset: .6 },
      { transform: at(fromLeft ? box.width + s : -s, by - box.height * .2) },
    ], { duration: 2600, easing: 'ease-in-out' });
    setTimeout(go, 2600 * .6);
    run.onfinish = () => p.remove();
  }

  function mischief() {
    const ev = S.event;
    const pool = shuffle(freeTiles(), Math.random);
    if (pool.length < 2) return;
    ev.covered = pool.slice(0, Math.min(4, pool.length));
    ev.done = true;
    if (ev.covered.includes(sel)) sel = null;
    toast(() => tt().mischief);
    render();
    if (!calm.matches) ev.covered.forEach(i => tiles[i].querySelector('.cover')
      ?.animate([{ transform: 'scale(.2) rotate(-40deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.3,1.6,.5,1)' }));
  }

  function uncover(i) {
    const ev = S.event;
    ev.covered = ev.covered.filter(j => j !== i);
    const c = tiles[i].querySelector('.cover');
    tiles[i].classList.remove('covered');
    if (c && !calm.matches) {
      c.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.6) rotate(25deg)', opacity: 0 }], { duration: 350, easing: 'ease-out' })
        .onfinish = () => render();
    } else render();
    save();
  }

  /* ---------- How to play ---------- */
  function openHelp() {
    const mini = f => `<svg class="mini-tile" viewBox="0 0 40 53" aria-hidden="true"><use href="#${theme.id}-k-${f}"></use></svg>`;
    const group = (rule, key) => `<div class="help-group">${[1, 2, 3, 4].map(n => mini(key + n)).join('')}</div><p>${rule}</p>`;
    const [play, free, stuck, surprises] = tr().help;
    $('#helpBody').innerHTML =
      `<p>${play}</p><div class="help-group">${mini('c3')}${mini('c3')}</div><p>${free}</p>` +
      group(tt().flowersRule, 'f') + group(tt().seasonsRule, 's') + `<p>${stuck}</p><p>${surprises}</p>`;
    $('#help').hidden = false;
    paused = true;
    $('#helpClose').focus();
  }
  function closeHelp() {
    $('#help').hidden = true;
    paused = false;
    lastTick = performance.now();
  }
  $('#helpBtn').onclick = openHelp;
  $('#helpClose').onclick = closeHelp;
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') closeHelp(); });

  function undo() {
    const h = S.history.pop();
    if (!h) return;
    clearHint(); sel = null; hideNotice();
    if (h.t === 'pair') { S.present[h.a] = S.present[h.b] = 1; }
    else if (h.t === 'pairs') h.list.forEach(([a, b]) => { S.present[a] = S.present[b] = 1; });
    else { S.faces = h.prev; }
    S.over = false;
    render();
  }

  function showHint() {
    if (S.over) return;
    const groups = openGroups();
    if (!groups.length) { checkEnd(); return; }
    startClock();
    sel = null;
    const g = groups[hintCycle++ % groups.length];
    hint = [g[0], g[1]];
    render();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint = []; render(); }, 2600);
  }

  function shuffleTiles() {
    if (S.over) return;
    const idx = [...Array(N).keys()].filter(i => S.present[i]);
    if (idx.length < 2) return;
    const byKey = {};
    idx.forEach(i => (byKey[keyOf(S.faces[i])] ||= []).push(S.faces[i]));
    const pairs = [];
    Object.values(byKey).forEach(a => { for (let k = 0; k + 1 < a.length; k += 2) pairs.push([a[k], a[k + 1]]); });
    const out = assign(idx, pairs, Math.random);
    clearHint(); sel = null;
    if (!out) {
      render();
      notice(tr().cantShuffle, tr().cantShuffleBody(idx.length), [[tr().undo, undo, true], [tr().newDeal, newDeal]]);
      return;
    }
    startClock();
    S.history.push({ t: 'shuffle', prev: S.faces.slice() });
    S.faces = S.faces.map((f, i) => out[i] ?? f);
    render();
    checkEnd();
  }

  const inProgress = () => S.history.length > 0 && !S.over;
  function confirmThen(title, fn) {
    if (!inProgress()) { fn(); return; }
    notice(title, tr().confirmBody(N - leftCount(), N), [[title, fn, true], [tr().keepPlaying, () => {}]]);
  }
  function begin(seed) {
    clearHint(); sel = null; hintCycle = 0; hideNotice();
    clearTimeout(partyTimer);
    $('#party').replaceChildren();
    S = fresh(seed);
    render();
    $('#toast').hidden = true;
    if (S.event && S.event.type === 'golden') setTimeout(() => toast(() => tt().golden[0]), 500);
  }
  const newDeal = () => begin(1 + Math.floor(Math.random() * 99999));
  const restart = () => begin(S.seed);

  /* ---------- Wiring ---------- */
  // Nothing responds until the tiles have loaded and there is a game.
  const whenDealt = fn => (...a) => { if (S) fn(...a); };
  board.addEventListener('click', whenDealt(e => {
    const el = e.target.closest('.tile');
    if (el) onTile(+el.dataset.i);
  }));
  $('#hintBtn').onclick = whenDealt(showHint);
  $('#undoBtn').onclick = whenDealt(undo);
  $('#shuffleBtn').onclick = whenDealt(shuffleTiles);
  $('#restartBtn').onclick = whenDealt(() => confirmThen(tr().restart, restart));
  $('#newBtn').onclick = whenDealt(() => confirmThen(tr().newDeal, newDeal));

  const shade = $('#shade');
  shade.checked = load(SHADE) !== '0';
  board.classList.toggle('shade-on', shade.checked);
  shade.onchange = () => { board.classList.toggle('shade-on', shade.checked); store(SHADE, shade.checked ? '1' : '0'); };

  document.addEventListener('keydown', e => {
    if (!S || e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (!$('#help').hidden) { if (k === 'escape') closeHelp(); return; }
    if (!$('#skins').hidden) { if (k === 'escape') { skinsOpen(false); $('#skinBtn').focus(); } return; }
    if (k === '?') { openHelp(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'h') showHint();
    else if (k === 'u') undo();
    else if (k === 's') shuffleTiles();
    else if (k === 'escape') { sel = null; render(); }
  });

  setInterval(() => {
    const now = performance.now();
    if (S && S.started && !S.over && !paused && !document.hidden) {
      S.elapsed += now - lastTick;
    }
    lastTick = now;
  }, 250);
  setInterval(() => S && S.started && save(), 5000);

  function fit() {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const ux = Math.max(8, Math.min(W / 31.4, H / 21.9, 38));
    const uy = ux * 1.28, d = ux * .3;
    board.style.setProperty('--ux', ux + 'px');
    board.style.setProperty('--uy', uy + 'px');
    board.style.setProperty('--d', d + 'px');
    board.style.setProperty('--t', ux * .3 + 'px');
    board.style.width = 30 * ux + 4 * d + 'px';
    board.style.height = 16 * uy + 4 * d + 'px';
  }
  new ResizeObserver(fit).observe(wrap);
  fit();

  function start() {
    let saved;
    try { saved = JSON.parse(load(STORE)); } catch { saved = null; }
    if (valid(saved)) {
      S = saved;
      if (S.event) S.event.running = false;
      render();
      if (!S.over && leftCount() > 0 && countPairs() === 0) checkEnd();
    } else newDeal();
  }

  /* ---------- Language ---------- */
  function useLang(code) {
    lang = LANGS.includes(code) ? code : 'en';
    store(LANG, lang);
    document.documentElement.lang = lang;
    document.title = tr().title;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr()[el.dataset.i18n]; });
    $('#helpBtn').setAttribute('aria-label', tr().howTo);
    $('#helpBtn').title = tr().howTo;
    $('#skins').setAttribute('aria-label', tr().tileStyle);
    $('#langs').setAttribute('aria-label', tr().language);
    board.setAttribute('aria-label', tr().board);
    document.querySelectorAll('.lang').forEach(b => b.setAttribute('aria-checked', b.dataset.lang === lang));
    if (theme) { labelSkins(); retoast(); }
    if (S) {
      tiles.forEach(el => { el._ref = null; });
      render();
    }
  }
  function buildLangs() {
    LANGS.forEach(code => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lang'; b.dataset.lang = code;
      b.setAttribute('role', 'radio');
      b.textContent = code.toUpperCase();
      b.title = I18N[code].langName;
      b.onclick = () => useLang(code);
      $('#langs').appendChild(b);
    });
  }
  // A first visit gets the browser's language when the game speaks it.
  const firstLang = () => {
    const saved = load(LANG);
    if (saved) return saved;
    for (const l of navigator.languages || [navigator.language || '']) {
      const c = l.slice(0, 2).toLowerCase();
      if (LANGS.includes(c)) return c;
      if (['bs', 'sr', 'sh'].includes(c)) return 'hr';
    }
    return 'en';
  };
  buildLangs();
  useLang(firstLang());

  /* ---------- Styles ---------- */
  function labelSkins() {
    document.querySelectorAll('.skin').forEach(b => {
      b.querySelector('span').textContent = tr().themes[b.dataset.id]?.name ?? b.dataset.id;
    });
    if (theme) {
      $('#skinBtnName').textContent = tt().name;
      $('#skinBtn').title = tr().tileStyle + ': ' + tt().name;
    }
  }
  // The style list opens from the button at the top left.
  const skinsOpen = open => {
    $('#skins').hidden = !open;
    $('#skinBtn').setAttribute('aria-expanded', open);
    if (open) $('.skin[aria-checked="true"]')?.focus();
  };
  $('#skinBtn').onclick = () => skinsOpen($('#skins').hidden);
  document.addEventListener('click', e => { if (!$('#skins').hidden && !$('#skinMenu').contains(e.target)) skinsOpen(false); });
  function useTheme(id) {
    theme = THEMES.find(t => t.id === id) || THEMES[0];
    document.documentElement.dataset.skin = theme.id;
    store(SKIN, theme.id);
    retoast();
    $('#skinBtnUse').setAttribute('href', `#${theme.id}-k-${theme.preview}`);
    labelSkins();
    document.querySelectorAll('.skin').forEach(b => b.setAttribute('aria-checked', b.dataset.id === theme.id));
    if (S) render();
  }
  function buildPicker() {
    const row = $('#skins');
    THEMES.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'skin'; b.dataset.id = t.id;
      b.setAttribute('role', 'radio');
      b.innerHTML = `<svg viewBox="0 0 40 53" aria-hidden="true"><use href="#${t.id}-k-${t.preview}"></use></svg><span></span>`;
      b.onclick = () => { useTheme(t.id); skinsOpen(false); $('#skinBtn').focus(); };
      row.appendChild(b);
    });
    labelSkins();
  }

  // The faces are inlined rather than referenced as assets/themes/<style>.svg#…,
  // so that they pick up the page's colour tokens and its web fonts. All styles
  // load up front so switching is instant.
  const get = (url, as) => fetch(url).then(r => { if (!r.ok) throw new Error(url + ': ' + r.status); return r[as](); });
  get('assets/themes/themes.json', 'json')
    .then(list => Promise.all(list.map(t => get(`assets/themes/${t.id}.svg`, 'text'))).then(svgs => {
      const holder = document.createElement('div');
      holder.className = 'sprite';
      holder.innerHTML = svgs.join('');
      document.body.prepend(holder);
      THEMES = list;
      buildPicker();
      useTheme(load(SKIN));
      start();
    }))
    .catch(() => {
      S = fresh(1);
      notice(tr().loadFailed, tr().loadFailedBody, []);
    });
})();
