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
  const nameOf = f => {
    const k = f[0], v = f.slice(1);
    if (k in theme.suits) return v + ' ' + theme.suits[k];
    if (k === 'f') return theme.flowers.items[v - 1];
    if (k === 's') return theme.seasons.items[v - 1];
    return theme.honours[HONOURS.indexOf(f)];
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
    SKIN = 'turtle-mahjong-style';
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
      if (on) el.classList.remove('leaving');
      el.classList.toggle('blocked', on && !free.has(i));
      el.classList.toggle('sel', sel === i);
      el.classList.toggle('hint', hint.includes(i));
      const ev = S.event;
      el.classList.toggle('golden', on && !!ev && ev.type === 'golden' && !ev.done && ev.tiles.includes(i));
      const covered = on && !!ev && ev.type === 'mischief' && ev.covered.includes(i);
      el.classList.toggle('covered', covered);
      if (covered) {
        const ref = `#${theme.id}-${EVENTS.mischief[theme.id][0]}`;
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
    const pairs = countPairs();
    $('#left').textContent = leftCount();
    $('#pairs').textContent = pairs;
    $('#pairs').classList.toggle('zero', pairs === 0 && leftCount() > 0);
    $('#time').textContent = fmt(S.elapsed);
    $('#deal').textContent = 'Deal #' + S.seed;
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
      celebrate(() => notice('Board cleared',
        `Deal #${S.seed} in ${fmt(S.elapsed)}. ` + (isBest ? 'That is your best time.' : `Your best is ${fmt(best)}.`),
        [['New deal', newDeal, true], ['Replay this deal', restart]]));
    } else if (countPairs() === 0) {
      notice('No pairs left',
        `${left} tiles remain, but no two free tiles match. Shuffle the remaining tiles into a layout that can be cleared, or undo.`,
        [['Shuffle tiles', shuffleTiles, true], ['Undo', undo], ['New deal', newDeal]]);
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
    swiss: { kind: 'fall', count: 4, aim: () => [(Math.random() - .5) * 3, 1.5 + Math.random() * 1.5] },
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
    swiss: [['k-wE', 'bounce', 3, 4.5], ['k-wS', 'bounce', 2, 4.5], ['k-wW', 'bounce', 2, 4], ['k-wN', 'bounce', 2, 4.5],
      ['fx-flag', 'rise', 12, 2.2], ['fx-snow', 'rain', 30, 1.6]],
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
      toast(EVENTS.golden[theme.id][1]);
      startClock();
      hint = openGroups().flat();
      render();
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { hint = []; render(); }, 6000);
    }
    surprise();
  }

  /* ---------- Surprises ---------- */
  // golden: [what the toast says at the start, what it says on matching one].
  // helper: [who comes, what the toast says]. mischief: [what covers the tiles,
  // what the toast says]. Pictures are the style's own fx-* or k-* symbols.
  const EVENTS = {
    golden: {
      classic: ['Two lucky tiles are glowing. Find them!', 'Lucky! Every pair you can take lights up.'],
      dogs: ['Two tiles are wearing golden collars. Find them!', 'Good dog! Every pair you can take lights up.'],
      chameleons: ['Two tiles are shimmering like a rainbow. Find them!', 'Rainbow power! Every pair you can take lights up.'],
      reef: ['Two tiles are hiding pearls. Find the shiny ones!', 'Pearls! Every pair you can take lights up.'],
      halloween: ['Two tiles are under a magic spell. Find them!', 'Abracadabra! Every pair you can take lights up.'],
      swiss: ['Two tiles are wrapped in gold foil, like chocolate. Find them!', 'Yum! Every pair you can take lights up.'],
    },
    helper: {
      classic: ['fx-lantern', 'A lantern floated by and carried a pair away!'],
      dogs: ['k-wS', 'Goldie ran in and fetched a pair for you!'],
      chameleons: ['k-wE', 'Zap! A chameleon caught a pair with its tongue!'],
      reef: ['k-wE', 'An octopus swam by and grabbed a pair!'],
      halloween: ['k-wE', 'Boo! A ghost made a pair vanish!'],
      swiss: ['k-wS', 'A St. Bernard came to the rescue and took a pair!'],
    },
    mischief: {
      classic: ['fx-cloud', 'A gust of wind blew clouds over some tiles. Tap them to clear the sky!'],
      dogs: ['fx-paw', 'Oops! A muddy puppy ran over some tiles. Tap them to wipe them clean!'],
      chameleons: ['fx-leaf', 'Leaves fell on some tiles. Tap them to brush them off!'],
      reef: ['fx-bubble', 'Bubbles covered some tiles. Tap them to pop them!'],
      halloween: ['fx-web', 'A spider spun webs over some tiles. Tap them to sweep them away!'],
      swiss: ['fx-snow', 'Snow fell on some tiles. Tap them to brush it off!'],
    },
  };

  let toastTimer = 0;
  function toast(text, ms = 4200) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

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
    const [who, text] = EVENTS.helper[theme.id];
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
    toast(text);
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
    toast(EVENTS.mischief[theme.id][1]);
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
    const group = (g, key) => `<div class="help-group">${[1, 2, 3, 4].map(n => mini(key + n)).join('')}</div>` +
      `<p>Any ${g.group} goes with any other ${g.group}.</p>`;
    $('#helpBody').innerHTML =
      `<p>Find two tiles with the same picture and tap them both. They disappear! Clear every tile to win.</p>` +
      `<div class="help-group">${mini('c3')}${mini('c3')}</div>` +
      `<p>You can only take a <b>free</b> tile: no tile lies on top of it, and its left or right side is open. ` +
      `With “Shade blocked tiles” on, the tiles you can’t take yet are darker.</p>` +
      group(theme.flowers, 'f') + group(theme.seasons, 's') +
      `<p>Stuck? <b>Hint</b> shows a pair, <b>Undo</b> takes back a move, and <b>Shuffle</b> mixes up the tiles that are left.</p>` +
      `<p>Watch out for surprises! Some games have glowing tiles, a helper who takes a pair for you, or a bit of mischief.</p>`;
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
      notice('Shuffling can’t help',
        `The ${idx.length} tiles left are stacked so that no arrangement of them can be cleared. Undo a few moves or start a new deal.`,
        [['Undo', undo, true], ['New deal', newDeal]]);
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
    notice(title, `You have cleared ${N - leftCount()} of ${N} tiles. This game will be lost.`, [[title, fn, true], ['Keep playing', () => {}]]);
  }
  function begin(seed) {
    clearHint(); sel = null; hintCycle = 0; hideNotice();
    clearTimeout(partyTimer);
    $('#party').replaceChildren();
    S = fresh(seed);
    render();
    $('#toast').hidden = true;
    if (S.event && S.event.type === 'golden') setTimeout(() => toast(EVENTS.golden[theme.id][0]), 500);
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
  $('#restartBtn').onclick = whenDealt(() => confirmThen('Restart deal', restart));
  $('#newBtn').onclick = whenDealt(() => confirmThen('New deal', newDeal));

  const shade = $('#shade');
  shade.checked = load(SHADE) !== '0';
  board.classList.toggle('shade-on', shade.checked);
  shade.onchange = () => { board.classList.toggle('shade-on', shade.checked); store(SHADE, shade.checked ? '1' : '0'); };

  document.addEventListener('keydown', e => {
    if (!S || e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (!$('#help').hidden) { if (k === 'escape') closeHelp(); return; }
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
      $('#time').textContent = fmt(S.elapsed);
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

  /* ---------- Styles ---------- */
  function useTheme(id) {
    theme = THEMES.find(t => t.id === id) || THEMES[0];
    document.documentElement.dataset.skin = theme.id;
    store(SKIN, theme.id);
    document.querySelectorAll('.skin').forEach(b => b.setAttribute('aria-checked', b.dataset.id === theme.id));
    if (S) render();
  }
  function buildPicker() {
    const row = $('#skins');
    THEMES.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'skin'; b.dataset.id = t.id;
      b.setAttribute('role', 'radio');
      b.title = t.name;
      b.innerHTML = `<svg viewBox="0 0 40 53" aria-hidden="true"><use href="#${t.id}-k-${t.preview}"></use></svg><span></span>`;
      b.querySelector('span').textContent = t.name;
      b.onclick = () => useTheme(t.id);
      row.appendChild(b);
    });
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
      notice('Tiles did not load',
        'The tile pictures in assets/themes could not be fetched. If you opened index.html as a file, serve the folder instead, for example with python3 -m http.server.',
        []);
    });
})();
