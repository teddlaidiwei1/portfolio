/* scenes/ads.js: Meta lead ads, live (scene builder A, v3). The camera dives into this place in the ads section.
   A new launch going up next to an HDB estate, squeezed onto the curve of the planet in the house style (flat colours,
   no sky dome, no fog): two HDB slab blocks (open void deck, corridor windows, a lift lobby, letterboxes), a lawn with
   rain trees, a two-lane road, and across it a condo going up (two part-built towers and a tower crane). At the front:
   HIS roadside billboard, a flat yellow face with three dark bars (a wireframe of an ad: headline, picture, button).
   YOU arrives aged 13 (2020) and grows to 18 as the visitor scrolls through the section's four lines.
   Click a bar on the billboard: that bar changes. Click a second bar while the first is still moving: the billboard
   shakes ("One change at a time"). Shapes and proportions from the reel set tinyworld-base/engine/sets/estate.js and
   tvwindows.js (rescaled, simplified). Scene units: YOU is 1.8 tall. See briefs/world-api.md. */
(function () {
  'use strict';
  function go() {
    var W = window.WORLD;
    if (!W || !W.registerScene) return;

    var S = null, TMP = null;

    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function ease(k, goal, dt, tau) { return k + (goal - k) * (1 - Math.exp(-dt / tau)); }
    function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function outBack(x) { x = clamp(x, 0, 1); var c = 1.9; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; }
    function sfx(name) { try { if (window.SFX && window.SFX.play) window.SFX.play(name); } catch (e) { /* sound is optional */ } }

    // ---------- a baker: static parts merged into one mesh with vertex colours (one draw call) ----------
    function Baker(T, X) { this.T = T; this.X = X; this.list = []; this.m = new T.Matrix4(); this.o = new T.Object3D(); }
    Baker.prototype.add = function (geo, color, matrix) {
      var T = this.T, g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (g.attributes.uv1) g.deleteAttribute('uv1');
      if (matrix) g.applyMatrix4(matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      var c = new T.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(arr, 3));
      g.clearGroups();
      this.list.push(g);
      geo.dispose();
    };
    Baker.prototype.part = function (geo, color, frame, x, y, z, rx, ry, rz, sx, sy, sz) {
      var o = this.o;
      o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0, 'YXZ');
      o.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); o.updateMatrix();
      this.m.copy(o.matrix);
      if (frame) this.m.premultiply(frame);
      this.add(geo, color, this.m);
    };
    Baker.prototype.mesh = function (mat) {
      if (!this.list.length) return null;
      var g = this.X.mergeGeometries(this.list, false);
      this.list.forEach(function (x) { x.dispose(); });
      this.list = [];
      var me = new this.T.Mesh(g, mat);
      me.castShadow = true; me.receiveShadow = true;
      return me;
    };
    function boxG(T, w, h, d) { var g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }
    function cylG(T, rt, rb, h, seg) { var g = new T.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0); return g; }
    // a thin bar from a to b (local points), for crane pendants and lattice diagonals
    function barG(T, ax, ay, az, bx, by, bz, t) {
      var dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var g = new T.BoxGeometry(t, L, t); g.translate(0, L / 2, 0);
      var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / L, dy / L, dz / L));
      g.applyQuaternion(q); g.translate(ax, ay, az);
      return g;
    }

    // ---------- layout (scene units; +z toward the camera) ----------
    var RX = -1.4, RW = 2.2;                       // the road runs along z: centre x and width
    var ROADL = RX - RW / 2, ROADR = RX + RW / 2;
    var BB = { x: 3.0, z: 2.0, ry: -0.12, post: 1.9, w: 4.4, h: 2.8 };  // his billboard
    var HOME = [0.35, 4.5], SPOT = [0.7, 3.15];    // where YOU waits, and where he stands by the billboard
    var LOOP = 30;                                 // seconds for one run of the four beats when the page sends none
    function zLim(x) { return Math.sqrt(Math.max(0, 9.9 * 9.9 - x * x)); }   // how far along z the cap reaches at x

    // street-level camera shots (scene space), one per beat: world.js glides along them with the same p as the beats
    var SHOTS = [
      { pos: [0.6, -1.1, 7.8], look: [2.4, 2.9, 2.0], fov: 55 },     // arrive low beside the kid, looking up at his billboard
      { pos: [0.6, 3.4, 6.2], look: [-3.0, 8.4, -6.0], fov: 58 },      // rise: the rival billboards on the blocks
      { pos: [1.4, 1.9, 5.7], look: [2.2, 1.85, 2.0], fov: 50 },       // push in on the one bar that changes
      { pos: [-3.6, 1.6, -1.3], look: [-5.2, -1.1, -5.0], fov: 52 },   // follow the envelope to the void-deck letterbox
      { pos: [0.25, 0.1, 7.0], look: [2.2, 1.2, 3.0], fov: 55 }       // he stands the billboard back up
    ];
    W.registerScene('ads', {
      shots: SHOTS,
      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, P = ctx.palette, lo = ctx.quality === 'low';
        var root = new T.Group();
        TMP = { m4: new T.Matrix4(), m5: new T.Matrix4(), m6: new T.Matrix4(), q: new T.Quaternion(), q2: new T.Quaternion(), p: new T.Vector3(),
          s: new T.Vector3(), v: new T.Vector3(), up: new T.Vector3(), Y: new T.Vector3(0, 1, 0), Xa: new T.Vector3(1, 0, 0), Za: new T.Vector3(0, 0, 1),
          e: new T.Euler(), one: new T.Vector3(1, 1, 1), col: new T.Color() };
        S = { root: root, T: T, ctx: ctx, lo: lo, kG: 0, kT: 0, kS: 0, mode: null, stopT: 0,
          beatP: 0, gotBeat: false, arrT: -1, beat: -1, beatT0: 0, lastHud: '', hudHold: 0, hudHoldUntil: 0,
          you: { x: HOME[0], z: HOME[1], walking: false, ry: 0.2 }, picked: false, waved: false, thudDone: false,
          shake: -10, scaleB: 0.72, scaleH: 1.18, lastSfx: {} };
        var vcol = ctx.mat('#ffffff', { vertexColors: true });
        var bake = new Baker(T, X);
        var dummy = new T.Object3D();
        function frameAt(x, z, ry, dy) { ctx.plant(dummy, x, z, ry); dummy.position.y += dy || 0; dummy.updateMatrix(); return dummy.matrix.clone(); }
        function holderAt(F) { var h = new T.Group(); h.matrixAutoUpdate = false; h.matrix.copy(F); root.add(h); return h; }
        S.own = [];   // materials and textures made here (not from ctx.mat): freed in dispose
        function basic(color) { var m = new T.MeshBasicMaterial({ color: color }); m.toneMapped = false; S.own.push(m); return m; }

        // ---------- ground: a curved cap; HDB lawn on the left, the building site and a plaza on the right ----------
        var RINGS = lo ? 14 : 22, SEG = lo ? 36 : 56, RMAX = 10.2;
        var cap = new T.BufferGeometry(), pos = [], cols = [];
        var cL1 = new T.Color(P.land), cL2 = new T.Color(P.land2), cDirt = new T.Color('#c9a77c'), cDirt2 = new T.Color('#bf9c6f'), cPlaza = new T.Color('#e6ddcb');
        function zone(x, z) {
          var hsh = hash(Math.floor(x * 0.9) * 12.99 + Math.floor(z * 0.9) * 78.23);
          if (x > ROADR + 0.4 && z < -1.7) return hsh > 0.6 ? cDirt2 : cDirt;
          if (x > ROADR + 0.4 && z > -1.7 && z < 0.9 && x < 6.8) return cPlaza;
          return hsh > 0.72 ? cL2 : cL1;
        }
        for (var ri = 0; ri < RINGS; ri++) {
          var r0 = RMAX * ri / RINGS, r1 = RMAX * (ri + 1) / RINGS;
          for (var si = 0; si < SEG; si++) {
            var a0 = si / SEG * Math.PI * 2, a1 = (si + 1) / SEG * Math.PI * 2;
            var pp = [[r0, a0], [r0, a1], [r1, a0], [r1, a1]].map(function (q) { var x = q[0] * Math.cos(q[1]), z = q[0] * Math.sin(q[1]); return [x, ctx.groundY(x, z) + 0.03, z]; });
            var tris = ri === 0 ? [[pp[0], pp[3], pp[2]]] : [[pp[0], pp[3], pp[2]], [pp[0], pp[1], pp[3]]];
            tris.forEach(function (tr) {
              var c = zone((tr[0][0] + tr[1][0] + tr[2][0]) / 3, (tr[0][2] + tr[1][2] + tr[2][2]) / 3);
              tr.forEach(function (p) { pos.push(p[0], p[1], p[2]); cols.push(c.r, c.g, c.b); });
            });
          }
        }
        cap.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        cap.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
        cap.computeVertexNormals();
        var capMesh = new T.Mesh(cap, vcol); capMesh.receiveShadow = true;
        root.add(capMesh);

        // strips laid on the curve (road, footpaths): a grid that follows the ground, crisp edges
        function strip(x0, x1, z0, z1, color, lift) {
          var nx = Math.max(1, Math.ceil((x1 - x0) / 0.8)), nz = Math.max(1, Math.ceil((z1 - z0) / 0.8)), sp = [];
          function v(i, j) { var x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; return [x, ctx.groundY(x, z) + lift, z]; }
          for (var i = 0; i < nx; i++) for (var j = 0; j < nz; j++) {
            var a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
            sp.push(a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
          }
          var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); g.computeVertexNormals();
          bake.add(g, color, null);
        }
        function zl(a, b) { return zLim(Math.max(Math.abs(a), Math.abs(b))); }
        strip(ROADL, ROADR, -zl(ROADL, ROADR), zl(ROADL, ROADR), '#5d6066', 0.06);               // asphalt
        strip(ROADL - 0.16, ROADL, -zl(ROADL - 0.16, ROADL), zl(ROADL - 0.16, ROADL), '#cfc8bb', 0.1);   // kerbs
        strip(ROADR, ROADR + 0.16, -zl(ROADR, ROADR + 0.16), zl(ROADR, ROADR + 0.16), '#cfc8bb', 0.1);
        strip(ROADL - 1.0, ROADL - 0.16, -zl(ROADL - 1.0, ROADL), zl(ROADL - 1.0, ROADL), '#d8d0c0', 0.05);  // footpaths beside the road
        strip(ROADR + 0.16, ROADR + 1.15, -1.7, zl(ROADR, ROADR + 1.15), '#d8d0c0', 0.05);
        strip(-7.4, ROADL - 1.0, -3.75, -3.05, '#d8d0c0', 0.05);                                  // path in front of block A
        for (var dz = -9; dz < 9; dz += 1.2) {                                                    // dashed centre line
          if (Math.abs(dz) > zLim(RX) - 0.6) continue;
          bake.part(boxG(T, 0.08, 0.02, 0.6), '#f2f0ea', frameAt(RX, dz, 0, 0.06), 0, 0, 0);
        }
        for (var zi = 0; zi < 6; zi++) bake.part(boxG(T, RW * 0.85, 0.02, 0.22), '#f2f0ea', frameAt(RX, 7.0 + zi * 0.42 - 1.0, 0, 0.06), 0, 0, 0);   // zebra crossing

        // ---------- HDB slab block (from estate.js: void deck, pillars with a painted band, lift lobby, corridor face) ----------
        S.panes = []; S.lifts = [];
        function hdbBlock(F, o) {
          var w = o.w, d = o.d, deck = o.deck, ph = o.ph, nf = o.floors, H = nf * ph, face = (d - 0.1) / 2, b = o.bake || bake;
          b.part(boxG(T, w + 0.3, 1.2, d + 0.3), '#cfc8bb', F, 0, -1.2, 0);           // plinth (the block stands level on the curve)
          b.part(boxG(T, w + 0.3, 0.06, d + 0.3), '#d8d2c6', F, 0, 0, 0);             // the tiled void deck floor
          var nc = Math.max(3, Math.round(w / 1.25));
          for (var i = 0; i <= nc; i++) {
            var px = -w / 2 + 0.2 + i * (w - 0.4) / nc;
            [d / 2 - 0.22, -d / 2 + 0.22].forEach(function (pz) {
              if (o.lift && Math.abs(px) < 1.0 && pz < 0) return;
              b.part(boxG(T, 0.26, deck, 0.26), '#f1ece2', F, px, 0, pz);
              b.part(boxG(T, 0.29, 0.42, 0.29), '#5aa6a0', F, px, 0, pz);
            });
          }
          b.part(boxG(T, w, 0.25, d), '#e9e2d4', F, 0, deck, 0);                       // slab over the void deck
          b.part(boxG(T, w, H, d - 0.1), '#ece4d3', F, 0, deck + 0.25, 0);             // the floors
          var bandH = ph * 0.52, np = Math.max(4, Math.floor(w / 0.62));
          for (var f = 0; f < nf; f++) {
            var y0 = deck + 0.25 + f * ph;
            b.part(boxG(T, w + 0.02, bandH, 0.08), o.recess || '#8e8a84', F, 0, y0 + 0.1, face + 0.02);     // the corridor
            b.part(boxG(T, w + 0.04, 0.06, 0.12), '#5aa6a0', F, 0, y0 + 0.1 + bandH + 0.12, face + 0.04);  // colour stripe on the parapet
            b.part(boxG(T, w + 0.02, bandH * 0.8, 0.06), '#d9d2c4', F, 0, y0 + 0.12, -face - 0.02);        // the back
            for (var k = 0; k < np; k++) {
              var wx = -w / 2 + (k + 0.5) * w / np;
              S.panes.push({ F: F, x: wx, y: y0 + 0.1 + bandH * 0.5, z: face + 0.075, i: S.panes.length, f: f, k: k });
              b.part(boxG(T, 0.38, 0.38, 0.03), '#5d6066', F, wx, y0 + 0.1 + bandH * 0.5 - 0.19, face + 0.06);   // window frame
            }
          }
          [-1, 1].forEach(function (s) { b.part(boxG(T, 0.04, 0.14, d - 0.1), '#5aa6a0', F, s * (w / 2 + 0.01), deck + 0.25 + H - 0.22, 0); });
          var top = deck + 0.25 + H;
          b.part(boxG(T, w + 0.12, 0.22, d + 0.02), '#ddd5c5', F, 0, top, 0);          // roof parapet
          b.part(boxG(T, w * 0.18, 0.5, d * 0.5), '#d8d0c0', F, -w / 4, top + 0.22, 0);   // water tank / lift motor rooms
          b.part(boxG(T, w * 0.12, 0.38, d * 0.42), '#cfc6b4', F, w / 4, top + 0.22, 0);
          if (o.lift) {
            var cz = -d / 2 + 0.08;
            b.part(boxG(T, 2.0, deck, 0.8), '#e4ddd0', F, 0, 0, cz + 0.4 - 0.4);         // lift core
            var holder = holderAt(F), doors = [];
            var steel = ctx.mat('#c9ccd0', { roughness: 0.4 }), dark = ctx.mat('#2b2f36');
            [-0.5, 0.5].forEach(function (lx) {
              b.part(boxG(T, 0.7, 1.3, 0.04), '#9c9a96', F, lx, 0.04, cz + 0.82);       // frame
              ctx.box(holder, 0.6, 1.2, 0.02, dark, lx, 0.06, cz + 0.845);               // the lift car, dark
              var halves = [-1, 1].map(function (s) { return ctx.box(holder, 0.3, 1.2, 0.03, steel, lx + s * 0.15, 0.06, cz + 0.87); });
              doors.push({ lx: lx, halves: halves });
            });
            S.lifts.push({ doors: doors, ph: S.lifts.length * 3.7 });
          }
          return { F: F, w: w, d: d, top: top + 0.22, deck: deck, face: face };
        }

        // block A: at the back on the left, facing the camera (lift lobby, letterboxes)
        var FA = frameAt(-3.7, -6.0, 0.3, 0);
        var blockA = hdbBlock(FA, { w: 5.6, d: 2.0, deck: 1.9, ph: 0.8, floors: lo ? 8 : 9, lift: true });
        // letterbox wall in block A's void deck (the envelope goes into one slot)
        var LBX = -1.75, LBZ = blockA.d / 2 - 0.55;
        bake.part(boxG(T, 1.15, 0.95, 0.16), '#9aa3ab', FA, LBX, 0.45, LBZ);
        for (var lc = 0; lc < 4; lc++) for (var lr = 0; lr < 3; lr++) bake.part(boxG(T, 0.22, 0.24, 0.02), '#c4cbd1', FA, LBX - 0.42 + lc * 0.28, 0.52 + lr * 0.29, LBZ + 0.08);
        for (lc = 0; lc < 4; lc++) for (lr = 0; lr < 3; lr++) bake.part(boxG(T, 0.14, 0.025, 0.012), '#3a3a3a', FA, LBX - 0.42 + lc * 0.28, 0.7 + lr * 0.29, LBZ + 0.095);
        S.slot = new T.Vector3(LBX - 0.14, 0.99, LBZ + 0.12).applyMatrix4(FA);
        // a stone chess table in the void deck
        bake.part(cylG(T, 0.32, 0.32, 0.06, 10), '#bfb8aa', FA, 1.8, 0.42, 0.1);
        bake.part(cylG(T, 0.1, 0.14, 0.42, 7), '#bfb8aa', FA, 1.8, 0, 0.1);

        // block B (high tier): to the left, its corridor turned toward the road
        var bakeB = lo ? null : new Baker(T, X), blockB = null;
        var FB = frameAt(-6.9, -1.7, 0.95, 0);
        if (!lo) blockB = hdbBlock(FB, { w: 4.2, d: 1.8, deck: 1.8, ph: 0.8, floors: 6, bake: bakeB });

        // ---------- rain trees on the lawn (trunks static, canopies sway) ----------
        S.trees = [];
        var treeSpots = lo ? [[-4.6, 1.0, 0.95], [-3.9, 4.0, 0.8]] : [[-4.6, 1.0, 0.95], [-3.9, 4.0, 0.8], [-6.5, 3.4, 0.85], [6.1, 1.4, 0.8], [5.2, 4.7, 0.72]];
        var leaf = ['#4f7f3a', '#5f8f45', '#43703a'];
        treeSpots.forEach(function (tp, k) {
          var F = frameAt(tp[0], tp[1], k * 1.3, 0), sk = tp[2];
          bake.part(cylG(T, 0.1 * sk, 0.15 * sk, 1.5 * sk, 6), '#6b5440', F, 0, 0, 0);
          var cb = new Baker(T, X);
          for (var i = 0; i < 4; i++) cb.part(new T.IcosahedronGeometry(0.75 * sk, 0), leaf[(i + k) % 3], null, Math.cos(i * 2.1) * 0.55 * sk, 1.55 * sk + (i % 2) * 0.22 * sk, Math.sin(i * 2.1) * 0.55 * sk, 0, i, 0, 1.35, 0.6, 1.2);
          var crown = cb.mesh(vcol);
          var g = holderAt(F), sw = new T.Group(); g.add(sw); sw.add(crown);
          S.trees.push({ g: sw, ph: k * 1.7 + tp[0] });
        });

        // ---------- the new launch across the road: hoarding, two part-built towers, a site cabin ----------
        for (var hx = ROADR + 1.2; hx < 6.4; hx += 1.15) bake.part(boxG(T, 1.12, 0.85, 0.08), '#f2f0ea', frameAt(hx + 0.56, -1.95, 0, 0), 0, 0, 0);
        for (var hz = -2.0; hz > -8.6; hz -= 1.15) { if (hz * hz + 1.0 > 81) break; bake.part(boxG(T, 0.08, 0.85, 1.12), '#f2f0ea', frameAt(ROADR + 1.2, hz - 0.56, 0, 0), 0, 0, 0); }
        for (hx = ROADR + 1.2; hx < 6.4; hx += 1.15) bake.part(boxG(T, 1.12, 0.12, 0.1), '#29A8C9', frameAt(hx + 0.56, -1.95, 0, 0), 0, 0.62, 0);
        function tower(F, w, done, bare, ph) {
          bake.part(boxG(T, w + 0.2, 1.0, w + 0.2), '#c9c4ba', F, 0, -1.0, 0);
          var y = 0;
          for (var f = 0; f < done; f++, y += ph) {
            bake.part(boxG(T, w, ph - 0.08, w), f % 2 ? '#BFE2F2' : '#b4d9ec', F, 0, y, 0);
            bake.part(boxG(T, w + 0.12, 0.08, w + 0.12), '#f4f2ec', F, 0, y + ph - 0.08, 0);
          }
          for (f = 0; f < bare; f++, y += ph) {
            [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]].forEach(function (c) { bake.part(boxG(T, 0.16, ph - 0.08, 0.16), '#bdb7ab', F, c[0] * (w / 2 - 0.1), y, c[1] * (w / 2 - 0.1)); });
            bake.part(boxG(T, w + 0.12, 0.1, w + 0.12), '#c9c4ba', F, 0, y + ph - 0.1, 0);
          }
          // formwork edge and safety net on the top working floor
          bake.part(boxG(T, w + 0.2, 0.32, 0.05), '#d98c3a', F, 0, y, w / 2 + 0.08);
          bake.part(boxG(T, 0.05, 0.32, w + 0.2), '#d98c3a', F, w / 2 + 0.08, y, 0);
          bake.part(boxG(T, w + 0.14, ph * 0.7, 0.03), '#5f9a6a', F, 0, y - ph * 0.85, -w / 2 - 0.08);
          return y;
        }
        var T1 = { x: 1.7, z: -5.9 }, T2 = { x: 6.5, z: -3.3 };
        var F1 = frameAt(T1.x, T1.z, 0.08, 0), F2 = frameAt(T2.x, T2.z, -0.1, 0);
        var t1top = tower(F1, 2.2, lo ? 6 : 8, 2, 0.72);
        var t2top = tower(F2, 1.9, 4, 1, 0.72);
        S.t1Top = new T.Vector3(0.2, t1top + 0.05, 0.2).applyMatrix4(F1);
        bake.part(boxG(T, 1.5, 0.75, 0.75), '#e8e4da', frameAt(1.75, -3.0, 0.1, 0), 0, 0, 0);          // site office cabin
        bake.part(boxG(T, 1.52, 0.1, 0.77), '#2f3b5c', frameAt(1.75, -3.0, 0.1, 0), 0, 0.5, 0);

        // ---------- the tower crane (mast static, the top slews and lifts a pallet) ----------
        var CR = { x: 3.9, z: -6.9 }, MAST = 9.4;
        var FC = frameAt(CR.x, CR.z, 0, 0);
        bake.part(boxG(T, 1.0, 0.3, 1.0), '#9a948a', FC, 0, -0.2, 0);
        var mw = 0.36;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { bake.part(boxG(T, 0.06, MAST, 0.06), '#f4f2ec', FC, c[0] * mw / 2, 0, c[1] * mw / 2); });
        for (var my = 0.3; my < MAST - 0.2; my += lo ? 1.2 : 0.6) {
          bake.part(boxG(T, mw, 0.05, 0.05), '#E8412B', FC, 0, my, mw / 2); bake.part(boxG(T, mw, 0.05, 0.05), '#f4f2ec', FC, 0, my, -mw / 2);
          bake.part(boxG(T, 0.05, 0.05, mw), '#f4f2ec', FC, mw / 2, my, 0); bake.part(boxG(T, 0.05, 0.05, mw), '#f4f2ec', FC, -mw / 2, my, 0);
          if (!lo) bake.add(barG(T, -mw / 2, my, mw / 2, mw / 2, my + 0.6, mw / 2, 0.035), '#f4f2ec', FC);
        }
        var crane = holderAt(FC), slew = new T.Group(); slew.position.y = MAST; crane.add(slew);
        var jb = new Baker(T, X), JL = 4.4, CJ = 1.6;
        jb.part(boxG(T, 0.5, 0.35, 0.5), '#3a3a3a', null, 0, 0, 0);                                   // slewing ring
        jb.part(boxG(T, 0.55, 0.5, 0.45), '#f4f2ec', null, 0.15, -0.55, 0.42);                        // cab
        jb.part(boxG(T, 0.4, 0.24, 0.05), '#29A8C9', null, 0.15, -0.42, 0.65);
        jb.add(barG(T, 0, 0.35, -0.13, JL, 0.35, -0.13, 0.05), '#f4f2ec', null);                     // jib chords
        jb.add(barG(T, 0, 0.35, 0.13, JL, 0.35, 0.13, 0.05), '#f4f2ec', null);
        jb.add(barG(T, 0, 0.65, 0, JL, 0.48, 0, 0.05), '#f4f2ec', null);
        for (var jx = 0.3; jx < JL - 0.1; jx += lo ? 0.9 : 0.45) { jb.add(barG(T, jx, 0.35, -0.13, jx + 0.22, 0.6, 0, 0.03), '#E8412B', null); jb.add(barG(T, jx, 0.35, 0.13, jx + 0.22, 0.6, 0, 0.03), '#E8412B', null); }
        jb.part(boxG(T, CJ, 0.18, 0.4), '#f4f2ec', null, -CJ / 2, 0.35, 0);                          // counter-jib
        jb.part(boxG(T, 0.55, 0.55, 0.5), '#9a948a', null, -CJ + 0.3, 0.05, 0);                      // counterweight
        jb.add(barG(T, 0, 0.35, 0, 0, 1.6, 0, 0.08), '#f4f2ec', null);                               // the A-frame
        jb.add(barG(T, 0, 1.6, 0, JL * 0.72, 0.6, 0, 0.025), '#3a3a3a', null);                       // pendants
        jb.add(barG(T, 0, 1.6, 0, -CJ + 0.2, 0.5, 0, 0.025), '#3a3a3a', null);
        jb.part(boxG(T, 0.18, 0.18, 0.5), '#E8412B', null, JL, 0.3, 0);
        slew.add(jb.mesh(vcol));
        var trolley = new T.Group(); trolley.position.y = 0.32; slew.add(trolley);
        ctx.box(trolley, 0.3, 0.12, 0.34, '#3a3a3a', 0, -0.1, 0);
        var cableG = new T.BoxGeometry(0.03, 1, 0.03); cableG.translate(0, -0.5, 0);
        var cable = new T.Mesh(cableG, ctx.mat('#262626')); trolley.add(cable);
        var hook = new T.Group(); trolley.add(hook);
        ctx.box(hook, 0.16, 0.18, 0.16, '#E8412B', 0, -0.18, 0);
        // pallets: on the hook, waiting on the ground, set down on the tower
        function palletG() {
          var pb = new Baker(T, X);
          pb.part(boxG(T, 0.7, 0.1, 0.7), '#b07a4a', null, 0, 0, 0);
          for (var i = 0; i < 4; i++) pb.part(boxG(T, 0.3, 0.22, 0.3), i % 2 ? '#d9d4ca' : '#c4bdb0', null, (i % 2 - 0.5) * 0.32, 0.1, (Math.floor(i / 2) - 0.5) * 0.32);
          pb.part(boxG(T, 0.3, 0.2, 0.3), '#d9d4ca', null, 0.05, 0.32, 0);
          var m = pb.mesh(vcol); return m;
        }
        var hookPallet = palletG(); hookPallet.position.y = -0.78; hook.add(hookPallet);
        var groundPallet = palletG(); root.add(groundPallet);
        var towerPallet = palletG(); root.add(towerPallet);
        var invC = new T.Matrix4().copy(FC).invert();
        var pick = new T.Vector3(4.9, 0, -4.2); S.pick = pick; pick.y = ctx.groundY(pick.x, pick.z);
        ctx.plant(groundPallet, pick.x, pick.z, 0.3);
        towerPallet.position.copy(S.t1Top); towerPallet.quaternion.copy(new T.Quaternion().setFromRotationMatrix(F1));
        var pl = pick.clone().applyMatrix4(invC), dl = S.t1Top.clone().applyMatrix4(invC);
        S.crane = { slew: slew, trolley: trolley, cable: cable, hook: hook, hookPallet: hookPallet, groundPallet: groundPallet, towerPallet: towerPallet,
          // in the slewing frame (origin at the mast top): the hook's height when the pallet's base sits on the point
          thP: Math.atan2(-pl.z, pl.x), rP: Math.min(JL - 0.3, Math.hypot(pl.x, pl.z)), yP: pl.y - MAST + 0.78,
          thD: Math.atan2(-dl.z, dl.x), rD: Math.min(JL - 0.3, Math.hypot(dl.x, dl.z)), yD: dl.y - MAST + 0.78 };

        // ---------- HIS billboard: flat yellow face, three dark bars (headline, picture, button). No text. ----------
        var board = new T.Group(); ctx.plant(board, BB.x, BB.z, BB.ry); root.add(board);
        board.userData.clickable = 'billboard';
        var tilt = new T.Group(); board.add(tilt);           // pivot at the post bases: topples forward
        var shake = new T.Group(); tilt.add(shake);
        var postM = ctx.mat('#3a3a3a');
        [-1, 1].forEach(function (s) { ctx.box(shake, 0.22, BB.post + 0.2, 0.22, postM, s * BB.w * 0.3, 0, -0.12); });
        ctx.box(shake, BB.w + 0.3, BB.h + 0.3, 0.2, '#262626', 0, BB.post - 0.15, -0.12);            // frame
        var faceM = ctx.box(shake, BB.w, BB.h, 0.08, basic(P.yellow), 0, BB.post, 0.0);                // the yellow face (flat, unlit)
        ctx.box(shake, BB.w * 0.7, 0.1, 0.5, '#3a3a3a', 0, BB.post - 0.3, 0.05);                       // the service walkway
        [-1.5, 0, 1.5].forEach(function (lx) {                                                             // flood lamps on arms
          ctx.box(shake, 0.05, 0.05, 0.55, '#3a3a3a', lx, BB.post + BB.h + 0.12, 0.2);
          ctx.box(shake, 0.32, 0.12, 0.16, '#d9d4ca', lx, BB.post + BB.h + 0.06, 0.45);
        });
        [-1, 1].forEach(function (s2) { var br = ctx.box(shake, 0.07, BB.h * 1.05, 0.07, '#3a3a3a', s2 * BB.w * 0.18, BB.post, -0.26); br.rotation.z = s2 * 0.75; });
        ctx.box(shake, BB.w * 0.7, 0.04, 0.03, '#3a3a3a', 0, BB.post - 0.3 + 0.38, 0.29);                 // walkway rail
        var barCache = {}, barMat = function (c) { return barCache[c] || (barCache[c] = basic(c)); };
        // bar variants: [width scale, height scale, colour]
        var VAR = [
          [[1, 1, '#1d1d1d'], [0.6, 1, '#1d1d1d'], [1, 1.45, '#2f3b5c']],
          [[1, 1, '#1d1d1d'], [0.68, 1, '#1d1d1d'], [1, 1, P.sea]],
          [[1, 1, '#1d1d1d'], [1.55, 1.05, P.red], [0.75, 1.25, '#2f3b5c']]
        ];
        var BAR = [ // base size and where it sits on the face (x is the left edge, so a bar grows to the right)
          { w: 3.7, h: 0.42, x: -1.85, y: BB.post + BB.h - 0.7 },
          { w: 3.7, h: 1.12, x: -1.85, y: BB.post + 0.86 },
          { w: 1.45, h: 0.42, x: -1.85, y: BB.post + 0.25 }
        ];
        S.bars = BAR.map(function (b, i) {
          var g = new T.Group(); g.position.set(b.x, b.y, 0.06); shake.add(g);
          var geo = new T.BoxGeometry(1, 1, 0.06); geo.translate(0.5, 0.5, 0.03);
          var m = new T.Mesh(geo, barMat(VAR[i][0][2])); m.scale.set(b.w, b.h, 1); m.castShadow = true;
          m.userData.bar = i; g.add(m);
          return { g: g, m: m, base: b, v: 0, from: 0, t0: -10, i: i };
        });
        S.VAR = VAR; S.barMat = barMat;
        S.board = { g: board, tilt: tilt, shake: shake, face: faceM };
        var hit = new T.Mesh(new T.BoxGeometry(BB.w + 0.6, BB.h + 0.6, 0.6), new T.MeshBasicMaterial({ visible: false }));
        hit.position.set(0, BB.post + BB.h / 2, 0.1); hit.userData.noBounds = true; hit.userData.boardHit = true;
        S.own.push(hit.material);
        shake.add(hit);

        // ---------- four blank rival billboards on the far blocks (they rise in beat 1) ----------
        S.rivals = [];
        var rivalCols = ['#f4f2ec', '#BFE2F2', '#F2EBDD', '#d9d4ca'];
        var spots = [[FA, -1.5, blockA.top, 0], [FA, 1.6, blockA.top, 0]];
        if (blockB) spots.push([FB, 0.4, blockB.top, 0]);
        else spots.push([FA, -0.1, blockA.top, 0]);
        spots.push([F2, 0, t2top + 0.1, 0]);
        spots.forEach(function (sp, k) {
          var h = holderAt(sp[0]), g = new T.Group(); g.position.set(sp[1], sp[2], 0); h.add(g);
          [-0.45, 0.45].forEach(function (x) { ctx.box(g, 0.08, 0.7, 0.08, '#3a3a3a', x, 0, 0); });
          ctx.box(g, 1.7, 1.05, 0.12, '#3a3a3a', 0, 0.62, -0.02);
          ctx.box(g, 1.54, 0.9, 0.06, rivalCols[k], 0, 0.695, 0.06);
          g.scale.set(1, 0.001, 1); g.visible = false;
          var wp = new T.Vector3(sp[1], sp[2] + 1.2, 0).applyMatrix4(sp[0]);
          S.rivals.push({ g: g, look: wp, risen: false });
        });

        // ---------- corridor windows: one instanced mesh, flat colours that switch ----------
        if (blockB) { var bm = bakeB.mesh(vcol); root.add(bm); S.blockBMesh = bm; }
        var NPn = S.panes.length;
        var paneMat = basic('#ffffff');
        var panes = ctx.instanced(new T.PlaneGeometry(0.3, 0.3), paneMat, NPn);
        panes.castShadow = false;
        S.panes.forEach(function (p, i) {
          TMP.m4.makeTranslation(p.x, p.y, p.z).premultiply(p.F);
          panes.setMatrixAt(i, TMP.m4);
          panes.setColorAt(i, TMP.col.set('#c9d3d8'));
        });
        panes.instanceMatrix.needsUpdate = true;
        root.add(panes);
        S.paneMesh = panes; S.paneLast = new Int8Array(NPn).fill(-1);
        S.paneCols = ['#c9d3d8', '#b9c4cc', '#ffd98a', '#58c4b8', '#7aa7e8', '#f2a77a', '#5d6670'].map(function (c) { return new T.Color(c); });

        // ---------- cars on the road (high tier) ----------
        var NC = lo ? 0 : 5;
        if (NC) {
          var cb2 = new Baker(T, X);
          cb2.part(boxG(T, 0.72, 0.36, 1.5), '#ffffff', null, 0, 0.12, 0);
          cb2.part(boxG(T, 0.62, 0.3, 0.8), '#ffffff', null, 0, 0.48, -0.08);
          cb2.part(boxG(T, 0.64, 0.22, 0.82), '#2b2f36', null, 0, 0.52, -0.08);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { cb2.part(boxG(T, 0.1, 0.24, 0.3), '#1d1d1d', null, c[0] * 0.33, 0, c[1] * 0.45); });
          cb2.part(boxG(T, 0.5, 0.1, 0.04), '#fff6dc', null, 0, 0.3, 0.75);
          var carGeo = cb2.mesh(vcol).geometry;
          var cars = ctx.instanced(carGeo, vcol, NC);
          var carCols = [P.white, P.sea, '#2f3b5c', P.red, '#d9d4ca'];
          for (var ci = 0; ci < NC; ci++) cars.setColorAt(ci, TMP.col.set(carCols[ci]));
          cars.castShadow = true;
          root.add(cars);
          S.cars = { mesh: cars, n: NC };
        }

        // ---------- generic walkers (high tier): legs, torso, head, hair, two arms; never yellow ----------
        var NW = lo ? 0 : 5;
        if (NW) {
          var legG = boxG(T, 0.13, 0.76, 0.15); legG.translate(0, -0.76, 0);
          var armG = boxG(T, 0.09, 0.52, 0.1); armG.translate(0, -0.52, 0);
          var torsoG = boxG(T, 0.42, 0.56, 0.24);
          var hb = new Baker(T, X);
          hb.part(boxG(T, 0.26, 0.27, 0.26), P.skin, null, 0, 0, 0);
          hb.part(boxG(T, 0.29, 0.08, 0.29), '#1d1d1d', null, 0, 0.25, 0);
          hb.part(boxG(T, 0.29, 0.16, 0.06), '#1d1d1d', null, 0, 0.12, -0.13);
          var headG = hb.mesh(vcol).geometry;
          var white = ctx.mat('#ffffff');
          S.walk = { n: NW, legL: ctx.instanced(legG, white, NW), legR: ctx.instanced(legG.clone(), white, NW), armL: ctx.instanced(armG, ctx.mat(P.skin), NW),
            armR: ctx.instanced(armG.clone(), ctx.mat(P.skin), NW), torso: ctx.instanced(torsoG, white, NW), head: ctx.instanced(headG, vcol, NW), list: [] };
          var shirts = [P.white, '#8fd3e6', P.orange, '#9aa0a6', P.red];
          var legsC = ['#2f3b5c', '#55595e', '#2f3b5c', '#3d4a6b', '#55595e'];
          // paths: [x0, z0, x1, z1]
          var paths = [[-7.0, -3.4, -3.7, -3.4], [-4.0, -3.45, -6.9, -3.45], [ROADL - 0.55, -6.6, ROADL - 0.55, 5.8], [ROADL - 0.62, 5.4, ROADL - 0.62, -6.0], [ROADR + 0.6, -1.3, ROADR + 0.6, 1.5]];
          for (var wi = 0; wi < NW; wi++) {
            S.walk.torso.setColorAt(wi, TMP.col.set(shirts[wi]));
            S.walk.legL.setColorAt(wi, TMP.col.set(legsC[wi])); S.walk.legR.setColorAt(wi, TMP.col.set(legsC[wi]));
            var pth = paths[wi];
            S.walk.list.push({ p: pth, len: Math.hypot(pth[2] - pth[0], pth[3] - pth[1]), sp: 0.55 + hash(wi) * 0.25, ph: hash(wi + 9) * 20 });
          }
          ['legL', 'legR', 'armL', 'armR', 'torso', 'head'].forEach(function (k) { S.walk[k].castShadow = true; root.add(S.walk[k]); });
        }

        // ---------- the beat-3 burst: pointer arrows (white with a dark edge) and one envelope ----------
        var arrowS = new T.Shape();
        arrowS.moveTo(0, 0); arrowS.lineTo(0, -1); arrowS.lineTo(0.26, -0.76); arrowS.lineTo(0.44, -1.12); arrowS.lineTo(0.6, -1.04);
        arrowS.lineTo(0.42, -0.69); arrowS.lineTo(0.76, -0.69); arrowS.lineTo(0, 0);
        var arrG = new T.ExtrudeGeometry(arrowS, { depth: 0.05, bevelEnabled: false }); arrG.translate(-0.3, 0.55, 0); arrG.scale(0.42, 0.42, 1);
        var arrG2 = arrG.clone(); arrG2.scale(1.28, 1.2, 1); arrG2.translate(0.0, 0.0, -0.03);
        var NA = lo ? 7 : 14;
        S.arrows = { n: NA, a: ctx.instanced(arrG, basic('#ffffff'), NA), b: ctx.instanced(arrG2, basic('#1d1d1d'), NA), d: [] };
        S.arrows.a.visible = S.arrows.b.visible = false;
        S.arrows.a.castShadow = S.arrows.b.castShadow = false;
        root.add(S.arrows.a); root.add(S.arrows.b);
        for (var ai = 0; ai < NA; ai++) S.arrows.d.push({ sx: BB.x - 4.5 + hash(ai + 1) * 6, sy: 7.0 + hash(ai + 2) * 2.5, sz: 5.0 + hash(ai + 3) * 2, hx: -1.6 + hash(ai + 4) * 3.2, hy: 0.5 + hash(ai + 5) * 2.2,
          vx: -1.2 + hash(ai + 6) * 2.4, vy: 1.2 + hash(ai + 7) * 1.6, vz: 1.8 + hash(ai + 8) * 1.4, spin: (hash(ai + 9) - 0.5) * 8, del: ai * 0.11 });
        var env = new T.Group(); root.add(env); env.visible = false;
        ctx.box(env, 0.5, 0.32, 0.03, P.white, 0, -0.16, 0);
        var flap1 = ctx.box(env, 0.3, 0.03, 0.035, '#9aa0a6', -0.11, -0.03, 0.0); flap1.rotation.z = -0.55;
        var flap2 = ctx.box(env, 0.3, 0.03, 0.035, '#9aa0a6', 0.11, -0.03, 0.0); flap2.rotation.z = 0.55;
        S.env = env;
        S.envFrom = new T.Vector3(-1.6, BB.post + 0.6, 0.35).applyMatrix4(frameAt(BB.x, BB.z, BB.ry, 0));

        // ---------- rain for the typhoon ----------
        var NR = lo ? 50 : 110;
        var rain = ctx.instanced(new T.BoxGeometry(0.03, 0.9, 0.03), basic('#3d5a73'), NR);
        rain.castShadow = false; rain.visible = false; root.add(rain);
        S.rain = { mesh: rain, n: NR, d: [] };
        for (var rI = 0; rI < NR; rI++) S.rain.d.push([-10 + ctx.rand() * 22, ctx.rand() * 13, -7 + ctx.rand() * 13]);

        // ---------- street-level detail along the camera path (lamps, bins, drains, bollards, crossing posts, shrubs, a bench) ----------
        function lamp(x, z, ry) {
          var LF = frameAt(x, z, ry, 0);
          bake.part(cylG(T, 0.05, 0.07, 3.3, 6), '#7d838a', LF, 0, 0, 0);
          bake.part(boxG(T, 0.7, 0.06, 0.08), '#7d838a', LF, 0.3, 3.25, 0);
          bake.part(boxG(T, 0.36, 0.09, 0.18), '#f4f2ec', LF, 0.6, 3.16, 0);
          bake.part(boxG(T, 0.16, 0.25, 0.16), '#6c7278', LF, 0, 0, 0);
        }
        lamp(ROADR + 0.95, -0.6, Math.PI); lamp(6.0, 3.6, Math.PI);
        lamp(ROADL - 0.9, 3.4, 0); if (!lo) lamp(ROADL - 0.9, -3.0, 0);
        function bin(x, z) { var BF = frameAt(x, z, 0, 0); bake.part(cylG(T, 0.2, 0.17, 0.62, 8), '#2f7d4f', BF, 0, 0, 0); bake.part(cylG(T, 0.22, 0.22, 0.06, 8), '#245f3c', BF, 0, 0.62, 0); bake.part(boxG(T, 0.18, 0.05, 0.02), '#1d1d1d', BF, 0, 0.5, 0.2); }
        bin(ROADR + 0.75, 2.1); bin(ROADL - 0.8, 1.6);
        for (var dzz = -7; dzz < 8; dzz += 2.6) {                                                          // drain covers at both kerbs
          if (Math.abs(dzz) > zLim(ROADR) - 0.8) continue;
          bake.part(boxG(T, 0.24, 0.02, 0.42), '#3a3d42', frameAt(ROADL + 0.18, dzz, 0, 0.06), 0, 0, 0);
          bake.part(boxG(T, 0.24, 0.02, 0.42), '#3a3d42', frameAt(ROADR - 0.18, dzz + 1.3, 0, 0.06), 0, 0, 0);
        }
        for (var bz = 0.4; bz < 6.4; bz += 1.0) bake.part(cylG(T, 0.06, 0.07, 0.55, 6), '#9aa0a6', frameAt(ROADR + 0.28, bz, 0, 0), 0, 0, 0);   // bollards
        [[ROADL - 0.35, 6.3], [ROADR + 0.35, 6.3]].forEach(function (bp) {                                 // crossing posts (black and white, amber globe)
          var BF = frameAt(bp[0], bp[1], 0, 0);
          for (var k = 0; k < 6; k++) bake.part(cylG(T, 0.05, 0.05, 0.4, 6), k % 2 ? '#f2f0ea' : '#1d1d1d', BF, 0, k * 0.4, 0);
          bake.part(new T.IcosahedronGeometry(0.16, 1), '#f2a321', BF, 0, 2.5, 0);
        });
        var SF = frameAt(ROADR + 0.4, 1.0, Math.PI, 0);                                                    // a plain round sign on a post (no text)
        bake.part(cylG(T, 0.035, 0.035, 2.0, 6), '#7d838a', SF, 0, 0, 0);
        bake.part(cylG(T, 0.3, 0.3, 0.04, 14), '#2f6fbf', SF, 0, 2.0, 0, Math.PI / 2, 0, 0);
        bake.part(boxG(T, 0.3, 0.06, 0.05), '#f2f0ea', SF, 0, 1.97, 0.0);
        for (var sx2 = ROADR + 1.5; sx2 < 6.0; sx2 += 0.75) bake.part(new T.IcosahedronGeometry(0.32, 0), sx2 % 1.5 > 0.7 ? '#4f8f45' : '#3f7f3a', frameAt(sx2, -1.6, sx2, 0), 0, 0.22, 0, 0, 0, 0, 1.2, 0.8, 1);   // shrubs at the hoarding
        var BN = frameAt(ROADL - 1.6, 4.6, Math.PI / 2, 0);                                                // a bench facing the road
        bake.part(boxG(T, 1.4, 0.06, 0.42), '#8a5a3b', BN, 0, 0.44, 0); bake.part(boxG(T, 1.4, 0.32, 0.05), '#8a5a3b', BN, 0, 0.55, -0.2);
        [-0.55, 0.55].forEach(function (lx) { bake.part(boxG(T, 0.06, 0.44, 0.4), '#3a3a3a', BN, lx, 0, 0); });
        // tiles in block A's void deck floor
        for (var tx2 = -2.6; tx2 <= 2.61; tx2 += 0.65) bake.part(boxG(T, 0.02, 0.01, blockA.d), '#bdb5a6', FA, tx2, 0.06, 0);
        for (var tz2 = -0.9; tz2 <= 0.91; tz2 += 0.6) bake.part(boxG(T, blockA.w, 0.01, 0.02), '#bdb5a6', FA, 0, 0.06, tz2);

        var stat = bake.mesh(vcol); root.add(stat);

        // beats from the page
        S.onBeat = function (e) { var d = e && e.detail; if (!S || !d || d.stop !== 'ads' || typeof d.p !== 'number') return; S.gotBeat = true; S.beatP = clamp(d.p, 0, 1); };
        window.addEventListener('site:beat', S.onBeat);

        ctx.you.place(HOME[0], HOME[1], 0.2);
        setHud(ctx, 'kid');
        S.ctx = ctx;
        setQ(ctx.quality);
        return root;
      },

      update: function (t, dt, ctx) {
        if (!S) return;
        var T = S.T, still = ctx.reduced, m4 = TMP.m4, qI = TMP.q, pV = TMP.p, sV = TMP.s;
        // what-if intensities ease in and out (instantly under reduced motion)
        var gG = S.mode === 'gravity' ? 1 : 0, gT = S.mode === 'typhoon' ? 1 : 0, gS = S.mode === 'stop' ? 1 : 0;
        if (still) { S.kG = gG; S.kT = gT; S.kS = gS; }
        else { S.kG = ease(S.kG, gG, dt, 0.5); S.kT = ease(S.kT, gT, dt, 0.35); S.kS = ease(S.kS, gS, dt, gS ? 0.25 : 0.6); }
        if (S.mode === 'stop') S.stopT += dt; else if (S.kS < 0.01) S.stopT = 0;
        var kG = S.kG, kT = S.kT, kS = S.kS;
        var slide = kS * (1 - Math.exp(-S.stopT * 2.4));

        // ---- which beat: the page's scroll progress, or our own slow loop if the page sends none
        if (ctx.arrived) { if (S.arrT < 0) S.arrT = t; } else S.arrT = -1;
        var p;
        if (S.gotBeat) p = S.beatP;
        else if (S.arrT >= 0 && t - S.arrT > 2 && !still) p = ((t - S.arrT - 2) / LOOP) % 1;
        else p = 0;
        var beat = p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.65 ? 2 : p < 0.85 ? 3 : 4;
        if (beat !== S.beat) { enterBeat(S.beat, beat, t, ctx); S.beat = beat; S.beatT0 = t; }
        var bt = t - S.beatT0;
        if (still) bt = 99;
        var mine = ctx.dive > 0.02;   // only drive YOU while the camera is on this place

        // ---- his age: 13 at the start, 18 by p 0.9 (only the two ends are ever labelled)
        var age = smooth(0.2, 0.9, p);
        var gb = 0.72 + 0.28 * age, gh = 1.18 - 0.18 * age;
        if (still) { S.scaleB = gb; S.scaleH = gh; } else { S.scaleB = ease(S.scaleB, gb, dt, 0.35); S.scaleH = ease(S.scaleH, gh, dt, 0.35); }
        if (mine && ctx.you.scale) ctx.you.scale(S.scaleB, S.scaleH);

        // ---- HUD: the year he started (beats 0-3), then 30+ campaigns (beat 4); the click rule for 2 s
        var hudKey = S.hudHoldUntil > t ? 'rule' : beat >= 4 ? 'count' : 'kid';
        if (hudKey !== S.lastHud && ctx.dive > 0.3) setHud(ctx, hudKey);

        // ---- rival billboards rise one by one in beat 1; stay up after; sink before
        var lookPt = null;
        for (var r = 0; r < S.rivals.length; r++) {
          var R = S.rivals[r], k;
          if (beat < 1) k = 0;
          else if (beat > 1) k = 1;
          else k = outBack((bt - 0.35 - r * 1.15) / 0.55);
          if (beat === 1 && k > 0.5 && !R.risen) { R.risen = true; sfx('pop'); }
          if (beat < 1) R.risen = false;
          R.g.visible = k > 0.002;
          R.g.scale.set(1, Math.max(0.001, k), 1);
          if (kG > 0.01) { R.g.position.z = 0; R.g.rotation.z = kG * 0.3 * Math.sin(t * 0.6 + r); } else R.g.rotation.z = 0;
          if (beat === 1 && bt > 0.35 + r * 1.15) lookPt = R.look;
        }

        // ---- the billboard: bars shimmer (a wireframe ad, waiting), change on click / in beat 2, topple in beat 4
        var B = S.board;
        for (var bi = 0; bi < 3; bi++) {
          var bar = S.bars[bi], vv = S.VAR[bi], cur = vv[bar.v], prv = vv[bar.from];
          var u = clamp((t - bar.t0) / 0.6, 0, 1), kk = still ? 1 : outBack(u);
          var wS = prv[0] + (cur[0] - prv[0]) * kk, hS = prv[1] + (cur[1] - prv[1]) * kk;
          var shim = still ? 0 : 0.035 * Math.max(0, Math.sin(t * 2.2 - bi * 0.9)) * (u >= 1 ? 1 : 0);
          bar.m.scale.set(bar.base.w * wS, bar.base.h * hS * (1 + shim), 1);
          bar.m.position.y = -bar.base.h * hS * shim * 0.5;
          var wantM = S.barMat(u > 0.4 || still ? cur[2] : prv[2]);
          if (bar.m.material !== wantM) bar.m.material = wantM;
        }
        var shk = t - S.shake;
        B.shake.rotation.z = (!still && shk < 0.5) ? 0.05 * Math.sin(shk * 46) * (1 - shk / 0.5) : 0;
        B.shake.position.x = (!still && shk < 0.5) ? 0.06 * Math.sin(shk * 38) * (1 - shk / 0.5) : 0;
        // topple (beat 4): falls forward, lies there, YOU picks it up and it rises again
        var fall = 0;
        if (beat === 4) {
          var f1 = clamp((bt - 0.25) / 0.6, 0, 1);
          fall = f1 * f1;                                   // accelerating fall
          if (f1 >= 1) fall = 1 + (bt < 1.1 ? 0.06 * Math.sin((bt - 0.85) * 22) * Math.exp(-(bt - 0.85) * 6) : 0);
          var up = smooth(2.0, 3.0, bt);
          fall = fall * (1 - up);
          if (bt > 0.85 && !S.thudDone && !still) { S.thudDone = true; sfx('thud'); }
          if (still) fall = 0;
        }
        B.tilt.rotation.x = fall * 1.72;
        B.g.position.y = ctx.groundY(BB.x, BB.z) + kG * (0.8 + 0.2 * Math.sin(t * 0.8));
        B.tilt.rotation.z = kT * (0.06 + 0.03 * Math.sin(t * 7)) + kG * 0.15 * Math.sin(t * 0.5);

        // ---- crane: a 16 s lift cycle; slews free in the typhoon (as real cranes are left to weathervane)
        var C = S.crane, c = still ? 13.6 : t % 16;
        var th, rr, hy, carry = false;
        if (c < 3) { var a = smooth(0, 3, c); th = C.thD + (C.thP - C.thD) * a; rr = C.rD + (C.rP - C.rD) * a; hy = -1.0; }
        else if (c < 4.5) { th = C.thP; rr = C.rP; hy = -1.0 + (C.yP + 1.0) * smooth(3, 4.5, c); }
        else if (c < 5) { th = C.thP; rr = C.rP; hy = C.yP; carry = c > 4.7; }
        else if (c < 7) { th = C.thP; rr = C.rP; hy = C.yP + (-1.0 - C.yP) * smooth(5, 7, c); carry = true; }
        else if (c < 10) { var a2 = smooth(7, 10, c); th = C.thP + (C.thD - C.thP) * a2; rr = C.rP + (C.rD - C.rP) * a2; hy = -1.0; carry = true; }
        else if (c < 11.5) { th = C.thD; rr = C.rD; hy = -1.0 + (C.yD - -1.0) * smooth(10, 11.5, c); carry = true; }
        else if (c < 12) { th = C.thD; rr = C.rD; hy = C.yD; carry = c < 11.7; }
        else if (c < 13.5) { th = C.thD; rr = C.rD; hy = C.yD + (-1.0 - C.yD) * smooth(12, 13.5, c); }
        else { th = C.thD; rr = C.rD; hy = -1.0; }
        th += kT * t * 0.9 + kS * 0.9 * Math.sin(Math.min(S.stopT, 4) * 2.0) * Math.exp(-S.stopT * 0.6);
        C.slew.rotation.y = th;
        C.trolley.position.x = rr;
        var hookY = hy - 0.32 + kG * 0.6 * Math.sin(t * 0.7);
        C.hook.position.y = hookY;
        C.cable.scale.y = Math.max(0.05, -hookY);
        C.hook.rotation.z = kT * 0.4 * Math.sin(t * 3.1);
        C.hookPallet.visible = carry;
        // the pallet waiting on the ground (back by the next cycle), and the one set down on the tower (taken in later)
        var gp = still ? 1 : (c < 4.7 ? 1 : 0) * Math.max(0.001, c < 0.6 ? smooth(0, 0.6, c) : 1);
        C.groundPallet.visible = gp > 0.01; C.groundPallet.scale.setScalar(Math.max(0.001, gp));
        var tp = still ? 0 : (c >= 11.7 ? 1 - smooth(14.8, 15.8, c) : 0);
        C.towerPallet.visible = tp > 0.01; C.towerPallet.scale.setScalar(Math.max(0.001, tp));
        C.groundPallet.position.y = ctx.groundY(S.pick.x, S.pick.z) + kG * 1.2;

        // ---- lift doors in block A's void deck
        for (var li = 0; li < S.lifts.length; li++) {
          var L = S.lifts[li];
          for (var dd = 0; dd < L.doors.length; dd++) {
            var D = L.doors[dd], lc = still ? 0 : (t + L.ph + dd * 4.3) % 9;
            var open = smooth(1.0, 1.6, lc) * (1 - smooth(4.0, 4.6, lc));
            D.halves[0].position.x = D.lx - 0.15 - 0.27 * open; D.halves[1].position.x = D.lx + 0.15 + 0.27 * open;
          }
        }

        // ---- corridor windows: flat colours that switch now and then
        var PN = S.paneMesh, changed = false, ncol = S.paneCols.length;
        for (var pi = 0; pi < S.panes.length; pi++) {
          var hs = hash(pi * 3.1 + 1), idx;
          if (hs < 0.55) idx = hs < 0.4 ? 0 : 1;
          else { var per = 2.5 + hash(pi + 7) * 5, n = Math.floor((still ? 0 : t) / per + hash(pi + 2) * 9); idx = Math.floor(hash(pi * 13 + n * 7.7) * ncol); }
          if (kT > 0.5 && hash(pi + 4) < 0.6) idx = 6;                            // the storm: many go dark
          if (idx !== S.paneLast[pi]) { S.paneLast[pi] = idx; PN.setColorAt(pi, S.paneCols[idx]); changed = true; }
        }
        if (changed) PN.instanceColor.needsUpdate = true;

        // ---- rain trees sway; lean hard in the typhoon; float with no gravity
        for (var ti = 0; ti < S.trees.length; ti++) {
          var tr = S.trees[ti];
          tr.g.rotation.z = still ? 0 : 0.045 * Math.sin(t * 1.1 + tr.ph) + kT * (0.32 + 0.1 * Math.sin(t * 6 + tr.ph));
          tr.g.rotation.x = still ? 0 : 0.03 * Math.sin(t * 0.8 + tr.ph * 1.3);
          tr.g.position.y = kG * (0.6 + 0.2 * Math.sin(t * 0.8 + tr.ph));
        }

        // ---- cars
        if (S.cars && !S.lo) {
          var CA = S.cars;
          for (var ci = 0; ci < CA.n; ci++) {
            var dir = ci % 2 ? -1 : 1, spd = still ? 0 : 1.9 * (1 - kT * 0.6) * (1 - kS);
            var span = 18, zc = ((ci * 3.7 + t * spd + span * 50) % span) - 9;
            if (still) zc = -6 + ci * 3.1;
            zc *= dir;
            var xc = RX + (dir > 0 ? 0.52 : -0.52) + slide * (1.6 + ci * 0.4);
            var edge = zLim(xc) - 0.9, sc = smooth(edge, edge - 1.2, Math.abs(zc));
            placeOnGround(xc, zc, dir > 0 ? 0 : Math.PI, kG * (0.8 + ci * 0.3 + 0.2 * Math.sin(t + ci)), kG * 0.5 * Math.sin(t * 0.6 + ci), kG * 0.4 * Math.cos(t * 0.5 + ci) + kT * 0.05);
            sV.set(sc, sc, sc);
            CA.mesh.setMatrixAt(ci, m4.compose(pV, qI, sV));
          }
          CA.mesh.instanceMatrix.needsUpdate = true;
        }

        // ---- walkers
        if (S.walk && !S.lo) {
          var WK = S.walk, m5 = TMP.m5, m6 = TMP.m6;
          for (var wi = 0; wi < WK.n; wi++) {
            var w = WK.list[wi], pth = w.p;
            var dist = still ? w.len * 0.3 : (t * w.sp * (1 - kT * 0.6) * (1 - kS) + w.ph) % (w.len * 2);
            var fwd = dist < w.len, along = fwd ? dist : w.len * 2 - dist, uu = along / w.len;
            var wx = pth[0] + (pth[2] - pth[0]) * uu + slide * (2.2 + wi * 0.4), wz = pth[1] + (pth[3] - pth[1]) * uu;
            var hd = Math.atan2(pth[2] - pth[0], pth[3] - pth[1]) + (fwd ? 0 : Math.PI);
            var lift = kG * (1.0 + (wi % 3) * 0.5 + 0.2 * Math.sin(t * 0.8 + wi));
            placeOnGround(wx, wz, hd, lift + (still ? 0 : Math.abs(Math.sin(t * 7 + wi)) * 0.03), kG * 0.8 * Math.sin(t * 0.6 + wi), kT * 0.22);
            m5.compose(pV, qI, TMP.one);
            var sw = still ? 0 : Math.sin(t * 6.5 * (1 - kS) + wi * 2) * 0.55 * (1 - kG * 0.6);
            setPart(WK.legL, wi, m5, -0.09, 0.78, 0, sw); setPart(WK.legR, wi, m5, 0.09, 0.78, 0, -sw);
            setPart(WK.armL, wi, m5, -0.27, 1.3, 0, -sw * 0.8 + kG * -2.4); setPart(WK.armR, wi, m5, 0.27, 1.3, 0, sw * 0.8 + kG * -2.4);
            setPart(WK.torso, wi, m5, 0, 0.76, 0, 0); setPart(WK.head, wi, m5, 0, 1.33, 0, 0);
          }
          ['legL', 'legR', 'armL', 'armR', 'torso', 'head'].forEach(function (k) { WK[k].instanceMatrix.needsUpdate = true; });
        }

        // ---- beat 3: pointer arrows bounce off the billboard; one envelope floats across the road into a letterbox
        var AR = S.arrows, showA = beat === 3 && !still && kG < 0.5;
        AR.a.visible = AR.b.visible = showA;
        if (showA) {
          var bF = S.board.g;
          for (var ai = 0; ai < AR.n; ai++) {
            var d = AR.d[ai], tt = bt - d.del;
            if (tt < 0) { sV.set(0.001, 0.001, 0.001); m4.compose(pV.set(0, -5, 0), qI.identity(), sV); AR.a.setMatrixAt(ai, m4); AR.b.setMatrixAt(ai, m4); continue; }
            var u2 = (tt % 1.5) / 1.5, ax, ay, az, sz = 1, rz;
            var hx = BB.x + d.hx, hyy = BB.post + d.hy + 0.4, hz = BB.z + 0.45;
            if (u2 < 0.4) { var a3 = u2 / 0.4; ax = d.sx + (hx - d.sx) * a3; ay = d.sy + (hyy - d.sy) * a3 + Math.sin(a3 * Math.PI) * 0.6; az = d.sz + (hz - d.sz) * a3; rz = 0.3 + d.spin * 0.02; }
            else { var s2 = (u2 - 0.4) * 1.5; ax = hx + d.vx * s2; ay = hyy + d.vy * s2 - 6 * s2 * s2; az = hz + d.vz * s2; rz = 0.3 + d.spin * s2; sz = 1 - smooth(0.6, 0.9, s2); }
            sz *= smooth(0, 0.08, u2);
            qI.setFromAxisAngle(TMP.Za, rz);
            sV.set(sz, sz, sz);
            AR.a.setMatrixAt(ai, m4.compose(pV.set(ax, ay, az), qI, sV));
            AR.b.setMatrixAt(ai, m4.compose(pV.set(ax, ay, az - 0.01), qI, sV));
          }
          AR.a.instanceMatrix.needsUpdate = true; AR.b.instanceMatrix.needsUpdate = true;
          if (!S.lastSfx.whoosh) { S.lastSfx.whoosh = true; sfx('whoosh'); }
        } else S.lastSfx.whoosh = false;
        var E = S.env, showE = beat === 3 && !still;
        if (showE) {
          var ec = (bt - 0.7) % 4.6, ek = clamp(ec / 2.6, 0, 1);
          E.visible = bt > 0.7 && ec < 2.8;
          if (E.visible) {
            var A0 = S.envFrom, A1 = S.slot, ee = ek * ek * (3 - 2 * ek);
            E.position.set(A0.x + (A1.x - A0.x) * ee, A0.y + (A1.y - A0.y) * ee + Math.sin(ek * Math.PI) * 3.2, A0.z + (A1.z - A0.z) * ee);
            E.rotation.set(0.25 * Math.sin(bt * 5), -0.3 * (1 - ek), 0.3 * Math.sin(bt * 3.3) * (1 - ek));
            var es = ek < 0.92 ? 1 : 1 - smooth(0.92, 1, ek); E.scale.set(1.5, 1.5 * Math.max(0.01, es), 1.5);
            if (ek >= 1 && !S.envIn) { S.envIn = true; sfx('drop'); }
            if (ek < 0.5) S.envIn = false;
            lookPt = E.position;
          }
        } else E.visible = false;

        // ---- YOU: waits (aged 13), turns to the rivals, walks to his billboard, picks it up when it falls
        if (mine) {
          var tgt = beat >= 2 ? SPOT : HOME, Y = S.you;
          var dx = tgt[0] - Y.x, dz = tgt[1] - Y.z, dl = Math.hypot(dx, dz);
          var canWalk = !still && !S.mode && kS < 0.05 && !(beat === 2 && bt < 0.4);
          if (dl > 0.04 && canWalk) {
            var stp = Math.min(dl, dt * 1.05 * S.scaleB);
            Y.x += dx / dl * stp; Y.z += dz / dl * stp;
            Y.ry = Math.atan2(dx, dz);
            if (!Y.walking) { Y.walking = true; ctx.you.play('Walk', { loop: true }); }
          } else {
            if (still || S.mode) { Y.x = tgt[0]; Y.z = tgt[1]; }
            if (Y.walking) { Y.walking = false; ctx.you.play('Idle', { loop: true }); }
            var ryGoal = beat >= 4 ? 1.0 : beat >= 2 ? 0.55 : 0.2;
            Y.ry = still ? ryGoal : ease(Y.ry, ryGoal, dt, 0.25);
          }
          ctx.you.place(Y.x, Y.z, Y.ry);
          // beat 2: he looks at the bar that changes; beat 4: at the billboard
          if (beat === 2 && !Y.walking) lookPt = TMP.v.set(BB.x - 1.2, BB.post + 0.5, BB.z);
          if (beat === 4) lookPt = TMP.v.set(BB.x - 1.0, 0.6 + (1 - fall) * 2.4, BB.z + fall * 2.2);
          if (beat === 4 && bt > 1.25 && !S.picked && !still && !S.mode) { S.picked = true; ctx.you.play('PickUp'); sfx('pickup'); }
          if (beat !== 4) S.picked = false;
          if (lookPt) ctx.you.lookAt(lookPt.x, lookPt.y, lookPt.z); else ctx.you.lookAt(null);
          // what-ifs on YOU
          if (kG > 0.02) ctx.you.offset(0, kG * (1.4 + 0.2 * Math.sin(t * 0.9)), 0, kG * 0.2 * Math.sin(t * 0.7), kG * 0.25 * Math.sin(t * 0.5 + 1));
          else if (kT > 0.02) ctx.you.offset(0, 0, 0, 0, kT * 0.22);
          else if (kS > 0.02 || S.stopT > 0) ctx.you.offset(slide * 2.6, 0, 0, 0, 0);
          else ctx.you.offset(0, 0, 0, 0, 0);
        }

        // ---- rain
        var RN = S.rain;
        RN.mesh.visible = kT > 0.02;
        if (RN.mesh.visible) {
          var rq = TMP.q2.setFromAxisAngle(TMP.Za, -0.45);
          for (var rj = 0; rj < RN.n; rj++) {
            var rd = RN.d[rj];
            if (!still) { rd[1] -= dt * 14; rd[0] -= dt * 6.5; }
            if (rd[1] < ctx.groundY(rd[0], rd[2]) || rd[0] < -11) { rd[1] = 10 + Math.random() * 3; rd[0] = -6 + Math.random() * 17; }
            sV.set(1, kT, 1);
            RN.mesh.setMatrixAt(rj, m4.compose(pV.set(rd[0], rd[1], rd[2]), rq, sV));
          }
          RN.mesh.instanceMatrix.needsUpdate = true;
        }
      },

      onPointer: function (ev, ctx) {
        if (!S || ev.type !== 'click' || !ev.hit) return false;
        var o = ev.hit.object, onBoard = false;
        while (o) { if (o === S.board.g) { onBoard = true; break; } o = o.parent; }
        if (!onBoard) return false;
        if (S.beat === 4 && ctx.time - S.beatT0 < 3.0 && !ctx.reduced) return true;   // it is on the ground: wait for him to stand it up
        var i = ev.hit.object.userData.bar;
        if (i === undefined) {
          // a click on the face or the frame: the nearest bar by height
          var lp = S.board.shake.worldToLocal(S.root.localToWorld(ev.hit.point.clone()));
          var best = 0, bd = 1e9;
          S.bars.forEach(function (b, k) { var cy = b.base.y + b.base.h / 2, dd = Math.abs(lp.y - cy); if (dd < bd) { bd = dd; best = k; } });
          i = best;
        }
        var t = ctx.time, busy = null;
        S.bars.forEach(function (b, k) { if (k !== i && t >= b.t0 && t - b.t0 < 0.6) busy = b; });
        if (busy) {
          S.shake = t;
          sfx('error');
          S.hudHoldUntil = t + 2;
          setHud(ctx, 'rule');
          return true;
        }
        changeBar(i, (S.bars[i].v + 1) % 3, t);
        sfx('tick');
        return true;
      },

      whatIf: function (mode, ctx) {
        if (!S) return false;
        var was = S.mode;
        S.mode = mode;
        S.you.walking = false;
        if (mode === 'gravity') ctx.you.play('Float', { loop: true });
        else if (mode === 'typhoon') ctx.you.play('Walk', { loop: true });
        else if (mode === 'stop') { ctx.you.play('Idle'); ctx.you.play('Roll', { then: 'StandUp' }); S.stopT = 0; }
        else { ctx.you.play('Idle'); if (was === 'gravity') ctx.you.play('Jump'); }
        return true;
      },

      setQuality: function (q) { setQ(q); },

      dispose: function () {
        if (!S) return;
        window.removeEventListener('site:beat', S.onBeat);
        S.own.forEach(function (m) { try { m.dispose(); } catch (e) { /* gone */ } });
        S = null; TMP = null;
      }
    });

    function setQ(q) {
      if (!S) return;
      S.lo = q === 'low';
      if (S.cars) S.cars.mesh.visible = !S.lo;
      if (S.walk) ['legL', 'legR', 'armL', 'armR', 'torso', 'head'].forEach(function (k) { S.walk[k].visible = !S.lo; });
      if (S.blockBMesh) S.blockBMesh.visible = !S.lo;
    }

    function setHud(ctx, key) {
      S.lastHud = key;
      if (key === 'kid') ctx.hud({ left: { value: '2020', caption: 'the year I started, aged 13' } });
      else if (key === 'count') ctx.hud({ left: { value: '30+', caption: 'campaigns since 2020' } });
      else ctx.hud({ left: { value: 'One change', caption: 'at a time' } });
    }

    function changeBar(i, v, t) {
      var b = S.bars[i];
      if (b.v === v) return;
      // start from wherever it is now (interruptible)
      b.from = (t - b.t0 < 0.3) ? b.from : b.v;
      b.v = v; b.t0 = t;
    }

    function enterBeat(from, to, t, ctx) {
      S.thudDone = false;
      // beat 2 makes exactly one change: the button bar; going back above it puts it back
      if (to >= 2 && (from < 2) && S.bars[2].v === 0) changeBar(2, 1, t + (ctx.reduced ? -1 : 1.5));
      if (to < 2 && from >= 2 && S.bars[2].v === 1) changeBar(2, 0, t);
    }

    // where a thing stands on the curve: sets TMP.p (position) and TMP.q (upright to the sphere, turned hd, tipped rx/rz)
    function placeOnGround(x, z, hd, lift, rx, rz) {
      var ctx = S.ctx, up = TMP.up, q = TMP.q, q2 = TMP.q2;
      var gy = ctx.groundY(x, z);
      up.set(x, gy + 14, z).normalize();
      q.setFromUnitVectors(TMP.Y, up).multiply(q2.setFromAxisAngle(TMP.Y, hd));
      if (rx) q.multiply(q2.setFromAxisAngle(TMP.Xa, rx));
      if (rz) q.multiply(q2.setFromAxisAngle(TMP.Za, rz));
      TMP.p.set(x + up.x * lift, gy + up.y * lift, z + up.z * lift);
    }
    function setPart(mesh, i, base, x, y, z, rx) {
      var m6 = TMP.m6;
      m6.makeRotationX(rx); m6.setPosition(x, y, z);
      mesh.setMatrixAt(i, TMP.m4.multiplyMatrices(base, m6));
    }
  }
  if (window.WORLD) go(); else window.addEventListener('DOMContentLoaded', go);
})();
