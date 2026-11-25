/* site.js (v3): the page. One layout() reads the window's shape and decides where the STAGE is (the planet's
   rectangle, fixed in the window) and where the text goes. Every frame, scroll is turned into the episode's state
   ({from, to, roll, dive}) for world.js, the colour fields, the HUD, the header and the text-panel clip.
   Every call into world.js is guarded, so the page works with no planet, an old planet or a half-built one.
   API: portfolio/briefs/world-api.md */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var easeIO = function (t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var lerpRect = function (a, b, t) { return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) }; };

  var reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  var fineQ = matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = function () { return reduceQ.matches; };

  // ---------- world.js, guarded ----------
  function W() { return window.WORLD || null; }
  function has(fn) { var w = W(); return !!(w && typeof w[fn] === 'function'); }
  function call(fn) {
    var w = W();
    if (!w || typeof w[fn] !== 'function') return undefined;
    try { return w[fn].apply(w, [].slice.call(arguments, 1)); }
    catch (e) { if (window.console) console.warn('WORLD.' + fn + ' failed:', e); return undefined; }
  }
  function worldLive() { return root.classList.contains('world-live') && !root.classList.contains('no-world'); }
  function stopName(s) {
    var st = (W() && W().stops) || null;
    if (s === 'bwgu' && st && !('bwgu' in st) && ('uncooked' in st)) return 'uncooked';
    return s;
  }
  function stopAngle(s) { var st = (W() && W().stops) || {}; var a = st[stopName(s)]; return typeof a === 'number' ? a : 0; }

  var canvasTimer = 0;
  function settleWorld() { clearInterval(canvasTimer); canvasTimer = 0; }
  function noWorld() { root.classList.add('no-world'); root.classList.remove('world-live'); settleWorld(); loadStills(); dirty = true; }
  // the stage's still pictures exist only when there is no 3D: made, fetched and shown only then
  var STILL_SRC = {
    // only tinyworld and the ads section (the drive-in) dive into a place; every other stop shows the planet (the logo picture)
    hero: ['img/world-fallback.png', 1080, 1080, 1], tinyworld: ['img/tw-gorilla.jpg', 720, 1280],
    films:['video/ads/ad-3.jpg', 720, 900], workflow: ['img/world-fallback.png', 1080, 1080, 1], bwgu: ['img/world-fallback.png', 1080, 1080, 1],
    about: ['img/world-fallback.png', 1080, 1080, 1], contact: ['img/world-fallback.png', 1080, 1080, 1]
  };
  function loadStills() {
    var box = document.getElementById('stills');
    if (!box || box.children.length) return;
    Object.keys(STILL_SRC).forEach(function (stop) {
      var d = STILL_SRC[stop], img = document.createElement('img');
      img.className = 'still' + (d[3] ? ' still--logo' : ''); img.setAttribute('data-still', stop);
      img.width = d[1]; img.height = d[2]; img.alt = ''; img.decoding = 'async'; img.src = d[0];
      box.appendChild(img);
    });
    if (typeof secs !== 'undefined' && secs) secs.forEach(function (s) { s.still = box.querySelector('[data-still="' + s.stop + '"]'); });
  }
  if (!W()) noWorld();
  window.addEventListener('world:failed', noWorld);
  window.addEventListener('world:ready', function () {
    root.classList.add('world-live'); root.classList.remove('no-world'); settleWorld();
    lastSent = {}; dirty = true;
  });
  (function () { var w = W(); if (w && w.ready && typeof w.ready.then === 'function') w.ready.then(null, noWorld); })();
  // world.js may fail before this script listens: no canvas in the layer after a while means no planet
  function checkCanvas() {
    if (worldLive()) { settleWorld(); return; }
    var l = document.getElementById('world-layer');
    if (l && !l.querySelector('canvas')) noWorld();
  }
  canvasTimer = setInterval(checkCanvas, 2000);
  setTimeout(function () { if (!worldLive()) noWorld(); }, 9000);

  // ---------- the parts of the page ----------
  var head = $('#site-head');
  var page = $('#page');
  var foot = $('#foot');
  var meta = $('meta[name="theme-color"]');
  var hudEl = $('#hud'), hudL = $('#hud-left'), hudR = $('#hud-right');
  var stills = $('#stills');
  var heroInner = $('.hero-inner'), heroFrame = $('.hero-frame');
  var nameEl = $('.hero .name'), nameBase = $('.name-base'), nameFirst = $('.name-first'), nameLast = $('.name-last');
  var headline = $('.headline'), heroBio = $('.hero .bio'), heroBtn = $('.hero-actions') || $('.hero-button'), heroFigs = $('.hero-figs');
  var nameChars = $$('.hero .name .ch');
  var heroWork = $('.hero-work');
  // r13 pass B: the lowest of the hero's words: the work strip when it shows, else the buttons
  function heroLow() { return heroWork && heroWork.offsetParent !== null && root.getAttribute('data-strip') !== 'off' ? heroWork : heroBtn; }
  // the strip's height: wide, the room between the buttons and the name's cap line (0.71 of the height); tall, a
  // fixed share of the height; phone, none (no room above the name for both the strip and his face)
  function sizeStrip() {
    if (!heroWork) return;
    var H = L.H, h = 0;
    root.setAttribute('data-strip', 'on');
    if (L.mode === 'phone') h = 0;
    else if (L.mode === 'wide') {
      setVar('--strip-h', '100px');
      var b = heroRect(heroBtn), gTop = parseFloat(getComputedStyle(heroWork).marginTop) || 24;
      h = b ? Math.floor(Math.min(H * 0.2, H * 0.71 - clamp(L.W * 0.012, 12, 28) - (b.y + b.h + gTop))) : 0;
    } else h = Math.round(clamp(H * 0.09, 72, 120));
    if (h < 64) { root.setAttribute('data-strip', 'off'); return; }
    setVar('--strip-h', px(h));
  }

  // P6: the old orange Meta ads section is gone; Before We Grow Up takes its orange (it was light blue, like tinyworld)
  // r13 pass B: one accent colour. Yellow is Tedd's own ground (hero, About) and the one accent everywhere else; the
  // work sections take turns on ink and paper (the sky blue and the orange are gone)
  var FIELD = { hero: '#FFC93C', films: '#141414', tinyworld: '#f3f3f1', bwgu: '#f3f3f1', workflow: '#141414', about: '#FFC93C', contact: '#141414' };
  var DARK = { films: 1, workflow: 1, contact: 1 };
  // P5 (22 Nov): the readout on the left shows NOTHING by default in every section (it repeated numbers already on
  // screen). It still shows its short-lived messages: a what-if's title while it plays, the planet-poke title on
  // the first screen, "Copied" for 2 s, and a scene's live reading while the visitor plays with it (the gorilla
  // fight clock).
  var HUD = { hero: { value: '', caption: '' } };
  var WHATIF_TITLE = { gravity: 'What if the world lost gravity?', typhoon: 'What if a typhoon hit Singapore?', stop: 'What if the Earth stopped spinning?' };
  var whatIfNow = null;
  var hudOverride = {};

  var secs = $$('main [data-stop]').map(function (el, i) {
    var stop = el.getAttribute('data-stop');
    return {
      el: el, i: i, stop: stop,
      col: $('.col', el) || $('.hero-inner', el) || el,
      layer: $('.field[data-field-for="' + stop + '"]'),
      still: stills ? $('[data-still="' + stop + '"]', stills) : null,
      // text first (21 Nov): only the two places where the 3D IS the work dive; everywhere else the whole
      // planet stays in view as a small companion, rolled to that stop's landmark
      dives: stop === 'tinyworld' || stop === 'films' || stop === 'workflow'
    };
  });
  var N = secs.length;

  // ---------- layout(): the one place that decides sizes from the window's shape ----------
  var L = { mode: '', W: 0, H: 0 };
  var LEAD_WIDE = 0.24; // window heights of lead-in before each section's text (wide): the planet only rolls
  var LEAD_TALL = 0.2;  // the same, in text-panel heights (tall, phone) (P5: was 0.3; a stop between two sections was
                        // more than a third bare)
  // Round 4 (21 Nov): every dive in and every pull-back out takes the same 0.6 of a window height of scroll, eased,
  // with the stage rectangle moving with it (wide: tinyworld and Video ads only; tall and phone: the band)
  var DIVE_SPAN = 0.6;
  // wide: the hero's planet moves to its companion place over this much scroll, smoothly, while the hero text
  // stays (pinned) beside it; the hero is pinned for exactly that long, then scrolls away like a page
  var HERO_A0 = 0.04, HERO_SPAN = 0.42;
  // Wide stages, all on the right after the hero (text first, 21 Nov):
  var COMP_W = 0.29;    // the small companion planet: share of the window width
  var COMP_D = 0.33;    // ...its disc, as a share of the window height
  var FILMS_W = 0.35;   // Video ads: a medium stage with room for the posters on the left
  var TW_W = 0.43;      // tinyworld: the 3D is his work here, so the stage is big (P5: 0.48 -> 0.43, so the four reels
                        // can be about 0.4 of the window height tall beside it)
  var BAND_TALL = 0.24, BAND_PHONE = 0.22; // tall and phone: the planet's band (HUD + stage), share of the height (P5: was 0.30 / 0.28)
  var HERO_MOVE = 0.3;  // window heights of scroll for the planet to move from the hero into the band (tall, phone)
  // How world.js draws the zoomed-out planet in a stage, measured live (see calibrate()):
  // a = disc diameter / stage height, b = disc centre / stage height, kt / kb = the 3D's top and bottom
  // (WORLD.bounds(): YOU on top, the disc below) from the disc centre, in disc diameters.
  var CAL = { a: 0.627, b: 0.637, kt: 0.972, kb: 0.5 };
  function setVar(name, v) { root.style.setProperty(name, v); }
  function px(n) { return Math.round(n) + 'px'; }

  // Wide: every stage sits on the right. The companion: about 29% of the width, its disc about a third of the
  // window height, standing in the lower half so the two HUD readouts sit right above it like a caption.
  // Video ads and tinyworld: taller stages from under the header (their places are dived into).
  function zonesWide() {
    var Wd = L.W, H = L.H;
    var zoneTop = Math.max(L.headB + 4, L.hudY + L.hudH + L.hudGap), zoneH = H - L.gb - zoneTop;
    var right = function (f) { var w = Math.round(Wd * f); return { x: Wd - L.gr - w, y: zoneTop, w: w, h: zoneH }; };
    L.zoneTw = right(TW_W);
    L.zoneFilms = right(FILMS_W);
    var cw = Math.round(Wd * COMP_W);
    // the disc: a third of the height, never wider than world.js allows in this width (0.8 of the stage)
    var D = Math.min(H * COMP_D, cw * 0.78);
    var ch = Math.round(Math.min(D / CAL.a, zoneH));
    L.zoneComp = { x: Wd - L.gr - cw, y: Math.round(H - L.gb - ch), w: cw, h: ch };
    L.zoneTop = zoneTop;
    L.colComp = L.zoneComp.x - L.gap - L.gl;
    // r13 pass B: the planet MOVES from section to section instead of standing in the same right third every time
    // (Tedd: keep the 3D big). Each work section has its own stage: right, left, low on the right, small on the
    // left, the companion, and big for Contact; the text and the work take the other side, never under the 3D.
    // Between two sections whose stages are on opposite sides the planet travels through the middle of the window,
    // big, while no text is on screen (see measure: the gap between the two texts is made a screen and a half).
    var left = function (f) { var w = Math.round(Wd * f); return { x: L.gl, y: zoneTop, w: w, h: zoneH }; };
    var lowR = Math.round(zoneH * 0.6), cwL = Math.round(Wd * 0.26), chL = Math.round(Math.min(Math.min(H * COMP_D, cwL * 0.78) / CAL.a, zoneH));
    L.zones = {
      films: right(0.3),
      tinyworld: left(0.34),
      workflow: { x: Wd - L.gr - Math.round(Wd * 0.42), y: Math.round(H - L.gb - lowR), w: Math.round(Wd * 0.42), h: lowR },
      bwgu: { x: L.gl, y: Math.round(H - L.gb - chL), w: cwL, h: chL },
      about: L.zoneComp,
      contact: right(0.44)
    };
    var cw0 = Math.round(Math.min(Wd * 0.5, zoneH * 1.25));
    L.zoneMid = { x: Math.round((Wd - cw0) / 2), y: zoneTop, w: cw0, h: zoneH };
    // each section's column: the side the stage leaves free
    L.cols = {};
    Object.keys(L.zones).forEach(function (k) {
      var z = L.zones[k];
      L.cols[k] = sideOf(z) === 'L' ? { x: z.x + z.w + L.gap, w: Wd - L.gr - (z.x + z.w + L.gap) } : { x: L.gl, w: z.x - L.gap - L.gl };
    });
    L.colTw = L.zoneTw.x - L.gap - L.gl;
    L.colFilms = L.zoneFilms.x - L.gap - L.gl;
  }
  // P6: the AI pipeline section keeps the dived sections' narrower column, so its 3D place can dive later with no re-layout
  function sideOf(z) { return z.x + z.w / 2 < L.W / 2 ? 'L' : 'R'; }
  function colOf(s) { return (L.cols && L.cols[s.stop]) || { x: L.gl, w: L.colComp }; }
  function colW(stop) { return (L.cols && L.cols[stop] ? L.cols[stop].w : L.colComp); }

  function layout() {
    hudSz = null; headSz = null;   // iPad pass: sizes re-read after a layout
    var Wd = window.innerWidth, H = window.innerHeight, keepY = window.scrollY;
    var mode = Wd < 600 ? 'phone' : (Wd / H >= 1.3 && Wd >= 900 ? 'wide' : 'tall');
    root.setAttribute('data-layout', mode);
    // r13 pass D: no dives on a phone: its band is too thin for a place, and a half-dived place read as a planet cut
    // in half by the band's edge. The planet stays whole there, rolled to each stop's landmark.
    secs.forEach(function (s) { s.dives = mode !== 'phone' && (s.stop === 'tinyworld' || s.stop === 'films' || s.stop === 'workflow'); });
    var gl = clamp(Wd * 0.016, 16, 40), gr = gl, gt = clamp(H * 0.014, 10, 24), gb = clamp(H * 0.018, 12, 32), gap = clamp(Wd * 0.016, 16, 40);
    setVar('--gl', px(gl)); setVar('--gr', px(gr)); setVar('--gt', px(gt)); setVar('--gb', px(gb)); setVar('--gap', px(gap));
    L = { mode: mode, W: Wd, H: H, gl: gl, gr: gr, gt: gt, gb: gb, gap: gap, name: L.name, zoneHero: null, stageHero: null };

    var headB = head ? head.offsetHeight : 0;
    var hudH = Math.max(hudL ? hudL.offsetHeight : 0, hudR ? hudR.offsetHeight : 0);
    L.headB = headB; L.hudH = hudH; L.hudGap = clamp(H * 0.012, 6, 16);
    // the HUD sits in line with the header's row (the nav), at the stage's top corners
    L.hudY = Math.max(6, gt - 8);
    var duoGap = clamp(Wd * 0.032, 32, 80);
    setVar('--duo-gap', px(duoGap));

    if (mode === 'wide') {
      L.clipTop = 0;
      L.viewH = H - headB;
      zonesWide();
      var colW = L.colComp;
      L.colW = colW;
      setVar('--col-w', px(colW));
      secs.forEach(function (s) { if (s.stop !== 'hero') { var c = colOf(s); s.el.style.setProperty('--col-w', px(c.w)); s.el.style.setProperty('--col-x', px(c.x - L.gl)); } });
      setVar('--lead', px(H * LEAD_WIDE));
      // P6: the drive-in section follows the hero: its field must reach above the window's top when its heading is at
      // the reading line (with 0.03 of the height it left a strip of the hero's yellow over it)
      setVar('--lead-first', px(headB + clamp(H * 0.04, 16, 48) + H * 0.03));
      // r13 pass D: pinned while the name and his face sink (heroExit), then the words scroll away like a page
      L.heroHold = Math.round(H * HERO_SINK);
      setVar('--hero-hold', px(L.heroHold));
      L.anchorTop = headB + clamp(H * 0.04, 16, 48);
      secs.forEach(function (s) { s.el.style.removeProperty('--lead'); s.el.style.removeProperty('--lead-first'); });
      setVar('--anchor-top', px(L.anchorTop));
      setVar('--view-h', px(L.viewH));
      setVar('--clip-top', '0px');
      setVar('--hero-top', px(Math.max(gt + 24, H * 0.085)));
      // hero: the headline sets the text width (two lines, the break is in the markup)
      headline.style.setProperty('--h-fit', '');
      headline.style.width = 'max-content';
      var hw = headline.offsetWidth;
      headline.style.width = '';
      setVar('--hero-w', px(Math.min(Wd * 0.5, Math.max(hw + 8, Math.min(colW, 26 * (parseFloat(getComputedStyle(heroBio).fontSize) || 20))))));
      // tinyworld: four reels in one row across its half of the screen
      setVar('--reel-h', px(Math.min(L.viewH * 0.62, ((L.colTw - 3 * gap) / 4) * 16 / 9)));
      root.setAttribute('data-reel-title', 'below');
    } else {
      // (P5: never so short that the planet's stage, under the HUD, drops below its 80 px floor: a 360x640 phone)
      var band = Math.round(Math.max(H * (mode === 'phone' ? BAND_PHONE : BAND_TALL), L.hudH + L.hudGap + 96));
      var zone = { x: gl, y: headB, w: Wd - gl - gr, h: band };
      L.zoneBand = zone;
      // r13 pass C: tall and phone, the planet moves inside the band from section to section (right, whole width,
      // left, small right, small left); the band itself stays, so no text ever scrolls under the 3D
      var part = function (fx, fw) { return { x: Math.round(zone.x + zone.w * fx), y: zone.y, w: Math.round(zone.w * fw), h: zone.h }; };
      L.bandZones = { films: part(0.38, 0.62), tinyworld: zone, workflow: part(0, 0.62), bwgu: part(0.5, 0.5), about: part(0, 0.5), contact: zone };
      secs.forEach(function (s) { s.el.style.removeProperty('--col-w'); s.el.style.removeProperty('--col-x'); s.el.style.removeProperty('--lead'); s.el.style.removeProperty('--lead-first'); });
      L.clipTop = headB + band + 4;
      L.viewH = H - L.clipTop;
      L.colW = Wd - gl - gr;
      setVar('--col-w', px(L.colW));
      setVar('--lead', px(L.viewH * LEAD_TALL));
      setVar('--lead-first', px(L.viewH * 0.5));
      // a dived section gets the room for its roll and its whole dive after the text before it has mostly gone,
      // so the dive ends as its heading reaches the reading line (see measure)
      // (P5: exactly the room measure() needs: the dive starts as the last text above passes 0.75 of the panel)
      var leadDive = Math.max(L.viewH * LEAD_TALL, H * DIVE_SPAN + 96 - L.viewH * 0.75);
      // (P6: the ads section, right after the hero, dives too)
      secs.forEach(function (s, i) { if (i >= 1 && s.dives) s.el.style.setProperty('--lead', px(leadDive)); });
      setVar('--clip-top', px(L.clipTop));
      L.anchorTop = L.clipTop + 48;
      setVar('--anchor-top', px(L.anchorTop));
      setVar('--view-h', px(L.viewH));
      setVar('--hero-w', '100%');
      setVar('--hero-top', px(headB + clamp(H * 0.016, 12, 28)));
      root.style.removeProperty('--step-mega');
      setVar('--step-mega', px(Math.min(Wd * 0.27, (H - L.clipTop) * 0.3, 260)));
      setVar('--reel-h', px(L.viewH * 0.74));
      root.setAttribute('data-reel-title', 'below');
    }
    L.heroMove = H * HERO_MOVE;
    fitHeads();
    sizeWork();
    sizeStrip();
    nameLayout();
    heroZone();
    heroWords();
    sizeKm();
    measure();
    fitGaps();
    collectBig();
    dirty = true;
    // r13 pass D: the lead-ins are taken off and put back above; at the bottom of the page the browser clamped the
    // scroll while they were off (a run readout caption that wraps lays the page out again there): put it back
    if (Math.abs(window.scrollY - keepY) > 1 && keepY <= document.documentElement.scrollHeight - H) window.scrollTo(0, keepY);
  }

  // G1: the sections are short now. Wide, a dived section's move (pull back out of the last place, roll, dive in)
  // can need more scroll than the text before it gives, so its dive would end after its heading has passed the
  // reading line. Give that section just enough extra lead-in that the dive ends as its heading arrives.
  // r13 pass B: two sections whose stages stand on opposite sides: the planet crosses the window only while no text is
  // in it, so the gap between A's last text and B's first is a window height plus the move (SWAP_MOVE)
  // r13 pass D: every hand-off is one calm screen. Between A's last words leaving the window and B's first words
  // coming in there is CLEAR of a window height of scroll with no words on screen at all: the planet rolls and swings
  // to B's side, B's colour opens as a circle out of the planet, and the km figure sits huge beside it. Every gap is
  // made at least that long (B's lead-in grows); nothing else moves.
  var CLEAR = 0.45;
  var HERO_SINK = 0.28;  // wide: the name and his face have sunk (heroExit) after this much scroll
  var HERO_SINK_T = 0.11; // tall and phone
  function fitGaps() {
    var H = L.H, wide = L.mode === 'wide', extra = [], any = false;
    for (var i = 1; i < N; i++) {
      var A = secs[i - 1], B = secs[i], need, gap;
      if (i === 1) { need = H * (1 + CLEAR) + (wide ? L.heroHold : 0) + H * 0.05; gap = B.top - L.heroInk; }
      else { need = (wide ? H : H - L.clipTop) + H * CLEAR; gap = B.top - A.ink; }
      extra[i] = Math.max(0, Math.ceil(need - gap));
      if (extra[i] > 0) any = true;
    }
    if (!any) return;
    for (var j = 1; j < N; j++) {
      if (!(extra[j] > 0)) continue;
      var s = secs[j], cs = parseFloat(getComputedStyle(s.el).paddingTop) || 0;
      s.el.style.setProperty(wide && j === 1 ? '--lead-first' : '--lead', px(cs + extra[j]));
    }
    measure();
  }
  // the hero's words (headline, bio, buttons, the work strip): their lowest line and their right edge, in hero
  // coordinates (wide: the pinned frame's own; tall and phone: the page's)
  function heroWords() {
    var b = 0, r = 0;
    [headline, heroBio, heroBtn, heroFigs, heroLow() === heroWork ? heroWork : null].forEach(function (el) {
      var q = el && el.offsetParent !== null ? heroRect(el) : null;
      if (q && q.h > 0) { b = Math.max(b, q.y + q.h); r = Math.max(r, q.x + q.w); }
    });
    L.heroInk = b || L.H * 0.5; L.heroRight = r || L.W * 0.5;
  }

  // ---------- P5: every section's h2 is its headline, two lines at most ----------
  // Head size first; only a heading that would take a third line at this width steps down (4% at a time, never
  // below 62% of head size). The hero headline follows the same rule.
  function fitHeads() {
    $$('.poster-h, .hero .headline').forEach(function (h) {
      h.style.setProperty('--h-fit', '');
      var fs = parseFloat(getComputedStyle(h).fontSize) || 40, k = 1;
      var lines = function () { var lh = parseFloat(getComputedStyle(h).lineHeight) || fs * 0.95; return Math.round(h.offsetHeight / lh); };
      while (lines() > 2 && k > 0.62) { k -= 0.04; h.style.setProperty('--h-fit', (fs * k).toFixed(1) + 'px'); }
      h._fit = +k.toFixed(2);
    });
    // the big figures: never wider than the column they stand in (a phone, a narrow tall pane)
    $$('.stat dt, .hero-fig dt').forEach(function (dt) {
      dt.style.fontSize = '';
      var box = dt.closest('.col-in, .hero-inner'); if (!box) return;
      var room = box.getBoundingClientRect().right - dt.getBoundingClientRect().left - 2;
      fitTextWidth(dt, room, 'font-size');
    });
  }
  function fitTextWidth(el, room, property) {
    var range = document.createRange(); range.selectNodeContents(el);
    var width = range.getBoundingClientRect().width;
    if (room > 0 && width > room) {
      var fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.setProperty(property, (fs * room / width).toFixed(1) + 'px');
    }
  }
  // ---------- P5: the work is the poster. Its sizes come from the window, so each first screen is full ----------
  // qa-r5 6: a caption set beside its big figure goes under it when the column leaves it under 9em (it was squeezed
  // to one word a line on a tablet turned to wide)
  function stackIfSqueezed(row) {
    if (!row) return;
    row.classList.remove('is-stacked');
    var dd = $('dd', row); if (!dd) return;
    if (dd.clientWidth < 9 * (parseFloat(getComputedStyle(dd).fontSize) || 18)) row.classList.add('is-stacked');
  }
  function headH(sel) { var h = $(sel); return h ? h.offsetHeight : 0; }
  // Round 11 pass 2: one shared one-line size for the work sections' headlines (ads, tinyworld, Before We Grow Up;
  // the AI pipeline's uses it too and may wrap): the largest size, 0.72 of head size at most, at which each of the
  // three fits its own column on one line. Phone keeps its normal two-line headlines.
  function workHead() {
    if (L.mode === 'phone') { root.style.removeProperty('--work-head'); L.workHead = 0; return; }
    var heads = ['#ads-h', '#tw-h', '#bw-h'].map(function (s) { return $(s); }).filter(Boolean);
    if (!heads.length) return;
    setVar('--work-head', 'calc(var(--step-head) * 0.72)');
    var cap = parseFloat(getComputedStyle(heads[0]).fontSize) || 60, fs = cap;
    heads.forEach(function (h) {
      var room = (h.parentElement ? h.parentElement.clientWidth : L.colW) - 2, w = inkWidth(h);
      if (room > 0 && w > room) fs = Math.min(fs, cap * room / w);
    });
    fs = Math.floor(fs * 10) / 10;
    setVar('--work-head', fs.toFixed(1) + 'px');
    L.workHead = fs;
  }
  // the lowest layout box bottom of a list of elements (document coordinates)
  function lowest(els) { var b = 0; els.forEach(function (el) { if (el && el.offsetParent !== null) b = Math.max(b, docRect(el).bottom); }); return b; }
  // r13 pass B: every screen has its own layout. Sizes come from the window; nothing is forced to a screen of its own
  // with empty space under it. Wide only (tall and phone stack at the column width, sized by CSS).
  function sizeWork() {
    var H = L.H, wide = L.mode === 'wide', vh = L.viewH;
    var top = wide ? L.anchorTop : L.clipTop + 48, room = H - top - L.gb;
    workHead();
    ['--adf-h', '--ads-h', '--reel-h', '--bw-h', '--about-h'].forEach(function (v) { if (!wide) root.style.removeProperty(v); });
    var pl = $('.pipeline');
    if (pl) pl.classList.remove('pipeline--2x2');
    if (!wide) {
      setVar('--bw-h', px(vh * 0.5));
      setVar('--about-h', px(vh * (L.mode === 'phone' ? 0.55 : 0.5)));
      return;
    }
    var col = colW('films');
    // Ads: the 4:5 pair, each ad as big as it can be: at most 0.45 of the window's width, and short enough that an
    // ad with its date line fits under the header when it is scrolled to
    var pair = $('.ad-pair');
    if (pair) {
      var adGap = parseFloat(getComputedStyle(pair).columnGap) || L.gap;
      setVar('--adf-h', '400px');
      var tile = $('.ad-pair > li'), clip = $('.ad-pair .clip');
      var capH = tile && clip ? tile.offsetHeight - clip.offsetHeight : 120;
      var adf = Math.floor(Math.min(L.W * 0.45 / 0.8, (col - adGap) / 1.6, room - capH - 8));
      setVar('--adf-h', px(adf));
    }
    // the two 9:16 ads with their words beside them: as tall as a screen allows with their captions under them
    var more = $('.ad-more');
    if (more) {
      setVar('--ads-h', '400px');
      var t2 = $('.ad-more > li'), c2 = $('.ad-more .clip');
      var cap2 = t2 && c2 ? t2.offsetHeight - c2.offsetHeight : 100;
      setVar('--ads-h', px(Math.floor(Math.min(room - cap2 - 8, (col * 0.62) / 1.125))));
    }
    // tinyworld: a wall of the four reel covers across the whole width, as tall as that allows, shortened only if a
    // reel and its title would not fit a screen
    var reelsEl = $('.reels');
    col = colW('tinyworld');
    if (reelsEl) {
      var rg = parseFloat(getComputedStyle(reelsEl).columnGap) || L.gap;
      reelsEl.classList.remove('reels--small');
      var reelH = Math.floor((col - 3 * rg) / 4 * 16 / 9);
      setVar('--reel-h', px(reelH));
      var rt = $('.reel-t'), rtH = rt ? rt.offsetHeight + 12 : 60;
      reelH = Math.floor(Math.min(reelH, room - rtH));
      setVar('--reel-h', px(reelH));
    }
    // the AI pipeline: four columns when every step word fits its column at head size, else two by two
    if (pl) {
      var cw = (pl.clientWidth - 3 * L.gap) / 4;
      var tooWide = $$('.pl-w', pl).some(function (w) { return inkWidth(w) > cw - 4; });
      if (tooWide) pl.classList.add('pipeline--2x2');
    }
    // Before We Grow Up: the Instagram picture across the whole width, shortened only to fit a screen
    col = colW('bwgu');
    var bwPic = $('.bwgu-pic');
    if (bwPic) setVar('--bw-h', px(Math.floor(Math.min(col * 709 / 1600, room * 0.86))));
    // About: the portrait as tall as a screen allows beside the words
    var abHead = $('#about-h');
    setVar('--about-h', px(Math.floor(room - (abHead ? abHead.offsetHeight : 0) - clamp(H * 0.044, 28, 64))));
  }

  // ---------- P5: his photo in the hero ----------
  // tedd-cut.png is a cut-out bust. His face (the skin from under the fringe to the chin) is this share of the
  // picture, measured from the file; the overlap test uses the same numbers.
  var FACE = { x0: 0.29, x1: 0.70, y0: 0.24, y1: 0.50 }, PHOTO_R = 741 / 632;
  var photoEl = $('.hero-photo');
  // Wide: he stands in the right half of the first screen, bottom on the window's bottom, 0.62 of its height,
  // behind his name (the name is drawn over his chest), the planet beside him on the right.
  // Tall and phone: the same, in the room between the buttons and the name (his face at least 96 px wide on a
  // phone); the picture ends at the name's baseline, so he stands behind it.
  function heroPhoto(atEdge) {
    L.photo = null;
    if (!photoEl || !L.name) return;
    var Wd = L.W, H = L.H, g = clamp(Wd * 0.012, 12, 28), pw, ph, x, y, boxH;
    if (L.mode === 'wide') {
      ph = Math.round(H * 0.62); pw = Math.round(ph / PHOTO_R);
      // placement C (chosen from three, see the P5 report): his left edge just right of the window's middle, so
      // his face sits beside the stats and the eye goes headline, face, stats, button; the planet stands at the
      // right beside him, out of the reading line
      x = atEdge ? Wd - L.gr - pw : Math.min(Math.round(Wd * 0.52), Wd - L.gr - pw); y = H - ph; boxH = ph;
    } else {
      var tb = heroRect(heroLow()), textB = tb ? tb.y + tb.h : H * 0.5;
      pw = L.mode === 'phone' ? clamp(Wd * 0.64, 236, 270) : Math.min(Wd * 0.42, H * 0.36 / PHOTO_R);
      var room = (L.name.capTop - g) - (textB + g);
      pw = Math.min(pw, room / ((FACE.y1 - FACE.y0) * PHOTO_R));
      ph = pw * PHOTO_R;
      x = Wd - L.gr - pw;
      y = L.name.capTop - g - FACE.y1 * ph;
      boxH = L.name.capTop + L.name.capH + L.name.fs * 0.04 - y;
    }
    L.photo = { edge: !!atEdge, x: x, y: y, w: pw, h: ph, boxH: boxH, face: { x: x + FACE.x0 * pw, y: y + FACE.y0 * ph, w: (FACE.x1 - FACE.x0) * pw, h: (FACE.y1 - FACE.y0) * ph } };
    photoEl.style.setProperty('--hp-w', px(pw)); photoEl.style.setProperty('--hp-h', px(boxH));
    photoEl.style.setProperty('--hp-x', px(x)); photoEl.style.setProperty('--hp-y', px(y));
  }

  // ---------- the hero name: one line across the bottom (wide) or TEDD over LAI (tall, phone) ----------
  // Its size comes from the window (min(19vw, 36svh) wide; about 27vw stacked), and it is placed so its cap tops
  // sit at 0.70 of the window height. The planet then stands on it (heroZone).
  var capRatio = 0;
  function measureCap() {
    try {
      var c = document.createElement('canvas').getContext('2d');
      c.font = '900 100px Archivo';
      var m = c.measureText('TEDLAI');
      if (m.actualBoundingBoxAscent > 40 && m.actualBoundingBoxAscent < 90) return m.actualBoundingBoxAscent / 100;
    } catch (e) { /* use the usual cap height */ }
    return 0.72;
  }
  function inkWidth(el) { var r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; }
  function nameLayout() {
    if (!nameEl) return;
    var wide = L.mode === 'wide', Wd = L.W, H = L.H;
    if (!capRatio || (document.fonts && document.fonts.status === 'loaded')) capRatio = measureCap();
    // (pass 3: measured with every letter in its place; paintChrome sinks them again)
    nameChars.forEach(function (c) { c.style.translate = ''; c._mtranslate = ''; });
    nameEl._o = null; if (photoEl) photoEl._o = null;
    nameEl.style.setProperty('--name-size', '100px');
    // round 4: TEDD LAI on one line at every shape (stacked, the two words read as two things with a hole between)
    var w100 = inkWidth(nameEl);
    var room = Wd - L.gl - L.gr;
    var fs = wide ? Math.min(Wd * 0.19, H * 0.36, room * 0.985 / Math.max(1, w100) * 100)
                  : Math.min(H * 0.2, room * 0.985 / Math.max(1, w100) * 100);
    // P5: wide, the cap line is at 0.71 of the height, or lower if the hero's words (now three figures) reach
    // further down; then the name gets smaller so it still ends above the window's bottom margin
    var capWide = Math.round(H * 0.71);
    if (wide) {
      var tbw = heroRect(heroLow()), gw = clamp(Wd * 0.012, 12, 28);
      if (tbw) capWide = Math.max(capWide, Math.round(tbw.y + tbw.h + gw));
      fs = Math.min(fs, (H - L.gb - capWide) / (capRatio || 0.72));
    }
    fs = Math.floor(fs);
    nameEl.style.setProperty('--name-size', fs + 'px');
    setVar('--display', fs + 'px');   // r13 pass B: the one display size (the name, 30+, 800,000+, Let's talk.)
    setVar('--name-top', '0px');
    var nr = nameEl.getBoundingClientRect(), br = nameBase.getBoundingClientRect();
    var baseOff = br.top - nr.top, capH = capRatio * fs;
    // pass 3: the name is masked a hair under its baseline, so a sinking letter disappears into the line
    nameEl.style.setProperty('--name-cut', (nameEl.offsetHeight - baseOff - 1).toFixed(1) + 'px');
    // (P5: 0.71 on wide, so his face, which ends at 0.69 of the height, stays clear of the letters)
    var capTop = wide ? capWide : Math.round(H * 0.70);
    if (!wide) {
      // tall and phone: the words first (headline, bio, button, all above the fold), the name along the bottom of
      // the first screen, the planet standing on it in the room between
      setVar('--bio-gap', '0px');
      var tb = heroRect(heroLow()), textB = tb ? tb.y + tb.h : H * 0.5;
      var nameH = nameEl.offsetHeight;
      // at least the room the smallest planet needs to stand on it (a short phone may push the name below the fold)
      var roomMin = 1.5 * Wd * 0.3 + 2 * clamp(Wd * 0.012, 12, 28);
      capTop = Math.round(Math.max(textB + Math.max(H * 0.12, roomMin), H - L.gb - nameH) + (baseOff - capH));
    }
    var top = capTop - (baseOff - capH);
    setVar('--name-top', px(top));
    // hero coordinates: from the hero section's top (the page's top), the same as the window's at scroll 0
    L.name = { fs: fs, capH: capH, capTop: capTop, top: top, bottom: top + nameEl.offsetHeight };
    setVar('--name-bottom', px(L.name.bottom));
    // the letters, each with the cap top of its own line
    var first = null;
    L.name.chars = nameChars.map(function (c) {
      var r = c.getBoundingClientRect();
      if (first === null) first = r.top;
      return { x0: r.left, x1: r.right, cap: capTop + (r.top - first) };
    });
    heroPhoto();
  }

  // ---------- the hero's stage: the planet stands on the name ----------
  // The biggest planet (up to 0.48 of the height wide, 0.66 of the width stacked) whose 3D, as world.js draws it
  // (CAL), touches no text but the name, covers the top of at most two letters by at most 20% of their cap
  // height (aimed at 12%), keeps the stage clear of every filled control, and stays near 0.60 of the width.
  // a hero element's box in hero coordinates (the sticky frame's own top in the wide layout)
  function heroRect(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var ref = (L.mode === 'wide' && heroFrame && heroFrame.contains(el)) ? heroFrame.getBoundingClientRect().top : secs[0].el.getBoundingClientRect().top;
    return { x: r.left, y: r.top - ref, w: r.width, h: r.height };
  }
  function hits(a, b, g) { return a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g; }
  function heroZone() {
    // P5: first with him beside the stats and the planet at the right; if the planet cannot stand on the name
    // there, with him at the right edge and the planet on the name to his left
    fitHero();
    if (L.heroFitOk === false && L.mode === 'wide' && L.photo && !L.photo.edge) { heroPhoto(true); fitHero(); }
  }
  function fitHero() {
    if (!L.name || !nameChars.length) return;
    var Wd = L.W, H = L.H, wide = L.mode === 'wide';
    var g = clamp(Wd * 0.012, 12, 28);
    var text = [heroRect(headline), heroRect(heroBtn), heroRect(heroBio), heroRect(heroFigs), heroLow() === heroWork ? heroRect(heroWork) : null].filter(Boolean);
    // the header's own words (its background is see-through while the hero is up); the Quick view button is filled
    var hd = head ? { x: Wd - head.offsetWidth, y: 0, w: head.offsetWidth, h: L.headB } : null;
    var solid = $$('.hero-actions .button').map(heroRect), qv = $('#qv-open');
    if (qv) { var qr = qv.getBoundingClientRect(); solid.push({ x: qr.left, y: qr.top - (head ? head.getBoundingClientRect().top : 0), w: qr.width, h: qr.height }); }
    if (wide && head) text.push(hd);
    else if (head) text.push({ x: 0, y: 0, w: Wd, h: L.headB });
    // wide: the run readout sits in the window's corner under the header while the hero is up
    if (wide && hudR) text.push({ x: Wd - L.gr - hudR.offsetWidth, y: L.headB + L.hudGap, w: hudR.offsetWidth, h: hudR.offsetHeight });
    // P5: his face is kept clear of the 3D too (the planet may stand in front of his shoulder, never his face)
    // (a wider berth sideways: the planet's drawn box grows and shrinks a little as its clouds drift)
    // (round 8: wider on tall and phone: with the shorter hero the planet stands bigger beside him, and a drifting
    // cloud reached 5 px into his face box at 958x1265)
    if (L.photo) { var fcw = Wd * (wide ? 0.03 : 0.05); text.push({ x: L.photo.face.x - fcw, y: L.photo.face.y, w: L.photo.face.w + 2 * fcw, h: L.photo.face.h }); }
    text = text.filter(Boolean);
    var capTop = L.name.capTop, capH = L.name.capH;
    var chars = L.name.chars;
    var pref = wide ? (L.photo && !L.photo.edge ? Wd * 0.84 : Wd * 0.6) : Wd / 2;
    var Dmax = wide ? H * 0.48 : Wd * 0.66, Dmin = wide ? H * 0.22 : Wd * 0.3, Dstep = Math.max(2, H * 0.004);
    var cxStep = Math.max(2, Wd * 0.004);
    // how deep the planet sits on the letters, in cap heights: 8% first, never more than about 10% (round 4)
    // (planned a little shallower than that: world.js draws the disc a few % of a cap lower than CAL predicts)
    var deltas = [0.04, 0.03, 0.06, 0.02];
    var best = null;
    for (var D = Dmax; D >= Dmin && !best; D -= Dstep) {
      var lo = L.gl + D * 0.65, hi = Wd - L.gr - D * 0.65;
      if (lo > hi) continue;
      for (var di = 0; di < deltas.length && !best; di++) {
        for (var k = 0; !best; k++) {
          var off = Math.ceil(k / 2) * cxStep * (k % 2 ? 1 : -1), cx = pref + off;
          if (Math.abs(off) > Wd * 0.2) break;
          if (cx < lo || cx > hi) continue;
          var cy = capTop + deltas[di] * capH - D / 2;
          if (cy + CAL.kb * D > capTop + 0.11 * capH) continue;
          var B = { x: cx - D / 2, y: cy - CAL.kt * D, w: D, h: (CAL.kt + CAL.kb) * D };
          if (B.y < 2) continue;
          // letters touched: at least one as planned, and still no more than two if world.js draws the disc a
          // few pixels bigger or lower than planned (its spring, its own rounding)
          var n = 0, nWide = 0, rW = D / 2 + 6;
          for (var c = 0; c < chars.length; c++) {
            var ch = chars[c], cap = ch.cap, x = clamp(cx, ch.x0, ch.x1), dx = Math.abs(x - cx);
            if (dx < D / 2 && cy + Math.sqrt(D * D / 4 - dx * dx) > cap + 1) n++;
            if (dx < rW && cy + 4 + Math.sqrt(rW * rW - dx * dx) - 6 > cap) nWide++;
          }
          if (n < 1 || nWide > 2) continue;
          var bad = false;
          for (var t = 0; t < text.length && !bad; t++) if (hits(B, text[t], g)) bad = true;
          if (bad) continue;
          var sh = D / CAL.a, sy = cy - CAL.b * sh;
          if (sy < 0 || sy + sh > H) continue;
          var ws = [1.32 * D, 1.27 * D];
          for (var wi = 0; wi < ws.length && !best; wi++) {
            var sw = ws[wi], sx = cx - sw / 2;
            if (sx < 0 || sx + sw > Wd) continue;
            var S0 = { x: sx, y: sy, w: sw, h: sh }, ok = true;
            for (var q = 0; q < solid.length && ok; q++) if (solid[q] && hits(S0, solid[q], 2)) ok = false;
            if (ok) best = { x: Math.round(sx), y: Math.round(sy), w: Math.round(sw), h: Math.round(sh), D: D, cx: cx, delta: deltas[di] };
          }
        }
      }
    }
    L.heroFitOk = !!best;
    if (!best) {
      // no room for the planet on the name (an odd window): the space between the text and the name
      var top = wide ? L.headB + 4 : (text[1] ? text[1].y + text[1].h + g : L.headB);
      var bot = capTop - g;
      best = wide ? { x: Math.round(Wd * 0.5), y: Math.round(top), w: Math.round(Wd * 0.5 - L.gr), h: Math.round(Math.max(120, bot - top)) }
                  : { x: L.gl, y: Math.round(top), w: Wd - L.gl - L.gr, h: Math.round(Math.max(120, bot - top)) };
      // (P5) and never over his face: the part of that space to the side of it with more room
      var fc = L.photo && L.photo.face;
      if (fc && hits(best, fc, g)) {
        var lw = fc.x - g - best.x, rw = best.x + best.w - (fc.x + fc.w + g);
        if (lw >= rw) best.w = Math.max(60, Math.round(lw)); else { best.x = Math.round(fc.x + fc.w + g); best.w = Math.max(60, Math.round(rw)); }
        if (!wide && best.y + best.h > fc.y - g && Math.max(lw, rw) < 100) best.h = Math.max(60, Math.round(fc.y - g - best.y));
      }
    }
    L.heroFit = best;
    L.zoneHero = { x: best.x, y: best.y, w: best.w, h: best.h };
    L.stageHero = L.zoneHero;
  }

  // world.js may draw the planet a little differently from what CAL says (it is still being worked on): once the
  // hero has settled, read the real disc and 3D box and fit the hero again if they differ.
  var introDone = false, calT = 0;
  window.addEventListener('world:intro-done', function () { setTimeout(function () { introDone = true; }, 600); });
  window.addEventListener('world:ready', function () { setTimeout(function () { introDone = true; }, 4000); });
  function calibrate() {
    if (!introDone || !worldLive() || S.cur !== 0 || S.y > 2 || !L.zoneHero) return;
    var d = call('discRect'), b = call('bounds');
    if (!d || !b || !b.stage || !d.w) return;
    var st = b.stage, mine = S.stage;
    if (!mine || Math.abs(st.x - mine.x) > 1 || Math.abs(st.y - mine.y) > 1 || Math.abs(st.w - mine.w) > 1 || Math.abs(st.h - mine.h) > 1) return;
    var cy = d.y + d.h / 2;
    var nc = { a: d.h / st.h, b: (cy - st.y) / st.h, kt: Math.max(CAL.kt, (cy - b.y) / d.h), kb: Math.max(0.5, (b.y + b.h - cy) / d.h) };
    var far = Math.abs(nc.a - CAL.a) / CAL.a > 0.015 || Math.abs(nc.b - CAL.b) > 0.01 || nc.kt - CAL.kt > 0.015 || nc.kb - CAL.kb > 0.01;
    if (!far) return;
    CAL = nc;
    if (L.mode === 'wide') { zonesWide(); measure(); }
    heroZone(); lastSent = {}; dirty = true;
  }

  // section positions in document coordinates, and the scroll ranges of each move between two sections
  var T = [], kmAt = { about: 0 }, footTop = 0, maxScroll = 0, endAt = 1e9, endName = 1e9;
  var END_SPAN = 0.3; // window heights of scroll for the end card's pull-back
  // layout position (ignores transforms, so an entrance or a drift in progress never skews it)
  function docRect(el) { var y = 0, e = el; while (e) { y += e.offsetTop; e = e.offsetParent; } var h = el.offsetHeight; return { top: y, bottom: y + h, h: h }; }
  var measureN = 0;
  function measure() {
    var H = L.H;
    measureN++;
    // No text is pinned for the camera's sake any more (text first, 21 Nov): every section scrolls like a page.
    secs.forEach(function (s) {
      var r = docRect(s.col); s.top = r.top; s.bottom = r.bottom; s.secTop = docRect(s.el).top; s.textBottom = r.bottom - (parseFloat(getComputedStyle(s.col).paddingBottom) || 0);
      // r13 pass D: the section's last line of words or work (the column can be taller than its content)
      var ci = $('.col-in', s.el); s.ink = ci ? Math.min(s.textBottom, docRect(ci).bottom) : s.textBottom;
    });
    footTop = foot ? docRect(foot).top : 1e9;
    maxScroll = Math.max(0, document.documentElement.scrollHeight - H);
    T = [];
    var wide = L.mode === 'wide';
    var p = L.viewH;
    for (var i = 1; i < N; i++) {
      var A = secs[i - 1], B = secs[i], gone, enter, pb;
      if (wide) {
        // Wide, one move between two sections, scrubbed by scroll. Phases (scroll y):
        //   pb0..pb1  pull back out of A (only if A was dived)
        //   r0..r1    the planet rolls B up under YOU (the colour field grows from the planet)
        //   m0..m1    the stage eases from A's size to B's (always on the right)
        //   d0..d1    the dive into B (only tinyworld and Video ads)
        // A stage that gets SMALLER moves before B's wider text comes up from the bottom; a stage that gets
        // BIGGER waits until A's wider text has gone above the new stage's top, so 3D never crosses text.
        var zA = zoneOf(A), zB = zoneOf(B), t, DS = H * DIVE_SPAN;
        enter = B.top - H;
        // The stage moves in two parts (round 4). Its left edge (x, w: ml0..ml1) is the only part that can meet a
        // text column, so it waits for the text; its top and height (m0..m1) only ever move on the right, beside
        // the text, so they can move with the dive while text is still in view.
        if (A.stop === 'hero') {
          // r13 pass D, the start line: the name and his face sink while the words stay pinned (0..p0); then the
          // camera pushes in on the planet (p0..p1: it grows from its corner into the right half, the words scrolling
          // away on the left) and it starts to roll, the START arch passing over YOU as he runs; once the words have
          // gone (c0) the ink of the ads opens out of it, the km figure grows huge beside it, and as the ads heading
          // comes up (c1..g3) the planet settles into the ads stage and the figure shrinks back into the HUD
          var p0 = H * HERO_SINK, p1 = p0 + H * 0.45, c0h = L.heroHold + L.heroInk, c1h = B.top - H, g3h = c1h + H * 0.32;
          t = { hero: true, p0: p0, p1: p1, c0: c0h, c1: c1h, g3: g3h, r0: p0 + H * 0.02, r1: c1h, m0: p0, m1: g3h, ml0: p0, ml1: g3h };
          t.d0 = g3h; t.d1 = B.dives ? Math.max(g3h + H * 0.3, B.top - L.anchorTop) : g3h;
          t.kmEnd = Math.max(t.d1, B.top - L.anchorTop);
        } else {
          // r13 pass D: every other hand-off is a gap ride (pass C), now with its calm screen. g0: the gap's top
          // enters at the bottom; c0: A's last words leave at the top; c1: B's first words come in at the bottom;
          // g3: the planet has settled into B's stage. A dived A pulls back as the gap arrives (g0..gp)
          // (a dived A stays arrived until its last words are halfway up the window, then pulls back in its own stage)
          var g0 = A.ink - H, c0 = A.ink, c1 = B.top - H, g3 = c1 + H * 0.32, gq = Math.max(g0, c0 - H * 0.55), gp = gq + H * 0.3;
          t = { swap: true, g0: g0, c0: c0, c1: c1, g3: g3, m0: g0, m1: g3, ml0: g0, ml1: g3, r0: A.dives ? gp : g0 + H * 0.15, r1: c1 };
          if (A.dives) { t.pb0 = gq; t.pb1 = gp; }
          t.d0 = g3; t.d1 = B.dives ? Math.max(g3 + H * 0.3, B.top - L.anchorTop) : g3;
        }
        if (t.c0 !== undefined) {
          // the wipe: from 0.2 of a window before A's words have gone (the circle is kept clear of them) to most of
          // the way through the calm screen; the km figure grows once the circle has filled the window
          t.w0 = t.c0 - H * 0.2; t.w1 = Math.min(t.c1 - H * 0.04, t.c0 + H * CLEAR * 0.6);
          t.kb0 = t.w1 - H * 0.04; t.kb1 = Math.min(t.c1, t.w1 + H * 0.14);
        }
        if (t.ml0 === undefined) { t.ml0 = t.m0; t.ml1 = t.m1; }
        var start = Math.min(t.r0, t.m0, t.ml0, t.pb0 === undefined ? 1e9 : t.pb0);
        // never before the last move has finished
        var prevEnd = i > 1 && T[i - 1] ? T[i - 1].t1 : 0;
        if (start < prevEnd) { var sh = prevEnd - start; ['r0', 'r1', 'm0', 'm1', 'ml0', 'ml1', 'd0', 'd1', 'pb0', 'pb1', 'g0', 'c0', 'c1', 'g3', 'w0', 'w1', 'kb0', 'kb1', 'kmEnd'].forEach(function (k) { if (t[k] !== undefined) t[k] += sh; }); start += sh; }
        t.t0 = start; t.t1 = Math.max(t.r1, t.m1, t.d1, t.ml1); t.e = enter;
        T[i] = t;
        continue;
      }
      // tall and phone: one band for every section. r13 pass D: every move of the band's 3D happens around the calm
      // screen, short, so a half-dived place (the planet's curve cut by the band's edge) is only seen briefly: pull
      // back out of A over 0.3 of a window as A's last words go under the band (..c0), roll on the calm screen
      // (c0..c1), dive into B over 0.3 of a window as B's first words come in (c1..). A jump to B's heading still
      // lands arrived (its heading is further on).
      var anchorY = B.top - L.anchorTop, DS2 = H * 0.3;
      var tt = { c0: A.ink - L.clipTop, c1: B.top - H };
      var prevT1 = i > 1 && T[i - 1] ? T[i - 1].t1 : 0;
      tt.t0 = Math.max(prevT1, tt.c0 - (A.dives ? DS2 : 0));
      tt.L = Math.max(tt.t0 + 1, tt.c0);
      tt.en = Math.max(tt.L + 40, tt.c1 - H * 0.04);
      tt.t1 = B.dives ? Math.min(Math.max(tt.en + 40, anchorY), tt.en + DS2) : tt.en;
      tt.g3 = tt.c1 + p * 0.45;
      if (i === 1) {
        // the start line, tall and phone: the name and his face sink (0..p0), the planet grows out of its place
        // on the name into the room the words leave as they scroll up (p0..p1), the run starts; it settles into the
        // band as B's words come in (c1..g3), then dives
        var hp0 = H * HERO_SINK_T, hg3 = B.top - H + p * 0.45;
        tt = { hero: true, p0: hp0, p1: hp0 + H * 0.4, c0: L.heroInk, c1: B.top - H, g3: hg3, t0: hp0, L: hp0 + H * 0.02, en: hg3 };
        tt.t1 = B.dives ? Math.min(Math.max(hg3 + 40, anchorY), hg3 + DS2) : hg3;
        tt.kmEnd = Math.max(tt.t1, anchorY);
      }
      tt.w0 = tt.c0 - H * 0.1; tt.w1 = Math.min(tt.c1 - H * 0.04, tt.c0 + H * CLEAR * 0.6);
      tt.kb0 = tt.w1 - H * 0.04; tt.kb1 = Math.min(tt.c1, tt.w1 + H * 0.14);
      T[i] = tt;
    }
    // the end card: the camera pulls back out to the whole globe and has finished before the footer's name
    // comes into the window, so the name only ever appears under the whole globe (never under a dived place)
    // (the name is an SVG, which has no offsetTop: it starts at the footer's top padding)
    endName = foot ? Math.min(maxScroll, footTop + (parseFloat(getComputedStyle(foot).paddingTop) || 0) - H) : maxScroll;
    // tall and phone: how far Contact's heading would sit under the band at the very bottom of the page
    L.endNeed = L.mode === 'wide' ? 0 : Math.max(0, L.clipTop + 8 - (secs[N - 1].top - maxScroll));
    endAt = endName - H * END_SPAN;
    // the run: 0 km at the top, 42.195 km when Contact arrives (round 4: the finish is the contact, not About),
    // smooth in between
    var iC = secs.findIndex(function (s) { return s.stop === 'contact'; });
    kmAt.about = Math.min(maxScroll, iC > 0 && T[iC] ? T[iC].t1 : maxScroll);
    // the large text that fades out before the band's edge would slice it (tall and phone)
    big.forEach(function (b) { var r = docRect(b.el); b.top = r.top; b.h = r.h; });
    motionMeasure();
    dirty = true;
  }

  // text at 24px or more (the size the eye reads as a heading) fades before the band's edge reaches it
  var big = [];
  function collectBig() {
    big.forEach(function (b) { b.el.classList.remove('is-cut'); });
    big = [];
    if (L.mode === 'wide') return;
    // a figure and its caption (and a date and its line) go together: the group is the unit (round 4, J8)
    // (P6: a lesson's bold line and its sentence, and a pipeline step, are a unit too)
    var groups = $$('#page .stat, #page .hero-fig, #page .tests > li, #page .pipeline > li');
    groups.forEach(function (g) { big.push({ el: g, top: 0, h: 0, o: -1, live: false }); });
    $$('#page h2, #page h3, #page p, #page li, #page dt, #page dd, #page a, #page th, #page td, #page button > span').forEach(function (el) {
      if (el.closest('.name')) return;
      if (groups.some(function (g) { return g.contains(el); })) return;
      // headings fade whatever their size, so no heading is ever shown cut in half at the band's edge
      var heading = el.matches('h2, h3, .sub-h, dt');
      var direct = '';
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) direct += n.nodeValue;
      if (direct.trim().length < 3 && !heading) return;
      if (!heading && parseFloat(getComputedStyle(el).fontSize) < 24) return;
      big.push({ el: el, top: 0, h: 0, o: -1, live: !!el.closest('.col-in') }); // pinned text: read its real place each frame
    });
    big.forEach(function (b) { var r = docRect(b.el); b.top = r.top; b.h = r.h; });
  }

  // ---------- the episode state from scroll ----------
  var S = { cur: 0, from: 'hero', to: 'hero', roll: 1, dive: 0, fieldP: [], zone: null, stage: null, travel: 0 };
  function wideNow() { return L.mode === 'wide'; }
  function zoneOf(s) {
    if (L.mode !== 'wide') return (L.bandZones && L.bandZones[s.stop]) || L.zoneBand;
    if (s.stop === 'hero') return L.zoneHero || L.zoneComp;
    return (L.zones && L.zones[s.stop]) || L.zoneComp;
  }
  function ramp(y, a, b) { if (a === undefined) return 1; if (b <= a) return y >= b ? 1 : 0; return clamp((y - a) / (b - a), 0, 1); }
  var S_riding = false;   // r13 pass C: the planet is riding a gap between two sections (the HUD steps aside)
  // r13 pass D: the words on screen during hand-off i, as boxes in the window: A's block above (down to its last line,
  // gT) and B's below (from its first line, gB). Tall and phone: text only shows under the clip line (line).
  function colBoxOf(s) {
    if (L.mode !== 'wide') return { x0: L.gl, x1: L.W - L.gr };
    var c = colOf(s); return { x0: c.x, x1: c.x + c.w };
  }
  function handWords(i, y, line) {
    var A = secs[i - 1], B = secs[i], wide = L.mode === 'wide', a, b;
    if (i === 1) {
      var off = wide ? Math.max(0, y - (L.heroHold || 0)) : y;
      a = { x0: L.gl, x1: wide ? L.heroRight : L.W - L.gr, y0: wide ? -1e9 : line, y1: L.heroInk - off };
    } else {
      var ca = colBoxOf(A); a = { x0: ca.x0, x1: ca.x1, y0: wide ? -1e9 : line, y1: A.ink - y };
    }
    var cb = colBoxOf(B); b = { x0: cb.x0, x1: cb.x1, y0: Math.max(line, B.top - y), y1: 1e9 };
    if (a.y1 <= line) a = null;
    if (B.top - y >= L.H) b = null;
    return { a: a, b: b, gT: a ? a.y1 : line, gB: b ? b.y0 : L.H };
  }
  // a stage rectangle never reaches into a block of words beside it: it gets shorter instead
  function keepClear(r, w, pad) {
    var x0 = r.x, x1 = r.x + r.w, top = r.y, bot = r.y + r.h;
    if (w.a && x1 > w.a.x0 - pad && x0 < w.a.x1 + pad) top = Math.max(top, w.a.y1 + pad);
    if (w.b && x1 > w.b.x0 - pad && x0 < w.b.x1 + pad) bot = Math.min(bot, w.b.y0 - pad);
    return { x: r.x, y: top, w: r.w, h: Math.max(60, bot - top) };
  }
  function distBox(x, y, b) { var dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1); return Math.sqrt(dx * dx + dy * dy); }
  // the colour circle at eased progress e: centred on the planet's disc as drawn (the stage's middle with no 3D),
  // from just inside the disc to the window's farthest corner, never touching a word on screen
  function circleFor(e, w, st) {
    var d = worldLive() ? call('discRect') : null, cx, cy, r0;
    if (d && d.w > 4) { cx = d.x + d.w / 2; cy = d.y + d.h / 2; r0 = d.w / 2; }
    else { cx = st.x + st.w / 2; cy = st.y + st.h * CAL.b; r0 = Math.min(st.w, st.h) * 0.3; }
    var Wd = L.W, H = L.H;
    var R = Math.sqrt(Math.max(cx * cx, (Wd - cx) * (Wd - cx)) + Math.max(cy * cy, (H - cy) * (H - cy))) + 2;
    var r = mix(r0 * 0.9, R, e), pad = 16;
    if (w && w.a) r = Math.min(r, distBox(cx, cy, w.a) - pad);
    if (w && w.b) r = Math.min(r, distBox(cx, cy, w.b) - pad);
    return { cx: cx, cy: cy, r: Math.max(0, r), R: R };
  }
  function compute(y) {
    S_riding = false;
    var H = L.H, wide = wideNow(), red = reduced();
    var cur = 0, from = 'hero', to = 'hero', roll = 1, dive = 0, fieldP = [], zone = zoneOf(secs[0]), phase = 'arrived', heroK = 1;
    var run = 0, words = null, kroom = null, heroP = 1, direct = false, heroChain = false, heroSnap = false, line = L.clipTop || 0;
    var pad = clamp(H * 0.02, 10, 24);
    for (var i = 1; i < N; i++) {
      var t = T[i]; if (!t) continue;
      var A = secs[i - 1], B = secs[i];
      if (y < t.t0) break;
      // (iPad pass: tall, a hand-off also stays open until g3, while the planet settles from its calm-screen size)
      if (y >= t.t1 && !((t.hero || (!wide && !red && t.c0 !== undefined)) && y < t.g3)) {
        cur = i; from = A.stop; to = B.stop; roll = 1; dive = B.dives ? 1 : 0; fieldP[i] = 1; zone = zoneOf(B); phase = 'arrived';
        if (i === 1) heroK = 0;
        continue;
      }
      if (wide && t.e !== undefined) {
        // every part eased the same way (smoothstep), so the stage, the HUD and the dive move together and the
        // same forwards and backwards; nothing is squeezed into one wheel notch
        var rp = ramp(y, t.r0, t.r1), mp = smooth(ramp(y, t.m0, t.m1));
        if (red) mp = mp >= 0.5 ? 1 : 0;
        var dA = A.dives ? 1 - smooth(ramp(y, t.pb0, t.pb1)) : 0, dB = B.dives ? smooth(ramp(y, t.d0, t.d1)) : 0;
        if (rp <= 0) {
          // still at A (pulling back out of it, if it was dived)
          cur = i - 1; to = A.stop; from = i > 1 ? secs[i - 2].stop : A.stop; roll = 1; dive = dA;
          phase = A.dives && dA < 1 ? 'pullback' : 'arrived';
        } else {
          from = A.stop; to = B.stop; roll = rp; dive = rp >= 1 ? dB : 0;
          cur = rp >= 0.5 ? i : i - 1;
          phase = rp < 1 ? 'roll' : (mp < 1 ? 'morph' : 'dive');
        }
        var zA0 = zoneOf(A), zB0 = zoneOf(B);
        // r13 pass D: the hand-off's stage (see measure): the planet only ever stands where no words are
        var w = handWords(i, y, 0), sB = sideOf(zB0);
        var top = L.headB + L.hudH + 2 * L.hudGap, bot = Math.min(w.gB - pad, H - L.gb), gh = Math.max(60, bot - top), big;
        if (t.hero) {
          // the push-in: from its place on the name into the right half, beside the words as they scroll away
          var gwH = Math.max(120, Math.min(gh * 1.25, L.W - L.gr - (L.heroRight + L.gap)));
          big = { x: L.W - L.gr - gwH, y: top, w: gwH, h: gh };
          var kp = smooth(ramp(y, t.p0, t.p1)), k2h = smooth(ramp(y, t.c1, t.g3));
          zone = k2h > 0 ? lerpRect(big, zB0, k2h) : lerpRect(L.zoneHero || zA0, big, kp);
          if (red) zone = y < t.c0 ? (L.zoneHero || zA0) : zB0;
          run = y > t.p0 && y < t.c1 ? 1 : 0;
          S_riding = y > t.c0 && k2h < 0.98;
          heroK = y < t.c0 ? 1 : 0;
          heroChain = y < t.g3;
          sB = 'R';
        } else {
          // the calm screen: the planet keeps its own stage beside A's words (pulling back out of A's place) until
          // they have gone, then grows and swings to B's side on the empty screen, stands big beside the empty half
          // of the window, and settles into B's stage as B's words come in (it is kept above them)
          // iPad pass (fix 6, depth): bigger on the calm screen. The HUD row is empty there (both readouts step out
          // while the planet rides; the km figure has its own room), so the stage starts right under the header
          var topC = L.headB + L.hudGap, ghC = Math.max(60, bot - topC);
          var gw = Math.min(ghC * 1.3, L.W * 0.56), cxR = L.W - L.gr - gw / 2, cxL = L.gl + gw / 2;
          var xp = smooth(ramp(y, t.c0, t.c0 + H * 0.3));
          var cx = mix(sideOf(zA0) === 'R' ? cxR : cxL, sB === 'R' ? cxR : cxL, xp);
          big = { x: cx - gw / 2, y: topC, w: gw, h: ghC };
          var k1 = smooth(ramp(y, t.c0, t.c0 + H * 0.22)), k2 = smooth(ramp(y, t.c1, t.g3));
          zone = k2 > 0 ? lerpRect(big, zB0, k2) : lerpRect(zA0, big, k1);
          if (red) zone = y < t.c0 ? zA0 : zB0;
          S_riding = k1 > 0.02 && k2 < 0.98;
        }
        zone = keepClear(zone, w, pad);
        words = w;
        // the km figure's room: the half the planet leaves free, between the words
        var rx0 = sB === 'R' ? L.gl : zone.x + zone.w + L.gap, rx1 = sB === 'R' ? zone.x - L.gap : L.W - L.gr;
        var ry0 = Math.max(top, w.gT + pad), ry1 = Math.min(H - L.gb, w.gB - pad);
        kroom = { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 };
        fieldP[i] = rp;
        break;
      }
      if (t.hero) {
        // r13 pass D, the start line on tall and phone (see measure): the stage here is the planet's own rectangle
        // (no HUD block over it) until it reaches the band
        var wt = handWords(1, y, y < t.c0 ? 0 : L.clipTop), zBt = zoneOf(B), hb = L.hudH + L.hudGap;
        var bandSt = { x: zBt.x, y: zBt.y + hb, w: zBt.w, h: Math.max(80, zBt.h - hb) };
        var topT = Math.max(wt.gT + pad, L.headB + 4), botT = Math.min(wt.gB - pad, H - L.gb), ghT = Math.max(60, botT - topT);
        // (the planet in the lower 0.6 of the room the words leave, the km figure above it)
        var bigT = { x: L.gl, y: topT + Math.round(ghT * 0.4), w: L.W - L.gl - L.gr, h: Math.round(ghT * 0.6) };
        var sh = L.stageHero ? { x: L.stageHero.x, y: L.stageHero.y - y, w: L.stageHero.w, h: L.stageHero.h } : bandSt;
        var kpT = smooth(ramp(y, t.p0, t.p1)), k2T = smooth(ramp(y, t.c1, t.g3));
        zone = k2T > 0 ? lerpRect(bigT, bandSt, k2T) : lerpRect(sh, bigT, kpT);
        if (red) zone = y < t.c0 ? sh : bandSt;
        zone = keepClear(zone, wt, pad);
        direct = true; heroChain = y < t.g3; heroSnap = y < t.p0;
        var rpT = ramp(y, t.L, t.en), dpT = smooth(ramp(y, t.en, t.t1));
        from = 'hero'; to = B.stop; roll = rpT; dive = rpT >= 1 && B.dives ? dpT : 0; cur = rpT >= 0.5 ? 1 : 0;
        phase = rpT < 1 ? 'roll' : 'dive'; fieldP[1] = rpT;
        run = y > t.p0 && y < t.c1 ? 1 : 0;
        heroP = clamp(y / Math.max(1, t.c0), 0, 1);
        line = y < t.c0 ? 0 : L.clipTop;
        S_riding = y > t.c0 && k2T < 0.98;
        words = wt;
        kroom = { x: L.gl, y: topT, w: L.W - L.gl - L.gr, h: Math.min(zone.y, topT + ghT * 0.4) - pad - topT };
        break;
      }
      if (y < t.L) {
        // pulling back out of A to the whole globe
        var pbp = smooth((y - t.t0) / Math.max(1, t.L - t.t0));
        cur = i - 1; to = A.stop; from = i > 1 ? secs[i - 2].stop : A.stop; roll = 1;
        dive = A.dives ? 1 - pbp : 0; zone = zoneOf(A); phase = 'pullback';
      } else {
        // tall and phone: one band for every section; roll while the gap passes (r13 pass D: the planet moves to B's
        // place in the band with the roll, scrubbed), then dive (DIVE_SPAN, eased)
        var rpb = clamp((y - t.L) / Math.max(1, t.en - t.L), 0, 1), dp = smooth((y - t.en) / Math.max(1, t.t1 - t.en));
        zone = red ? zoneOf(B) : lerpRect(zoneOf(A), zoneOf(B), smooth(rpb));
        from = A.stop; to = B.stop; roll = rpb; dive = rpb >= 1 && B.dives ? dp : 0;
        fieldP[i] = rpb; cur = rpb >= 0.5 ? i : i - 1;
        phase = rpb < 1 ? 'roll' : (y >= t.t1 ? 'arrived' : 'dive');
        // iPad pass (fix 6), tall: on the calm screen the planet leaves the band and grows into the empty window
        // (the km figure above it, as on the start line), then settles back into the band as B's words come in.
        // Nothing else is on screen then: A's words have gone under the band, B's are still below the window.
        var kq = red || t.c0 === undefined ? 0 : smooth(ramp(y, t.c0, t.c0 + H * 0.4)) * (1 - smooth(ramp(y, t.c1, t.g3)));
        if (kq > 0.001) {
          var wq = handWords(i, y, L.clipTop), hbq = L.hudH + L.hudGap;
          var topQ = L.headB + 4, botQ = Math.min(wq.gB - pad, H - L.gb), ghQ = Math.max(60, botQ - topQ), kmQ = Math.round(ghQ * 0.3);
          var bigQ = { x: L.gl, y: topQ + kmQ, w: L.W - L.gl - L.gr, h: Math.max(80, ghQ - kmQ) };
          var baseQ = { x: zone.x, y: zone.y + hbq, w: zone.w, h: Math.max(80, zone.h - hbq) };
          zone = keepClear(lerpRect(baseQ, bigQ, kq), wq, pad);
          direct = true; line = L.clipTop; words = wq;
          S_riding = kq > 0.02;
          kroom = { x: L.gl, y: topQ, w: L.W - L.gl - L.gr, h: Math.max(0, zone.y - pad - topQ) };
        }
      }
      break;
    }
    // tall and phone, before the start line has begun: the planet stands on the name and goes up with the page
    if (!wide && cur === 0 && !direct && L.stageHero && !(T[1] && y >= T[1].t0)) {
      zone = { x: L.stageHero.x, y: L.stageHero.y - y, w: L.stageHero.w, h: L.stageHero.h };
      direct = true; heroChain = true; heroSnap = true; heroP = 0; line = 0;
    }
    for (var k = 1; k < N; k++) if (fieldP[k] === undefined) fieldP[k] = (T[k] && y >= T[k].t1) ? 1 : 0;
    // the hero has no dive: from === to once it is reached
    if (roll >= 1 && to === 'hero') { from = to; dive = 0; }
    // the end card: as the footer comes in, pull back out to the whole world
    var endP = 0;
    if (cur === N - 1 && foot && y > endAt) {
      endP = clamp((y - endAt) / Math.max(1, endName - endAt), 0, 1);
      dive = dive * (1 - endP);
    }
    if (red) { roll = roll >= 0.5 ? 1 : 0; if (roll < 1) { to = from; roll = 1; } dive = dive >= 0.5 ? 1 : 0; }
    zone = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    // tall and phone, the very end (round 4, J3): if Contact and the footer do not fit under the band, the band
    // (and its clip line) gets shorter over the last 0.4 of a window height, so "Let's talk." is fully in view at
    // the bottom of the page; the whole small globe stays in it
    var clipEnd = L.clipTop;
    if (L.mode !== 'wide' && L.endNeed > 0 && !direct) {
      var ek = smooth((y - (maxScroll - L.H * 0.4)) / (L.H * 0.4));
      var cut = Math.min(L.endNeed, zone.h - L.hudH - L.hudGap - 90) * ek;
      if (cut > 0) { zone.h -= cut; clipEnd = Math.round(L.clipTop - cut); }
    }
    // in the wide layout the footer pushes the stage up (then, once it reaches the top, shorter), so the name
    // never sits on the planet
    if (L.mode === 'wide' && foot) {
      var ft = (endName + L.H) - y - L.gap; // the footer's name, which only arrives after the pull-back
      if (ft < zone.y + zone.h) {
        var top0 = L.zoneTop || zone.y;
        zone.y = Math.max(Math.min(zone.y, top0), ft - zone.h);
        if (ft < zone.y + zone.h) zone.h = Math.max(120, ft - zone.y);
      }
    }
    var stage, clipNow = clipEnd;
    if (L.mode === 'wide' || direct) {
      // wide: the zone is the stage (the HUD sits above it, in line with the header); the tall start line too
      stage = { x: Math.round(zone.x), y: Math.round(zone.y), w: Math.round(zone.w), h: Math.round(Math.max(80, zone.h)) };
      if (direct) clipNow = line;
    } else {
      // tall and phone: the band, under the HUD readouts
      var hudBlock = L.hudH + L.hudGap;
      stage = { x: Math.round(zone.x), y: Math.round(zone.y + hudBlock), w: Math.round(zone.w), h: Math.round(Math.max(80, zone.h - hudBlock)) };
    }
    // r13 pass D: the hand-off whose calm screen is on (its wipe and the big km figure)
    var hand = 0;
    for (var h = 1; h < N; h++) { var th = T[h]; if (th && th.w0 !== undefined && y >= th.w0 && y < th.g3) { hand = h; break; } }
    var wipe = null, kmK = 0;
    if (hand && !red) {
      var tk = T[hand];
      if (!words) words = handWords(hand, y, clipNow);
      if (!kroom) {
        var ty0 = Math.max(words.gT, clipNow) + pad, ty1 = Math.min(words.gB, H - L.gb) - pad;
        kroom = { x: L.gl, y: ty0, w: L.W - L.gl - L.gr, h: ty1 - ty0 };
      }
      var e = ramp(y, tk.w0, tk.w1);
      if (e > 0 && e < 1) { wipe = circleFor(smooth(e), words, stage); wipe.on = true; wipe.i = hand; wipe.e = smooth(e); }
      kmK = smooth(ramp(y, tk.kb0, tk.kb1)) * (1 - smooth(ramp(y, tk.c1, tk.g3)));
    }
    S = { cur: cur, from: from, to: to, roll: roll, dive: dive, fieldP: fieldP, zone: zone, stage: stage, phase: phase, y: y, endP: endP, heroP: heroP, heroK: heroK, worldO: 1,
          run: run, hand: hand, wipe: wipe, kmK: kmK, kroom: kroom, words: words, heroChain: heroChain, heroSnap: heroSnap, direct: direct };
    L.clipNow = clipNow;
    return S;
  }

  // ---------- applying the state ----------
  var lastSent = {}, lastActive = -1, dirty = true, snapNext = false;
  function sendWorld() {
    var st = S.stage, w = W();
    if (!w) return;
    var key = st.x + ',' + st.y + ',' + st.w + ',' + st.h;
    if (has('setStage')) {
      if (key !== lastSent.stage) {
        lastSent.stage = key;
        // snap (no spring) on the first stage after a resize (QA 9), and while the tall/phone hero planet follows
        // the page or travels unseen to the band (the spring would let it lag behind the name it stands on)
        var snap = snapNext || (L.mode !== 'wide' && S.heroSnap);
        snapNext = false;
        call('setStage', snap ? { x: st.x, y: st.y, w: st.w, h: st.h, snap: true } : { x: st.x, y: st.y, w: st.w, h: st.h });
      }
      var sk = S.from + '>' + S.to + ':' + S.roll.toFixed(4) + ':' + S.dive.toFixed(4) + ':' + (S.run || 0);
      if (sk !== lastSent.scene) {
        lastSent.scene = sk;
        call('setScene', { from: stopName(S.from), to: stopName(S.to), roll: S.roll, dive: S.dive, run: S.run || 0 });
      }
      // the footer's end card (another builder adds WORLD.endCard; guarded)
      var ek = S.endP.toFixed(4);
      if (ek !== lastSent.end && (S.endP > 0 || (lastSent.end !== undefined && lastSent.end !== '0.0000'))) {
        lastSent.end = ek;
        if (window.WORLD && WORLD.endCard) call('endCard', S.endP);
      }
    } else if (has('setTarget')) {
      // an older world.js: a rectangle and an angle
      var ang = mix(stopAngle(S.from), stopAngle(S.to), S.roll);
      var tk = key + ':' + ang.toFixed(4);
      if (tk !== lastSent.target) {
        lastSent.target = tk;
        call('setTarget', { rect: { left: st.x, top: st.y, width: st.w, height: st.h }, stop: stopName(S.roll >= 0.5 ? S.to : S.from), angle: ang });
      }
    }
  }

  // Colour fields (round 4): each section's field starts exactly at that section's own top edge, which lies in the
  // gap between two sections' texts, and every section carries its own text colours (site.css), so text always
  // sits on its own field and the change can never rest half-way across a heading, wherever the scroll stops.
  // Tall and phone: below the band the edge is the section's top; the band above it takes the colour of the text
  // right under it, so no edge ever runs through the planet or the HUD there.
  // r13 pass D: one colour at a time. Each hand-off swaps the field at the end of its wipe (the circle of B's colour
  // that grew out of the planet has filled the window by then); no field edge ever runs across the window, and the
  // swap only happens on the calm screen, where no words are. Reduced motion: the swap halfway through the calm
  // screen, no circle.
  function swapAt(k) { var t = T[k]; if (!t || t.w1 === undefined) return 1e9; return reduced() ? (t.c0 + t.c1) / 2 : t.w1; }
  function paintFields() {
    var y = S.y || 0, top = 0;
    for (var i = 1; i < N; i++) if (y >= swapAt(i)) top = i;
    for (var k = 0; k < N; k++) {
      var f = secs[k].layer; if (!f) continue;
      var v = k === top ? 'visible' : 'hidden';
      if (f._k === v) continue;
      f._k = v; f.style.visibility = v; f.style.clipPath = 'none';
    }
    S.topField = top;
    paintWipe();
  }
  // the circle (iPad pass): one filled circle on a window-sized 2D canvas, redrawn only when it changes. The old
  // way (a round div the size of the window's diagonal, grown with transform: scale) made Safari re-rasterise a
  // layer of up to 8 million pixels on every frame of the wipe.
  var wipeEl = null, wipeCx = null, wipeDpr = 1, wipeH = 1;
  function sizeWipe() {
    if (!wipeEl) {
      var box = $('.fields'); if (!box) return;
      wipeEl = document.createElement('canvas'); wipeEl.className = 'wipe'; wipeEl.setAttribute('aria-hidden', 'true');
      box.appendChild(wipeEl);
      wipeCx = wipeEl.getContext('2d', { alpha: true });
    }
    wipeDpr = Math.min(window.devicePixelRatio || 1, 2);
    // (touch: 160 px more, so the strip under a browser bar that slides away is covered too)
    wipeH = L.H + (matchMedia('(pointer: coarse)').matches ? 160 : 0);
    var cw = Math.round(L.W * wipeDpr), ch = Math.round(wipeH * wipeDpr);
    if (wipeEl.width !== cw) wipeEl.width = cw;
    if (wipeEl.height !== ch) wipeEl.height = ch;
    wipeEl.style.width = L.W + 'px'; wipeEl.style.height = wipeH + 'px';
    wipeEl._k = '';
  }
  function paintWipe() {
    if (!wipeEl || !wipeCx) return;
    var w = S.wipe;
    if (!w || !w.on || w.r < 1) { if (wipeEl._v !== 0) { wipeEl._v = 0; wipeEl.style.visibility = 'hidden'; } return; }
    var c = fieldColour(secs[w.i].stop);
    var k = w.cx.toFixed(1) + ',' + w.cy.toFixed(1) + ',' + w.r.toFixed(1) + ',' + c;
    if (wipeEl._k !== k) {
      wipeEl._k = k;
      var g = wipeCx;
      g.setTransform(wipeDpr, 0, 0, wipeDpr, 0, 0);
      g.clearRect(0, 0, L.W, wipeH);
      g.fillStyle = c;
      if (w.R && w.r >= w.R - 1) g.fillRect(0, 0, L.W, wipeH);
      else { g.beginPath(); g.arc(w.cx, w.cy, w.r, 0, Math.PI * 2); g.fill(); }
    }
    if (wipeEl._v !== 1) { wipeEl._v = 1; wipeEl.style.visibility = 'visible'; }
  }
  // which field is under a point of the window (for the header, the HUD and the km figure)
  function fieldAt(x, y) {
    var w = S.wipe;
    if (w && w.on) { var dx = x - w.cx, dy = y - w.cy; return secs[dx * dx + dy * dy < w.r * w.r ? w.i : w.i - 1].stop; }
    return secs[S.topField || 0].stop;
  }
  // the circle's edge runs through this box of the window (a readout steps out of sight while it does)
  function edgeIn(b) {
    var w = S.wipe;
    if (!w || !w.on) return false;
    var near = distBox(w.cx, w.cy, { x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h });
    var fx = Math.max(Math.abs(b.x - w.cx), Math.abs(b.x + b.w - w.cx)), fy = Math.max(Math.abs(b.y - w.cy), Math.abs(b.y + b.h - w.cy));
    return near < w.r && Math.sqrt(fx * fx + fy * fy) > w.r;
  }


  // the page's own colours (scrollbar, the browser's bar) follow the section at the middle of the window
  var themeStop = 'hero';
  function applyTheme() {
    var stop = fieldAt(0, L.H * 0.5);
    if (stop === themeStop) return;
    themeStop = stop;
    root.setAttribute('data-field', stop);
    if (meta) meta.setAttribute('content', fieldColour(stop));
  }
  // a field's colour now (the tinyworld field changes with the what-if weather)
  function fieldColour(stop) {
    if (stop === 'tinyworld' && root.classList.contains('flash')) return '#f3f3f1';
    if (stop === 'tinyworld' && root.classList.contains('storm')) return '#7E98A6';
    return FIELD[stop];
  }

  function paintChrome() {
    // header: hides while scrolling down, comes back on the way up; coloured by the field under it
    var y = S.y;
    if (head) {
      if (head.contains(document.activeElement)) { head.classList.remove('is-hidden'); }
      else if (y > headY + 6 && y > 160) head.classList.add('is-hidden');
      else if (y < headY - 6 || y < 160) head.classList.remove('is-hidden');
      headY = y;
      // while the hero is up nothing scrolls under the header, so it has no background (the planet may stand
      // beside it); after that it takes the colour of the field under it
      // (r13 pass D: only while the words are still pinned; once they scroll it takes the field's colour)
      var clear = y < (L.mode === 'wide' ? (L.heroHold || 0) + 8 : 8);
      var hs = clear ? 'hero' : fieldAt(L.W - 120, 30);
      if (head._clear !== clear) { head._clear = clear; head.classList.toggle('is-clear', clear); }
      if (hs !== head._f) {
        head._f = hs;
        head.style.setProperty('--head-bg', fieldColour(hs));
        head.style.setProperty('--head-fg', DARK[hs] ? '#f3f3f1' : '#141414');
      }
    }
    // HUD: right above the stage, at its two corners, like a caption for the planet (wide: on the companion it
    // stands in the middle of the window's height; on a tall stage it sits in line with the header's row); at
    // the band's top corners (tall, phone). In the hero the place readout rests and,
    // wide, the run readout sits in the window's corner under the header, clear of the planet.
    if (hudL && hudR && S.zone) {
      var z = S.zone, wide = L.mode === 'wide';
      // wide: the readouts sit right above the 3D as it is really drawn (world.js springs the picture after the
      // stage), so a planet still settling never pokes into them
      var zTop = z.y;
      if (wide && worldLive()) { var wb = call('bounds'); if (wb && wb.h > 0 && wb.y < zTop) zTop = wb.y; }
      // (the readouts' real heights: a caption can wrap to a second line while the stage is narrower)
      // iPad pass: the readouts' sizes are measured once after their text or width changes (hudSize), not on
      // every scroll frame
      var hz = hudSize(), wl = hz.wl, hl = hz.hl, wr = hz.wr, hr = hz.hr;
      var hy = wide ? Math.max(L.hudY, Math.round(zTop - Math.max(L.hudH, hl, hr) - L.hudGap)) : z.y;
      var lx = Math.round(z.x), rx = Math.round(z.x + z.w), ly = Math.round(hy), ry = ly;
      var inHero = S.cur === 0;
      if (wide && S.heroK > 0) {
        var hk0 = smooth(S.heroK);
        rx = Math.round(mix(rx, L.W - L.gr, hk0)); ry = Math.round(mix(ly, L.headB + L.hudGap, hk0));
      }
      // the place readout rests on the first screen and while the planet is still moving off it (wide)
      // (r13 pass D: while the km figure is out on a calm screen the run readout stays on, with its value and caption
      // hidden, so the figure lands back in it without a fade)
      var kmOut = S.kmK > 0.002 && !reduced();
      var offL = inHero || (wide && S.heroK > 0.02) || (wide && z.w < 260) || S_riding || S.heroChain, offR = ((!wide && S.heroChain) || S_riding) && !kmOut;
      // round 4 (QA 1): the readouts never move onto each other or under the header. A readout whose place the
      // header covers right now (it is back on the way up) steps out of sight until the header goes again; wide, a
      // readout that a field edge is running through steps out too, so it is never half on one colour.
      // the header's own place (not its sliding box), whenever it is shown
      var hb = (head && !head.classList.contains('is-hidden')) ? headBox() : null;
      var boxL = { x: lx, y: ly, w: wl, h: hl }, boxR = { x: rx - wr, y: ry, w: wr, h: hr };
      var underHead = function (b) { return hb && b.y < hb.bottom && b.y + b.h > hb.top && b.x < hb.right + 6 && b.x + b.w > hb.left - 6; };
      if (underHead(boxL)) offL = true;
      if (underHead(boxR)) offR = true;
      if (edgeIn(boxL) && !inHero) offL = true;
      if (edgeIn(boxR) && !kmOut) offR = true;
      // a planet poke on the first screen: its title shows in the run readout's place for its 3 s (QA/J11)
      if (inHero && pokeUntil > performance.now()) offR = false;
      if (hudL._off !== offL) { hudL._off = offL; hudL.classList.toggle('is-off', offL); }
      if (hudR._off !== offR) { hudR._off = offR; hudR.classList.toggle('is-off', offR); }
      var kl = lx + ',' + ly, kr = rx + ',' + ry;
      if (hudL._k !== kl) { hudL._k = kl; hudL.style.transform = 'translate(' + lx + 'px,' + ly + 'px)'; }
      if (hudR._k !== kr) { hudR._k = kr; hudR.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translateX(-100%)'; }
      hudR._rx = rx; hudR._ry = ry;
      var fl = fieldAt(lx + 20, ly + hl / 2), fr = fieldAt(rx - 20, ry + hr / 2);
      if (hudL._f !== fl) { hudL._f = fl; hudL.style.color = DARK[fl] ? '#f3f3f1' : '#141414'; }
      if (hudR._f !== fr) { hudR._f = fr; hudR.style.color = DARK[fr] ? '#f3f3f1' : '#141414'; }
      hudKm();
      hudFit();
      paintKm();
    }
    // tall and phone: no text is drawn under the band. Each section (and the hero's text) is clipped at the
    // band's lower edge; the page itself is not clipped, so the hero name can stay under the planet.
    clipText(y);
    fadeBig(y);
    // the hero, wide: its words stay, pinned, while the planet moves to its companion place (round 4: no fade,
    // so no screen is left empty), then scroll away like a page
    if (heroInner && heroInner._o !== 'x') { heroInner._o = 'x'; heroInner.style.opacity = ''; heroInner.style.visibility = ''; }
    // the hero name: wide, it stays pinned with the hero's words and fades as the planet starts to move off it;
    // tall and phone, it scrolls with the page (the planet goes up with it) and fades before the band reaches it
    // (r13 pass D: the phone too: the letters and his face sink, no fade)
    if (nameEl) heroExit(y);
    // tall and phone hero: the planet fades out while it travels to the band (QA 8)
    var wlay = document.getElementById('world-layer');
    if (wlay) { var wo = (S.worldO === undefined ? 1 : S.worldO).toFixed(3); if (wlay._o !== wo) { wlay._o = wo; wlay.style.opacity = wo === '1.000' ? '' : wo; } }
    // no 3D: the stage shows the section's picture
    if (stills && root.classList.contains('no-world')) {
      var st = S.stage, sk = st.x + ',' + st.y + ',' + st.w + ',' + st.h;
      if (stills._k !== sk) {
        stills._k = sk;
        stills.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px)';
        stills.style.width = st.w + 'px'; stills.style.height = st.h + 'px';
      }
      secs.forEach(function (s) { if (s.still) s.still.classList.toggle('is-on', s.i === S.cur); });
    }
  }
  var headY = 0;
  // pass 3 (2): wide and tall, the hero's exit is authored and scrubbed over the first 0.28 window heights of
  // scroll: each letter of the name sinks straight down behind the name's baseline (masked there), one after
  // another from the left, and his photo sinks with the letters it stands behind. Scrolling back brings them up.
  // (It replaces the fade.) Reduced motion: no travel; the name and photo go at once a little way into the scroll.
  var photoImg = photoEl ? $('img', photoEl) : null;
  function heroExit(y) {
    var wide = L.mode === 'wide', H = L.H, n = nameChars.length;
    var ny = wide ? Math.min(y, L.heroHold || 0) : 0;
    // (tall: over 0.11 of the height, so he and the name are gone before the planet's trip to the band crosses them)
    var p = y / (H * (wide ? 0.28 : 0.11)), red = reduced(), gone = true;
    var sink = (L.name ? L.name.capH : 100) * 1.16;
    var ks = nameChars.map(function (c, i) { return red ? 0 : letterK(p, i, n); });
    nameChars.forEach(function (c, i) {
      if (red ? p <= 0.5 : ks[i] < 1) gone = false;
      setT(c, 'translate', ks[i] > 0.0005 ? '0 ' + (ks[i] * sink).toFixed(1) + 'px' : '');
    });
    // tall: never under the band (it has sunk long before; this is the guard)
    var band = !wide && L.name && (L.name.top - y) < (L.clipNow || 0) + 8;
    var nk = (gone || band ? 'h' : 'v') + Math.round(ny);
    if (nameEl._o !== nk) { nameEl._o = nk; nameEl.style.opacity = ''; nameEl.style.visibility = gone || band ? 'hidden' : ''; nameEl.style.translate = ny ? '0 ' + Math.round(ny) + 'px' : ''; }
    if (photoEl && L.photo) {
      // the letters he stands behind (by their places across the name)
      var px0 = L.photo.x, px1 = L.photo.x + L.photo.w, sum = 0, cnt = 0;
      (L.name.chars || []).forEach(function (ch, i) { if (ch.x1 > px0 && ch.x0 < px1) { sum += ks[i]; cnt++; } });
      var pk = cnt ? sum / cnt : ks[n - 1];
      var pcut = !wide ? Math.round((L.clipNow || 0) - (L.photo.y - y)) : 0;
      var pkey = pk.toFixed(4) + ',' + Math.round(ny) + ',' + Math.max(0, pcut);
      if (photoEl._o !== pkey) {
        photoEl._o = pkey;
        photoEl.style.opacity = '';
        photoEl.style.visibility = pk >= 1 || (red && gone) ? 'hidden' : '';
        photoEl.style.translate = ny ? '0 ' + Math.round(ny) + 'px' : '';
        photoEl.style.clipPath = pcut > 0 ? 'inset(' + pcut + 'px 0 0 0)' : '';
        if (photoImg) photoImg.style.translate = pk > 0.0005 ? '0 ' + (pk * L.photo.boxH).toFixed(1) + 'px' : '';
      }
    }
  }

  // tall and phone: clip each block of text at the line where the band ends (L.clipNow)
  var clipEls = null;
  function clipText(y) {
    if (!clipEls) clipEls = [heroFrame].concat(secs.slice(1).map(function (s) { return s.el; }), [foot]).filter(Boolean);
    var tall = L.mode !== 'wide', line = L.clipNow || 0;
    for (var i = 0; i < clipEls.length; i++) {
      var el = clipEls[i], k;
      if (!tall) k = '';
      else {
        if (el._top === undefined || el._mk !== measureN) { el._top = docRect(el).top; el._mk = measureN; }
        var cut = Math.round(line - (el._top - y));
        k = cut > 0 ? 'inset(' + cut + 'px 0 0 0)' : '';
      }
      if (el._c !== k) { el._c = k; el.style.clipPath = k; }
    }
  }

  // tall and phone: large text fades before the band's edge reaches it, so no heading is ever shown sliced.
  // Checked every frame: an entrance that finishes late must not bring a faded heading back.
  // Round 4: either fully there or gone, never half-faded (a short opacity transition in site.css, .is-cut).
  function fadeBig(y) {
    if (!big.length) return;
    var line = L.clipNow || 0, F = 6;
    // iPad pass: once per frame (paintChrome and the loop both call it), and a live box is only read when it is
    // near the band's edge (a read after the frame's style writes is a forced layout)
    if (fadeBig._f === frameN && fadeBig._y === y) return;
    fadeBig._f = frameN; fadeBig._y = y;
    for (var i = 0; i < big.length; i++) {
      var b = big[i], t = b.top - y;
      if (b.live && Math.abs(t - line) < L.H * 0.35) t = b.el.getBoundingClientRect().top;
      var cut = t < line + F;
      if (cut === !!b.set) continue;
      if (cut && window.gsap) { window.gsap.killTweensOf(b.el); b.el.style.transform = ''; b.el.style.opacity = ''; }
      b.set = cut;
      b.el.classList.toggle('is-cut', cut);
    }
  }

  // ---------- r13 pass D: the run's km figure, huge on each calm screen ----------
  // The run: 0.0 to 1.0 km over the start line (the push-in to the Meta ads heading), then on to 42.195 km at Contact.
  function kmOf(y) {
    var t = T[1];
    if (!t || t.kmEnd === undefined) return 42.195 * clamp(y / Math.max(1, kmAt.about), 0, 1);
    var a = t.p0 || 0, b = Math.max(a + 1, t.kmEnd);
    if (y <= a) return 0;
    if (y < b) return (y - a) / (b - a);
    return 1 + 41.195 * clamp((y - b) / Math.max(1, kmAt.about - b), 0, 1);
  }
  // The figure is the run readout's own value, drawn once at a big size (crisp) and scaled down to the readout's
  // size and place when it goes back (transform only). Its digits roll like an odometer with the scroll: a digit
  // turns over in the last quarter of its tenth, the next one along with it when it passes 9.
  var kmBig = null, kmCols = [], KB_FS = 200;
  function buildKm() {
    var hud = $('#hud');
    if (kmBig || !hud) return;
    kmBig = document.createElement('p'); kmBig.className = 'km-big'; kmBig.setAttribute('aria-hidden', 'true');
    ['d', 'd', '.', 'd', 'u'].forEach(function (k) {
      var c = document.createElement('span');
      if (k === 'd') {
        c.className = 'kb-col';
        var st = document.createElement('span'); st.className = 'kb-s';
        st.appendChild(document.createElement('span')).textContent = '0';
        st.appendChild(document.createElement('span')).textContent = '1';
        c.appendChild(st); kmCols.push({ el: c, s: st, n: -1, f: '' });
      } else { c.className = 'kb-fix'; c.textContent = k === '.' ? '.' : ' km'; }
      kmBig.appendChild(c);
    });
    hud.appendChild(kmBig);
  }
  function sizeKm() {
    buildKm();
    if (!kmBig) return;
    KB_FS = Math.round(Math.min(L.H * 0.3, L.W * 0.2));
    kmBig.style.fontSize = KB_FS + 'px';
    kmBig._w = 0; kmBig._hfs = 0;
    sizeWipe();
  }
  function kmDigits(km) {
    var v = Math.max(0, km) * 10 + 1e-6, n0 = Math.floor(v), turn = smooth((v - n0 - 0.75) / 0.25);
    var t = n0 % 10, u = Math.floor(n0 / 10) % 10, d = Math.floor(n0 / 100) % 10;
    return [
      { n: d, f: u === 9 && t === 9 ? turn : 0, show: n0 >= 100 || (n0 >= 99 && turn > 0) },
      { n: u, f: t === 9 ? turn : 0, show: true },
      { n: t, f: turn, show: true }
    ];
  }
  function paintKm() {
    if (!kmBig) return;
    var k = reduced() ? 0 : (S.kmK || 0), R = S.kroom;
    var on = k > 0.002 && R && R.w > 40 && R.h > 40 && hudR;
    if (hudR) { var bg = !!on; if (hudR._big !== bg) { hudR._big = bg; hudR.classList.toggle('is-big', bg); } }
    if (!on) { if (kmBig._v !== 0) { kmBig._v = 0; kmBig.style.visibility = 'hidden'; } return; }
    var ds = kmDigits(kmOf(S.y));
    for (var j = 0; j < 3; j++) {
      var c = kmCols[j], d = ds[j];
      if (c.n !== d.n) { c.n = d.n; c.s.firstChild.textContent = String(d.n); c.s.lastChild.textContent = String((d.n + 1) % 10); }
      var fk = d.f > 0.001 ? (-50 * d.f).toFixed(2) : '';
      if (c.f !== fk) { c.f = fk; c.s.style.transform = fk ? 'translateY(' + fk + '%)' : ''; }
      if (j === 0) { var dsp = d.show ? '' : 'none'; if (c._d !== dsp) { c._d = dsp; c.el.style.display = dsp; kmBig._w = 0; } }
    }
    if (!kmBig._w) kmBig._w = kmBig.offsetWidth;
    if (!kmBig._hfs) { var hv = $('.hud-v', hudR); kmBig._hfs = (hv && parseFloat(getComputedStyle(hv).fontSize)) || 24; }
    var wB = kmBig._w, hB = KB_FS * 1.05, s0 = kmBig._hfs / KB_FS;
    // the big place: centred in the room the planet leaves free, as big as fits (never bigger than drawn)
    var s1 = Math.max(s0, Math.min(1, R.w * 0.92 / wB, R.h * 0.7 / hB));
    var bx = R.x + R.w / 2 + wB * s1 / 2, by = R.y + R.h / 2 - hB * s1 / 2;
    var hx = hudR._rx || L.W - L.gr, hy = hudR._ry || L.headB;
    // its path never crosses the planet: small, it slides along the readout's row (above the stage) to the free
    // side, drops into the room there, and only then grows to its big place (the same path back as it returns)
    var st = S.stage || { x: 0, w: 0 }, dx;
    if (L.mode === 'wide') dx = R.x + R.w;
    else dx = st.x + st.w / 2 > L.W / 2 ? L.gl + wB * s0 : L.W - L.gr;
    var dy = R.y;
    var k1 = smooth(k / 0.3), k2 = smooth((k - 0.3) / 0.3), k3 = smooth((k - 0.6) / 0.4);
    var xr = mix(mix(hx, dx, k1), bx, k3), yy = mix(mix(hy, dy, k2), by, k3), s = mix(s0, s1, k3);
    // never on a word: its box stays below A's last line and above B's first wherever it would cross their columns
    var wd = S.words, x0 = xr - wB * s, pad = 12;
    if (wd && wd.a && xr > wd.a.x0 && x0 < wd.a.x1) yy = Math.max(yy, wd.a.y1 + pad);
    if (wd && wd.b && xr > wd.b.x0 && x0 < wd.b.x1 && yy + hB * s > wd.b.y0 - pad) {
      var room = wd.b.y0 - pad - Math.max(L.headB, wd.a ? wd.a.y1 + pad : 0);
      if (hB * s > room) s = Math.max(s0, room / hB);
      yy = wd.b.y0 - pad - hB * s;
    }
    var key = x0.toFixed(1) + ',' + yy.toFixed(1) + ',' + s.toFixed(4);
    if (kmBig._k !== key) { kmBig._k = key; kmBig.style.transform = 'translate(' + (xr - wB * s).toFixed(1) + 'px,' + yy.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')'; }
    var f = fieldAt(xr - wB * s / 2, yy + hB * s / 2), col = DARK[f] ? '#f3f3f1' : '#141414';
    if (kmBig._c !== col) { kmBig._c = col; kmBig.style.color = col; }
    if (kmBig._v !== 1) { kmBig._v = 1; kmBig.style.visibility = 'visible'; }
  }

  // ---------- the HUD ----------
  function rollTo(item, value, caption, asTitle) {
    var v = $('.hud-v', item), c = $('.hud-c', item);
    var oldSpan = v.lastElementChild;
    if (oldSpan && oldSpan.textContent === value && c.textContent === caption) return;
    v.classList.toggle('is-title', !!asTitle);
    if (c.textContent !== caption) { c.textContent = caption; hudResized(); }
    if (reduced() || !oldSpan || !oldSpan.animate) {
      v.textContent = ''; var s0 = document.createElement('span'); s0.textContent = value; v.appendChild(s0);
      return;
    }
    $$('span', v).forEach(function (s) { if (s !== oldSpan) s.remove(); });
    var s = document.createElement('span'); s.textContent = value; v.appendChild(s);
    oldSpan.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' })
      .onfinish = function () { oldSpan.remove(); };
    s.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }
  var pokeUntil = 0, pokeTimer = 0;
  // The place readout: one reading per section (G1). tinyworld takes its reading from its scene (world:hud);
  // every other section, Video ads included, shows the page's own.
  var copiedUntil = 0;
  function hudReading() {
    var stop = secs[S.cur].stop;
    if (stop === 'contact' && performance.now() < copiedUntil) return { value: 'Copied', caption: 'the email address' };
    if (whatIfNow && WHATIF_TITLE[whatIfNow]) return { value: WHATIF_TITLE[whatIfNow], caption: '', title: true };
    var o = hudOverride[stop];
    if (o && o.live) return o;
    return { value: '', caption: '' };
  }
  function hudPlace() {
    if (!hudL || performance.now() < pokeUntil) return;
    var h = hudReading();
    hudL.classList.toggle('is-empty', !h.value);
    rollTo(hudL, h.value, h.caption, !!h.title);
  }
  // The run: the page is a marathon. Set up on the first screen, the finish at About.
  // The value is a smooth function of scroll; the caption says what the number means at each point.
  var RUN = {
    start: 'Scroll to run. This page is 42.195 km long.',
    run: 'of 42.195 km',
    half: 'Halfway. My longest race so far.',
    finish: 'The finish. My first full marathon is in December.'
  };
  var kmShown = '', capShown = '';
  function hudKm() {
    if (pokeHero && performance.now() < pokeUntil) return;
    var y = S.y;
    var km = kmOf(y);
    if (window.SFX && SFX.runKm) SFX.runKm(km);
    // (within a hair of the end counts as the end: a scroll that stops a fraction of a pixel short of Contact's
    // arrival must not read 42.1)
    var fin = km >= 42.19;
    var text = fin ? '42.195 km' : (Math.floor(km * 10) / 10).toFixed(1) + ' km';
    var atStart = y < 8;
    var cap = (fin && secs[S.cur].stop === 'contact') ? RUN.finish
      : (km >= 20.6 && km < 21.6) ? RUN.half
      : (atStart ? RUN.start : RUN.run);
    if (text === kmShown && cap === capShown) return;
    var v = $('.hud-v', hudR);
    if (v.classList.contains('is-title') || v.children.length !== 1) { v.classList.remove('is-title'); v.textContent = ''; v.appendChild(document.createElement('span')); }
    if (text !== kmShown) { kmShown = text; v.firstElementChild.textContent = text; }
    if (cap !== capShown) { capShown = cap; $('.hud-c', hudR).textContent = cap; hudResized(); }
  }
  // the place readout's caption wraps before it would meet the run readout (over the stage's own width)
  function hudFit() {
    if (!hudL || !hudR || !S.zone) return;
    var rw = Math.round(Math.max(S.zone.w * 0.5, L.mode === 'wide' ? 190 : 150)) + 'px';   // r13 pass B: room for "of 42.195 km" over the badge
    if (hudR._mw !== rw) { hudR._mw = rw; hudR.style.maxWidth = rw; hudSz = null; }
    var mw =Math.max(L.mode === 'wide' ? 160 : 120, Math.round(S.zone.w - hudSize().wr - (L.mode === 'wide' ? 24 : 16))) + 'px';
    if (hudL._mw !== mw) { hudL._mw = mw; hudL.style.maxWidth = mw; hudSz = null; }
  }
  // iPad pass: cached sizes of the two readouts and the header (a read after the frame's style writes forces a
  // layout of the whole 19,000 px page, so it happens only after something that changes them)
  var hudSz = null, headSz = null;
  function hudSize() {
    if (!hudSz) hudSz = { wl: hudL ? hudL.offsetWidth : 0, hl: hudL ? hudL.offsetHeight : 0, wr: hudR ? hudR.offsetWidth : 0, hr: hudR ? hudR.offsetHeight : 0 };
    return hudSz;
  }
  function headBox() {
    var k = head.className;
    if (!headSz || headSz.k !== k) headSz = { k: k, top: 0, bottom: head.offsetHeight, left: head.offsetLeft, right: head.offsetLeft + head.offsetWidth };
    return headSz;
  }
  // anything that may change a readout's size (its text, a class) marks the cache stale
  if (window.MutationObserver) {
    var hudMo = new MutationObserver(function () { hudSz = null; });
    [hudL, hudR].forEach(function (el) { if (el) hudMo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] }); });
  }
  // a caption that wraps to another line changes the HUD's height: the stage starts under it
  function hudResized() {
    hudFit();
    var hh = Math.max(hudL ? hudL.offsetHeight : 0, hudR ? hudR.offsetHeight : 0);
    // wide: the stage starts under the HUD row, so a taller readout moves the stage down (once, by layout)
    // (r13 pass D: once the scroll rests, never in the middle of a scroll: a whole layout there was a long frame)
    if (L.mode === 'wide' && hh > L.hudH + 1) { relayoutAt = relayoutAt || performance.now(); return; }
    if (Math.abs(hh - L.hudH) > 1) { L.hudH = hh; dirty = true; }
  }
  window.addEventListener('world:hud', function (e) {
    var d = e.detail || {}; if (!d.stop || !d.left) return;
    var stop = d.stop === 'uncooked' ? 'bwgu' : d.stop;
    // only a live reading (one the visitor started: the scene marks it with extra) is shown; a resting reading is not
    hudOverride[stop] = { value: String(d.left.value), caption: String(d.left.caption || ''), live: !!d.extra };
    if (secs[S.cur] && secs[S.cur].stop === stop) hudPlace();
  });
  // A planet poke shows its reel title for 3 s. On the first screen the place readout rests, so the title takes
  // the run readout's place there (in the window's corner, clear of the planet); elsewhere the place readout's.
  var pokeHero = false;
  window.addEventListener('world:poke', function (e) {
    var d = e.detail || {}; if (!d.title || !hudL || !hudR) return;
    pokeUntil = performance.now() + 3000;
    pokeHero = S.cur === 0;
    if (!pokeHero) hudL.classList.remove('is-empty');
    rollTo(pokeHero ? hudR : hudL, d.title, 'from my reels', true);
    clearTimeout(pokeTimer);
    dirty = true;
    pokeTimer = setTimeout(function () { pokeUntil = 0; if (pokeHero) { pokeHero = false; kmShown = ''; capShown = ''; } hudPlace(); dirty = true; }, 3010);
  });

  // ---------- the active section ----------
  function onActive() {
    var s = secs[S.cur];
    lastActive = S.cur;
    hudPlace();
    if (s.stop === 'contact') call('wave');
  }

  // ---------- the one loop ----------
  var lastY = -1, lastW = 0, lastH = 0, movedAt = 0, relayoutAt = 0, frameN = 0;
  function frame(now) {
    frameN++;
    var y = window.scrollY;
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) onResize();
    if (dirty || y !== lastY) {
      if (y !== lastY) movedAt = performance.now();
      dirty = false; lastY = y;
      compute(y);
      if (S.cur !== lastActive) onActive();
      else hudPlace();
      paintFields();
      applyTheme();
      paintChrome();
      revealCheck();
      motionPaint(y);
      paintStage();
      rememberPlace(y);
    } else if (worldLive() && performance.now() - ((window.WORLD && WORLD._drawnAt) || 0) < 120) {
      // r13 pass D: the circle stays centred on the planet as it is drawn while the picture still springs to its stage
      if (S.wipe && S.wipe.on) { var nw = circleFor(S.wipe.e, S.words, S.stage); nw.on = true; nw.i = S.wipe.i; nw.e = S.wipe.e; S.wipe = nw; paintWipe(); }
      if (L.mode === 'wide' || S.wipe || S.kmK > 0) paintChrome(); // the picture may still be springing toward the stage: keep the HUD above it (r13: only while the 3D still draws)
    }
    if (relayoutAt && performance.now() - movedAt > 250) { relayoutAt = 0; layout(); }
    fadeBig(window.scrollY);
    sendWorld();
    sendBeat();
    now = performance.now();
    if (now - calT > 500) { calT = now; calibrate(); }
    requestAnimationFrame(frame);
  }

  // keep the visitor in the same place when the window changes shape (QA 20)
  // The place is measured at the line where text starts to be readable (under the header in wide, under the
  // band in tall/phone): which section, and how far through its text (or through its lead, before the text).
  var place = { i: 0, col: false, f: 0 };
  function readLine() { return L.mode === 'wide' ? L.anchorTop : L.clipTop + 48; }
  function rememberPlace(y) {
    var p = y + readLine();
    for (var i = N - 1; i >= 0; i--) {
      var s = secs[i];
      if (p >= s.secTop || i === 0) {
        if (p >= s.top || s.top <= s.secTop) place = { i: i, col: true, f: clamp((p - s.top) / Math.max(1, s.bottom - s.top), 0, 1) };
        else place = { i: i, col: false, f: clamp((p - s.secTop) / Math.max(1, s.top - s.secTop), 0, 1) };
        return;
      }
    }
  }
  var resizeT = 0;
  function onResize() {
    lastW = window.innerWidth; lastH = window.innerHeight;
    var keep = place;
    layout();
    var s = secs[keep.i];
    if (s && window.scrollY > 0) {
      var p = keep.col ? s.top + keep.f * (s.bottom - s.top) : s.secTop + keep.f * (s.top - s.secTop);
      window.scrollTo(0, Math.max(0, Math.round(p - readLine())));
    }
    lastSent = {}; snapNext = true;
    clearTimeout(resizeT);
    resizeT = setTimeout(measure, 250);
  }

  // ---------- header clock ----------
  var timeEl = $('#sg-time'), timeFmt = null;
  try { timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { timeFmt = null; }
  function showTime() {
    if (!timeEl || !timeFmt) return;
    var t = timeFmt.format(new Date());
    timeEl.textContent = t; timeEl.setAttribute('datetime', t);
  }
  showTime(); setInterval(showTime, 20000);

  // ---------- figures: views from data/stats.json, the live day counter (shown final, never counted up) ----------
  function setViews(text, caption) {
    var f = $('#views-figure'), c = $('#views-caption'), q = $('#qv-views'), hv = $('#hero-views');
    if (text && f) { if (f._rolling) { f._final = text; f.setAttribute('aria-label', text); } else f.textContent = text; }
    if (text && hv) hv.textContent = text;
    if (text && q) q.textContent = text;
    if (caption && c) c.textContent = caption;
    // (P5: no longer repeated in the HUD)
  }
  if (window.fetch) {
    fetch('data/stats.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (d && d.views_text) setViews(d.views_text, d.views_caption); })
      .catch(function () { /* the numbers written in the page stay */ });
  }

  // ---------- clips ----------
  function play(v) { if (!v) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function pause(v) { if (v && !v.paused) v.pause(); }
  function rest(v) { if (!v) return; pause(v); if (v.currentTime > 0) { try { v.load(); } catch (e) { /* poster stays */ } } }

  // r13 pass A: nothing plays by itself. Every ad and reel tile shows its still cover (the video's poster) and plays
  // only when pressed; a second press pauses it. One video at a time: whatever starts pauses every other one. A tile
  // that leaves the window stops and goes back to its cover. The ads with a full version open it in the player
  // (with sound, as their label says); the clips in the tiles are silent loops, so the Sound toggle has nothing to
  // add there and still only drives the page's sound effects.
  var reels = $$('.clip--reel'), ads = $$('.clip--ad');
  var tiles = reels.concat(ads);
  function tileOf(v) { return v && v.closest ? v.closest('.clip') : null; }
  function stopTile(b, back) {
    var v = $('video', b);
    if (back) rest(v); else pause(v);
    b.classList.remove('is-playing');
  }
  function playTile(b) {
    var v = $('video', b);
    if (!v) return;
    if (v.getAttribute('data-poster')) { v.poster = v.getAttribute('data-poster'); v.removeAttribute('data-poster'); }
    b.classList.add('is-playing');
    play(v);
  }
  // one at a time, page-wide: a video that starts pauses all the others (the tiles, the full player)
  document.addEventListener('play', function (e) {
    var v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    $$('video').forEach(function (o) {
      if (o === v || o.paused) return;
      var tb = tileOf(o);
      if (tb) stopTile(tb, false); else o.pause();
    });
  }, true);
  tiles.forEach(function (b) {
    var v = $('video', b), full = b.getAttribute('data-full');
    if (!v) return;
    v.autoplay = false; v.removeAttribute('autoplay');
    v.addEventListener('pause', function () { b.classList.remove('is-playing'); });
    b.addEventListener('click', function () {
      if (full && openPlayer(full, b)) return;
      if (!v.paused) { stopTile(b, false); return; }
      playTile(b);
    });
  });
  // a playing tile that scrolls out of the window stops (no video decodes off screen)
  var clipIO = null;
  function watchClips() {
    if (!('IntersectionObserver' in window)) return;
    if (clipIO) clipIO.disconnect();
    clipIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) { var v = $('video', e.target); if (v && !v.paused) stopTile(e.target, true); } });
    }, { threshold: 0 });
    tiles.forEach(function (b) { clipIO.observe(b); });
  }
  // posters load when their clip is about a screen and a half away, not all at the first screen (QA 12)
  (function () {
    var vids = $$('video[data-poster]');
    var give = function (v) { if (v.getAttribute('data-poster')) { v.poster = v.getAttribute('data-poster'); v.removeAttribute('data-poster'); } };
    if (!('IntersectionObserver' in window)) { vids.forEach(give); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { give(e.target); io.unobserve(e.target); } }); }, { rootMargin: '150% 0px 150% 0px' });
    vids.forEach(function (v) { io.observe(v); });
  })();

  // the full ad with sound, in a plain full-window player
  var player = $('#player'), playerVideo = $('#player-video'), playerClose = $('#player-close'), playerFrom = null;
  function openPlayer(src, from) {
    if (!player || !playerVideo) return false;
    tiles.forEach(function (b) { stopTile(b, false); });
    playerFrom = from;
    playerVideo.src = src;
    if (typeof player.showModal === 'function') player.showModal(); else player.setAttribute('open', '');
    root.classList.add('qv-open');
    call('pause');
    play(playerVideo);
    if (playerClose) playerClose.focus();
    return true;
  }
  function closePlayer() { if (player && player.hasAttribute('open')) { if (typeof player.close === 'function') player.close(); else player.removeAttribute('open'); } }
  if (player) {
    player.addEventListener('close', function () {
      pause(playerVideo); playerVideo.removeAttribute('src'); try { playerVideo.load(); } catch (e) { /* nothing to unload */ }
      root.classList.remove('qv-open');
      call('resume');
      if (playerFrom) playerFrom.focus();
    });
    player.addEventListener('cancel', function (e) { e.preventDefault(); closePlayer(); });
    player.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closePlayer(); } });
    if (playerClose) playerClose.addEventListener('click', closePlayer);
  }

  // ---------- what-if weather ----------
  // P6: the page no longer starts what-ifs (the toy is gone); a planet poke on the first screen still plays one.
  // The what-if sequences (world.js dispatches 'world:whatif' {mode, stage}; mode null = put back).
  // typhoon: the tinyworld field turns a flat storm blue while it runs; stop: a short flat flash to paper on
  // stage 3; gravity: no colour change.
  var flashT = 0;
  function weather(mode, stage) {
    var storm = mode === 'typhoon';
    if (root.classList.contains('storm') !== storm) { root.classList.toggle('storm', storm); recolourChrome(); }
    if (mode === 'stop' && +stage === 3 && !reduced()) {
      clearTimeout(flashT);
      root.classList.add('flash'); recolourChrome();
      flashT = setTimeout(function () { root.classList.remove('flash'); recolourChrome(); }, 140);
    }
  }
  function recolourChrome() {
    if (head) head._f = null;
    if (hudL) hudL._f = null;
    if (hudR) hudR._f = null;
    if (meta && themeStop === 'tinyworld') meta.setAttribute('content', fieldColour('tinyworld'));
    dirty = true;
  }
  window.addEventListener('world:whatif', function (e) {
    var d = e.detail || {};
    var mode = d.mode || null;
    weather(mode, d.stage);
    // the left readout names the what-if while it plays (P5)
    if (whatIfNow !== mode) { whatIfNow = mode; hudPlace(); }
  });

  // ---------- copy the email: the button keeps its size, only the words swap ----------
  var copyBtn = $('#copy-email');
  if (copyBtn) {
    var email = copyBtn.getAttribute('data-email');
    var hint = $('#copy-hint'), copyStatus = $('#copy-status'), fallbackInput = $('#copy-fallback');
    var resetTimer = 0;
    var done = function () {
      copyBtn.classList.add('is-copied');
      if (copyStatus) copyStatus.textContent = 'Email address copied.';
      try { window.dispatchEvent(new CustomEvent('site:copied', { detail: { email: email } })); } catch (e) { /* old browser */ }
      // the HUD says so for 2 s
      copiedUntil = performance.now() + 2000; hudPlace();
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () { copyBtn.classList.remove('is-copied'); copiedUntil = 0; hudPlace(); }, 2000);
    };
    var fallback = function () {
      try {
        fallbackInput.focus(); fallbackInput.select();
        var ok = document.execCommand && document.execCommand('copy');
        copyBtn.focus();
        if (ok) done(); else if (hint) hint.textContent = 'Couldn’t copy here. The address is ' + email + '.';
      } catch (e) { if (hint) hint.textContent = 'Couldn’t copy here. The address is ' + email + '.'; }
    };
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(email).then(done, fallback);
      else fallback();
    });
  }

  // ---------- jumps inside the page: land on the text of the section ("arrived") ----------
  // Round 4: the target is worked out (not left to scrollIntoView), so the two dived sections land arrived (QA 5),
  // and it is checked again when the scroll ends, in case a picture above grew while it ran (QA 3).
  function jumpY(target) {
    var m = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    var y = docRect(target).top - m;
    var s = secs.filter(function (q) { return q.el.contains(target); })[0];
    // a dived section: never land before its dive has finished (the stage may still be widening beside the text)
    if (s && s.dives && T[s.i]) y = Math.max(y, (T[s.i].d1 !== undefined ? T[s.i].d1 : T[s.i].t1) + 1);
    return clamp(Math.round(y), 0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  }
  var jumpFix = null;
  function jumpTo(id, focusHeading, instant) {
    var target = document.getElementById(id);
    if (!target) return false;
    var smoothGo = !instant && !reduced();
    window.scrollTo({ top: jumpY(target), behavior: smoothGo ? 'smooth' : 'auto' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    var h = target.matches('h2') ? target : $('h2', target);
    if (focusHeading && h) h.focus({ preventScroll: true });
    // one check, when this jump's scroll ends (or after a while, if the browser has no scrollend)
    if (jumpFix) { window.removeEventListener('scrollend', jumpFix); clearTimeout(jumpFix.t); }
    var fix = jumpFix = function () {
      window.removeEventListener('scrollend', fix); clearTimeout(fix.t);
      if (jumpFix === fix) jumpFix = null;
      measure();
      var y = jumpY(target);
      if (Math.abs(window.scrollY - y) > 4) window.scrollTo({ top: y, behavior: 'auto' });
    };
    if ('onscrollend' in window && Math.abs(window.scrollY - jumpY(target)) > 1) { window.addEventListener('scrollend', fix); fix.t = setTimeout(fix, 4000); }
    else fix.t = setTimeout(fix, smoothGo ? 1200 : 80);
    return true;
  }
  $$('a[href^="#"]').forEach(function (a) {
    if (a.hasAttribute('data-qv-go') || a.classList.contains('skip')) return;
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      if (!id || !document.getElementById(id)) return;
      e.preventDefault();
      jumpTo(id, true);
      if (head && head.contains(a)) {
        // a mouse click leaves no highlight behind (keyboard focus stays visible)
        head.classList.add('no-hover');
        if (e.detail > 0) a.blur();
      }
    });
  });
  if (head) window.addEventListener('pointermove', function () { if (head.classList.contains('no-hover')) head.classList.remove('no-hover'); }, { passive: true });
  if (head) head.addEventListener('focusin', function () { head.classList.remove('is-hidden'); });

  // ---------- Quick view ----------
  var qv = $('#quick-view'), qvOpen = $('#qv-open'), qvClose = $('#qv-close');
  function focusables() { return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', qv).filter(function (el) { return el.offsetParent !== null; }); }
  function openQV() {
    if (!qv) return;
    if (typeof qv.showModal === 'function') qv.showModal(); else qv.setAttribute('open', '');
    root.classList.add('qv-open');
    call('pause');
    if (qvClose) qvClose.focus();
  }
  function closeQV() {
    if (!qv || !qv.hasAttribute('open')) return;
    if (typeof qv.close === 'function') qv.close(); else qv.removeAttribute('open');
  }
  if (qv) {
    qv.addEventListener('close', function () {
      root.classList.remove('qv-open');
      call('resume');
      if (qvOpen && !qv._going) qvOpen.focus();
      qv._going = false;
    });
    qv.addEventListener('cancel', function (e) { e.preventDefault(); closeQV(); });
    qv.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeQV(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('[data-qv-go]', qv).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        if (!document.getElementById(id)) return;
        e.preventDefault();
        qv._going = true;
        closeQV();
        jumpTo(id, true);
      });
    });
  }
  if (qvOpen) qvOpen.addEventListener('click', openQV);
  if (qvClose) qvClose.addEventListener('click', closeQV);

  // ---------- the footer name fits its letters ----------
  function fitName() {
    var name = $('.foot-name'), nt = name && $('text', name);
    if (!nt) return;
    try { var b = nt.getBBox(); if (b.width > 100) name.setAttribute('viewBox', [Math.floor(b.x), 10, Math.ceil(b.width), 152].join(' ')); } catch (e) { /* keep the written size */ }
  }

  // ---------- entrances (P5): a lead entrance per section, played once ----------
  // When a section's headline reaches the reading area: (1) the headline rises line by line from behind its own
  // baseline (each line masked, 60 to 80 px of travel); (2) then the proof arrives in its own manner (a big figure
  // counts up once to its real value, a picture group opens from a mask or settles from 0.96 scale); (3) then the
  // small lines, row by row. Transform, opacity and clip-path only, staggered 60 to 110 ms, Web Animations (no
  // library). Only sections still wholly below the window when the page starts are held back, and only by an
  // inline opacity this script sets; a section is shown at once, finished, if its headline is already above the
  // reading area when any of it comes into view (a jump, a reload mid-page, scrolling back up). Reduced motion,
  // no script or no Web Animations: nothing is ever hidden.
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var acts = [];
  function countUp(dt, delay) {
    var txt = dt.textContent, m = txt.match(/^([^\d]*)([\d,]+)(.*)$/);
    if (!m) return;
    var end = parseInt(m[2].replace(/,/g, ''), 10), commas = m[2].indexOf(',') >= 0;
    if (!(end > 1)) return;
    var w = dt.getBoundingClientRect().width;
    dt.style.minWidth = Math.ceil(w) + 'px';
    var fmt = function (v) { var t = String(v); return commas ? t.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : t; };
    var t0 = 0, dur = end > 999 ? 1000 : 800;
    // lead r6: a big figure counts in round steps (792,000, 799,000, 800,000), so it never rests on 799,996
    var q = end > 999 ? Math.pow(10, String(end).length - 3) : 1;
    dt.textContent = m[1] + fmt(0) + m[3];
    var step = function (now) {
      if (!t0) t0 = now + delay;
      var k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      dt.textContent = m[1] + fmt(Math.min(end, Math.round(end * e / q) * q)) + m[3];
      if (k < 1) requestAnimationFrame(step); else { dt.textContent = txt; dt.style.minWidth = ''; }
    };
    requestAnimationFrame(step);
  }
  function splitLines(h) {
    var html = h.innerHTML, units = [];
    [].slice.call(h.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        n.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) units.push(document.createTextNode(part));
          else { var w = document.createElement('span'); w.textContent = part; units.push(w); }
        });
      } else if (n.nodeType === 1 && n.tagName !== 'BR') units.push(n.cloneNode(true));
    });
    // measure where each word sits with the heading's own wrapping, then rebuild it as masked lines
    h.textContent = '';
    var spans = [];
    units.forEach(function (u) { h.appendChild(u); });
    var lines = [], cur = null, lastTop = null;
    units.forEach(function (u) {
      var top = u.nodeType === 1 ? u.getBoundingClientRect().top : null;
      if (top !== null && (lastTop === null || Math.abs(top - lastTop) > 4)) { cur = []; lines.push(cur); lastTop = top; }
      if (!cur) { cur = []; lines.push(cur); }
      cur.push(u);
    });
    h.textContent = '';
    lines.forEach(function (l) {
      var o = document.createElement('span'), i = document.createElement('span');
      o.className = 'h-line';
      l.forEach(function (u) { i.appendChild(u); });
      o.appendChild(i); h.appendChild(o); spans.push(i);
    });
    return { lines: spans, restore: function () { h.innerHTML = html; } };
  }
  function smallRows(el) {
    if (el.matches('ul, ol')) return [].slice.call(el.children);
    var rows = [];
    [].slice.call(el.children).forEach(function (c) { if (c.matches('ul, ol')) rows = rows.concat([].slice.call(c.children)); else if (c.matches('.small-col, [data-small], div')) rows = rows.concat(smallRows(c)); else rows.push(c); });
    return rows.length ? rows : [el];
  }
  function partsOf(sec) {
    var col = $('.col-in', sec.el) || $('.hero-inner', sec.el);
    if (!col) return null;
    var h = sec.stop === 'hero' ? $('.headline', sec.el) : $('h2', col);
    var proof = $$('[data-proof]', col);
    if (sec.stop === 'hero') proof = [photoEl, heroFigs].filter(Boolean);
    var small = [];
    $$('[data-small]', col).forEach(function (e) { small = small.concat(smallRows(e)); });
    if (sec.stop === 'hero') small = [heroBio, heroBtn].filter(Boolean);
    if (sec.stop === 'contact') small = [].slice.call(col.children).filter(function (c) { return c !== h; });
    return { h: h, proof: proof, small: small };
  }
  function holdBack(list, on) { list.forEach(function (e) { if (e) e.style.opacity = on ? '0' : ''; }); }
  function finishIn(a) {
    if (a.done) return; a.done = true;
    holdBack([a.p.h].concat(a.p.proof, a.p.small), false);
  }
  function playIn(a) {
    if (a.done) return; a.done = true;
    var P = a.p, h = P.h, t = 0;
    // (1) the headline, line by line
    if (h) {
      var sp = splitLines(h), lh = parseFloat(getComputedStyle(h).lineHeight) || 60;
      var travel = clamp(lh * 0.9, 40, 80), last = null;
      h.style.opacity = '';
      sp.lines.forEach(function (ln, i) {
        last = ln.animate([{ transform: 'translateY(' + travel + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 760, delay: i * 90, easing: EASE, fill: 'backwards' });
      });
      var undo = function () { sp.restore(); };
      if (last) last.onfinish = undo; else undo();
      setTimeout(undo, 2200);
      t = 180 + sp.lines.length * 90;
    }
    // (2) the proof
    P.proof.forEach(function (el, i) {
      if (!el) return;
      el.style.opacity = '';
      var d = t + i * 110;
      if (el.matches('.stat-row, .hero-figs')) {
        $$('.stat, .hero-fig', el).forEach(function (st, j) {
          st.animate([{ translate: '0 24px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 640, delay: d + j * 90, easing: EASE, fill: 'backwards' });
          // pass 3 (4): wide and tall, the figure rolls into place like an odometer; phone keeps the count
          $$('dt[data-count]', st).forEach(function (dt) { if (L.mode !== 'phone') rollFigure(dt, d + j * 90); else countUp(dt, d + j * 90); });
        });
      } else if (el.matches('.pipeline')) {
        // P6: the four steps rise one after another (translate and opacity only: a clip-path animation on these
        // subgrid rows crashed Chrome's page on a phone-sized window)
        [].slice.call(el.children).forEach(function (row, j) {
          row.animate([{ translate: '0 28px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 700, delay: d + j * 80, easing: EASE, fill: 'backwards' });
        });
      } else if (el.matches('.ad-tiles, .reels')) {
        // a strip of clips opens from the bottom, one after another
        [].slice.call(el.children).forEach(function (li, j) {
          li.animate([{ clipPath: 'inset(100% 0 0 0)', translate: '0 32px' }, { clipPath: 'inset(0 0 0 0)', translate: '0 0' }], { duration: 820, delay: d + j * 90, easing: EASE, fill: 'backwards' });
        });
      } else {
        // a picture settles from 0.96 scale
        el.animate([{ scale: '0.96', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 820, delay: d, easing: EASE, fill: 'backwards' });
      }
    });
    t += 140 + P.proof.length * 70;   // lead r6: the small lines follow sooner (a section was read as near-empty 0.7 s after arriving)
    // (3) the small lines, row by row
    P.small.forEach(function (el, i) {
      if (!el) return;
      el.style.opacity = '';
      // pass 3 (8): the email button in Contact opens from its left edge; the hint under it rises as before
      var mail = el.matches('.contact-actions') ? $('.button--email', el) : null;
      if (mail) {
        mail.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 720, delay: t + i * 60, easing: EASE, fill: 'backwards' });
        $$('.contact-hint', el).forEach(function (hint) { hint.animate([{ translate: '0 16px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 600, delay: t + i * 60 + 180, easing: EASE, fill: 'backwards' }); });
        return;
      }
      el.animate([{ translate: '0 16px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 600, delay: t + i * 60, easing: EASE, fill: 'backwards' });
    });
  }
  // the reading area: a headline whose top has come up past this line plays its entrance
  function readArea() { return L.mode === 'wide' ? L.H * 0.78 : (L.clipTop || 0) + (L.H - (L.clipTop || 0)) * 0.78; }
  function revealCheck() {
    if (!acts.length) return;
    var H = L.H || window.innerHeight, line = readArea(), y = window.scrollY;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i]; if (a.done) continue;
      // iPad pass: page positions measured once per layout (docRect, cached), not getBoundingClientRect every
      // scroll frame (each read after the frame's style writes forced a layout of the whole page)
      if (a._mk !== measureN) { a._mk = measureN; a._r = docRect(a.sec.el); a._h = a.p.h ? docRect(a.p.h) : a._r; }
      var r = { top: a._r.top - y, bottom: a._r.bottom - y };
      if (r.bottom < 0 || r.top > H) continue;          // none of it in view yet
      var hr = { top: a._h.top - y, bottom: a._h.bottom - y };
      if (hr.bottom < (L.mode === 'wide' ? 0 : (L.clipTop || 0)) + 8) finishIn(a); // its headline is already past: show it as it is
      else if (hr.top < line) playIn(a);
      // P6: a visitor who stops with a headline low in the window (under the reading area) sees it arrive too,
      // once the scroll has rested 0.7 s, instead of a blank space where it will be
      else if (hr.top < H - 8 && performance.now() - movedAt > 700) playIn(a);
    }
    acts = acts.filter(function (a) { return !a.done; });
  }
  var revealCheckAll = revealCheck;
  revealCheck = function () { revealCheckAll(); subCheck(); };
  function entrances() {
    if (reduced() || !document.body.animate) return;
    var H = window.innerHeight;
    secs.forEach(function (s) {
      var p = partsOf(s); if (!p) return;
      var a = { sec: s, p: p, done: false };
      if (s.stop === 'hero') { if (window.scrollY < 4) playIn(a); return; }
      // only a section still wholly below the window is held back
      if (s.el.getBoundingClientRect().top <= H) return;
      holdBack([p.h].concat(p.proof, p.small), true);
      acts.push(a);
    });
    setInterval(revealCheck, 300);
  }
  // reduced motion switched on while something is held back: show it all, now
  if (reduceQ.addEventListener) reduceQ.addEventListener('change', function () { if (reduced()) acts.forEach(finishIn); });

  // ---------- beats inside a section: how far through its "arrived" stretch the visitor is ----------
  // window event 'site:beat' {stop, p} for every section the camera dives into (tinyworld, Video ads), every frame
  // p changes; p 0..1 runs from the moment the dive arrives to the moment the pull-back starts.
  var lastBeat = '';
  function readMid() { return L.mode === 'wide' ? L.H * 0.5 : L.clipTop + L.viewH * 0.5; }
  function arrivedSpan(i) {
    var s = secs[i]; if (!s || !s.dives || !T[i]) return null;
    var a = T[i].t1, b = (i + 1 < N && T[i + 1]) ? T[i + 1].t0 : endAt;
    return { a: a, b: Math.max(a + 1, b) };
  }
  function sendBeat() {
    var s = secs[S.cur], span = arrivedSpan(S.cur);
    if (!s || !span) return;
    var p = clamp((S.y - span.a) / (span.b - span.a), 0, 1);
    var key = s.stop + ':' + p.toFixed(4);
    if (key === lastBeat) return;
    lastBeat = key;
    var d = { stop: stopName(s.stop), p: p };
    try { window.dispatchEvent(new CustomEvent('site:beat', { detail: d })); } catch (err) { /* old browser */ }
  }

  // ---------- the stage as a real element, named for the place in view ----------
  var stageEl = $('#stage');
  // the two dived places, once arrived
  var PLACE = {
    tinyworld: 'A live 3D scene of Marina Bay in Singapore on the tinyworld planet, with the guy in the yellow shirt on the promenade',
    films: 'A live 3D scene of a drive-in cinema at night, its big screen playing one of his video ads',
    end: 'The whole tinyworld planet, with the guy in the yellow shirt standing on top'
  };
  // the whole planet, turned to each stop, with that stop's small landmark standing on it
  var PLANET = {
    hero: "Tedd's tinyworld planet: a small low-poly globe with a guy in a yellow shirt standing on top",
    films: 'The small tinyworld planet, turned to the ads stop: a drive-in screen and two cars stand on it, with the guy in the yellow shirt on top',
    tinyworld: 'The small tinyworld planet, turned to Marina Bay: Marina Bay Sands and a gorilla stand on it, with the guy in the yellow shirt on top',
    workflow: 'The small tinyworld planet, turned to the AI pipeline stop: a line of four machines stands on it, with the guy in the yellow shirt on top',
    bwgu: 'The small tinyworld planet, turned to the Before We Grow Up stop: a film camera on a tripod, a clapperboard and a light stand on it, with the guy in the yellow shirt on top',
    about: 'The small tinyworld planet, turned to the About stop: a running track and a finish gate stand on it, with the guy in the yellow shirt on top',
    contact: 'The small tinyworld planet, turned to the Contact stop: a red letterbox and a signpost stand on it, with the guy in the yellow shirt on top'
  };
  var LOGO = "Tedd's tinyworld logo: a small low-poly planet with a guy in a yellow shirt standing on top";
  var STILL = {
    hero: LOGO,
    tinyworld: 'Cover of the tinyworld reel: What if you had to fight a silverback gorilla?',
    films: 'Poster frame of one of his video ads: Upgrading from your HDB?',
    workflow: LOGO, bwgu: LOGO, about: LOGO, contact: LOGO
  };
  function paintStage() {
    if (!stageEl || !S.stage) return;
    var st = S.stage, k = st.x + ',' + st.y + ',' + st.w + ',' + st.h;
    if (stageEl._k !== k) {
      stageEl._k = k;
      stageEl.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px)';
      stageEl.style.width = st.w + 'px'; stageEl.style.height = st.h + 'px';
    }
    var stop = secs[S.cur].stop, live = !root.classList.contains('no-world');
    var label = live ? (S.endP > 0.5 ? PLACE.end : (S.dive > 0.5 && PLACE[stop] ? PLACE[stop] : PLANET[stop])) : STILL[stop];
    if (stageEl._l !== label) { stageEl._l = label; stageEl.setAttribute('aria-label', label); }
  }

  // r13 pass A: the Lenis smooth scroll (pass 3 (1)) and the play disc that followed the pointer (pass 3 (7)) are
  // gone: the browser's own scrolling, and the plain pointer over the tiles.

  // ---------- pass 3 (4): the giant figures roll into place like an odometer (wide and tall) ----------
  // each digit is a masked column that rolls up to its digit, the columns 45 ms apart from the left, 600 ms each (pass 4);
  // the comma and the plus rise with their neighbours. Screen readers get the plain figure (aria-label on the dt);
  // the plain text node is back when the roll ends.
  function rollFigure(dt, delay) {
    var txt = dt.textContent;
    if (!/\d/.test(txt) || !dt.animate) return;
    dt._rolling = true; dt._final = txt;
    dt.setAttribute('aria-label', txt);
    dt.textContent = '';
    dt.classList.add('is-rolling');
    var col = -1, last = null, ROW = 1.3, ROWS = 3;
    txt.split('').forEach(function (ch) {
      var o = document.createElement('span'), inner = document.createElement('span');
      o.className = 'odo'; o.setAttribute('aria-hidden', 'true'); inner.className = 'odo-in';
      inner.textContent = ch;
      var digit = /\d/.test(ch);
      if (digit) col++;
      var at = delay + Math.max(0, col) * 45;
      var travel = ROW;
      if (digit) {
        // the digits it passes on the way, stacked above it
        var d = +ch;
        for (var r = 1; r <= ROWS; r++) {
          var s = document.createElement('span');
          s.className = 'odo-s'; s.textContent = String((d - r + 20) % 10);
          s.style.top = (-r * ROW) + 'em';
          inner.appendChild(s);
        }
        travel = ROWS * ROW;
      }
      o.appendChild(inner); dt.appendChild(o);
      last = inner.animate([{ transform: 'translateY(' + travel + 'em)' }, { transform: 'none' }], { duration: 600, delay: at, easing: EASE, fill: 'backwards' });
    });
    var done = function () {
      if (!dt._rolling) return;
      dt._rolling = false;
      dt.classList.remove('is-rolling');
      dt.textContent = dt._final; dt.removeAttribute('aria-label');
    };
    if (last) last.onfinish = done;
    setTimeout(done, delay + 600 + 45 * 12 + 400);
  }

  // ---------- pass 3 (8): entrances that belong to one part of a section, played once as it reaches the reading area ----------
  var subActs = [];
  function subEntrances() {
    if (reduced() || !document.body.animate) return;
    var H = window.innerHeight;
    var add = function (el, items, play) {
      if (!el || !items.length || el.getBoundingClientRect().top <= H) return;
      items.forEach(function (i) { i.style.opacity = '0'; });
      subActs.push({ el: el, items: items, play: play, done: false });
    };
    // the three lessons rise one by one, as a list
    add($('.tests'), $$('.tests > li'), function (items) {
      items.forEach(function (li, j) { li.animate([{ translate: '0 40px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 720, delay: j * 130, easing: EASE, fill: 'backwards' }); });
    });
    // the change log, row by row, 45 ms apart, the marked mistake last and 200 ms later
    var rows = $$('.log tbody tr');
    add($('.log'), rows, function (items) {
      var plain = items.filter(function (r) { return !r.classList.contains('is-mark'); }), mark = items.filter(function (r) { return r.classList.contains('is-mark'); });
      plain.forEach(function (r, j) { r.animate([{ translate: '0 12px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 460, delay: j * 45, easing: EASE, fill: 'backwards' }); });
      mark.forEach(function (r, j) { r.animate([{ translate: '0 12px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 520, delay: plain.length * 45 + 200 + j * 45, easing: EASE, fill: 'backwards' }); });
    });
    // the form's screens open left to right
    add($('.form-screens'), $$('.form-screens > li'), function (items) {
      items.forEach(function (li, j) { li.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 640, delay: j * 90, easing: EASE, fill: 'backwards' }); });
    });
  }
  function subCheck() {
    if (!subActs.length) return;
    // (these parts start as soon as they come up into the window, so they are done by the time they are read)
    var line = window.innerHeight - 40;
    subActs.forEach(function (a) {
      if (a.done) return;
      var r = a.el.getBoundingClientRect();
      if (r.bottom < 0) { a.done = true; a.items.forEach(function (i) { i.style.opacity = ''; }); return; }
      if (r.top < line) {
        a.done = true;
        a.items.forEach(function (i) { i.style.opacity = ''; });
        try { a.play(a.items); } catch (e) { /* shown as it is */ }
      }
    });
    subActs = subActs.filter(function (a) { return !a.done; });
  }

  // ---------- round 11 pass 3: the motion layer. Everything moves because you moved ----------
  // Three kinds of motion only: scrubbed by scroll (it rests when the scroll rests and runs back when it runs back),
  // one-time entrances, and feedback under the pointer. Transform, opacity and clip-path only; sizes are read once
  // per measure() (motionMeasure) and only transforms and opacity are written per frame (motionPaint).
  var MO = { tiles: [], heads: [], pipe: null, foot: null, step: 0, hoverRow: 0 };
  var footChars = [];
  var SVGNS = 'http://www.w3.org/2000/svg';
  // the footer's giant name as one tspan per letter (same text, same place at rest), so its letters can rise one by one
  function splitFootName() {
    var t = $('.foot-name text');
    if (!t || t._split) return;
    t._split = true;
    var s = t.textContent; t.textContent = '';
    s.split('').forEach(function (ch) {
      var ts = document.createElementNS(SVGNS, 'tspan');
      ts.textContent = ch; t.appendChild(ts);
      if (ch.trim()) footChars.push(ts);
    });
  }
  function scrubOk() { return !reduced() && L.mode !== 'phone'; }
  function motionMeasure() {
    var line = readLine(), H = L.H;
    var ref = function (el) { return el ? docRect(el).top - line : 0; };
    // (3) the big media of each work section settle into place as their section reaches its reading position
    MO.tiles = [];
    var group = function (els, r, kind) { els.forEach(function (el, i) { if (el) MO.tiles.push({ el: el, y: r, d: (i + 1) * 28, kind: kind || 'y' }); }); };
    group($$('.ad-pair .clip'), ref($('#ads-h')));
    group($$('.ad-more .clip'), ref($('.more-ads')));
    group($$('.reels .clip'), ref($('#tw-h')));
    group([$('.bwgu-pic img')], ref($('#bw-h')));
    group([$('.about-photo')], ref($('#about-h')), 'scale');
    // (9) the one-line work headlines drift left a little as their section passes
    MO.heads = [];   // r13 pass B: the headlines no longer drift as their section passes
    // (5) the pipeline: where its reading stretch starts, and each row's place for the phone
    var pl = $('.pipeline'), wf = $('#wf-h');
    MO.pipe = pl ? { rows: $$('.pipeline > li').map(function (li) { return { li: li, w: $('.pl-w', li), d: $('.pl-d', li), top: docRect(li).top }; }), a: ref(wf) } : null;
    // (2) the footer name rises as the footer arrives and is up by the time Contact reaches its reading position
    var fn = $('.foot-name');
    if (foot && fn) {
      var ft = docRect(foot).top + (parseFloat(getComputedStyle(foot).paddingTop) || 0);
      var s0 = ft - H, s1 = Math.min(maxScroll, secs[N - 1].top - line);
      if (s1 < s0 + 40) s1 = maxScroll;
      MO.foot = { a: s0, b: Math.max(s0 + 1, s1) };
    }
    dirty = true;
  }
  // the AI pipeline's active step, told to the 3D factory once per change
  function pipeStep(k) {
    if (MO.step === k) return;
    MO.step = k;
    try { window.dispatchEvent(new CustomEvent('site:pipeline', { detail: { step: k } })); } catch (e) { /* old browser */ }
  }
  // pointing at a row makes it the active step (fine pointers; the CSS brings its word to full ink)
  (function () {
    $$('.pipeline > li').forEach(function (li, i) {
      li.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; MO.hoverRow = i + 1; dirty = true; });
      li.addEventListener('pointerleave', function () { if (MO.hoverRow === i + 1) { MO.hoverRow = 0; dirty = true; } });
    });
  })();
  function setT(el, prop, v) { if (el['_m' + prop] !== v) { el['_m' + prop] = v; el.style[prop] = v; } }
  // letter i of n: its own half of the span, the letters one after another from the left
  function letterK(p, i, n) { var w = 0.5, s0 = n > 1 ? i * (1 - w) / (n - 1) : 0; var k = clamp((p - s0) / w, 0, 1); return 1 - Math.pow(1 - k, 3); }
  function motionPaint(y) {
    var H = L.H, on = scrubOk(), fineOn = on && fineQ.matches;
    // (3) media settle
    for (var i = 0; i < MO.tiles.length; i++) {
      var t = MO.tiles[i], k = fineOn ? clamp((t.y - y) / (H * 0.5), 0, 1) : 0;
      k = k * k;
      if (t.kind === 'scale') setT(t.el, 'scale', k > 0.0005 ? (1 + 0.06 * k).toFixed(4) : '');
      else setT(t.el, 'translate', k > 0.0005 ? '0 ' + (t.d * k).toFixed(1) + 'px' : '');
    }
    // (9) headlines drift
    for (var j = 0; j < MO.heads.length; j++) {
      var hd = MO.heads[j], kx = fineOn ? clamp((y - hd.y - 24) / (H * 0.6), 0, 1) : 0; // (a few px of rest at the reading position first)
      setT(hd.el, 'translate', kx > 0.001 ? (-24 * kx).toFixed(1) + 'px 0' : '');
    }
    // (5) the pipeline's words switch on, one after another, as the visitor scrolls through it (pass 4: only the
    // words dim; the sentences are always full ink). The active step (the last word switched on, or the row the
    // pointer is on) lights its tools' lamps in the 3D factory: 'site:pipeline' {step: 1..4, 0 = none}
    if (MO.pipe) {
      var rows = MO.pipe.rows, step = H * 0.15, on = 0;
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r], kw;
        if (L.mode === 'phone') { var mid = readMid(), topW = row.top - y; kw = clamp((mid + L.viewH * 0.15 - topW) / (L.viewH * 0.15), 0, 1); }
        else kw = clamp((y - (MO.pipe.a + (r - 1) * step)) / step, 0, 1);
        if (kw >= 0.999) on = r + 1;
        setT(row.w, 'opacity', '');   // r13 pass B: the words are always at full ink (the dim read as grey decoration)
      }
      var inWf = secs[S.cur] && secs[S.cur].stop === 'workflow';
      pipeStep(inWf ? (MO.hoverRow > 0 ? MO.hoverRow : on) : 0);
    }
    // (2) the footer name rises out of its baseline, letter by letter
    if (footChars.length && MO.foot) {
      var fp = on ? clamp((y - MO.foot.a) / (MO.foot.b - MO.foot.a), 0, 1) : 1, prev = 0;
      for (var c = 0; c < footChars.length; c++) {
        var dn = Math.round((1 - letterK(fp, c, footChars.length)) * 158 * 10) / 10;
        var dy = (dn - prev).toFixed(1); prev = dn;
        if (footChars[c]._dy !== dy) { footChars[c]._dy = dy; if (dy === '0.0') footChars[c].removeAttribute('dy'); else footChars[c].setAttribute('dy', dy); }
      }
    }
  }

  // ---------- debug state for the overlap test (read only) ----------
  window.SITE = {
    // clipTop: where text is clipped now (tall and phone; 0 at the very top, where the hero has no band yet)
    // name: the hero name's cap line in the window now, for the overlap test's one allowed case
    state: function () {
      var nm = null;
      if (L.name && nameEl) {
        var top = secs[0].el.getBoundingClientRect().top;
        nm = { capTop: top + L.name.capTop, capH: L.name.capH, opacity: parseFloat(getComputedStyle(nameEl).opacity), fit: L.heroFit || null, cal: CAL };
      }
      return { layout: L.mode, stage: S.stage, zone: S.zone, from: S.from, to: S.to, roll: S.roll, dive: S.dive, cur: secs[S.cur].stop, phase: S.phase, endP: S.endP, clipTop: L.mode === 'wide' ? 0 : (L.clipNow || 0), clipBand: L.clipTop, headB: L.headB, heroP: S.heroP, name: nm, hand: S.hand, kmK: S.kmK, wipe: S.wipe, kroom: S.kroom, words: S.words, km: kmOf(S.y) };
    },
    kmOf: function (y) { return kmOf(y); },
    // r13 pass D: the scroll at which the run reads km (world.js puts its km boards there)
    yOfKm: function (km) {
      var t = T[1], a = t && t.kmEnd !== undefined ? (t.p0 || 0) : 0, b = t && t.kmEnd !== undefined ? Math.max(a + 1, t.kmEnd) : 0;
      if (!b) return km / 42.195 * kmAt.about;
      if (km <= 1) return a + km * (b - a);
      return b + (km - 1) / 41.195 * Math.max(1, kmAt.about - b);
    },
    pipelineStep: function () { return MO.step || 0; },
    sections: function () { return secs.map(function (s, i) { return { stop: s.stop, top: s.top, bottom: s.bottom, t: T[i] || null }; }); }
  };

  // ---------- start ----------
  function start() {
    lastW = window.innerWidth; lastH = window.innerHeight;
    layout();
    watchClips();
    entrances();
    subEntrances();
    splitFootName();
    fitName();
    requestAnimationFrame(frame);
    var refresh = function () { fitName(); layout(); watchClips(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { measure(); });
      ro.observe($('main'));
      // P5: the hero's words decide where the name, his photo and the planet go; if they change height after the
      // first layout (the web font arrives after load), lay the hero out again
      if (heroInner) {
        var heroH = heroInner.offsetHeight;
        new ResizeObserver(function () { var h = heroInner.offsetHeight; if (Math.abs(h - heroH) > 2) { heroH = h; requestAnimationFrame(refresh); } }).observe(heroInner);
      }
    }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refresh);
    window.addEventListener('resize', function () { /* handled in the frame loop, once per frame */ });
    window.addEventListener('resize', function () { clearTimeout(watchClips._t); watchClips._t = setTimeout(watchClips, 300); });
    if (reduceQ.addEventListener) reduceQ.addEventListener('change', function () { dirty = true; collectBig(); });
    // a hash in the address lands on the section's text
    if (location.hash && location.hash.length > 1) {
      var id = decodeURIComponent(location.hash.slice(1));
      var hid = id === 'uncooked' ? 'bwgu' : id;
      if (document.getElementById(hid)) setTimeout(function () { measure(); jumpTo(hid, false, true); }, 60);
    }
  }
  start();
})();
