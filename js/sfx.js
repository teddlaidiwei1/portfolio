/* sfx.js: the site's sound effects (Tedd Lai portfolio). Plain script, no modules, no dependencies.
 *
 * OFF by default. Nothing is fetched and no AudioContext exists until the visitor turns sound on.
 *   SFX.enabled            true while sound is on
 *   SFX.toggle()           flip it (returns the new state); SFX.set(true | false)
 *   SFX.play(name, {volume, rate, pan})   safe any time; a no-op when off, before a gesture, or for an unknown name
 *   SFX.runKm(km)          optional helper for the run counter: plays 'half' once when km crosses 21.1 upward
 *                          and 'finish' once when it crosses 42.195 upward (re-arms after going back down)
 *   SFX.mountToggle(el)    turn any button into the sound toggle (aria-pressed + "Sound on" / "Sound off")
 *   SFX.names()            list of sound names
 * Fires window event 'sfx:change' {on} whenever the state changes. State is remembered in localStorage.
 * Under prefers-reduced-motion it always starts OFF (even if remembered on); turning it on is the visitor's choice.
 *
 * Auto-wiring (event delegation and window events only, nothing to edit in other files):
 *   button / link presses -> 'tap' (big primary buttons -> 'press'); hover is always silent
 *   [data-whatif] buttons -> 'gravity' | 'typhoon' | 'stop' | 'reset' (empty value = put it back)
 *   world:poke {mode}     -> 'gravity' | 'typhoon' | 'stop' | 'lava' | 'clones'
 *   world:scene {state}   -> 'arrived' = 'land', 'left' = 'leave'
 *   world:hud             -> 'tick' when a stop's reading changes (throttled, not on the first reading)
 *   world:intro-done      -> 'sting' (once)
 *   site:copied           -> 'copied'
 *   Quick view dialog     -> 'open' / 'close'
 *   section change        -> 'tick' (soft)
 * Opt-outs for the page: data-sfx="off" on an element (or any parent) silences its presses;
 * data-sfx="<name>" plays that sound instead of the default tick.
 * Sound files live in <folder of this script>/sfx/<name>.mp3 (override: window.SFX_BASE = 'path/').
 */
