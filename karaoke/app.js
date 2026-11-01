// Starlight Stage: karaoke game engine.
// Built-in songs (songs.js) are played by a Web Audio synth band; songs the player adds use their own audio file.
// The real mic is read through an AnalyserNode and scored with autocorrelation pitch detection.
"use strict";
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const GENRES = [
    { id: "all", name: "All", icon: "✨" },
    { id: "pop", name: "Pop", icon: "🍭" },
    { id: "rnb", name: "R&B", icon: "💜" },
    { id: "rap", name: "Rap", icon: "🎧" },
    { id: "gospel", name: "Gospel", icon: "🙌" },
    { id: "country", name: "Country", icon: "🤠" },
    { id: "oldies", name: "Oldies", icon: "📻" },
    { id: "mine", name: "My Songs", icon: "💾" }
  ];
  const SING_GENRES = ["pop", "rnb", "rap", "gospel", "country", "oldies"];
  const genreOf = id => GENRES.find(g => g.id === id) || GENRES[0];

  // ---------- save data (per browser) ----------
  const SAVE_KEY = "starlight-stage-v1";
  const save = Object.assign({ sung: 0, best: {}, genres: [], grades: [], mic: "classic", micMode: "virtual", guide: true }, (() => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
  })());
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage blocked: progress lasts this visit only */ } };

  // ---------- mic designs ----------
  const MICS = [
    { id: "classic", name: "Classic Chrome", need: { type: "start" }, head: ["#f4f6ff", "#8d96bd"], body: "#3a3f5c", band: "#c9cfee" },
    { id: "bubblegum", name: "Bubblegum", need: { type: "count", n: 1 }, head: ["#ffe0f7", "#ff4fd8"], body: "#ff8ae6", band: "#ffffff" },
    { id: "lime", name: "Lime Fizz", need: { type: "count", n: 2 }, head: ["#f1ffd6", "#7fd11a"], body: "#2e5a00", band: "#d6ff7a", extra: "bubbles" },
    { id: "neon", name: "Neon Glow", need: { type: "count", n: 3 }, head: ["#d6faff", "#33e1ff"], body: "#0f2b4d", band: "#33e1ff", glow: "#33e1ff" },
    { id: "kitty", name: "Kitty Mic", need: { type: "count", n: 5 }, head: ["#ffffff", "#ffb3d9"], body: "#ff7ac8", band: "#ffffff", extra: "ears" },
    { id: "retro", name: "Jukebox '58", need: { type: "genre", g: "oldies" }, head: ["#fff6d6", "#cfa95a"], body: "#c0392b", band: "#f5e6c4", extra: "grille" },
    { id: "halo", name: "Halo Gold", need: { type: "genre", g: "gospel" }, head: ["#fff7c2", "#ffc400"], body: "#fffaf0", band: "#ffd23f", extra: "halo", glow: "#ffe27a" },
    { id: "rodeo", name: "Rodeo Star", need: { type: "genre", g: "country" }, head: ["#ffe7c4", "#c47a32"], body: "#6b3b16", band: "#ffd23f", extra: "star" },
    { id: "bassboom", name: "Bass Boom", need: { type: "genre", g: "rap" }, head: ["#f0f0f0", "#2a2a2a"], body: "#111111", band: "#ffd23f", extra: "chain" },
    { id: "velvet", name: "Velvet Vibes", need: { type: "genre", g: "rnb" }, head: ["#e9d6ff", "#7a2ccf"], body: "#3b0a5c", band: "#ff9de6", glow: "#b46bff" },
    { id: "flame", name: "Hot Flame", need: { type: "grade", g: "A" }, head: ["#fff2a8", "#ff5a1f"], body: "#2b0a00", band: "#ff8a3d", extra: "flame" },
    { id: "rainbow", name: "Rainbow Burst", need: { type: "allGenres" }, rainbow: true, body: "#ffffff", band: "#ffffff" },
    { id: "galaxy", name: "Galaxy", need: { type: "count", n: 10 }, head: ["#c9a8ff", "#24074f"], body: "#120626", band: "#b9a5ff", extra: "stars" },
    { id: "diamond", name: "Diamond", need: { type: "grade", g: "S" }, head: ["#ffffff", "#9ef0ff"], body: "#dff8ff", band: "#ffffff", extra: "sparkle", glow: "#c6f8ff" }
  ];
  const GRADE_RANK = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  function unlocked(m) {
    const n = m.need;
    if (n.type === "start") return true;
    if (n.type === "count") return save.sung >= n.n;
    if (n.type === "genre") return save.genres.includes(n.g);
    if (n.type === "grade") return save.grades.some(g => GRADE_RANK[g] >= GRADE_RANK[n.g]);
    if (n.type === "allGenres") return SING_GENRES.every(g => save.genres.includes(g));
    return false;
  }
  function needText(m) {
    const n = m.need;
    if (n.type === "start") return "Starter mic";
    if (n.type === "count") return `Sing ${n.n} song${n.n > 1 ? "s" : ""} (${Math.min(save.sung, n.n)}/${n.n})`;
    if (n.type === "genre") return `Sing a ${genreOf(n.g).name} song`;
    if (n.type === "grade") return `Get an ${n.g} grade${n.g === "A" ? " or better" : ""}`;
    return `Sing every genre (${SING_GENRES.filter(g => save.genres.includes(g)).length}/6)`;
  }
  let svgId = 0;
  function micSVG(m) {
    const id = "mg" + (++svgId), clip = "mc" + svgId;
    const grad = m.rainbow
      ? `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4f6d"/><stop offset=".25" stop-color="#ffd23f"/><stop offset=".5" stop-color="#5dff7a"/><stop offset=".75" stop-color="#33e1ff"/><stop offset="1" stop-color="#b14fff"/></linearGradient>`
      : `<radialGradient id="${id}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${m.head[0]}"/><stop offset="1" stop-color="${m.head[1]}"/></radialGradient>`;
    const accent = m.rainbow ? "#ffffff" : m.head[1];
    const extras = {
      ears: `<path d="M9 20 L12 -2 L25 9 Z M51 20 L48 -2 L35 9 Z" fill="${accent}"/><path d="M13 13 L14 4 L20 9 Z M47 13 L46 4 L40 9 Z" fill="#ff7ac8"/>`,
      halo: `<ellipse cx="30" cy="-6" rx="17" ry="5" fill="none" stroke="#ffd23f" stroke-width="3.5"/>`,
      star: `<path d="M30 52 l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="#fff6c2"/>`,
      chain: `<path d="M14 66 Q30 84 46 66" fill="none" stroke="#ffd23f" stroke-width="3" stroke-dasharray="4 3"/><circle cx="30" cy="80" r="5" fill="#ffd23f"/>`,
      flame: `<path d="M30 -14 C40 -4 44 4 38 10 C40 2 34 0 32 -4 C30 4 22 2 24 10 C16 4 20 -6 30 -14Z" fill="#ffb21f"/><path d="M30 -6 C35 0 35 6 30 8 C25 6 26 0 30 -6Z" fill="#fff2a8"/>`,
      stars: `<g fill="#fff"><circle cx="20" cy="22" r="1.6"/><circle cx="38" cy="16" r="1.2"/><circle cx="33" cy="38" r="1.8"/><circle cx="16" cy="38" r="1"/><circle cx="44" cy="30" r="1.4"/></g>`,
      sparkle: `<g fill="#fff"><path d="M50 2 l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M8 40 l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/></g>`,
      bubbles: `<g fill="none" stroke="#ffffff" stroke-width="1.5" opacity=".8"><circle cx="20" cy="20" r="3"/><circle cx="38" cy="34" r="2"/><circle cx="30" cy="14" r="1.5"/></g>`,
      grille: `<g stroke="rgba(0,0,0,.35)" stroke-width="2"><path d="M8 22 H52 M6 30 H54 M8 38 H52"/></g>`
    };
    const style = m.glow ? ` style="filter: drop-shadow(0 0 8px ${m.glow})"` : "";
    return `<svg viewBox="0 -16 60 156" aria-hidden="true"${style}><defs>${grad}<clipPath id="${clip}"><circle cx="30" cy="30" r="24"/></clipPath></defs>
      ${m.extra === "ears" ? extras.ears : ""}${m.extra === "halo" ? extras.halo : ""}${m.extra === "flame" ? extras.flame : ""}
      <path d="M19 62 H41 L36 130 Q30 137 24 130 Z" fill="${m.body}"/>
      <rect x="23" y="66" width="4" height="58" rx="2" fill="rgba(255,255,255,.28)"/>
      <circle cx="30" cy="30" r="24" fill="url(#${id})"/>
      <g clip-path="url(#${clip})" stroke="rgba(0,0,0,.16)" stroke-width="1.4"><path d="M6 18 H54 M6 26 H54 M6 34 H54 M6 42 H54 M18 6 V54 M26 6 V54 M34 6 V54 M42 6 V54"/></g>
      <ellipse cx="22" cy="20" rx="7" ry="4" fill="rgba(255,255,255,.55)" transform="rotate(-30 22 20)"/>
      ${m.extra === "grille" ? extras.grille : ""}${m.extra === "stars" ? extras.stars : ""}${m.extra === "bubbles" ? extras.bubbles : ""}
      <rect x="15" y="51" width="30" height="12" rx="4" fill="${m.band}"/>
      ${m.extra === "star" ? extras.star : ""}${m.extra === "chain" ? extras.chain : ""}${m.extra === "sparkle" ? extras.sparkle : ""}
    </svg>`;
  }
  const currentMic = () => MICS.find(m => m.id === save.mic && unlocked(m)) || MICS[0];

  // ---------- blocky avatars ----------
  const SKINS = ["#ffd29a", "#f2b880", "#c98b5a", "#8d5a3b", "#ffe0bd", "#6b3f26"];
  const SHIRTS = ["#ff4fd8", "#33e1ff", "#b6ff3b", "#ffd23f", "#ff8a3d", "#8a5cff", "#ff4f6d", "#4fffb0"];
  const HAIRS = ["#3a1c0c", "#111111", "#ffd23f", "#ff4fd8", "#7a3b12", "#33e1ff", "#ffffff"];
  const avatarHTML = (style = "") => `<div class="avatar" style="${style}"><div class="hd"><div class="mouth"></div></div><div class="ar l"></div><div class="ar r"></div><div class="tr"></div><div class="lg l"></div><div class="lg r"></div></div>`;
  function fillCrowd(el, n) {
    el.innerHTML = Array.from({ length: n }, (_, i) => avatarHTML(`--skin:${pick(SKINS)};--shirt:${SHIRTS[i % SHIRTS.length]};--hair:${pick(HAIRS)};--pants:${pick(["#2b2d6e", "#1b1b2f", "#3b0a5c", "#0f3d4d"])};--d:${(-Math.random()).toFixed(2)}s`)).join("");
  }
  function drawPerformer(el) {
    el.innerHTML = avatarHTML();
    el.firstElementChild.insertAdjacentHTML("beforeend", `<div class="held-mic">${micSVG(currentMic())}</div>`);
  }
  const setMood = (el, mood) => { el.classList.remove("cheer", "cringe", "wow"); if (mood) el.classList.add(mood); };

  // ---------- audio ----------
  let ctx, master, sfx, songBus, noiseBuf;
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = .9;
      master.connect(comp).connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = .8; sfx.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended" && !(run && run.paused)) ctx.resume();
    return ctx;
  }
  function freshSongBus() {
    if (songBus) {
      const old = songBus;
      old.gain.setTargetAtTime(0, ctx.currentTime, .04);
      setTimeout(() => old.disconnect(), 400);
    }
    songBus = ctx.createGain();
    songBus.connect(master);
    return songBus;
  }

  // One general voice: oscillators (or organ partials) -> low-pass -> envelope.
  function tone(f, t, d, o = {}) {
    const { type = "triangle", level = .12, a = .01, r = .12, cut = 4000, det = [0], vib = 0, partials = null, decay = 0, fenv = 0, dest = songBus, glide = 0 } = o;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + a);
    if (decay) g.gain.setTargetAtTime(level * .0001 + 0.0001, t + a, decay);
    g.gain.setValueAtTime(decay ? 0.0001 : level, t + d);
    if (!decay) g.gain.setTargetAtTime(0, t + d, r / 3);
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(fenv ? cut * fenv : cut, t);
    if (fenv) flt.frequency.setTargetAtTime(cut, t, .06);
    flt.connect(g).connect(dest);
    const end = t + d + r + .05;
    const oscs = (partials || det.map(c => [1, 1 / det.length, c])).map(([mult, lv, cents = 0]) => {
      const osc = ctx.createOscillator();
      osc.type = partials ? "sine" : type;
      osc.frequency.setValueAtTime((glide || f) * mult, t);
      if (glide) osc.frequency.exponentialRampToValueAtTime(f * mult, t + .08);
      osc.detune.value = cents;
      const og = ctx.createGain(); og.gain.value = lv;
      osc.connect(og).connect(flt);
      osc.start(t); osc.stop(end);
      return osc;
    });
    if (vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = f * vib;
      lfo.connect(lg);
      oscs.forEach(osc => lg.connect(osc.frequency));
      lfo.start(t); lfo.stop(end);
    }
  }
  function noise(t, dur, { type = "highpass", freq = 8000, q = .7, level = .1, decay = .05, dest = songBus } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.setTargetAtTime(0, t + .002, decay);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * .5); src.stop(t + dur);
  }
  function drum(kind, t, lv = 1, dest = songBus) {
    switch (kind) {
      case "kick": {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .13);
        g.gain.setValueAtTime(.95 * lv, t); g.gain.setTargetAtTime(0, t + .02, .09);
        o.connect(g).connect(dest); o.start(t); o.stop(t + .5);
        break;
      }
      case "snare":
        noise(t, .25, { type: "bandpass", freq: 1900, q: .6, level: .45 * lv, decay: .06, dest });
        tone(190, t, .05, { type: "triangle", level: .22 * lv, decay: .04, r: .05, dest });
        break;
      case "brush": noise(t, .2, { type: "bandpass", freq: 3200, q: .5, level: .2 * lv, decay: .07, dest }); break;
      case "clap":
        [0, .011, .022].forEach((o, i) => noise(t + o, i === 2 ? .3 : .02, { type: "bandpass", freq: 1500, q: .9, level: .45 * lv, decay: i === 2 ? .08 : .008, dest }));
        break;
      case "hat": noise(t, .06, { freq: 8000, level: .12 * lv, decay: .018, dest }); break;
      case "ohat": noise(t, .35, { freq: 7000, level: .09 * lv, decay: .09, dest }); break;
      case "tamb": noise(t, .12, { type: "bandpass", freq: 9000, q: 1.5, level: .16 * lv, decay: .035, dest }); break;
      case "shaker": noise(t, .08, { type: "bandpass", freq: 6000, q: 1, level: .08 * lv, decay: .025, dest }); break;
      case "rim": tone(1700, t, .02, { type: "square", level: .06 * lv, decay: .012, r: .02, cut: 5000, dest }); break;
    }
  }

  // ---------- music theory ----------
  const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const QUAL = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], dim: [0, 3, 6] };
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const midiHz = m => 440 * 2 ** ((m - 69) / 12);
  const noteMidi = n => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return m ? PC[m[1]] + 12 * (+m[2] + 1) : null; };
  const midiName = m => NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
  function chordOf(name) {
    const m = /^([A-G][#b]?)(maj7|m7|m|7|sus4|dim)?$/.exec(name || "C") || [, "C", ""];
    const q = m[2] || "";
    const root = PC[m[1]], iv = QUAL[q];
    const voice = iv.map(i => { let v = 48 + root + i; while (v > 66) v -= 12; while (v < 52) v += 12; return v; }).sort((a, b) => a - b);
    const color = iv.length > 3 ? voice : voice.concat(((48 + root + (q === "m" ? 10 : 11)) - 52) % 12 + 52);
    return { root, iv, minor: q === "m" || q === "m7", bass: 36 + root, voice, color };
  }

  // ---------- genre bands: each plays one bar starting at t ----------
  const BANDS = {
    pop(c, t, beat, bar, nx) {
      const s = beat / 4;
      for (let i = 0; i < 16; i++) {
        const at = t + i * s;
        if (i % 4 === 0) drum("kick", at);
        if (i === 4 || i === 12) { drum("clap", at, .9); drum("snare", at, .5); }
        if (i % 2 === 0) drum("hat", at, i % 4 === 2 ? 1 : .6);
        if (i % 4 === 2) drum("ohat", at, .5);
        if (i % 2 === 0) tone(midiHz(c.bass + (i % 8 === 6 ? 12 : 0)), at, s * 1.6, { type: "sawtooth", level: .14, cut: 650, decay: .14, r: .05 });
        if (i % 2 === 1 || i === 0) tone(midiHz(c.voice[(i >> 1) % c.voice.length] + 12), at, s, { type: "square", level: .035, cut: 2600, decay: .08, fenv: 2.5 });
      }
      c.voice.forEach(n => tone(midiHz(n), t, beat * 3.9, { type: "sawtooth", det: [-9, 9], level: .045, a: .12, r: .3, cut: 1500 }));
    },
    rnb(c, t, beat) {
      const s = beat / 4, sw = i => (i % 2 ? s * .22 : 0);
      for (let i = 0; i < 16; i++) {
        const at = t + i * s + sw(i);
        if (i === 0 || i === 7 || i === 10) drum("kick", at, .85);
        if (i === 4 || i === 12) { drum("snare", at, .55); drum("rim", at, .8); }
        drum("hat", at, i % 2 ? .35 : .7);
      }
      tone(midiHz(c.bass), t, beat * 1.4, { type: "sine", level: .3, a: .02, r: .1, cut: 900 });
      tone(midiHz(c.bass), t + 10 * s + sw(10), beat * .9, { type: "sine", level: .26, r: .1, cut: 900, glide: midiHz(c.bass - 2) });
      [0, 6, 11].forEach((i, k) => c.color.forEach(n => tone(midiHz(n), t + i * s + sw(i), beat * (k ? .8 : 1.4), { type: "sine", partials: [[1, .7], [2, .18], [3, .06]], level: .055, decay: .35, r: .2, vib: .003 })));
    },
    rap(c, t, beat, bar) {
      const s = beat / 4, sw = i => (i % 2 ? s * .16 : 0);
      for (let i = 0; i < 16; i++) {
        const at = t + i * s + sw(i);
        if (i === 0 || i === 7 || i === 10 || (bar % 2 && i === 14)) drum("kick", at, 1);
        if (i === 4 || i === 12) { drum("snare", at, .9); drum("clap", at, .45); }
        if (i % 2 === 0) drum("hat", at, .75);
        else if (bar % 4 === 3 && i > 11) drum("hat", at, .45);
      }
      const b808 = (at, d) => { tone(midiHz(c.bass - 12), at, d, { type: "sine", level: .5, a: .005, r: .15, cut: 400, glide: midiHz(c.bass) }); tone(midiHz(c.bass), at, d, { type: "triangle", level: .08, a: .005, decay: .2, cut: 800 }); };
      b808(t, beat * 1.6);
      b808(t + 10 * s + sw(10), beat * 1.2);
      [0, 3, 6].forEach(i => c.voice.forEach(n => tone(midiHz(n + 12), t + i * s, s * 1.4, { type: "triangle", level: .04, decay: .12, cut: 2200 })));
    },
    gospel(c, t, beat, bar, nx) {
      const s = beat / 4, sh = i => (i % 4 === 2 ? s * .66 : 0);
      for (let i = 0; i < 16; i += 2) {
        const at = t + i * s + sh(i);
        if (i === 0 || i === 8) drum("kick", at, .9);
        if (i === 4 || i === 12) { drum("clap", at, .9); drum("snare", at, .4); }
        drum("tamb", at, i % 4 ? 1 : .55);
      }
      c.voice.forEach(n => tone(midiHz(n), t, beat * 3.95, { partials: [[1, .5], [2, .3], [3, .12], [4, .08]], level: .05, a: .04, r: .2, vib: .004, cut: 3500 }));
      [[0, 0, 1.4], [6, 7, .6], [8, 0, 1.2], [14, -1, .6]].forEach(([i, off, d]) => {
        const n = i === 14 ? 36 + nx.root - 1 : c.bass + off;
        tone(midiHz(n), t + i * s + sh(i), beat * d, { type: "triangle", level: .28, r: .08, cut: 1000 });
      });
      [6, 14].forEach(i => c.voice.forEach(n => tone(midiHz(n + 12), t + i * s + sh(i), s * 1.5, { type: "sine", partials: [[1, .7], [2, .2]], level: .045, decay: .15 })));
    },
    country(c, t, beat, bar) {
      const s = beat / 4;
      [0, 8].forEach((i, k) => { drum("kick", t + i * s, .7); tone(midiHz(c.bass + (k ? 7 : 0) - (k && c.bass + 7 > 47 ? 12 : 0)), t + i * s, beat * .9, { type: "triangle", level: .3, r: .06, cut: 1200 }); });
      [4, 12].forEach(i => {
        drum("brush", t + i * s, 1);
        c.voice.concat(c.voice[0] + 12).forEach((n, k) => tone(midiHz(n), t + i * s + k * .012, beat * .8, { type: "sawtooth", level: .035, decay: .18, cut: 2400, fenv: 2 }));
      });
      for (let i = 2; i < 16; i += 4) c.voice.forEach((n, k) => tone(midiHz(n), t + i * s + k * .01, beat * .4, { type: "sawtooth", level: .02, decay: .1, cut: 2000 }));
      for (let i = 0; i < 16; i += 2) drum("shaker", t + i * s, i % 4 ? 1 : .6);
    },
    oldies(c, t, beat) {
      const tr = beat / 3;
      for (let i = 0; i < 12; i++) {
        const at = t + i * tr;
        c.voice.forEach(n => tone(midiHz(n + 12), at, tr * .8, { type: "triangle", partials: [[1, .7], [2, .2], [4, .05]], level: i % 3 ? .02 : .035, decay: .09 }));
        drum("hat", at, i % 3 === 2 ? .5 : .25);
      }
      [0, 2].forEach(b => drum("kick", t + b * beat, .7));
      [1, 3].forEach(b => { drum("snare", t + b * beat, .6); drum("rim", t + b * beat, .8); });
      const walk = c.minor ? [0, 3, 7, 12] : [0, 4, 7, 9];
      walk.forEach((iv, b) => tone(midiHz(c.bass + iv), t + b * beat, beat * .9, { type: "triangle", level: .28, r: .06, cut: 900 }));
      c.voice.forEach(n => tone(midiHz(n + 12), t, beat * 3.9, { type: "sine", det: [-6, 6], level: .02, a: .25, r: .3, vib: .006 }));
    }
  };

  // ---------- song models ----------
  // Marks where each sung phrase starts (after a gap of .75 beats or more). The virtual mic only gives full
  // credit when the button was pressed again after that point, so holding it through a whole song doesn't win.
  function markPhrases(notes) {
    let prevEnd = -Infinity, phrase = 0;
    for (const n of notes) {
      if (n.start - prevEnd >= .75) phrase = Math.max(0, n.start - 1);
      n.phrase = phrase;
      prevEnd = n.start + n.dur;
    }
    return notes;
  }
  function buildSong(s) {
    const notes = [], lines = [];
    let b = (s.intro || 2) * 4;
    s.lines.forEach((ln, li) => {
      const toks = ln.words.trim().split(/\s+/);
      const syls = [];
      let ti = 0, first = null, last = b;
      const lineStart = b;
      for (const tok of ln.notes.trim().split(/\s+/)) {
        const [n, d = "1"] = tok.split(":");
        const dur = parseFloat(d);
        if (n !== "-") {
          const w = toks[ti++] ?? "";
          if (w === "~" && syls.length) syls[syls.length - 1].end = b + dur;
          else syls.push({ text: w.replace(/-$/, ""), join: w.endsWith("-"), start: b, end: b + dur });
          notes.push({ start: b, dur, midi: n === "x" ? null : noteMidi(n), line: li });
          if (first === null) first = b;
          last = b + dur;
        }
        b += dur;
      }
      lines.push({ start: lineStart, end: b, sing: first ?? lineStart, singEnd: last, syls });
    });
    const totalBars = Math.ceil((b + 8) / 4);
    markPhrases(notes);
    return { ...s, custom: false, notes, lines, beat: 60 / s.bpm, total: totalBars * 4, totalBars };
  }
  // Custom songs run in seconds (beat = 1 s). Lines come from LRC timestamps or are spread evenly.
  function buildCustom(s, duration) {
    const raw = s.lyrics.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const timed = [];
    for (const l of raw) {
      const m = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(l);
      if (m && m[3]) timed.push({ time: +m[1] * 60 + +m[2], text: m[3] });
    }
    let entries;
    if (timed.length >= 2) entries = timed.sort((a, b) => a.time - b.time);
    else {
      const texts = raw.map(l => l.replace(/^\[[^\]]*\]\s*/, "")).filter(Boolean);
      const startAt = Math.min(8, duration * .1), span = Math.max(4, duration - startAt - 4);
      entries = texts.map((text, i) => ({ time: startAt + span * i / texts.length, text }));
    }
    const notes = [], lines = [];
    entries.forEach((e, i) => {
      const next = entries[i + 1] ? entries[i + 1].time : Math.min(duration, e.time + 5);
      const len = Math.max(.8, (next - e.time) * .88);
      const words = e.text.split(/\s+/);
      const each = len / words.length;
      const syls = words.map((w, k) => ({ text: w, join: false, start: e.time + k * each, end: e.time + (k + 1) * each }));
      syls.forEach(sy => notes.push({ start: sy.start, dur: sy.end - sy.start, midi: null, line: i }));
      lines.push({ start: e.time, end: next, sing: e.time, singEnd: e.time + len, syls });
    });
    markPhrases(notes);
    return { ...s, custom: true, notes, lines, beat: 1, total: duration, difficulty: 1 };
  }
  const songSeconds = s => s.custom ? (s.durationSec || 0) : (() => {
    let beats = (s.intro || 2) * 4 + 8;
    s.lines.forEach(l => l.notes.trim().split(/\s+/).forEach(tok => { beats += parseFloat(tok.split(":")[1] || "1"); }));
    return Math.ceil(beats / 4) * 4 * 60 / s.bpm;
  })();
  const fmtTime = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

  // ---------- custom songs in IndexedDB ----------
  const idb = (() => {
    let dbp;
    const open = () => dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open("starlight-stage", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("songs", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction("songs", mode);
        const req = fn(t.objectStore("songs"));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    };
    return { all: () => tx("readonly", s => s.getAll()), put: v => tx("readwrite", s => s.put(v)), del: id => tx("readwrite", s => s.delete(id)) };
  })();
  let customSongs = [];
  async function loadCustom() {
    try { customSongs = (await idb.all()).map(s => ({ ...s, custom: true })); } catch { customSongs = []; }
  }
  const allSongs = () => [...(window.SONGS || []), ...customSongs];

  // ---------- screens ----------
  let screen = "lobby";
  function go(id) {
    if (id === screen) return;
    if (screen === "stage" && run) endRun(false);
    $$(".screen").forEach(s => s.classList.toggle("is-active", s.id === id));
    screen = id;
    if (id === "library") { renderLibrary(); setTimeout(() => $("#search").focus({ preventScroll: true }), 400); }
    if (id === "locker") renderLocker();
    if (id === "lobby") renderLobby();
    sfxWhoosh();
  }
  document.addEventListener("click", e => {
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) { $$("dialog[open]").forEach(d => d.close()); go(goBtn.dataset.go); }
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) { const d = $("#" + openBtn.dataset.open); if (!d.open) d.showModal(); if (d.id === "micDialog") renderMicDialog(); }
    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) closeBtn.closest("dialog").close();
  });
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  // ---------- lobby ----------
  function renderLobby() {
    $("#statSung").textContent = save.sung;
    $("#statSungWord").textContent = save.sung === 1 ? "song sung" : "songs sung";
    $("#statMics").textContent = `${MICS.filter(unlocked).length}/${MICS.length}`;
    $("#statMicMode").textContent = save.micMode === "real" ? "🎙️ Real mic" : "🕹️ Virtual mic";
    drawPerformer($("#lobbyStar"));
  }
  $("#playBtn").addEventListener("click", () => { audio(); sfxPop(); go("library"); });

  // ---------- library ----------
  let genre = "all", query = "";
  function renderGenres() {
    $("#genres").innerHTML = GENRES.map(g => `<button type="button" class="genre-btn" data-genre="${g.id}" aria-pressed="${g.id === genre}">${g.icon} ${g.name}</button>`).join("");
  }
  $("#genres").addEventListener("click", e => {
    const b = e.target.closest("[data-genre]");
    if (!b) return;
    genre = b.dataset.genre;
    renderGenres(); renderLibrary(); sfxTick();
  });
  $("#search").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); renderLibrary(); });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const coverStyle = s => {
    const [c1, c2] = s.colors || ["#8a5cff", "#ff4fd8"];
    return `--c1:${c1};--c2:${c2}`;
  };
  function renderLibrary() {
    const list = allSongs().filter(s =>
      (genre === "all" || (genre === "mine" ? s.custom : s.genre === genre)) &&
      (!query || `${s.title} ${s.artist} ${genreOf(s.genre).name}`.toLowerCase().includes(query)));
    $("#emptyMsg").hidden = list.length > 0;
    $("#songGrid").innerHTML = list.map((s, i) => {
      const best = save.best[s.id];
      return `<button type="button" class="song-card" data-song="${esc(s.id)}" style="${coverStyle(s)};--i:${Math.min(i, 12) * 40}ms">
        <div class="cover"><span class="gicon">${s.custom ? "💾" : genreOf(s.genre).icon}</span>${best ? `<span class="best">${best.grade} · ${best.score.toLocaleString()}</span>` : ""}</div>
        <span class="genre-tag">${genreOf(s.genre).name}${s.custom ? " · Mine" : ""}</span>
        <p class="song-title">${esc(s.title)}</p>
        <p class="song-artist">${esc(s.artist)}</p>
        <div class="song-meta"><span class="diff" aria-label="Difficulty ${s.difficulty || 1} of 3">${"★".repeat(s.difficulty || 1)}${"☆".repeat(3 - (s.difficulty || 1))}</span><span>${fmtTime(songSeconds(s))}</span></div>
      </button>`;
    }).join("");
  }
  $("#songGrid").addEventListener("click", e => {
    const c = e.target.closest("[data-song]");
    if (c) openSong(c.dataset.song);
  });

  // ---------- song dialog ----------
  let chosen = null, deleteArmed = false;
  function openSong(id) {
    chosen = allSongs().find(s => s.id === id);
    if (!chosen) return;
    sfxPop();
    const g = genreOf(chosen.genre);
    $("#sdCover").className = "sd-cover cover";
    $("#sdCover").style.cssText = coverStyle(chosen);
    $("#sdCover").innerHTML = `<span class="gicon">${chosen.custom ? "💾" : g.icon}</span>`;
    $("#sdGenre").textContent = g.name + (chosen.custom ? " · My song" : "");
    $("#sdTitle").textContent = chosen.title;
    $("#sdArtist").textContent = chosen.artist;
    const best = save.best[chosen.id];
    $("#sdMeta").textContent = [chosen.custom ? null : `${chosen.bpm} BPM`, fmtTime(songSeconds(chosen)), `Difficulty ${"★".repeat(chosen.difficulty || 1)}`, best ? `Best: ${best.grade} (${best.score.toLocaleString()})` : null].filter(Boolean).join(" · ");
    $("#guideToggle").checked = save.guide;
    $("#guideToggle").closest("label").hidden = !!chosen.custom;
    $("#sdMic").textContent = save.micMode === "real" ? "Real mic 🎙️" : "Virtual mic 🕹️";
    $("#deleteSongBtn").hidden = !chosen.custom;
    $("#deleteSongBtn").textContent = "Delete this song";
    deleteArmed = false;
    $("#songDialog").showModal();
  }
  $("#guideToggle").addEventListener("change", e => { save.guide = e.target.checked; persist(); });
  $("#singBtn").addEventListener("click", () => { $("#songDialog").close(); startSong(chosen); });
  $("#deleteSongBtn").addEventListener("click", async () => {
    if (!deleteArmed) { deleteArmed = true; $("#deleteSongBtn").textContent = "Tap again to delete for good"; return; }
    await idb.del(chosen.id).catch(() => {});
    delete save.best[chosen.id]; persist();
    await loadCustom();
    $("#songDialog").close();
    renderLibrary();
  });

  // ---------- add your own ----------
  const addGenre = $("#addGenre");
  addGenre.innerHTML = SING_GENRES.map(g => `<option value="${g}">${genreOf(g).icon} ${genreOf(g).name}</option>`).join("");
  $("#addForm").addEventListener("submit", async e => {
    e.preventDefault();
    const file = $("#addFile").files[0];
    const err = $("#addError");
    err.textContent = "";
    if (!file) { err.textContent = "Choose a music file to sing along to."; return; }
    const durationSec = await new Promise(res => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => { res(a.duration); URL.revokeObjectURL(a.src); };
      a.onerror = () => res(0);
      a.src = URL.createObjectURL(file);
    });
    if (!durationSec || !isFinite(durationSec)) { err.textContent = "That file can't be played in this browser. Try an MP3 or M4A file."; return; }
    const song = {
      id: "mine-" + Date.now().toString(36), custom: true, genre: addGenre.value,
      title: $("#addTitle").value.trim(), artist: $("#addArtist").value.trim(),
      lyrics: $("#addLyrics").value, durationSec, blob: file, difficulty: 1,
      colors: [pick(SHIRTS), pick(SHIRTS)]
    };
    try { await idb.put(song); } catch { err.textContent = "This browser wouldn't save the song. Check that site storage is allowed."; return; }
    await loadCustom();
    $("#addForm").reset();
    $("#addDialog").close();
    genre = "mine"; renderGenres(); renderLibrary();
    sfxPop();
  });

  // ---------- microphone ----------
  const mic = { stream: null, src: null, analyser: null, buf: null, monitor: null, rms: 0, hz: 0, midi: null, floor: .012 };
  async function enableMic() {
    const status = $("#micStatus");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status.textContent = "Your browser blocks the mic on this page. Start the game with the local server link (see the README), then try again.";
      return false;
    }
    try {
      audio();
      if (!mic.stream) {
        mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
        mic.src = ctx.createMediaStreamSource(mic.stream);
        mic.analyser = ctx.createAnalyser();
        mic.analyser.fftSize = 2048;
        mic.buf = new Float32Array(1024);
        mic.src.connect(mic.analyser);
      }
      status.textContent = "Mic is on. Sing a note and watch the meter.";
      return true;
    } catch (e) {
      status.textContent = e.name === "NotAllowedError" ? "Mic permission was blocked. Allow the mic in your browser's address bar, then try again." : "No microphone was found. Plug one in, or use the virtual mic.";
      return false;
    }
  }
  function setMonitor(on) {
    if (!mic.src) return;
    if (on && !mic.monitor) {
      const delay = ctx.createDelay(1), fb = ctx.createGain(), out = ctx.createGain();
      delay.delayTime.value = .11; fb.gain.value = .32; out.gain.value = .8;
      mic.src.connect(out); mic.src.connect(delay); delay.connect(fb).connect(delay); delay.connect(out);
      out.connect(master);
      mic.monitor = { out, delay, fb };
    } else if (!on && mic.monitor) {
      mic.monitor.out.disconnect(); mic.monitor.delay.disconnect(); mic.monitor = null;
    }
  }
  // Autocorrelation pitch detection on 1024 samples. Returns Hz, or 0 when nothing clear is heard.
  function readMic() {
    if (!mic.analyser) { mic.rms = 0; mic.hz = 0; return; }
    const buf = mic.buf;
    mic.analyser.getFloatTimeDomainData(buf);
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    mic.rms = rms;
    if (rms < Math.max(.01, mic.floor * 1.6)) { mic.hz = 0; mic.midi = null; return; }
    const n = buf.length, c = new Float32Array(n);
    for (let lag = 0; lag < n; lag++) {
      let s = 0;
      for (let i = 0; i < n - lag; i++) s += buf[i] * buf[i + lag];
      c[lag] = s;
    }
    let d = 0;
    while (d < n - 1 && c[d] > c[d + 1]) d++;
    let best = -1, pos = -1;
    for (let i = d; i < n; i++) if (c[i] > best) { best = c[i]; pos = i; }
    if (pos < 1 || best < c[0] * .3) { mic.hz = 0; mic.midi = null; return; }
    const x1 = c[pos - 1], x2 = c[pos], x3 = c[pos + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
    const hz = ctx.sampleRate / (a ? pos - b / (2 * a) : pos);
    mic.hz = hz > 70 && hz < 1100 ? hz : 0;
    mic.midi = mic.hz ? 69 + 12 * Math.log2(mic.hz / 440) : null;
  }

  let testLoop = 0;
  function renderMicDialog(message) {
    const real = save.micMode === "real";
    $("#useRealMic").setAttribute("aria-pressed", real);
    $("#useVirtualMic").setAttribute("aria-pressed", !real);
    $("#micTest").hidden = !(real && mic.stream);
    $("#micStatus").textContent = message || (real && !mic.stream ? "Tap Real mic to allow your microphone." : (real ? "Mic is on. Sing a note and watch the meter." : "Virtual mic is on. Hold the button or Space to sing."));
    cancelAnimationFrame(testLoop);
    if (real && mic.stream) {
      const tick = () => {
        if (!$("#micDialog").open) return;
        readMic();
        $("#testMeter").style.width = clamp(mic.rms * 600, 0, 100) + "%";
        $("#testNote").textContent = mic.midi ? midiName(mic.midi) : "—";
        testLoop = requestAnimationFrame(tick);
      };
      tick();
    }
  }
  $("#useRealMic").addEventListener("click", async () => {
    $("#micStatus").textContent = "Asking for your microphone…";
    const ok = await enableMic();
    if (ok) { save.micMode = "real"; persist(); }
    renderMicDialog(ok ? "" : $("#micStatus").textContent); renderLobby();
    if (chosen) $("#sdMic").textContent = save.micMode === "real" ? "Real mic 🎙️" : "Virtual mic 🕹️";
  });
  $("#useVirtualMic").addEventListener("click", () => {
    save.micMode = "virtual"; persist(); setMonitor(false); $("#monitorToggle").checked = false;
    renderMicDialog(); renderLobby();
    if (chosen) $("#sdMic").textContent = "Virtual mic 🕹️";
  });
  $("#monitorToggle").addEventListener("change", e => setMonitor(e.target.checked));

  // ---------- sound effects ----------
  function sfxTick() { if (!ctx) return; tone(1200, ctx.currentTime, .03, { type: "sine", level: .05, decay: .02, dest: sfx }); }
  function sfxPop() { audio(); const t = ctx.currentTime; tone(520, t, .1, { type: "sine", level: .12, decay: .06, dest: sfx, glide: 300 }); tone(880, t + .05, .1, { type: "sine", level: .08, decay: .06, dest: sfx }); }
  function sfxWhoosh() { if (!ctx) return; noise(ctx.currentTime, .4, { type: "bandpass", freq: 900, q: .5, level: .08, decay: .12, dest: sfx }); }
  function sfxBeep(hi) { tone(hi ? 1320 : 660, ctx.currentTime, .18, { type: "square", level: .09, cut: 3000, r: .08, dest: sfx }); }
  function sfxRimshot() { const t = ctx.currentTime; drum("snare", t, .7, sfx); drum("snare", t + .16, .7, sfx); drum("kick", t + .3, .8, sfx); drum("ohat", t + .3, 1.4, sfx); }
  function sfxCrickets() { const t = ctx.currentTime; for (let i = 0; i < 6; i++) tone(4400, t + i * .09 + (i > 2 ? .35 : 0), .03, { type: "sine", level: .04, decay: .015, dest: sfx }); }
  function sfxCheer(power = 1) {
    const t = ctx.currentTime;
    noise(t, 2.6 * power, { type: "bandpass", freq: 1200, q: .4, level: .12 * power, decay: .9 * power, dest: sfx });
    const claps = Math.round(40 * power);
    for (let i = 0; i < claps; i++) noise(t + Math.random() * 2.4 * power, .03, { type: "bandpass", freq: 1200 + Math.random() * 1400, q: 1.2, level: .25, decay: .012, dest: sfx });
    tone(700, t + .1, .6, { type: "sine", level: .03 * power, vib: .04, glide: 500, dest: sfx });
  }

  // ---------- performance ----------
  let run = null;
  const lane = $("#lane"), lctx = lane.getContext("2d");

  async function startSong(song) {
    audio();
    if (save.micMode === "real" && !mic.stream && !(await enableMic())) save.micMode = "virtual";
    let model, el = null;
    if (song.custom) {
      el = new Audio(URL.createObjectURL(song.blob));
      el.preload = "auto";
      model = buildCustom(song, song.durationSec);
    } else model = buildSong(song);
    if (run) endRun(false);
    run = {
      song, m: model, el, t0: 0, started: false, paused: false, done: false, nextBar: 0, nextNote: 0, timer: 0, raf: 0,
      score: 0, combo: 0, maxCombo: 0, hype: 50, judged: new Set(), got: new Map(), perfect: 0, results: [],
      trail: [], lastReact: 0, misses: 0, silentLines: 0, lastLine: -1, lineVoice: 0, holding: false, holdStart: -Infinity
    };
    $("#nowTitle").textContent = song.title;
    $("#nowArtist").textContent = song.artist;
    $("#score").textContent = "0";
    $("#combo").textContent = "";
    $("#progress").style.width = "0";
    $("#hype").style.width = "50%";
    $("#lyricNow").innerHTML = `<span class="ready">GET READY…</span>`;
    $("#lyricNext").textContent = model.lines[0] ? lineText(model.lines[0]) : "";
    $("#reactions").innerHTML = "";
    $("#holdBtn").hidden = save.micMode === "real";
    $("#micNote").textContent = save.micMode === "real" ? "🎙️" : "🕹️";
    fillCrowd($("#crowd"), 9);
    setMood($("#crowd"), null);
    drawPerformer($("#performer"));
    $$(".screen").forEach(s => s.classList.toggle("is-active", s.id === "stage"));
    screen = "stage";
    sizeLane();
    countdown(run);
  }
  const lineText = ln => ln.syls.map(s => s.text + (s.join ? "" : " ")).join("").trim();

  function countdown(r) {
    const box = $("#countdown"), num = $("#countNum");
    box.hidden = false;
    const steps = ["3", "2", "1", "SING!"];
    let i = 0;
    const next = () => {
      if (run !== r) return;
      if (i === steps.length) { box.hidden = true; begin(r); return; }
      num.textContent = steps[i];
      num.classList.remove("tick"); void num.offsetWidth; num.classList.add("tick");
      sfxBeep(i === 3);
      if (i === 3) burstEmoji(["🎤", "✨", "🎶", "⭐"], 6);
      i++;
      r.cd = setTimeout(next, 800);
    };
    next();
  }
  function begin(r) {
    r.started = true;
    freshSongBus();
    if (r.m.custom) {
      r.el.play().catch(() => {});
    } else {
      r.t0 = ctx.currentTime + .12;
      r.timer = setInterval(() => schedule(r), 40);
      schedule(r);
    }
    r.raf = requestAnimationFrame(ts => frame(r, ts));
  }
  const nowBeat = r => r.m.custom ? (r.el ? r.el.currentTime : 0) : (ctx.currentTime - r.t0) / r.m.beat;

  // Look-ahead scheduler: queues bars and guide notes about a quarter second ahead of the audio clock.
  function schedule(r) {
    if (run !== r || r.paused) return;
    const m = r.m, beat = m.beat, horizon = ctx.currentTime + .3;
    while (r.nextBar < m.totalBars && r.t0 + r.nextBar * 4 * beat < horizon) {
      const ch = m.chords[r.nextBar % m.chords.length], nx = m.chords[(r.nextBar + 1) % m.chords.length];
      BANDS[m.genre] ? BANDS[m.genre](chordOf(ch), r.t0 + r.nextBar * 4 * beat, beat, r.nextBar, chordOf(nx)) : BANDS.pop(chordOf(ch), r.t0 + r.nextBar * 4 * beat, beat, r.nextBar, chordOf(nx));
      r.nextBar++;
    }
    while (r.nextNote < m.notes.length && r.t0 + m.notes[r.nextNote].start * beat < horizon) {
      const n = m.notes[r.nextNote++];
      if (!save.guide) continue;
      const at = r.t0 + n.start * beat;
      if (n.midi == null) drum("rim", at, .9);
      else tone(midiHz(n.midi), at, n.dur * beat * .92, { type: "triangle", partials: [[1, .8], [2, .15], [3, .05]], level: .13, a: .03, r: .08, vib: .006, cut: 3000 });
    }
  }

  function frame(r, ts) {
    if (run !== r) return;
    r.raf = requestAnimationFrame(t => frame(r, t));
    if (r.paused) return;
    const m = r.m, b = nowBeat(r);
    const dt = r.lastB == null ? 0 : clamp(b - r.lastB, 0, .5);
    r.lastB = b;

    // Voice input
    let singing = false, midi = null;
    if (save.micMode === "real") {
      r.flip = !r.flip;
      if (r.flip) readMic();
      singing = mic.rms > Math.max(.012, mic.floor * 2);
      midi = mic.midi;
      $("#meter").style.width = clamp(mic.rms * 600, 0, 100) + "%";
      $("#micNote").textContent = midi ? midiName(midi) : "🎙️";
    } else {
      singing = r.holding;
      $("#meter").style.width = singing ? (70 + Math.random() * 25) + "%" : "4%";
    }
    $("#performer").classList.toggle("singing", singing);

    // Scoring the active note
    const active = m.notes.find(n => b >= n.start && b < n.start + n.dur);
    if (active && dt) {
      let credit = 0;
      if (singing) {
        if (save.micMode !== "real") credit = r.holdStart >= active.phrase ? 1 : .3;
        else if (active.midi == null) credit = 1;
        else if (midi != null) {
          const tol = [0, 1.6, 1.2, .9][m.difficulty || 2];
          const folded = midi + 12 * Math.round((active.midi - midi) / 12);
          credit = Math.abs(folded - active.midi) <= tol ? 1 : .35;
          r.trail.push({ b, midi: folded });
        } else credit = .3;
      }
      r.got.set(active, (r.got.get(active) || 0) + credit * dt);
      if (singing) r.lineVoice += dt;
    }
    if (save.micMode === "real" && midi != null && !active) {
      const ref = m.notes.find(n => n.start > b && n.midi != null);
      if (ref) r.trail.push({ b, midi: midi + 12 * Math.round((ref.midi - midi) / 12) });
    }
    r.trail = r.trail.filter(p => p.b > b - 3);

    // Judge notes that just ended
    for (const n of m.notes) {
      if (n.start + n.dur > b) break;
      if (r.judged.has(n)) continue;
      r.judged.add(n);
      judge(r, n, (r.got.get(n) || 0) / n.dur);
    }

    // Lines: lyrics and silence reactions
    const li = m.lines.findIndex(l => l.singEnd + (m.custom ? .3 : .25) > b);
    if (li !== r.lastLine) {
      if (r.lastLine >= 0) {
        const prev = m.lines[r.lastLine];
        r.silentLines = r.lineVoice < (prev.singEnd - prev.sing) * .08 ? r.silentLines + 1 : 0;
        if (r.silentLines >= 2) { react(r, "silent"); r.silentLines = 0; }
      }
      r.lastLine = li;
      r.lineVoice = 0;
      renderLine(m, li);
    }
    paintLine(m, li, b);

    // HUD
    $("#progress").style.width = clamp(b / m.total * 100, 0, 100) + "%";
    drawLane(r, b);
    if (b >= m.total || (m.custom && r.el && r.el.ended)) finish(r);
  }

  function judge(r, n, ratio) {
    const tiers = [[.7, "PERFECT!", 100, 7, "var(--gold)"], [.45, "GREAT!", 70, 4, "var(--lime)"], [.2, "GOOD", 35, 1, "var(--cyan)"]];
    const t = tiers.find(x => ratio >= x[0]);
    if (t) {
      r.combo++;
      r.maxCombo = Math.max(r.maxCombo, r.combo);
      r.score += Math.round(t[2] * (1 + Math.min(r.combo, 50) * .02));
      r.hype = clamp(r.hype + t[3], 0, 100);
      r.misses = 0;
      if (t[2] === 100) r.perfect++;
      r.results.push(t[2] / 100);
      flashJudge(t[1], t[4]);
      if ([10, 25, 50].includes(r.combo)) { react(r, "combo"); burstEmoji(["🔥", "⭐", "💥"], 5); }
    } else {
      r.combo = 0;
      r.misses++;
      r.hype = clamp(r.hype - 6, 0, 100);
      r.results.push(0);
      if (r.misses === 4) { react(r, "bad"); r.misses = 0; }
    }
    $("#score").textContent = r.score.toLocaleString();
    $("#combo").textContent = r.combo > 2 ? `${r.combo}x combo` : "";
    $("#hype").style.width = r.hype + "%";
    const crowd = $("#crowd");
    setMood(crowd, r.hype > 72 ? "cheer" : r.hype < 22 ? "cringe" : null);
    if (r.hype > 85 && Math.random() < .15) react(r, "great");
  }
  function flashJudge(text, color) {
    const el = $("#judge");
    el.innerHTML = `<span class="pop" style="color:${color};text-shadow:0 0 16px ${color}">${text}</span>`;
  }

  // ---------- funny reactions ----------
  const REACTIONS = {
    great: [["🔥", "SHEESH! Who let them cook?!"], ["👑", "Main character energy!"], ["🤩", "I got CHILLS!"], ["🎯", "Pitch perfect. Literally."], ["😭", "Stop, I'm crying!"], ["🚀", "That note went to SPACE"]],
    combo: [["🔥", "COMBO! Somebody call the fire department!"], ["⚡", "Unstoppable!!"], ["🌟", "Superstar alert!"]],
    bad: [["😬", "Bold choice. Very bold."], ["🙉", "My ears asked for a break"], ["🐐", "A goat just joined the chorus"], ["🤖", "Autotune who?"], ["😂", "That was… an experience!"], ["🫠", "The notes are on vacation"]],
    silent: [["🦗", "*crickets*"], ["🎤", "Hello? Is this thing on?"], ["😴", "Wake me up when you sing!"], ["👀", "The crowd is waiting…"]]
  };
  function react(r, kind) {
    const now = performance.now();
    if (now - r.lastReact < 2500) return;
    r.lastReact = now;
    const [em, text] = pick(REACTIONS[kind]);
    const el = document.createElement("div");
    el.className = "reaction";
    el.style.left = (8 + Math.random() * 45) + "%";
    el.innerHTML = `<span class="em">${em}</span>${esc(text)}`;
    $("#reactions").appendChild(el);
    setTimeout(() => el.remove(), 2700);
    if (kind === "bad") { sfxRimshot(); setMood($("#crowd"), "cringe"); }
    if (kind === "silent") sfxCrickets();
    if (kind === "great" || kind === "combo") { setMood($("#crowd"), "cheer"); sfxCheer(.35); }
  }
  function burstEmoji(set, n) {
    if (reduced) return;
    const box = $("#reactions");
    for (let i = 0; i < n; i++) {
      const e = document.createElement("span");
      e.className = "float-emoji";
      e.textContent = pick(set);
      e.style.left = (10 + Math.random() * 80) + "%";
      e.style.setProperty("--r", (Math.random() * 60 - 30) + "deg");
      e.style.animationDelay = (Math.random() * .4) + "s";
      box.appendChild(e);
      setTimeout(() => e.remove(), 2800);
    }
  }

  // ---------- lyrics ----------
  function renderLine(m, li) {
    const now = $("#lyricNow"), next = $("#lyricNext");
    const ln = m.lines[li];
    if (!ln) { now.innerHTML = `<span class="ready">🎉 FINISH! 🎉</span>`; next.textContent = ""; return; }
    now.innerHTML = ln.syls.map(s => `<span class="syl">${esc(s.text)}</span>${s.join ? "" : " "}`).join("");
    next.textContent = m.lines[li + 1] ? lineText(m.lines[li + 1]) : "";
  }
  function paintLine(m, li, b) {
    const ln = m.lines[li];
    if (!ln) return;
    const spans = $("#lyricNow").children;
    if (li === 0) {
      // During the intro the second row counts down to the first line instead of showing line 2.
      const left = Math.ceil(ln.sing - b);
      const want = b < ln.sing ? (left <= 4 ? "● ".repeat(left).trim() : "♪ intro ♪") : (m.lines[1] ? lineText(m.lines[1]) : "");
      const next = $("#lyricNext");
      if (next.textContent !== want) next.textContent = want;
    }
    for (let k = 0; k < ln.syls.length && k < spans.length; k++) {
      const s = ln.syls[k];
      const p = clamp((b - s.start) / (s.end - s.start), 0, 1);
      spans[k].style.setProperty("--p", p.toFixed(3));
      spans[k].classList.toggle("done", p >= 1);
    }
  }

  // ---------- note lane ----------
  function sizeLane() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lane.width = lane.clientWidth * dpr;
    lane.height = lane.clientHeight * dpr;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", () => { if (screen === "stage") sizeLane(); });
  function drawLane(r, b) {
    const w = lane.clientWidth, h = lane.clientHeight, m = r.m;
    lctx.clearRect(0, 0, w, h);
    const span = m.custom ? 8 : 10 * (m.bpm / 100);
    const px = w / span, head = w * .22;
    const xOf = beat => head + (beat - b) * px;
    const pitched = m.notes.filter(n => n.midi != null);
    const lo = pitched.length ? Math.min(...pitched.map(n => n.midi)) - 2 : 0;
    const hi = pitched.length ? Math.max(...pitched.map(n => n.midi)) + 2 : 1;
    const yOf = midi => midi == null ? h / 2 : h - 12 - (midi - lo) / (hi - lo) * (h - 24);
    // guide lines
    lctx.strokeStyle = "rgba(255,255,255,.06)";
    lctx.lineWidth = 1;
    for (let y = 12; y < h; y += 14) { lctx.beginPath(); lctx.moveTo(0, y); lctx.lineTo(w, y); lctx.stroke(); }
    // notes
    for (const n of m.notes) {
      const x = xOf(n.start), x2 = xOf(n.start + n.dur);
      if (x2 < -10 || x > w + 10) continue;
      const done = r.judged.has(n), ratio = (r.got.get(n) || 0) / n.dur;
      const y = yOf(n.midi);
      lctx.fillStyle = done ? (ratio >= .45 ? "#ffd23f" : "rgba(255,255,255,.18)") : (n.midi == null ? "#33e1ff" : "#ff4fd8");
      lctx.shadowColor = lctx.fillStyle;
      lctx.shadowBlur = done && ratio >= .45 ? 14 : 6;
      if (n.midi == null) {
        lctx.beginPath(); lctx.arc(x + 4, y, 7, 0, Math.PI * 2); lctx.fill();
      } else {
        const bw = Math.max(6, x2 - x - 3);
        lctx.beginPath(); lctx.roundRect(x, y - 6, bw, 12, 6); lctx.fill();
      }
    }
    lctx.shadowBlur = 0;
    // player's pitch trail
    if (save.micMode === "real") {
      lctx.fillStyle = "#b6ff3b";
      for (const p of r.trail) {
        const x = xOf(p.b);
        if (x < 0 || x > head + 2) continue;
        lctx.globalAlpha = clamp(1 - (b - p.b) / 3, .1, 1);
        lctx.beginPath(); lctx.arc(x, yOf(clamp(p.midi, lo, hi)), 3.2, 0, Math.PI * 2); lctx.fill();
      }
      lctx.globalAlpha = 1;
    }
    // playhead
    lctx.strokeStyle = "#ffffff";
    lctx.shadowColor = "#33e1ff"; lctx.shadowBlur = 12;
    lctx.lineWidth = 3;
    lctx.beginPath(); lctx.moveTo(head, 4); lctx.lineTo(head, h - 4); lctx.stroke();
    lctx.shadowBlur = 0;
  }

  // ---------- pause / quit ----------
  function pause() {
    if (!run || !run.started || run.paused || run.done) return;
    run.paused = true;
    if (run.m.custom) run.el.pause(); else ctx.suspend();
    $("#pauseMenu").hidden = false;
  }
  function resume() {
    if (!run || !run.paused) return;
    run.paused = false;
    $("#pauseMenu").hidden = true;
    if (run.m.custom) run.el.play().catch(() => {}); else ctx.resume();
  }
  function endRun(stopAudio = true) {
    if (!run) return;
    const r = run;
    clearTimeout(r.cd); clearInterval(r.timer); cancelAnimationFrame(r.raf);
    if (r.el) { r.el.pause(); URL.revokeObjectURL(r.el.src); }
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); freshSongBus(); }
    $("#pauseMenu").hidden = true;
    $("#countdown").hidden = true;
    run = null;
  }
  $("#pauseBtn").addEventListener("click", pause);
  $("#resumeBtn").addEventListener("click", resume);
  $("#restartBtn").addEventListener("click", () => { const s = run.song; endRun(); startSong(s); });
  $("#quitBtn").addEventListener("click", () => { endRun(); go("library"); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  // virtual mic: hold the button or Space
  const hold = on => {
    if (run) {
      if (on && !run.holding) run.holdStart = run.started ? nowBeat(run) : -Infinity;
      run.holding = on;
    }
    $("#holdBtn").classList.toggle("on", on);
  };
  $("#holdBtn").addEventListener("pointerdown", e => { e.preventDefault(); hold(true); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => $("#holdBtn").addEventListener(ev, () => hold(false)));
  document.addEventListener("keydown", e => {
    if (screen !== "stage") return;
    if (e.code === "Space" && !e.repeat) { e.preventDefault(); hold(true); }
    if (e.key === "Escape") { e.preventDefault(); run && run.paused ? resume() : pause(); }
  });
  document.addEventListener("keyup", e => { if (e.code === "Space") hold(false); });

  // ---------- results ----------
  function finish(r) {
    if (r.done) return;
    r.done = true;
    for (const n of r.m.notes) if (!r.judged.has(n)) { r.judged.add(n); r.results.push(Math.min(1, (r.got.get(n) || 0) / n.dur)); }
    const acc = r.results.length ? r.results.reduce((a, v) => a + v, 0) / r.results.length * 100 : 0;
    const grade = acc >= 90 ? "S" : acc >= 75 ? "A" : acc >= 55 ? "B" : acc >= 35 ? "C" : "D";
    const before = new Set(MICS.filter(unlocked).map(m => m.id));
    save.sung++;
    if (!save.genres.includes(r.song.genre)) save.genres.push(r.song.genre);
    if (!save.grades.includes(grade)) save.grades.push(grade);
    const prevBest = save.best[r.song.id];
    const isBest = !prevBest || r.score > prevBest.score;
    if (isBest) save.best[r.song.id] = { score: r.score, grade };
    persist();
    const fresh = MICS.filter(m => unlocked(m) && !before.has(m.id));
    const song = r.song;
    endRun();
    showResults(song, { score: r.score, acc, grade, perfect: r.perfect, combo: r.maxCombo, isBest: isBest && !!prevBest, fresh });
  }
  const QUIPS = {
    S: ["Legendary! The crowd is chanting your name!", "Flawless. Somebody get this star a record deal!", "That was so good the lights started crying."],
    A: ["Amazing! You owned that stage!", "Encore! Encore! ENCORE!", "That performance had main character energy."],
    B: ["Nice! The crowd is vibing with you.", "Solid set! A few more runs and you're a legend.", "Good stuff! Your mic is proud of you."],
    C: ["Not bad! Practice makes platinum.", "The crowd clapped… mostly politely!", "You've got the confidence. The notes will follow!"],
    D: ["The crowd is… confused, but supportive!", "A bold, experimental take. Very avant-garde.", "Even legends start somewhere. Try the guide vocal!"]
  };
  function showResults(song, res) {
    $$(".screen").forEach(s => s.classList.toggle("is-active", s.id === "results"));
    screen = "results";
    $("#resTitle").textContent = song.title;
    $("#resArtist").textContent = song.artist;
    const g = $("#grade");
    g.textContent = res.grade;
    g.classList.remove("show"); void g.offsetWidth; g.classList.add("show");
    $("#quip").textContent = pick(QUIPS[res.grade]);
    countUp($("#resScore"), res.score);
    $("#resAcc").textContent = Math.round(res.acc) + "%";
    $("#resPerfect").textContent = res.perfect;
    $("#resCombo").textContent = res.combo;
    $("#newBest").hidden = !res.isBest;
    $("#unlocks").innerHTML = res.fresh.map(m => `<div class="unlock-card">${micSVG(m)}<b>NEW MIC UNLOCKED</b><span>${esc(m.name)}</span></div>`).join("");
    fillCrowd($("#resCrowd"), 9);
    const power = { S: 1.4, A: 1.1, B: .8, C: .5, D: .3 }[res.grade];
    setMood($("#resCrowd"), power >= .8 ? "cheer" : power >= .5 ? "wow" : "cringe");
    $("#applauseSign").classList.toggle("lit", power >= .5);
    sfxCheer(power);
    confetti(power);
    if (res.fresh.length) setTimeout(() => { const t = ctx.currentTime; [0, 4, 7, 12].forEach((iv, i) => tone(midiHz(72 + iv), t + i * .09, .25, { type: "square", level: .06, cut: 3000, decay: .15, dest: sfx })); }, 900);
    $("#againBtn").onclick = () => startSong(song);
  }
  function countUp(el, to) {
    const t0 = performance.now(), dur = 1200;
    const step = now => {
      const p = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round(to * (1 - (1 - p) ** 3)).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- confetti + background sparkles ----------
  const cf = $("#confetti"), cfx = cf.getContext("2d");
  function confetti(power) {
    if (reduced) return;
    cf.width = innerWidth; cf.height = innerHeight;
    const colors = ["#ff4fd8", "#33e1ff", "#b6ff3b", "#ffd23f", "#ff8a3d", "#8a5cff"];
    const bits = Array.from({ length: Math.round(160 * power) }, () => ({
      x: Math.random() * cf.width, y: -20 - Math.random() * cf.height * .5, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4,
      s: 6 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, c: pick(colors), clap: Math.random() < .08
    }));
    const t0 = performance.now();
    const step = now => {
      cfx.clearRect(0, 0, cf.width, cf.height);
      for (const p of bits) {
        p.x += p.vx; p.y += p.vy; p.vy += .05; p.rot += p.vr;
        cfx.save(); cfx.translate(p.x, p.y); cfx.rotate(p.rot);
        if (p.clap) { cfx.font = "26px serif"; cfx.fillText("👏", -13, 9); }
        else { cfx.fillStyle = p.c; cfx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
        cfx.restore();
      }
      if (now - t0 < 4500) requestAnimationFrame(step); else cfx.clearRect(0, 0, cf.width, cf.height);
    };
    requestAnimationFrame(step);
  }
  (function sparkles() {
    const c = $("#sparkles"), x = c.getContext("2d");
    let stars = [];
    const size = () => {
      c.width = innerWidth; c.height = innerHeight;
      stars = Array.from({ length: Math.round(innerWidth * innerHeight / 14000) }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height * .8, r: .5 + Math.random() * 1.8, p: Math.random() * 6, s: .5 + Math.random() * 1.5 }));
    };
    size();
    addEventListener("resize", size);
    let last = 0;
    const draw = now => {
      if (now - last > 50) {
        last = now;
        x.clearRect(0, 0, c.width, c.height);
        for (const s of stars) {
          x.globalAlpha = reduced ? .5 : .25 + .75 * Math.abs(Math.sin(s.p + now / 1000 * s.s));
          x.fillStyle = "#fff";
          x.beginPath(); x.arc(s.x, s.y, s.r, 0, Math.PI * 2); x.fill();
        }
      }
      if (!reduced) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  })();

  // ---------- mic locker ----------
  function renderLocker() {
    const n = MICS.filter(unlocked).length;
    $("#lockCount").textContent = `${n}/${MICS.length} unlocked`;
    $("#micGrid").innerHTML = MICS.map((m, i) => {
      const open = unlocked(m), on = currentMic().id === m.id;
      return `<button type="button" class="mic-card${open ? "" : " locked"}${on ? " equipped" : ""}" data-mic="${m.id}" ${open ? "" : "aria-disabled=\"true\""} style="--i:${i * 35}ms">
        ${micSVG(m)}<b>${esc(m.name)}</b><small>${on ? "★ On stage" : open ? "Tap to equip" : "🔒 " + needText(m)}</small></button>`;
    }).join("");
  }
  $("#micGrid").addEventListener("click", e => {
    const c = e.target.closest("[data-mic]");
    if (!c) return;
    const m = MICS.find(x => x.id === c.dataset.mic);
    if (!unlocked(m)) { sfxTick(); return; }
    save.mic = m.id; persist(); audio(); sfxPop(); renderLocker();
  });

  // ---------- start ----------
  fillCrowd($("#lobbyCrowd"), 7);
  renderGenres();
  renderLobby();
  loadCustom().then(() => { if (screen === "library") renderLibrary(); });
})();
