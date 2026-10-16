// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: AGPL-3.0-only
//
// Music and sound effects, made while the game runs with the Web Audio API:
// there are no sound files. Each style has its own key, tempo, instruments
// and accompaniment. The tunes come from a small generator, so each song is
// new: two four-bar sections in the form A A B A, played twice. The sounds
// for a pair, the golden pair and a cleared board use the style's key and
// the chord that is playing, so they sit inside the music.
//
// Browsers only start sound after a tap or a key, so nothing plays before
// the first one.

window.Sound = (() => {
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  const mulberry32 = a => () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // The context, its noise buffer and the buses: `fx` for effects, `music`
  // for the style that is playing (a new one per style, so the old one can
  // fade out on its own), both with a send to a shared reverb.
  let ac = null, NOISE, master, verb, fx, music = null;

  /* ---------- Voices ---------- */
  // One oscillator with an attack, an optional hold and an exponential decay.
  // `glide` starts the pitch at f * glide and slides to f; `vib` is vibrato
  // depth as a fraction of f; `filter` is a lowpass cutoff.
  function tone(out, t, f, { type = 'sine', a = .005, hold = 0, d = .5, v = .2, detune = 0, glide = 0, vib = 0, filter = 0, q = 1 }) {
    if (f * Math.max(1, glide) > 15000) return; // an overtone above hearing
    const o = ac.createOscillator(), g = ac.createGain(), end = t + a + hold + d + .05;
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(glide ? f * glide : f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(f, t + a + .05);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (hold) g.gain.setValueAtTime(v, t + a + hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + d);
    let node = o;
    if (filter) {
      const fl = ac.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = filter; fl.Q.value = q;
      node = node.connect(fl);
    }
    node.connect(g).connect(out);
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 5.3; lg.gain.value = f * vib;
      l.connect(lg).connect(o.frequency);
      l.start(t + .1); l.stop(end);
    }
    o.start(t); o.stop(end);
  }
  // Filtered white noise; `sweep` moves the filter to that frequency over the sound.
  function noise(out, t, { a = 0, d = .05, v = .1, type = 'highpass', f = 6000, q = 1, sweep = 0 }) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = NOISE;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + a + d);
    g.gain.setValueAtTime(a ? 0 : v, t);
    if (a) g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
    s.connect(fl).connect(g).connect(out);
    s.start(t, Math.random() * .5); s.stop(t + a + d + .05);
  }

  // Instruments: (bus, time, midi note, length in s, loudness).
  const sus = d => Math.max(0, d);
  const I = {
    pluck: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { type: 'triangle', d: 1.3, v, glide: .985 }); tone(o, t, f * 2, { d: .45, v: v * .35 }); },
    square: (o, t, m, d, v) => tone(o, t, hz(m), { type: 'square', hold: d * .4, d: .16, v: v * .5, filter: 2400 }),
    keys: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { d: d + .9, v }); tone(o, t, f * 2, { type: 'triangle', d: .35, v: v * .2 }); },
    marimba: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { a: .002, d: .55, v }); tone(o, t, f * 4, { a: .001, d: .07, v: v * .3 }); },
    bell: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { a: .012, d: 1.8, v }); tone(o, t, f * 3, { d: .3, v: v * .12 }); },
    celesta: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { d: 1.2, v }); tone(o, t, f * 2, { d: .5, v: v * .35 }); tone(o, t, f * 3.01, { d: .2, v: v * .15 }); },
    musicbox: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { a: .002, d: 1, v }); tone(o, t, f * 2, { a: .002, d: .25, v: v * .3 }); tone(o, t, f * 5.4, { a: .001, d: .06, v: v * .12 }); },
    flute: (o, t, m, d, v) => { const f = hz(m); tone(o, t, f, { a: .07, hold: sus(d - .15), d: .25, v, vib: .005 }); tone(o, t, f * 2, { type: 'triangle', a: .07, hold: sus(d - .15), d: .2, v: v * .08 }); },
    theremin: (o, t, m, d, v) => tone(o, t, hz(m), { a: .12, hold: sus(d - .15), d: .4, v, vib: .012, glide: .97 }),
    organ: (o, t, m, d, v) => { const f = hz(m); [1, 2, 3].forEach((k, i) => tone(o, t, f * k, { a: .2, hold: sus(d - .2), d: .6, v: v / (1 + i * i) })); },
    pad: (o, t, m, d, v) => [-8, 8].forEach(c => tone(o, t, hz(m), { type: 'sawtooth', a: .9, hold: sus(d - .9), d: 1.5, v, detune: c, filter: 900 })),
    drone: (o, t, m, d, v) => tone(o, t, hz(m), { type: 'triangle', a: .1, hold: sus(d - .1), d: .9, v, filter: 500 }),
    bass: (o, t, m, d, v) => tone(o, t, hz(m), { type: 'triangle', a: .01, hold: d * .5, d: .3, v, filter: 700 }),
    pizz: (o, t, m, d, v) => tone(o, t, hz(m), { type: 'triangle', a: .003, d: .28, v, filter: 1000 }),
    horn: (o, t, m, d, v) => tone(o, t, hz(m), { type: 'sawtooth', a: .25, hold: sus(d - .25), d: .6, v, filter: 650, vib: .003 }),
    drop: (o, t, m, d, v) => tone(o, t, hz(m), { a: .004, d: .35, v }),
  };
  // Percussion and noises: (bus, time, loudness).
  const P = {
    shaker: (o, t, v) => noise(o, t, { d: .045, v, f: 6500 }),
    tick: (o, t, v) => tone(o, t, 1900, { a: .001, d: .035, v }),
    block: (o, t, v) => tone(o, t, 880, { a: .001, d: .08, v }),
    kick: (o, t, v) => tone(o, t, 52, { a: .002, d: .28, v, glide: 3 }),
    tom: (o, t, v) => tone(o, t, 82, { a: .003, d: .45, v, glide: 1.6 }),
    conga: (o, t, v, high) => tone(o, t, high ? 330 : 220, { a: .002, d: .22, v, glide: 1.25 }),
    ride: (o, t, v) => noise(o, t, { d: .14, v, f: 8000 }),
    brush: (o, t, v) => noise(o, t, { d: .16, v, type: 'bandpass', f: 2500, q: .7 }),
    cowbell: (o, t, v) => { tone(o, t, 560, { a: .002, d: .6, v }); tone(o, t, 845, { a: .002, d: .4, v: v * .6 }); },
    bubble: (o, t, v, f = 500 + Math.random() * 700) => tone(o, t, f, { a: .004, d: .09, v, glide: .5 }),
    boing: (o, t, v, f) => tone(o, t, f, { a: .005, d: .32, v, glide: .45, vib: .04 }),
    whoosh: (o, t, v) => noise(o, t, { a: .12, d: .45, v, type: 'bandpass', f: 350, q: 1.2, sweep: 2400 }),
    crack: (o, t, v) => noise(o, t, { d: .035, v, f: 1500 }),
    gong: (o, t, v, f) => [1, 1.47, 2.09, 2.76, 3.5].forEach((k, i) => tone(o, t, f * k, { a: .02, d: 3.5 - i * .5, v: v / (1 + i) })),
    ghost: (o, t, v, f) => tone(o, t, f, { a: .3, hold: .3, d: 1, v, vib: .03, glide: 1.5 }),
  };

  /* ---------- Styles ---------- */
  // Chords as pitch classes over the key.
  const CH = {
    I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 0], V: [7, 11, 2], vi: [9, 0, 4],
    i: [0, 3, 7], iv: [5, 8, 0], VI: [8, 0, 3], VII: [10, 2, 5],
    Imaj7: [0, 4, 7, 11], ii7: [2, 5, 9, 0], iii7: [4, 7, 11, 2], IVmaj7: [5, 9, 0, 4], V7: [7, 11, 2, 5], vi7: [9, 0, 4, 7],
  };
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], PENTA = [0, 2, 4, 7, 9], MINOR = [0, 2, 3, 5, 7, 8, 11], MIXO = [0, 2, 4, 5, 7, 9, 10];
  // key: the tonic as a MIDI note (the tune moves in the 1.5 octaves above
  // its fourth); steps: eighths per bar; sd: seconds per eighth; swing: how
  // late the off-beats come, in eighths; A and B: a chord per bar; lead and
  // lv: the tune's instrument and loudness (leadB for the B section);
  // density: how busy the tune is; wet: reverb; vol: evens out the styles'
  // loudness; back: everything else in a bar.
  // back(bus, T, c, bar, next, rng) gets T(step) -> time, and the chord as
  // c = { bass, tones, fifth } in MIDI notes.
  const STYLES = {
    classic: {
      key: 62, steps: 8, sd: .36, scale: PENTA, A: ['I', 'vi', 'IV', 'I'], B: ['vi', 'iii', 'IV', 'V'],
      lead: 'pluck', lv: .2, density: .4, wet: .3, vol: .83,
      back: (o, T, c, bar) => {
        I.drone(o, T(0), c.bass, T(8) - T(0), .12);
        [2, 3, 5].forEach((s, k) => I.pluck(o, T(s), c.tones[k % c.tones.length], .3, .05));
        if (bar % 2 === 0) P.block(o, T(0), .05);
      },
    },
    dogs: {
      key: 65, steps: 8, sd: .23, scale: MAJOR, A: ['I', 'IV', 'V', 'I'], B: ['vi', 'IV', 'ii', 'V'],
      lead: 'square', lv: .2, density: .7, wet: .12, vol: .66,
      back: (o, T, c) => {
        I.bass(o, T(0), c.bass, .4, .3); I.bass(o, T(4), c.bass + c.fifth, .4, .26);
        [2, 6].forEach(s => c.tones.forEach(m => I.pizz(o, T(s), m, .2, .05)));
        P.kick(o, T(0), .35); P.kick(o, T(4), .25);
        [1, 3, 5, 7].forEach(s => P.shaker(o, T(s), .035));
      },
    },
    cats: {
      key: 60, steps: 8, sd: .3, swing: .33, scale: MAJOR, A: ['ii7', 'V7', 'Imaj7', 'vi7'], B: ['IVmaj7', 'iii7', 'ii7', 'V7'],
      lead: 'keys', lv: .18, density: .55, wet: .2, vol: 1.33,
      back: (o, T, c, bar, next) => {
        // A walking bass: root, third, fifth, then a half step into the next chord.
        const walk = [c.bass, c.bass + c.third, c.bass + c.fifth, next.bass + (next.bass > c.bass + c.fifth ? -1 : 1)];
        walk.forEach((m, k) => I.pizz(o, T(k * 2), m, .3, .26));
        [3, 7].forEach(s => c.tones.forEach(m => I.keys(o, T(s), m, .2, .035)));
        [0, 2, 3, 4, 6, 7].forEach(s => P.ride(o, T(s), s % 2 ? .015 : .025));
        [2, 6].forEach(s => P.brush(o, T(s), .03));
      },
    },
    chameleons: {
      key: 67, steps: 8, sd: .27, scale: PENTA, A: ['I', 'IV', 'I', 'V'], B: ['IV', 'V', 'vi', 'V'],
      lead: 'marimba', lv: .22, density: .65, wet: .18, vol: 1.8,
      back: (o, T, c) => {
        [[0, 0], [3, c.fifth], [6, 12]].forEach(([s, up]) => I.marimba(o, T(s), c.bass + 12 + up, .3, .16));
        [2, 5, 7].forEach((s, k) => I.marimba(o, T(s), c.tones[k % c.tones.length] + 12, .2, .05));
        for (let s = 0; s < 8; s++) P.shaker(o, T(s), s === 2 || s === 6 ? .05 : .022);
        P.conga(o, T(3), .12); P.conga(o, T(7), .1, true);
      },
    },
    reef: {
      key: 64, steps: 8, sd: .42, scale: MAJOR, A: ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'], B: ['vi7', 'iii7', 'IVmaj7', 'V'],
      lead: 'bell', lv: .16, density: .3, wet: .5, vol: .55,
      back: (o, T, c, bar, next, rng) => {
        const len = T(8) - T(0);
        c.tones.forEach(m => I.pad(o, T(0), m, len, .022));
        tone(o, T(0), hz(c.bass), { a: .3, hold: len - .3, d: .8, v: .16 });
        [0, 2, 4, 6].forEach((s, k) => I.drop(o, T(s), c.tones[(k + bar) % c.tones.length] + 12, .2, .035));
        if (rng() < .4) for (let k = 0; k < 3; k++) P.bubble(o, T(rng() * 8) + k * .07, .03);
      },
    },
    halloween: {
      key: 57, steps: 8, sd: .3, scale: MINOR, A: ['i', 'VI', 'iv', 'V'], B: ['i', 'iv', 'VI', 'V'],
      lead: 'celesta', leadB: 'theremin', lv: .17, density: .45, wet: .45, vol: .84,
      back: (o, T, c) => {
        [c.bass, c.bass + c.fifth, c.bass + 12, c.bass + c.fifth].forEach((m, k) => I.pizz(o, T(k * 2), m, .2, .22));
        c.tones.forEach(m => I.organ(o, T(0), m, T(8) - T(0), .018));
        P.tom(o, T(0), .2);
        P.tick(o, T(2), .03); P.block(o, T(6), .03);
      },
    },
    fantasy: {
      key: 69, steps: 6, sd: .22, scale: MAJOR, A: ['I', 'vi', 'IV', 'V'], B: ['IV', 'I', 'ii', 'V'],
      lead: 'musicbox', lv: .17, density: .55, wet: .4, vol: 1.27,
      back: (o, T, c) => {
        I.pluck(o, T(0), c.bass, .5, .18);
        [2, 4].forEach(s => c.tones.forEach(m => I.pluck(o, T(s), m, .2, .04)));
      },
    },
    mountain: {
      key: 62, steps: 8, sd: .34, scale: MIXO, A: ['I', 'I', 'VII', 'I'], B: ['IV', 'I', 'VII', 'I'],
      lead: 'flute', lv: .17, density: .45, wet: .35, vol: .6,
      back: (o, T, c, bar, next, rng) => {
        if (bar % 2 === 0) [0, c.fifth].forEach(up => I.horn(o, T(0), c.bass + up, (T(8) - T(0)) * 2, .04));
        [0, 3, 4, 6].forEach(s => c.tones.forEach((m, k) => I.pluck(o, T(s) + k * .025, m, .2, .04)));
        if (rng() < .2) P.cowbell(o, T(rng() * 8), .035);
      },
    },
  };

  // A chord in the style's key: bass note, the tones in the octave above the
  // key, and the third and fifth as intervals over the root.
  function chord(st, name) {
    const pcs = CH[name], root = pcs[0];
    return {
      name, pcs,
      bass: st.key - 12 + root - (root >= 7 ? 12 : 0),
      tones: pcs.map(p => st.key + p).sort((a, b) => a - b),
      third: (pcs[1] - root + 12) % 12, fifth: (pcs[2] - root + 12) % 12,
    };
  }

  /* ---------- Writing a tune ---------- */
  // Which eighths of a bar get a note: the downbeat nearly always, the other
  // beats more often than the off-beats.
  function rhythm(rng, st) {
    const w = st.steps === 6 ? [1, .2, .7, .2, .7, .2] : [1, .25, .55, .25, .85, .25, .55, .25];
    const on = w.map((x, s) => s === 0 ? rng() < .9 : rng() < x * st.density * 1.5).flatMap((y, s) => y ? [s] : []);
    return on.length ? on : [0];
  }
  // Pitches for one bar. Beats take a tone of the chord near the last note,
  // the eighths between them a step or two along the scale. A bar that ends
  // a section holds the chord's root.
  function bar(rng, st, c, on, prev, end) {
    const lo = st.key + 5, hi = st.key + 21, mid = (lo + hi) / 2;
    const pool = [], fits = [];
    for (let m = lo; m <= hi; m++) {
      const pc = (m - st.key + 120) % 12;
      if (st.scale.includes(pc)) pool.push(m);
      if (c.pcs.includes(pc)) fits.push(m);
    }
    const near = (list, to) => list.slice().sort((a, b) => Math.abs(a - to) - Math.abs(b - to));
    const beat = st.steps === 6 ? 3 : 4;
    if (end) on = rng() < .5 ? [0] : [0, beat];
    const notes = on.map((s, k) => {
      let m;
      if (end && k === on.length - 1) m = near(fits.filter(x => (x - st.key + 120) % 12 === c.pcs[0]), prev)[0];
      else if (s % beat === 0 || s === 0) m = near(fits, prev)[rng() < .6 ? 0 : rng() < .7 ? 1 : 2];
      else {
        let i = near(pool, prev).map(x => pool.indexOf(x))[0];
        const moves = prev > mid + 4 ? [-2, -1, -1, 1] : prev < mid - 4 ? [-1, 1, 1, 2] : [-2, -1, -1, 1, 1, 2];
        i = Math.max(0, Math.min(pool.length - 1, i + moves[rng() * moves.length | 0]));
        m = pool[i];
      }
      prev = m;
      return { s, len: (on[k + 1] ?? st.steps) - s, m };
    });
    return { notes, last: prev };
  }
  // A song: sections A and B of four bars, as A A B A.
  function compose(st, seed) {
    const rng = mulberry32(seed);
    let prev = st.key + 12;
    const section = names => {
      const r1 = rhythm(rng, st), r2 = rhythm(rng, st);
      return names.map((n, i) => {
        const c = chord(st, n), b = bar(rng, st, c, [r1, r1, r2, r1][i], prev, i === 3);
        prev = b.last;
        return { c, notes: b.notes };
      });
    };
    const A = section(st.A), B = section(st.B).map(b => ({ ...b, b: true }));
    return [...A, ...A, ...B, ...A];
  }

  /* ---------- Playing ---------- */
  let style = 'classic', mode = 'off', timer = 0, song = null, played = 0, nextBar = 0, barNo = 0, rng = Math.random;
  const MUSIC = .55, level = () => MUSIC * STYLES[style].vol;
  // The chords as scheduled, so effects can take the one sounding now.
  let heard = [];

  function playBar(st, t0, b, next, n) {
    const T = s => t0 + s * st.sd + (st.swing && s % 2 ? st.swing * st.sd : 0);
    const lead = I[b.b && st.leadB || st.lead];
    b.notes.forEach(({ s, len, m }) => lead(music.bus, T(s), m, len * st.sd, st.lv * (s === 0 ? 1 : .8)));
    st.back(music.bus, T, b.c, n, next.c, rng);
    heard.push({ t: t0, c: b.c });
    if (heard.length > 4) heard.shift();
  }
  // Writes the bars that start in the next half second.
  function schedule(until) {
    const st = STYLES[style];
    while (nextBar < until) {
      if (!song || barNo === song.length * 2) { song = compose(st, Math.random() * 1e9 | 0); barNo = 0; }
      const k = barNo % song.length;
      playBar(st, nextBar, song[k], song[(k + 1) % song.length], barNo);
      nextBar += st.steps * st.sd;
      barNo++;
    }
  }
  function busFor(st) {
    const bus = ac.createGain(), send = ac.createGain();
    bus.connect(master);
    bus.connect(send).connect(verb);
    send.gain.value = st.wet;
    return { bus, st };
  }
  function startMusic() {
    if (!ac || mode !== 'music' || music) return;
    const st = STYLES[style];
    music = busFor(st);
    const t = ac.currentTime;
    music.bus.gain.setValueAtTime(0, t);
    music.bus.gain.linearRampToValueAtTime(level(), t + 2);
    song = null; nextBar = t + .1; heard = [];
    schedule(t + .5);
    timer = setInterval(() => schedule(ac.currentTime + .5), 100);
  }
  function stopMusic() {
    clearInterval(timer);
    if (!music) return;
    const { bus } = music, t = ac.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + .6);
    setTimeout(() => bus.disconnect(), 3000);
    music = null; heard = [];
  }

  /* ---------- Effects ---------- */
  // The chord sounding now, or the tonic chord when there is no music.
  const now = t => {
    const h = heard.filter(x => x.t <= t).pop();
    return h ? h.c : chord(STYLES[style], STYLES[style].A[0]);
  };
  const pick = list => list[Math.random() * list.length | 0];

  function pair(t) {
    const st = STYLES[style], c = now(t), up = c.tones.map(m => m + 12), a = pick(up), b = up.find(m => m > a) ?? a + 12 - (a - up[0]);
    const o = fx, lead = I[st.lead];
    switch (style) {
      case 'dogs': P.boing(o, t, .22, hz(a)); I.square(o, t + .09, b, .15, .32); break;
      case 'reef': for (let k = 0; k < 3; k++) P.bubble(o, t + k * .06, .35, hz(a) * (1 + k * .25)); break;
      case 'halloween': lead(o, t, a, .2, .22); lead(o, t + .09, b, .2, .22); P.ghost(o, t, .05, hz(b)); break;
      case 'fantasy': [a, b, a + 12, b + 12].forEach((m, k) => I.musicbox(o, t + k * .05, m, .1, .14)); break;
      case 'mountain': P.whoosh(o, t, .12); I.flute(o, t + .12, b, .3, .18); break;
      default: lead(o, t, a, .2, .25); lead(o, t + .08, b, .2, .25);
    }
  }
  function golden(t) {
    const c = now(t), notes = [...c.tones, ...c.tones.map(m => m + 12), c.tones[0] + 24];
    notes.forEach((m, k) => I.bell(fx, t + k * .06, m + 12, .2, .1));
  }
  // The cleared board: the music steps back, a fanfare on the tonic chord
  // (Haunted Night's minor turns major at the end), and the style's own flourish.
  function win(t) {
    const st = STYLES[style], k = st.key + 12, lead = I[st.lead], o = fx;
    if (music) {
      const g = music.bus.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(level() * .25, t + .3);
      g.setValueAtTime(level() * .25, t + 4.5);
      g.linearRampToValueAtTime(level(), t + 6.5);
    }
    const third = st.scale[2] === 3 ? 3 : 4;
    [0, third, 7, 12].forEach((p, i) => lead(o, t + i * .13, k + p, .2, .32));
    [0, 4, 7, 12].forEach(p => lead(o, t + .6, k + p, .6, .2));
    I.pad(o, t + .55, k - 12, 2, .03); I.pad(o, t + .55, k - 5, 2, .03);
    const r = (a, b) => a + Math.random() * (b - a);
    const scale = n => Array.from({ length: n }, (_, i) => k + 12 * Math.floor(i / st.scale.length) + st.scale[i % st.scale.length]);
    switch (style) {
      case 'classic': P.gong(o, t, .1, hz(st.key - 12)); for (let i = 0; i < 12; i++) P.crack(o, t + r(1, 2.6), .25); break;
      case 'dogs': for (let i = 0; i < 4; i++) P.boing(o, t + .8 + i * .18, .14, hz(k + i * 4)); break;
      case 'cats': scale(15).forEach((m, i) => I.pluck(o, t + .9 + i * .035, m, .1, .07)); break;
      case 'chameleons': scale(10).forEach((m, i) => I.marimba(o, t + .9 + i * .05, m, .1, .12)); for (let i = 0; i < 10; i++) P.shaker(o, t + .9 + i * .05, .05); break;
      case 'reef': for (let i = 0; i < 24; i++) P.bubble(o, t + r(.2, 2.6), .08); break;
      case 'halloween': P.ghost(o, t + .2, .1, hz(k)); for (let i = 0; i < 6; i++) P.bubble(o, t + r(1, 2), .04, r(2000, 3000)); break;
      case 'fantasy': scale(15).forEach((m, i) => I.pluck(o, t + .8 + i * .035, m, .1, .08)); for (let i = 0; i < 12; i++) I.musicbox(o, t + r(1, 2.6), pick(scale(15)), .1, .07); break;
      case 'mountain': [0, 7, 12, 7, 12].forEach((p, i) => I.horn(o, t + .9 + i * .3, st.key - 12 + p, i === 4 ? 1.2 : .28, .055)); for (let i = 0; i < 3; i++) P.cowbell(o, t + r(.8, 2.4), .06); break;
    }
  }

  /* ---------- The context ---------- */
  function build(ctx) {
    ac = ctx;
    NOISE = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    NOISE.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = .9; master.connect(comp);
    // A small room: two seconds of decaying noise, a little different per ear.
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) ir.getChannelData(ch).forEach((_, i, d) => { d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; });
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .35;
    verb.connect(wet).connect(master);
    fx = ctx.createGain(); fx.gain.value = .7;
    fx.connect(master);
    const send = ctx.createGain(); send.gain.value = .25;
    fx.connect(send).connect(verb);
  }
  // Made on the first tap or key, the first moment a browser lets a page play sound.
  function unlock() {
    if (mode === 'off') return;
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      build(new C());
    }
    if (ac.state !== 'running') ac.resume().then(startMusic, () => {});
    else startMusic();
  }
  ['pointerdown', 'pointerup', 'touchend', 'keydown'].forEach(e => document.addEventListener(e, unlock, true));
  // Silent while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else if (mode !== 'off') ac.resume();
  });

  const live = fn => () => { if (ac && mode !== 'off' && ac.state === 'running') fn(ac.currentTime + .02); };
  return {
    // 'off', 'effects' or 'music'.
    mode(m) {
      mode = m;
      // Turned on with a tap or a key: start now rather than on the next one.
      if (!ac) { if (navigator.userActivation?.isActive) unlock(); return; }
      if (m !== 'music') stopMusic();
      if (m === 'off') ac.suspend();
      else unlock();
    },
    style(id) {
      if (!STYLES[id] || id === style) return;
      style = id;
      if (music) { stopMusic(); startMusic(); }
    },
    pair: live(pair),
    golden: live(golden),
    win: live(win),
    // For listening without a page: `sec` seconds of a style's music, with
    // pair sounds at the times in `pairs` and the cleared-board sound at
    // `winAt`, as an AudioBuffer.
    render(id, sec, winAt, pairs = []) {
      const keep = [ac, NOISE, master, verb, fx, music, style, song, nextBar, barNo, heard];
      const ctx = new OfflineAudioContext(2, 44100 * sec, 44100);
      build(ctx);
      style = id; music = busFor(STYLES[id]); music.bus.gain.value = level(); song = null; nextBar = .05; heard = [];
      schedule(sec);
      pairs.forEach(t => pair(t));
      if (winAt < sec) win(winAt);
      const out = ctx.startRendering();
      [ac, NOISE, master, verb, fx, music, style, song, nextBar, barNo, heard] = keep;
      return out;
    },
  };
})();