(function () {
  'use strict';
  if (window.SFX && window.SFX._v) return;

  var STORE = 'tl-sfx-on';
  //  name: [file, volume, minimum gap ms, pitch variation (+/- fraction)]
  var MAP = {
    tick:    ['tick',    0.8, 70,  0.05],
    tap:     ['tap',     1.0, 45,  0.05],
    press:   ['press',   1.0, 60,  0.03],
    blip:    ['blip',    1.0, 50,  0.01],
    open:    ['open',    1.0, 150, 0.02],
    close:   ['close',   1.0, 150, 0.02],
    copied:  ['copied',  1.0, 300, 0],
    sting:   ['sting',   1.0, 1000, 0],
    half:    ['half',    1.0, 1000, 0],
    finish:  ['finish',  1.0, 1000, 0],
    pickup:  ['pickup',  1.0, 80,  0.01],
    gravity: ['gravity', 1.0, 250, 0.03],
    typhoon: ['typhoon', 1.0, 400, 0.04],
    stop:    ['stop',    1.0, 250, 0.04],
    reset:   ['reset',   1.0, 200, 0.04],
    lava:    ['lava',    1.0, 250, 0.05],
    clones:  ['clones',  1.0, 250, 0.02],
    land:    ['land',    1.0, 500, 0.04],
    leave:   ['leave',   1.0, 400, 0.05],
    whoosh:  ['whoosh',  1.0, 80,  0.06],
    pop:     ['pop',     1.0, 45,  0.06],
    clap:    ['clap',    1.0, 120, 0.04],
    punch:   ['punch',   1.0, 90,  0.06],
    thud:    ['thud',    1.0, 90,  0.05],
    drop:    ['drop',    1.0, 300, 0.03],
    cheer:   ['cheer',   0.9, 1500, 0.03],
    engine:  ['engine',  1.0, 250, 0.06],
    error:   ['error',   1.0, 300, 0.01]
  };
  var MAX_VOICES = 10;
  var MASTER = 0.5;

  var w = window, d = document;
  var base = (function () {
    if (typeof w.SFX_BASE === 'string') return w.SFX_BASE.replace(/\/?$/, '/');
    var s = d.currentScript;
    var src = (s && s.src) || '';
    if (s && s.getAttribute('data-base')) return s.getAttribute('data-base').replace(/\/?$/, '/');
    return src ? src.replace(/[^\/?#]*([?#].*)?$/, '') + 'sfx/' : 'sfx/';
  })();

  function store(v) {
    try { if (v === undefined) return w.localStorage.getItem(STORE); w.localStorage.setItem(STORE, v ? '1' : '0'); }
    catch (e) { return null; }
    return null;
  }
  var reduceQ = null;
  try { reduceQ = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { reduceQ = null; }
  function reduced() { return !!(reduceQ && reduceQ.matches); }

  var enabled = store() === '1' && !reduced();
  var ctx = null, master = null, gestured = false;
  var raw = {}, buffers = {}, fetching = false, decoding = {};
  var last = {}, voices = [], played = 0, lastName = null, lastRate = {};
  var hidden = !!d.hidden;
  var AC = w.AudioContext || w.webkitAudioContext;

  function now() { return (w.performance && performance.now) ? performance.now() : Date.now(); }

  // ---------- audio graph ----------
  function ensureCtx() {
    if (ctx || !AC || !enabled) return ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return null; } }
    try {
      master = ctx.createGain(); master.gain.value = MASTER;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 12;
      comp.attack.value = 0.002; comp.release.value = 0.15;
      master.connect(comp); comp.connect(ctx.destination);
    } catch (e) { ctx = null; master = null; return null; }
    decodeAll();
    return ctx;
  }
  function wake() {
    if (!ctx || hidden || !enabled) return null;
    try {
      if (ctx.state === 'suspended' && ctx.resume) { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); return p || null; }
    } catch (e) {}
    return null;
  }

  // ---------- loading (only after sound is on) ----------
  function fetchAll() {
    if (fetching || !w.fetch) return; fetching = true;
    var order = ['tap', 'press', 'tick', 'blip', 'copied', 'open', 'close', 'land', 'leave'];
    var files = {};
    order.forEach(function (n) { files[MAP[n][0]] = 1; });
    Object.keys(MAP).forEach(function (n) { files[MAP[n][0]] = 1; });
    Object.keys(files).forEach(function (f) {
      try {
        w.fetch(base + f + '.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then(function (ab) { raw[f] = ab; decodeOne(f); })
          .catch(function () { /* a missing file just stays silent */ });
      } catch (e) {}
    });
  }
  function decodeOne(f) {
    if (!ctx || !raw[f] || buffers[f] || decoding[f]) return;
    decoding[f] = true;
    var ab = raw[f];
    var ok = function (b) { buffers[f] = b; raw[f] = null; decoding[f] = false; onDecoded(f); };
    var bad = function () { decoding[f] = false; raw[f] = null; };
    try {
      var p = ctx.decodeAudioData(ab, ok, bad);
      if (p && p.catch) p.catch(bad);
    } catch (e) { bad(); }
  }
  function decodeAll() { Object.keys(raw).forEach(decodeOne); }

  var confirmPending = false;
  function onDecoded(f) {
    if (confirmPending && f === 'blip') { confirmPending = false; play('blip', { volume: 0.8 }); }
  }

  // ---------- play ----------
  function play(name, opts) {
    try {
      if (!enabled || hidden || !ctx || !master) return false;
      var def = MAP[name]; if (!def) return false;
      if (ctx.state !== 'running') { wake(); if (ctx.state !== 'running') return false; }
      var buf = buffers[def[0]]; if (!buf) return false;
      var t = now();
      if (last[name] && t - last[name] < def[2]) return false;
      last[name] = t;
      opts = opts || {};
      // pitch: requested rate x a small random step that never repeats the last one exactly
      var vary = def[3], r = 1;
      if (vary > 0) {
        r = 1 + (Math.random() * 2 - 1) * vary;
        if (lastRate[name] && Math.abs(r - lastRate[name]) < vary * 0.3) r = 2 - r;
        lastRate[name] = r;
      }
      var rate = clamp(num(opts.rate, 1) * r, 0.25, 4);
      var vol = clamp(num(opts.volume, 1) * def[1], 0, 2);
      if (vol <= 0) return false;
      while (voices.length >= MAX_VOICES) { var old = voices.shift(); try { old.stop(); } catch (e) {} }
      var src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      var g = ctx.createGain(); g.gain.value = vol;
      src.connect(g);
      var pan = num(opts.pan, 0), out = g;
      if (pan && ctx.createStereoPanner) {
        var p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); out = p;
      }
      out.connect(master);
      voices.push(src);
      src.onended = function () {
        var i = voices.indexOf(src); if (i >= 0) voices.splice(i, 1);
        try { src.disconnect(); g.disconnect(); if (out !== g) out.disconnect(); } catch (e) {}
      };
      src.start(0);
      played++; lastName = name;
      return true;
    } catch (e) { return false; }
  }
  function num(v, dflt) { v = +v; return (v === v && isFinite(v)) ? v : dflt; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------- on / off ----------
  var userToggled = false;
  function set(on, why) {
    on = !!on;
    if (why !== 'system') { userToggled = true; store(on); }
    if (on === enabled) { syncToggles(); return enabled; }
    enabled = on;
    if (on) {
      fetchAll();
      var active = gestured || (navigator.userActivation && navigator.userActivation.isActive);
      if (active) {
        ensureCtx(); var wp = wake(); confirmPending = true;
        if (buffers.blip) {
          confirmPending = false;
          var beep = function () { play('blip', { volume: 0.8 }); };
          if (wp && wp.then) wp.then(beep, function () {}); else beep();
        }
      }
    } else {
      confirmPending = false;
      voices.slice().forEach(function (s) { try { s.stop(); } catch (e) {} }); voices = [];
      if (ctx && ctx.suspend) { try { ctx.suspend(); } catch (e) {} }
    }
    syncToggles();
    try { w.dispatchEvent(new CustomEvent('sfx:change', { detail: { on: enabled } })); } catch (e) {}
    return enabled;
  }
  function toggle() { return set(!enabled); }

  // first real gesture after sound is on: build / resume the AudioContext
  function onGesture() {
    gestured = true;
    if (!enabled) return;
    if (!ctx) ensureCtx(); else wake();
  }
  ['pointerdown', 'keydown', 'touchend', 'mousedown'].forEach(function (t) {
    w.addEventListener(t, onGesture, { capture: true, passive: true });
  });

  d.addEventListener('visibilitychange', function () {
    hidden = !!d.hidden;
    if (!ctx) return;
    try { if (hidden) ctx.suspend(); else if (enabled) wake(); } catch (e) {}
  });
  if (reduceQ) {
    var onReduce = function () { if (reduced() && enabled && !userToggled) set(false, 'system'); };
    if (reduceQ.addEventListener) reduceQ.addEventListener('change', onReduce);
    else if (reduceQ.addListener) reduceQ.addListener(onReduce);
  }

  // ---------- toggle control ----------
  var toggles = [];
  function syncToggles() {
    toggles.forEach(function (el) {
      el.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      var label = el.querySelector && el.querySelector('[data-sfx-label]');
      (label || el).textContent = enabled ? 'Sound on' : 'Sound off';
    });
  }
  function mountToggle(el) {
    if (!el || toggles.indexOf(el) >= 0) return el;
    if (el.tagName !== 'BUTTON' && !el.getAttribute('role')) el.setAttribute('role', 'button');
    if (el.tagName === 'BUTTON' && !el.getAttribute('type')) el.setAttribute('type', 'button');
    el.setAttribute('data-sfx-toggle', '');
    el.addEventListener('click', function (e) { if (e) e.preventDefault(); gestured = true; toggle(); });
    if (el.tagName !== 'BUTTON') {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gestured = true; toggle(); }
      });
    }
    toggles.push(el); syncToggles();
    return el;
  }

  // ---------- auto-wiring ----------
  var PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, label[for], input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"]';
  var PRIMARY = '.button--primary, .btn-primary, .is-primary, [data-sfx-primary], .hero-button, .button--email, .button--big, .cta';
  var DIALOG_CTRL = '#qv-open, #qv-close, .qv-close, [data-qv-go], [aria-haspopup="dialog"], [data-dialog-open], [data-dialog-close]';
  var COPY = '#copy-email, [data-email], [data-copy]';
  function closest(el, sel) {
    while (el && el.nodeType === 1) { if (matches(el, sel)) return el; el = el.parentNode; }
    return null;
  }
  function matches(el, sel) {
    var f = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
    try { return f ? f.call(el, sel) : false; } catch (e) { return false; }
  }

  var WHATIF = { gravity: 'gravity', typhoon: 'typhoon', stop: 'stop', earth: 'stop', lava: 'lava', clones: 'clones' };
  var lastWorldSound = 0, lastPress = 0;
  d.addEventListener('click', function (e) {
    if (!enabled) return;
    try {
      var el = closest(e.target, PRESSABLE); if (!el) return;
      lastPress = now();
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (el.hasAttribute('data-sfx-toggle')) return;
      var off = closest(el, '[data-sfx]');
      if (off) {
        var v = off.getAttribute('data-sfx');
        if (v === 'off' || v === 'none') return;
        if (off === el && MAP[v]) { play(v); return; }
      }
      if (el.hasAttribute('data-whatif')) {
        var m = (el.getAttribute('data-whatif') || '').toLowerCase();
        play(m ? (WHATIF[m] || 'tap') : 'reset'); lastWorldSound = now(); return;
      }
      if (matches(el, COPY)) return;          // 'site:copied' plays the confirm
      if (matches(el, DIALOG_CTRL)) return;   // the dialog watcher plays open / close
      play(matches(el, PRIMARY) ? 'press' : 'tap');
    } catch (err) {}
  }, true);

  function on(type, fn) { w.addEventListener(type, function (e) { try { fn((e && e.detail) || {}); } catch (err) {} }); }

  on('world:poke', function (dt) {
    var m = WHATIF[String(dt.mode || '').toLowerCase()];
    if (m && now() - lastWorldSound > 250) play(m);
  });
  var lastScene = 0;
  on('world:scene', function (dt) {
    if (dt.state === 'arrived') { play('land'); lastScene = now(); }
    else if (dt.state === 'left') { play('leave'); lastScene = now(); }
  });
  var hudSeen = {}, lastHud = 0;
  on('world:hud', function (dt) {
    var key = String(dt.stop || '');
    var val = dt.left ? String(dt.left.value) + '|' + String(dt.left.caption) : JSON.stringify(dt.extra || '');
    var first = !(key in hudSeen), changed = hudSeen[key] !== val;
    hudSeen[key] = val;
    var t = now();
    if (first || !changed) return;
    if (t - lastScene < 700 || t - lastHud < 500) return;
    lastHud = t; play('tick', { volume: 0.7 });
  });
  var introDone = false;
  on('world:intro-done', function () { if (introDone) return; introDone = true; play('sting'); });
  on('site:copied', function () { play('copied'); });

  // Quick view (or any modal dialog): watch the open attribute and the root 'qv-open' class
  var qvOpen = false;
  function dialogIsOpen() {
    var root = d.documentElement;
    if (root.classList && root.classList.contains('qv-open')) return true;
    var q = d.querySelector('#quick-view[open], dialog.qv[open], dialog[open][data-sfx-dialog]');
    return !!q;
  }
  function checkDialog() {
    var o = dialogIsOpen();
    if (o === qvOpen) return;
    qvOpen = o; play(o ? 'open' : 'close');
  }
  function startObservers() {
    if (!w.MutationObserver) return;
    try {
      new MutationObserver(checkDialog).observe(d.documentElement, { attributes: true, attributeFilter: ['class'] });
      new MutationObserver(checkDialog).observe(d.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });
    } catch (e) {}
    qvOpen = dialogIsOpen();
  }

  // section change: a soft tick when a new section reaches the middle of the window
  var currentSection = null, sectionReady = false, io = null, seen = [], lastSection = 0;
  function watchSections() {
    if (!w.IntersectionObserver) return;
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.getAttribute('data-stop') || en.target.id;
          if (id === currentSection) return;
          currentSection = id;
          if (!sectionReady) return;
          var t = now();
          // quiet while a link press smooth-scrolls past several sections, near a scene sound, or in quick succession
          if (t - lastScene < 400 || t - lastPress < 1500 || t - lastSection < 400) return;
          lastSection = t; play('tick', { volume: 0.6 });
        });
      }, { rootMargin: '-49% 0px -49% 0px', threshold: 0 });
    }
    var list = d.querySelectorAll('[data-stop], main > section[id]');
    for (var i = 0; i < list.length; i++) {
      if (seen.indexOf(list[i]) < 0) { seen.push(list[i]); io.observe(list[i]); }
    }
    setTimeout(function () { sectionReady = true; }, 800);
  }

  // run counter helper
  var runState = { half: false, finish: false, km: null };
  function runKm(km) {
    km = num(km, 0);
    if (runState.km === null) {          // first reading (page may load mid-way): set the baseline, play nothing
      runState.km = km; runState.half = km >= 21.1; runState.finish = km >= 42.195; return;
    }
    if (km >= 21.1 && runState.km < 21.1 && !runState.half) { runState.half = true; play('half'); }
    if (km >= 42.195 && runState.km < 42.195 && !runState.finish) { runState.finish = true; play('finish'); }
    if (km < 20.6) runState.half = false;
    if (km < 41.7) runState.finish = false;
    runState.km = km;
  }

  function boot() {
    startObservers(); watchSections();
    var t = d.querySelectorAll('[data-sfx-toggle]');
    for (var i = 0; i < t.length; i++) mountToggle(t[i]);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
  w.addEventListener('load', watchSections);
  if (enabled) {             // remembered "on": fetch when the page is idle, decode after the first gesture
    if (w.requestIdleCallback) w.requestIdleCallback(fetchAll, { timeout: 2500 }); else setTimeout(fetchAll, 1200);
  }

  w.SFX = {
    _v: 1,
    get enabled() { return enabled; },
    set enabled(v) { set(v); },
    toggle: toggle,
    set: function (v) { return set(v); },
    play: function (name, opts) { return play(name, opts); },
    runKm: runKm,
    mountToggle: mountToggle,
    names: function () { return Object.keys(MAP); },
    debug: function () {
      return { enabled: enabled, ctx: ctx, state: ctx ? ctx.state : 'none', master: master, base: base,
               decoded: Object.keys(buffers).length, total: Object.keys(MAP).length, played: played, last: lastName,
               voices: voices.length, gestured: gestured, reduced: reduced() };
    }
  };
})();
