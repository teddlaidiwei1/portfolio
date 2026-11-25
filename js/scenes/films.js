/* scenes/films.js: the Video ads stop, a drive-in at night (scene builder B, v3; calm pass W3, 21 Nov 2026).
   A drive-in on the curve under the ink sky: a tall 4:5 screen on a steel truss playing his real video ads (the
   scene's one VideoTexture: one video element whose source is swapped), five parked cars seen from behind, a
   projector booth with slowly turning reels and a flat pale beam, a snack stand with a striped awning, still stars.
   9:16 ads play at full height with two flat ink side masks closed in (they slide in 0.4 s when the format changes).
   YOU sits on a blanket beside his car to watch (fix r4: no bonnet seats, seen from behind their heads came through
   the roofs); a few people made from his own model (ctx.person) sit and queue, never in yellow.
   One toy: click a car and its headlights come on for a moment. A click on one of the page's ad tiles switches the
   screen to that ad. Low tier or reduced motion: the ad's poster as a still until the screen is tapped.
   Lights are flat unlit colour, no glow. Scene units: YOU is 1.8 tall. See briefs/world-api.md. */
(function () {
  'use strict';
  function go() {
    var W = window.WORLD;
    if (!W || !W.registerScene) return;

    var S = null, TMP = null;
    // the real video ads (silent 12 s loops with posters), and their format: 4:5 for feeds, 9:16 for Reels
    var ADS = [{ n: 'ad-3', a: 0.8 }, { n: 'ad-4', a: 0.5625 }, { n: 'ad-1', a: 0.5625 }, { n: 'ad-5', a: 0.8 }];

    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function ease(k, goal, dt, tau) { return k + (goal - k) * (1 - Math.exp(-dt / tau)); }
    function sfx(n) { try { if (window.SFX && window.SFX.play) window.SFX.play(n); } catch (e) { /* no sound layer */ } }

    // ---------- a baker: static parts merged into one mesh with vertex colours (one draw call) ----------
    function Baker(T, X) { this.T = T; this.X = X; this.list = []; this.m = new T.Matrix4(); this.o = new T.Object3D(); }
    Baker.prototype.add = function (geo, color, matrix) {
      var T = this.T, g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.deleteAttribute('uv');
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
    // a heading (unit xz) to the ry that turns a model whose front is local -Z
    function ryFront(hx, hz) { return Math.atan2(-hx, -hz); }
    function noHit() { /* not a pointer target */ }

    // a small seeded random, so the stars sit in the same places on every visit
    function lcg(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

    // ---------- the cars (front at local -Z); `col` body colour ----------
    var CARS = [
      { x: -3.4, z: -2.5, ry: -0.22, col: '#7a3434' },
      { x: -0.2, z: -2.7, ry: -0.5, col: '#c9c4b8', you: true },
      { x: 3.3, z: -2.5, ry: 0.22, col: '#3b5871' },
      { x: -3.3, z: 1.9, ry: 0.04, col: '#2f5a4f', wiper: true },
      { x: 3.5, z: 1.95, ry: 0, col: '#8b5d34' },
      // fix r4 detail: two more parked cars at the ends of the front row (still; not on the low tier)
      { x: -6.15, z: -1.9, ry: -0.42, col: '#4a5068' },
      { x: 6.25, z: -1.7, ry: 0.42, col: '#6e6a62' }
    ];
    var LOW_CARS = { 1: 1, 2: 1, 4: 1 };   // the phone version keeps three cars

    W.registerScene('films', {
      // calm pass: one settled framing from behind the cars, a little above them (world.js fits the distance)
      shots: [
        { pos: [0, 7.0, 20], look: [0, 2.0, 0], fov: 34, you: [1.3, -2.5] }
      ],
      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, P = ctx.palette, lo = ctx.quality === 'low';
        var root = new T.Group();
        TMP = { m4: new T.Matrix4(), q: new T.Quaternion(), p: new T.Vector3(), s: new T.Vector3(), v: new T.Vector3(), v2: new T.Vector3(),
          v3: new T.Vector3(), v4: new T.Vector3(), e: new T.Euler(), z: new T.Vector3(0, 0, 1), up: new T.Vector3() };
        S = { root: root, T: T, ctx: ctx, mats: [], texs: [], lo: lo, mode: null, kG: 0, kT: 0, kS: 0, stopT: 0,
          ai: 3, vid: null, userPlay: false, posters: {}, flashAll: -9, seq: null, arrivedWas: false,
          youClip: '', listeners: [], texA: 0.8, maskK: 0, people: [] };
        var sep = function (c, r) { return ctx.separate ? ctx.separate(c, r || 1.5) : c; };
        var vcol = ctx.mat('#ffffff', { vertexColors: true });
        function basic(color, o) {
          var m = new T.MeshBasicMaterial({ color: color });
          m.toneMapped = false;
          if (o) for (var k in o) m[k] = o[k];
          S.mats.push(m); return m;
        }
        var bake = new Baker(T, X);
        var dummy = new T.Object3D();
        function frameAt(x, z, ry, dy) { ctx.plant(dummy, x, z, ry); dummy.position.y += dy || 0; dummy.updateMatrix(); return dummy.matrix.clone(); }
        S.frameAt = frameAt;
        // calm pass: the kiosk, the booth and the lamps stand only partly tipped with the curve (k of the full tilt),
        // sunk a little, so they read upright in the settled framing
        var upV = new T.Vector3(), upQ = new T.Quaternion(), Y1 = new T.Vector3(0, 1, 0);
        function frameUp(x, z, ry, k, dy) {
          var gy = ctx.groundY(x, z);
          upV.set(x, gy + ctx.R, z).normalize().lerp(Y1, 1 - k).normalize();
          dummy.position.set(x, gy + (dy || 0), z);
          dummy.quaternion.setFromUnitVectors(Y1, upV).multiply(upQ.setFromAxisAngle(Y1, ry || 0));
          dummy.updateMatrix(); return dummy.matrix.clone();
        }

        // ---------- ground: asphalt lot on the curve, dark grass round the edge ----------
        var RINGS = lo ? 12 : 18, SEG = lo ? 32 : 48, RMAX = 10.2;
        var cap = new T.BufferGeometry(), pos = [], cols = [];
        var cLot = new T.Color(sep('#2a2d33')), cLot2 = new T.Color(sep('#30333a')), cGrass = new T.Color(sep('#1d3527')), cGrass2 = new T.Color(sep('#213b2c'));
        function vtx(r, a) { var x = r * Math.cos(a), z = r * Math.sin(a); return [x, ctx.groundY(x, z) + 0.02, z]; }
        function zone(x, z) {
          var r = Math.sqrt(x * x + z * z);
          var hsh = Math.sin(Math.floor(x * 0.8) * 12.99 + Math.floor(z * 0.8) * 78.23) * 43758.5; hsh -= Math.floor(hsh);
          if (r < 8.7 && z > -4.7) return hsh > 0.8 ? cLot2 : cLot;
          return hsh > 0.7 ? cGrass2 : cGrass;
        }
        for (var ri = 0; ri < RINGS; ri++) {
          var r0 = RMAX * ri / RINGS, r1 = RMAX * (ri + 1) / RINGS;
          for (var si = 0; si < SEG; si++) {
            var a0 = si / SEG * Math.PI * 2, a1 = (si + 1) / SEG * Math.PI * 2;
            var p00 = vtx(r0, a0), p01 = vtx(r0, a1), p10 = vtx(r1, a0), p11 = vtx(r1, a1);
            var tris = ri === 0 ? [[p00, p11, p10]] : [[p00, p11, p10], [p00, p01, p11]];
            for (var tk = 0; tk < tris.length; tk++) {
              var tr = tris[tk], mx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, mz = (tr[0][2] + tr[1][2] + tr[2][2]) / 3, c = zone(mx, mz);
              for (var pk = 0; pk < 3; pk++) { pos.push(tr[pk][0], tr[pk][1], tr[pk][2]); cols.push(c.r, c.g, c.b); }
            }
          }
        }
        cap.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        cap.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
        cap.computeVertexNormals();
        var capMesh = new T.Mesh(cap, vcol);
        capMesh.receiveShadow = true;
        root.add(capMesh);

        // bay lines for the two rows (two short pieces each, so they follow the curve)
        [-2.5, 1.9].forEach(function (zc) {
          [-4.65, -1.55, 1.55, 4.65].forEach(function (x) {
            [-0.95, 0.95].forEach(function (dz) { bake.part(boxG(T, 0.08, 0.02, 1.85), '#8d9198', frameAt(x, zc + dz, 0, 0.0), 0, 0, 0); });
          });
        });
        // the right-hand lane's dashed centre line
        for (var dl = 4.6; dl < 9.4; dl += 1.6) bake.part(boxG(T, 0.7, 0.02, 0.07), '#6f7379', frameAt(dl, 5.15, 0, 0), 0, 0, 0);
        // concrete wheel stops at the head of each bay, and the drive-in speaker posts between the cars
        [[-3.1, -2.5], [0, -2.5], [3.1, -2.5], [-3.1, 1.9], [0, 1.9], [3.3, 1.9]].forEach(function (b) {
          bake.part(boxG(T, 1.2, 0.13, 0.22), '#8d9198', frameAt(b[0], b[1] - 1.95, 0, 0), 0, 0, 0);
          bake.part(boxG(T, 1.24, 0.03, 0.24), '#6f7379', frameAt(b[0], b[1] - 1.95, 0, 0), 0, 0.13, 0);
        });
        [[-4.65, -2.9], [4.65, -2.9], [-1.55, 1.5], [1.55, 1.5], [-4.65, 1.5]].forEach(function (b) {
          var sf = frameAt(b[0], b[1], 0, 0);
          bake.part(new T.CylinderGeometry(0.05, 0.06, 1.05, 6), '#5d636b', sf, 0, 0.52, 0);
          bake.part(boxG(T, 0.24, 0.1, 0.24), '#3a3e44', sf, 0, 0, 0);
          [-1, 1].forEach(function (s) {
            bake.part(boxG(T, 0.26, 0.24, 0.12), '#2a2d32', sf, s * 0.15, 0.96, 0, 0, s * 0.3, 0);
            bake.part(boxG(T, 0.18, 0.16, 0.02), '#7c828b', sf, s * 0.17, 1.0, 0.065, 0, s * 0.3, 0);
          });
        });
        // two lot lamps; their heads are flat lit patches
        S.lampHeads = [];
        [[-4.9, -4.5, 0.5], [4.9, -4.5, -0.5]].forEach(function (l) {
          var lf = frameUp(l[0], l[1], l[2], 0.3, -0.05);
          bake.part(new T.CylinderGeometry(0.07, 0.1, 4.6, 6), '#3d4248', lf, 0, 2.3, 0);
          bake.part(boxG(T, 0.3, 0.3, 0.3), '#2a2d32', lf, 0, 0, 0);
          bake.part(boxG(T, 0.9, 0.08, 0.1), '#3d4248', lf, 0, 4.55, 0.3, -0.2, Math.PI / 2, 0);
          var lh = new T.Mesh(new T.BoxGeometry(0.44, 0.1, 0.28), basic('#fff1c4'));
          var lhH = new T.Group(); lhH.matrixAutoUpdate = false; lhH.matrix.copy(lf); lh.position.set(0, 4.5, 0.7); lhH.add(lh); root.add(lhH);
          S.lampHeads.push(lh);
        });

        // fix r4 detail (all still): a low fence behind the lot either side of the screen, trees along the back edge,
        // arrows painted in the entrance lane, and a small ticket hut by the lane
        [-1, 1].forEach(function (s) {
          var prevF = null, step = lo ? 1.2 : 0.6;
          for (var fx = 4.3; fx <= 6.1 + 1e-6; fx += step) {
            var fz = -4.75 - (fx - 4.3) * 0.12, ff = frameAt(s * fx, fz, 0, 0);
            bake.part(boxG(T, 0.07, 0.62, 0.07), '#6f7379', ff, 0, 0, 0);
            if (prevF) {
              var mx2 = (s * fx + prevF[0]) / 2, mz2 = (fz + prevF[1]) / 2, dx2 = s * fx - prevF[0], dz2 = fz - prevF[1];
              var fm2 = frameAt(mx2, mz2, Math.atan2(dx2, dz2), 0);
              bake.part(boxG(T, 0.04, 0.05, Math.hypot(dx2, dz2) + 0.04), '#8d9198', fm2, 0, 0.5, 0);
              bake.part(boxG(T, 0.04, 0.05, Math.hypot(dx2, dz2) + 0.04), '#8d9198', fm2, 0, 0.26, 0);
            }
            prevF = [s * fx, fz];
          }
        });
        var treeAt = lo ? [[-5.0, -6.3], [5.0, -6.2]] : [[-4.5, -6.6], [-5.5, -6.0], [-4.9, -7.5], [4.6, -6.5], [5.5, -5.8], [5.2, -7.3]];
        treeAt.forEach(function (tp, k) {
          var tf = frameUp(tp[0], tp[1], k, 0.3, -0.05), tsz = 0.85 + (k % 3) * 0.15;
          bake.part(cylG(T, 0.07, 0.1, 0.9 * tsz, 6), '#3b2c22', tf, 0, 0, 0);
          bake.part(new T.IcosahedronGeometry(0.62 * tsz, 0), sep(k % 2 ? '#1f3d2b' : '#24452f', 1.4), tf, 0, 1.25 * tsz, 0, 0, k, 0, 1, 1.15, 1);
        });
        [5.4, 7.2].forEach(function (ax) {   // lane arrows (flat, no words)
          var af = frameAt(ax, 4.55, -Math.PI / 2, 0);
          bake.part(boxG(T, 0.12, 0.02, 0.55), '#8d9198', af, 0, 0.01, 0.1);
          bake.part(boxG(T, 0.1, 0.02, 0.34), '#8d9198', af, 0.1, 0.01, -0.22, 0, 0.7, 0);
          bake.part(boxG(T, 0.1, 0.02, 0.34), '#8d9198', af, -0.1, 0.01, -0.22, 0, -0.7, 0);
        });
        var thF = frameUp(5.75, 3.0, 0.2, 0.3, -0.08);   // the ticket hut (kept behind the back row, so the framing stays as it was)
        bake.part(boxG(T, 0.8, 1.15, 0.75), sep('#4b5058', 1.6), thF, 0, 0, 0);
        bake.part(boxG(T, 0.92, 0.1, 0.86), '#a8302a', thF, 0, 1.15, 0);
        bake.part(boxG(T, 0.84, 0.25, 0.78), '#3a3e44', thF, 0, -0.2, 0);
        bake.part(boxG(T, 0.5, 0.34, 0.04), '#ffd9a0', thF, 0, 0.55, 0.38);
        bake.part(boxG(T, 0.6, 0.06, 0.14), '#8d9198', thF, 0, 0.5, 0.44);

        // ---------- the screen on its truss (4:5 portrait, the biggest thing in the place, top under 10.5) ----------
        var SZ = -6.2, scrF = frameAt(0, SZ, 0, 0);
        S.scrF = scrF;
        var steel = sep('#5d636b'), steelD = sep('#474c53');
        var SB = 1.7, SH = 8.0, SW = SH * 0.8;
        var TOPY = SB + SH;
        [-1, 1].forEach(function (s) {
          var tx = s * (SW / 2 + 0.6);
          // a lattice tower: four corner posts, rungs and front diagonals
          [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(function (c2) { bake.part(boxG(T, 0.09, TOPY + 1.9, 0.09), steel, scrF, tx + c2[0], -1.4, c2[1]); });
          for (var ry2 = -0.6; ry2 < TOPY + 0.2; ry2 += lo ? 1.6 : 0.8) {
            bake.part(boxG(T, 0.62, 0.06, 0.06), steelD, scrF, tx, ry2, 0.28);
            bake.part(boxG(T, 0.06, 0.06, 0.62), steelD, scrF, tx + 0.28 * s, ry2, 0);
            if (!lo) bake.part(boxG(T, 0.05, 0.92, 0.05), steelD, scrF, tx, ry2, 0.29, 0, 0, (ry2 * 10 | 0) % 16 ? 0.6 : -0.6);
          }
          bake.part(boxG(T, 0.9, 0.12, 0.9), sep('#3a3e44'), scrF, tx, -1.4, 0);
        });
        // top and bottom beams, the dark frame behind the picture
        bake.part(boxG(T, SW + 1.8, 0.42, 0.42), steel, scrF, 0, TOPY + 0.22, -0.1);
        bake.part(boxG(T, SW + 1.8, 0.3, 0.3), steel, scrF, 0, SB - 0.5, -0.25);
        // the speaker stacks on the bank, either side under the picture
        [-1, 1].forEach(function (s) {
          bake.part(boxG(T, 0.9, 1.2, 0.8), sep('#1d1f23'), scrF, s * 2.2, 0.1, 0.9);
          [0.45, 1.0].forEach(function (cy) {
            bake.part(new T.CylinderGeometry(0.24, 0.24, 0.06, 10), '#4a4f57', scrF, s * 2.2, cy, 1.31, Math.PI / 2, 0, 0);
            bake.part(new T.CylinderGeometry(0.08, 0.08, 0.08, 8), '#2a2d32', scrF, s * 2.2, cy, 1.34, Math.PI / 2, 0, 0);
          });
        });
        // the back of the picture is a closed steel-grey wall with braces
        bake.part(boxG(T, SW + 0.4, SH + 0.4, 0.06), sep('#3a3e44'), scrF, 0, SB - 0.2, -0.16);
        for (var bb = -SW / 2 + 0.4; bb <= SW / 2 - 0.3; bb += 1.4) bake.part(boxG(T, 0.08, SH + 0.3, 0.12), steelD, scrF, bb, SB - 0.15, -0.24);
        if (!lo) for (var bx = -SW / 2; bx <= SW / 2 + 0.01; bx += SW / 6) bake.part(boxG(T, 0.05, 0.5, 0.05), steelD, scrF, bx, TOPY + 0.18, 0.13, 0, 0, 0.7);
        bake.part(boxG(T, SW + 0.36, SH + 0.36, 0.18), sep('#17191c', 1.6), scrF, 0, SB - 0.18, -0.02);
        // a low grass bank under the screen (deep, so its ends never float off the curve)
        bake.part(boxG(T, SW + 3.0, 1.9, 1.6), sep('#1a2f23'), scrF, 0, -1.75, 0.4);

        // the picture (the scene's one VideoTexture, or a still poster)
        var scrMat = basic('#cfd4da');
        var scr = new T.Mesh(new T.PlaneGeometry(SW, SH), scrMat);
        var scrHolder = new T.Group(); scrHolder.matrixAutoUpdate = false; scrHolder.matrix.copy(scrF);
        scr.position.set(0, SB + SH / 2, 0.14);
        scr.userData.clickable = 'screen';
        scrHolder.add(scr);
        root.add(scrHolder);
        S.screen = { mat: scrMat, mesh: scr, tex: null };
        // the side masks for 9:16 ads: flat ink, anchored at the picture's sides, slid in by scale
        var MW = (SW - SH * 0.5625) / 2, maskM = basic('#141414');
        S.masks = [-1, 1].map(function (s) {
          var mg = new T.PlaneGeometry(MW, SH); mg.translate(-s * MW / 2, 0, 0);
          var mm = new T.Mesh(mg, maskM); mm.position.set(s * SW / 2, SB + SH / 2, 0.16); mm.scale.x = 0.001; mm.visible = false;
          mm.userData.noBounds = true; mm.raycast = noHit;
          scrHolder.add(mm);
          return mm;
        });
        S.SW = SW; S.SH = SH;

        // ---------- the projector booth: a hut, the projector on its roof with two reels, the beam ----------
        var BX = 5.3, BZ = 1.0;
        var bRy = ryFront(0 - BX, SZ - BZ);
        var bF = frameUp(BX, BZ, bRy, 0.3, -0.12);
        bake.part(boxG(T, 1.8, 2.1, 1.8), sep('#4b5058', 1.8), bF, 0, 0, 0);
        bake.part(boxG(T, 2.0, 0.14, 2.0), '#33373d', bF, 0, 2.1, 0);
        bake.part(boxG(T, 0.7, 1.4, 0.05), '#262a30', bF, 0.35, 0, 0.91);                 // door, on the camera side
        bake.part(boxG(T, 0.06, 0.06, 0.06), '#aab0b8', bF, 0.62, 0.72, 0.95);             // its handle
        bake.part(boxG(T, 1.0, 0.18, 0.5), '#3a3e44', bF, 0.35, -0.1, 1.1);                // a step
        bake.part(boxG(T, 1.9, 0.3, 1.9), '#3a3e44', bF, 0, -0.3, 0);                      // a plinth, so no edge floats
        bake.part(boxG(T, 0.95, 0.08, 0.06), '#2a2d32', bF, 0, 1.08, -0.93);               // window sill
        bake.part(boxG(T, 0.4, 0.25, 0.05), '#33373d', bF, -0.5, 1.75, 0.92);              // a vent
        bake.part(boxG(T, 0.62, 0.45, 0.8), '#25282d', bF, 0, 2.24, 0.1);                // the projector body
        var lensF = new T.Matrix4().copy(bF);
        bake.part(new T.CylinderGeometry(0.12, 0.14, 0.3, 8), '#1c1e22', bF, 0, 2.47, -0.42, Math.PI / 2, 0, 0);
        var win = new T.Mesh(new T.PlaneGeometry(0.9, 0.5), basic('#ffd9a0'));
        var winH = new T.Group(); winH.matrixAutoUpdate = false; winH.matrix.copy(bF); root.add(winH);
        win.position.set(0, 1.35, -0.91); win.rotation.y = Math.PI; winH.add(win);
        var side = new T.Mesh(new T.PlaneGeometry(0.6, 0.4), basic('#ffd9a0'));
        side.position.set(0.91, 1.4, -0.2); side.rotation.y = Math.PI / 2; winH.add(side);
        // the reels stand up on the projector, in the plane of the lens axis, and turn about the booth's x axis
        S.reels = [];
        [-0.12, 0.34].forEach(function (rz2, k) {
          var rg = new T.Group(); rg.position.set(0, 2.69 + 0.42, rz2 + (k ? 0 : -0.06)); winH.add(rg);
          var disc = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.05, lo ? 10 : 16), ctx.mat('#aab0b8', { metalness: 0.2, roughness: 0.5 }));
          disc.rotation.z = Math.PI / 2; rg.add(disc);
          for (var sp = 0; sp < 3; sp++) {
            var spoke = new T.Mesh(new T.BoxGeometry(0.07, 0.62, 0.07), ctx.mat('#2a2d32'));
            spoke.rotation.x = sp * Math.PI / 3; spoke.position.x = 0.04; rg.add(spoke);
          }
          var hub = new T.Mesh(new T.BoxGeometry(0.1, 0.16, 0.16), ctx.mat('#2a2d32')); hub.position.x = -0.04; rg.add(hub);
          S.reels.push(rg);
        });
        ctx.box(winH, 0.05, 0.42, 0.05, ctx.mat('#2a2d32'), 0, 2.62, -0.12);
        ctx.box(winH, 0.05, 0.42, 0.05, ctx.mat('#2a2d32'), 0, 2.62, 0.28);

        // the beam: a solid pale wedge from the lens to the picture, flat and low in opacity (not a glow)
        var lens = TMP.v.set(0, 2.47, -0.6).applyMatrix4(lensF).clone();
        var corners = [[-SW / 2 + 0.25, SB + 0.2], [SW / 2 - 0.25, SB + 0.2], [SW / 2 - 0.25, SB + SH - 0.2], [-SW / 2 + 0.25, SB + SH - 0.2]].map(function (c3) {
          return new T.Vector3(c3[0], c3[1], 0.2).applyMatrix4(scrF);
        });
        var bpos = [];
        for (var cI = 0; cI < 4; cI++) {
          var A = corners[cI], B2 = corners[(cI + 1) % 4];
          bpos.push(lens.x, lens.y, lens.z, A.x, A.y, A.z, B2.x, B2.y, B2.z);
        }
        var beamG = new T.BufferGeometry(); beamG.setAttribute('position', new T.Float32BufferAttribute(bpos, 3));
        var beamM = basic('#fff3d6', { transparent: true, opacity: 0.075, depthWrite: false, side: T.DoubleSide });
        var beam = new T.Mesh(beamG, beamM); beam.userData.noBounds = true; beam.renderOrder = 2;
        beam.raycast = noHit;   // light is not a click target (the drag zone sits under it)
        root.add(beam);
        S.beam = { mesh: beam, mat: beamM };

        // ---------- the snack stand: kiosk, counter, striped awning, a sign with chasing bulbs ----------
        var KX = -5.3, KZ = 1.2, kRy = 1.1;
        var kF = frameUp(KX, KZ, kRy, 0.3, -0.12);
        bake.part(boxG(T, 2.6, 2.3, 1.3), '#5b4636', kF, 0, 0, -0.35);
        bake.part(boxG(T, 2.6, 0.95, 0.6), '#e9e4da', kF, 0, 0, 0.55);
        bake.part(boxG(T, 2.7, 0.08, 0.7), '#b8b1a4', kF, 0, 0.95, 0.55);
        bake.part(boxG(T, 2.8, 0.12, 1.5), '#3b2c22', kF, 0, 2.3, -0.3);
        bake.part(boxG(T, 2.62, 0.3, 1.32), '#3b2c22', kF, 0, -0.3, -0.35);               // footing
        // popcorn boxes (red with a white band), paper cups, a napkin box, a blank menu board, stools
        [[-0.95, 0.5], [-0.62, 0.62], [-0.3, 0.48]].forEach(function (pb) {
          bake.part(boxG(T, 0.2, 0.26, 0.16), P.red, kF, pb[0], 1.03, pb[1]);
          bake.part(boxG(T, 0.21, 0.07, 0.17), '#f4f0e6', kF, pb[0], 1.13, pb[1]);
          bake.part(new T.IcosahedronGeometry(0.1, 0), '#f6e3a6', kF, pb[0], 1.32, pb[1], 0, 0, 0, 1, 0.6, 0.8);
        });
        [0.15, 0.32, 0.49].forEach(function (cx) { bake.part(new T.CylinderGeometry(0.06, 0.045, 0.16, 7), '#f4f0e6', kF, cx, 1.11, 0.62); bake.part(new T.CylinderGeometry(0.062, 0.062, 0.02, 7), '#d8453a', kF, cx, 1.2, 0.62); });
        bake.part(boxG(T, 0.16, 0.12, 0.12), '#2a2d32', kF, 1.0, 1.03, 0.45);
        bake.part(boxG(T, 1.6, 0.42, 0.04), '#2d2a26', kF, 0, 1.95, 0.3);
        [-0.5, 0, 0.5].forEach(function (mx) { bake.part(boxG(T, 0.42, 0.06, 0.02), '#e9e4da', kF, mx, 2.05, 0.33); bake.part(boxG(T, 0.3, 0.05, 0.02), '#b8b1a4', kF, mx, 2.18, 0.33); });
        [-0.8, 0, 0.8].forEach(function (sx2) {
          bake.part(new T.CylinderGeometry(0.04, 0.05, 0.62, 6), '#5d636b', kF, sx2, 0.31, 1.25);
          bake.part(new T.CylinderGeometry(0.18, 0.18, 0.07, 10), '#d8453a', kF, sx2, 0.66, 1.25);
        });
        bake.part(new T.CylinderGeometry(0.2, 0.18, 0.7, 8), '#2f5a4f', kF, 1.55, 0.35, 0.6);   // a bin
        bake.part(boxG(T, 0.3, 0.5, 0.3), '#2f6fa8', kF, 0.65, 1.03, 0.45);               // a drinks cooler
        // fix r4 detail: a stack of trays, a ketchup and a mustard bottle, a straw cup on the counter
        bake.part(boxG(T, 0.32, 0.08, 0.22), '#c9c4b8', kF, 1.0, 1.15, 0.55);
        bake.part(new T.CylinderGeometry(0.035, 0.04, 0.16, 6), '#c0392b', kF, 0.86, 1.11, 0.72);
        bake.part(new T.CylinderGeometry(0.035, 0.04, 0.16, 6), '#e0b32a', kF, 0.96, 1.11, 0.74);
        bake.part(new T.CylinderGeometry(0.05, 0.04, 0.12, 6), '#e9e4da', kF, -1.15, 1.09, 0.62);
        var kWin = new T.Mesh(new T.PlaneGeometry(2.2, 0.9), basic('#ffd9a0'));
        var kH = new T.Group(); kH.matrixAutoUpdate = false; kH.matrix.copy(kF); root.add(kH);
        kWin.position.set(0, 1.45, 0.31); kH.add(kWin);
        // the awning: red and white slats, sloping out over the counter (they flap in the typhoon)
        S.slats = [];
        var NSL = lo ? 6 : 10;
        for (var sl = 0; sl < NSL; sl++) {
          var slat = ctx.box(kH, 2.7 / NSL + 0.01, 0.05, 1.05, ctx.mat(sl % 2 ? '#ece6da' : '#d8453a'), -1.35 + (sl + 0.5) * 2.7 / NSL, 2.05, 0.75);
          slat.rotation.x = 0.32;
          S.slats.push(slat);
        }
        // the sign on top (a plain red panel; no words) and its bulbs
        ctx.box(kH, 0.08, 0.6, 0.08, ctx.mat('#2a2d32'), -0.9, 2.42, -0.3);
        ctx.box(kH, 0.08, 0.6, 0.08, ctx.mat('#2a2d32'), 0.9, 2.42, -0.3);
        ctx.box(kH, 2.3, 0.8, 0.12, ctx.mat('#a8302a'), 0, 2.95, -0.3);
        var NBU = lo ? 10 : 16, bulbs = ctx.instanced(new T.BoxGeometry(0.11, 0.11, 0.06), basic('#ffffff'), NBU);
        bulbs.castShadow = false;
        kH.add(bulbs);
        var per = 2 * (2.1 + 0.6), bc = new T.Color();
        for (var bu = 0; bu < NBU; bu++) {
          var d = bu / NBU * per, bxx, byy;
          if (d < 2.1) { bxx = -1.05 + d; byy = 3.65; } else if (d < 2.7) { bxx = 1.05; byy = 3.65 - (d - 2.1); }
          else if (d < 4.8) { bxx = 1.05 - (d - 2.7); byy = 3.05; } else { bxx = -1.05; byy = 3.05 + (d - 4.8); }
          ctx.setInstance(bulbs, bu, bxx, byy, -0.22, 0, 1, 1, 1);
          bulbs.setColorAt(bu, bc.set('#ffe9a8'));
        }
        bulbs.instanceMatrix.needsUpdate = true;
        if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
        // the vendor behind the counter and a customer at it (people from YOU's own model, ctx.person)
        if (ctx.person) {
          var vend = ctx.person({ shirt: '#c0392b', pants: '#2b2f38', skin: '#c68a62', hair: '#1e1a18' });
          if (vend) { vend.position.set(0.15, 0, -0.15); kH.add(vend); }
          if (!lo) {
            var cust = ctx.person({ shirt: '#8fd3f4', pants: '#55595f', skin: '#f1c7a3', hair: '#5a3a22' });
            if (cust) { cust.position.set(-0.45, 0, 1.25); cust.rotation.y = Math.PI; kH.add(cust); }
          }
        }

        // ---------- the cars ----------
        S.cars = [];
        var glass = '#1b2633';
        CARS.forEach(function (cd, k) {
          if (lo && !LOW_CARS[k]) return;
          var g = new T.Group(); g.userData.clickable = 'car';
          var inner = new T.Group(); g.add(inner);
          var cb = new Baker(T, X);
          var body0 = sep(cd.col, 1.8);
          cb.part(boxG(T, 1.6, 0.52, 3.4), body0, null, 0, 0.22, 0);
          cb.part(boxG(T, 1.62, 0.16, 0.12), '#18191c', null, 0, 0.2, -1.72);
          cb.part(boxG(T, 1.62, 0.16, 0.12), '#18191c', null, 0, 0.2, 1.72);
          cb.part(boxG(T, 1.4, 0.5, 1.66), body0, null, 0, 0.74, 0.28);
          cb.part(boxG(T, 1.43, 0.3, 1.72), glass, null, 0, 0.8, 0.28);
          // close-up detail: pillars, mirrors, grille, blank plates, a door seam, hub caps, a closed underside
          cb.part(boxG(T, 1.45, 0.3, 0.1), body0, null, 0, 0.8, 0.28);
          [-1, 1].forEach(function (s) {
            cb.part(boxG(T, 0.18, 0.1, 0.1), body0, null, s * 0.86, 0.8, -0.5);
            cb.part(boxG(T, 0.12, 0.08, 0.02), '#9aa7b3', null, s * 0.88, 0.81, -0.44);
          });
          cb.part(boxG(T, 1.0, 0.16, 0.04), '#141518', null, 0, 0.38, -1.72);
          cb.part(boxG(T, 0.52, 0.14, 0.03), '#e8e6df', null, 0, 0.24, -1.79);
          cb.part(boxG(T, 0.52, 0.14, 0.03), '#e8e6df', null, 0, 0.38, 1.79);
          cb.part(boxG(T, 1.63, 0.36, 0.02), '#18191c', null, 0, 0.32, 0.02);
          cb.part(boxG(T, 1.5, 0.08, 3.2), '#121316', null, 0, 0.14, 0);
          for (var wx = -1; wx <= 1; wx += 2) for (var wz = -1; wz <= 1; wz += 2) {
            cb.part(new T.CylinderGeometry(0.3, 0.3, 0.24, lo ? 6 : 10), '#111214', null, wx * 0.72, 0.3, wz * 1.1, 0, 0, Math.PI / 2);
            if (!lo) cb.part(new T.CylinderGeometry(0.15, 0.15, 0.26, 8), '#8d949c', null, wx * 0.725, 0.3, wz * 1.1, 0, 0, Math.PI / 2);
          }
          var body = cb.mesh(vcol); inner.add(body);
          // lights: separate meshes so they can switch (flat colour, no glow)
          var lights = { head: [], tail: [] };
          [-1, 1].forEach(function (s) {
            var hl = new T.Mesh(new T.BoxGeometry(0.34, 0.14, 0.05), null); hl.position.set(s * 0.52, 0.55, -1.72); inner.add(hl); lights.head.push(hl);
            var tl = new T.Mesh(new T.BoxGeometry(0.36, 0.14, 0.05), null); tl.position.set(s * 0.55, 0.6, 1.72); inner.add(tl); lights.tail.push(tl);
          });
          // the headlight beam on the asphalt ahead, bent down with the curve
          var bp = [], NBs = 6;
          for (var bs = 0; bs < NBs; bs++) {
            var z0 = -1.8 - bs * 0.6, z1 = z0 - 0.6, w0 = 0.65 + bs * 0.15, w1 = w0 + 0.15;
            var y0 = 0.04 - z0 * z0 / 28, y1 = 0.04 - z1 * z1 / 28;
            bp.push(-w0, y0, z0, w0, y0, z0, w1, y1, z1, -w0, y0, z0, w1, y1, z1, -w1, y1, z1);
          }
          var bgm = new T.BufferGeometry(); bgm.setAttribute('position', new T.Float32BufferAttribute(bp, 3));
          var cbeam = new T.Mesh(bgm, S.mHeadBeam || (S.mHeadBeam = basic('#fff1c4', { transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide })));
          cbeam.userData.noBounds = true; cbeam.renderOrder = 1; cbeam.visible = false; cbeam.raycast = noHit;
          inner.add(cbeam);
          var car = { g: g, inner: inner, lights: lights, beam: cbeam, d: cd, k: k, flash: -9, on: -1, brake: -1, ph: k * 1.37 };
          g.userData.clickable = 'car';
          if (cd.wiper) {
            // a rear wiper on the back window (the side we see); it only sweeps in the typhoon
            var wp = new T.Group(); wp.position.set(0, 0.86, 1.13); inner.add(wp);
            var arm = new T.Mesh(boxG(T, 0.035, 0.36, 0.03), ctx.mat('#0e0f11')); wp.add(arm);
            car.wiper = wp;
          }
          ctx.plant(g, cd.x, cd.z, cd.ry);
          root.add(g);
          setLights(car, false, false);
          S.cars.push(car);
          if (cd.you) S.youCar = car;
        });
        // fix r4: the watchers (YOU too) sit on a blanket on the ground BESIDE their car, facing the screen. Seen from
        // behind, a seat on the bonnet put their heads through the car roofs. A blanket is a thin flat slab, planted
        // on the curve each frame with its seat (it slides with the car in the stop what-if, stays down in gravity).
        S.blankets = [];
        function blanket(col) {
          var bg = new T.Group(), bm = new T.Mesh(boxG(T, 1.0, 0.04, 1.3), ctx.mat(sep(col, 1.4)));
          bm.position.z = 0.32; bm.raycast = noHit; bm.receiveShadow = true; bm.userData.cast = false;
          bg.add(bm); root.add(bg); return bg;
        }
        S.youBlanket = blanket('#5f7fa3');
        if (ctx.person) {
          [[0, 1, '#ffffff', '#2f3b5c', '#8d5a3b', '#141414', '#a0563f'], [4, -0.85, '#E8412B', '#2b2b2b', '#e0ac85', '#2b2018', '#5d7a58']].forEach(function (pp) {
            if (lo && pp[0] === 0) return;
            var car2 = S.cars.filter(function (c3) { return c3.k === pp[0]; })[0];
            var pr = car2 && ctx.person({ pose: 'sit', shirt: pp[2], pants: pp[3], skin: pp[4], hair: pp[5] });
            if (!pr) return;
            root.add(pr);
            S.people.push({ g: pr, car: car2, side: pp[1], bl: blanket(pp[6]) });
          });
        }

        // ---------- stars: single flat points, still ----------
        var NST = lo ? 16 : 34, rnd = lcg(7), sp2 = [], sc2 = [];
        S.stars = [];
        for (var st = 0; st < NST * 3 && S.stars.length < NST; st++) {
          var sx = -11 + rnd() * 22, sy = 3.0 + rnd() * 8.2, sz = -6.8 - rnd() * 2.4;
          if (Math.abs(sx) < 6.4 && sy < 9.4) continue;   // not behind the screen
          sp2.push(sx, sy, sz); sc2.push(1, 1, 1);
          S.stars.push({ base: 0.45 + rnd() * 0.55 });
        }
        var stG = new T.BufferGeometry();
        stG.setAttribute('position', new T.Float32BufferAttribute(sp2, 3));
        stG.setAttribute('color', new T.Float32BufferAttribute(sc2, 3));
        var stM = new T.PointsMaterial({ size: lo ? 2.5 : 3, sizeAttenuation: false, vertexColors: true });
        stM.toneMapped = false; S.mats.push(stM);
        for (var sb = 0; sb < S.stars.length; sb++) { var b0 = S.stars[sb].base; sc2[sb * 3] = b0; sc2[sb * 3 + 1] = b0; sc2[sb * 3 + 2] = b0 * 0.96; }
        stG.attributes.color.array.set(sc2);
        var stars = new T.Points(stG, stM);
        stars.raycast = noHit;
        root.add(stars);
        S.starMesh = stars;

        // ---------- rain for the typhoon ----------
        var NR = lo ? 50 : 110;
        var rain = ctx.instanced(new T.BoxGeometry(0.03, 0.9, 0.03), basic('#7f97ad'), NR);
        rain.castShadow = false; rain.visible = false; rain.raycast = noHit;
        root.add(rain);
        S.rain = { mesh: rain, n: NR, d: [] };
        for (var rI = 0; rI < NR; rI++) S.rain.d.push([-10 + ctx.rand() * 22, ctx.rand() * 13, -7 + ctx.rand() * 13]);

        var staticMesh = bake.mesh(vcol);
        root.add(staticMesh);
        S.static = staticMesh;

        // ---------- YOU: walks round his car to the front bumper, then sits on the bonnet to watch ----------
        S.youStart = [2.0, 0.4];
        ctx.you.place(S.youStart[0], S.youStart[1], Math.PI);
        // W4: no default HUD reading from the scene (the page owns this readout and leaves it empty by default)

        // the page's ad tiles (.clip--ad, their video's file is video/ads/ad-N.mp4) switch the 3D screen to that ad.
        // The motion tests at the end of the section never go on the 3D screen.
        var sec = document.querySelector('[data-stop="films"]');
        if (sec) {
          var onTile = function (e) {
            var el = e.target && e.target.closest ? e.target.closest('.clip--ad') : null;
            if (!el || !S) return;
            var v = el.querySelector('video');
            if (!v) return;
            var src = v.getAttribute('src') || v.currentSrc || '';
            var name = src.split('/').pop().split('?')[0].replace(/\.mp4$/i, '');
            for (var i = 0; i < ADS.length; i++) if (ADS[i].n === name) { switchAd(i); S.flashAll = S.ctx.time; return; }
          };
          sec.addEventListener('click', onTile, true);
          S.listeners.push([sec, 'click', onTile, true]);
          // W4: and whichever ad tile starts playing (hovered, or the one in view), so the drive-in shows the ad the
          // visitor is looking at (media events do not bubble: capture)
          var onPlay = function (e) {
            var v = e.target;
            if (!S || !v || v.tagName !== 'VIDEO' || !v.closest || !v.closest('.clip--ad')) return;
            // lead r6: only an ad the visitor points at or tabs to (the tiles in view all play by themselves, and the
            // big first tile would put the same picture on both screens)
            var tile = v.closest('.clip--ad'); if (!tile.matches(':hover') && !tile.contains(document.activeElement)) return;
            var name = (v.getAttribute('src') || v.currentSrc || '').split('/').pop().split('?')[0].replace(/\.mp4$/i, '');
            for (var i = 0; i < ADS.length; i++) if (ADS[i].n === name) { switchAd(i); return; }
          };
          sec.addEventListener('play', onPlay, true);
          S.listeners.push([sec, 'play', onPlay, true]);
        }
        setQ(ctx.quality);
        // fetch the first ad's poster now (the scene is built a section early), so nothing loads mid-dive
        posterTex(S.ai, function () {});
        return root;
      },

      update: function (t, dt, ctx) {
        if (!S) return;
        var still = ctx.reduced, live = !still && !ctx.frozen;
        S.ctx = ctx;
        // what-if intensities ease in and out (instantly under reduced motion)
        var gG = S.mode === 'gravity' ? 1 : 0, gT = S.mode === 'typhoon' ? 1 : 0, gS = S.mode === 'stop' ? 1 : 0;
        if (still) { S.kG = gG; S.kT = gT; S.kS = gS; }
        else { S.kG = ease(S.kG, gG, dt, 0.5); S.kT = ease(S.kT, gT, dt, 0.35); S.kS = ease(S.kS, gS, dt, gS ? 0.25 : 0.6); }
        if (S.mode === 'stop') S.stopT += dt; else if (S.kS < 0.01) S.stopT = 0;
        var kG = S.kG, kT = S.kT, kS = S.kS;
        var slide = kS * (1 - Math.exp(-S.stopT * 2.4));
        // a frozen world holds its loops where they are
        if (live) S.lt = (S.lt || 0) + dt;
        var lt = S.lt || 0;

        // ---- cars: all parked; the clicked one's lights; wipers; what-ifs
        var m4 = TMP.m4;
        for (var ci = 0; ci < S.cars.length; ci++) {
          var car = S.cars[ci], cd = car.d;
          var head = false, brake = false, rev = false;
          S.ctx.plant(car.g, cd.x + slide * (1.4 + ci * 0.35), cd.z, cd.ry);
          // the toy: a clicked car's headlights come on for 2.5 s; a picked ad tile flashes them all once
          var flashOn = (t - car.flash >= 0 && t - car.flash < 2.5) || (t - S.flashAll >= 0 && t - S.flashAll < 0.45);
          setLights(car, head || flashOn, brake || rev || flashOn);
          // what-ifs: lift and tumble, rock in the wind, slide east
          var inner = car.inner;
          inner.position.y = kG * (1.2 + 0.45 * (ci % 3) + (still ? 0 : 0.2 * Math.sin(lt * 0.8 + car.ph)));
          inner.rotation.x = kG * 0.35 * (still ? 0.5 : Math.sin(lt * 0.5 + car.ph)) + kT * 0.04 * Math.sin(lt * 5.1 + car.ph);
          inner.rotation.z = kG * 0.3 * (still ? 0.4 : Math.cos(lt * 0.42 + car.ph)) + kT * 0.06 * Math.sin(lt * 4.3 + car.ph * 2) + kS * 0.25 * Math.exp(-S.stopT * 1.4);
          // the wiper sweeps only in the typhoon
          if (car.wiper) car.wiper.rotation.z = 1.45 - (still ? 0 : Math.abs(Math.sin(lt * 4.2)) * kT) * 2.9;
        }

        // ---- YOU: sits on the bonnet; StandUp when the camera leaves. The other watchers ride their cars.
        stepYou(t, dt, ctx, kG, kT, kS, slide);
        for (var pi = 0; pi < S.people.length; pi++) seatOn(S.people[pi], kG, kT, slide, t, pi);

        // ---- the reels turn (faster while the film runs), the beam flickers a little
        var running = S.vid && !S.vid.paused;
        S.reelA = (S.reelA || 0) + (live ? dt * (running ? 1.1 : 0.4) * (1 + kS * 3) : 0);
        for (var rr = 0; rr < S.reels.length; rr++) S.reels[rr].rotation.x = S.reelA * (rr ? 1.15 : 1);
        var beamOn = S.screen.tex ? 1 : 0.6;
        S.beam.mat.opacity = (0.06 + 0.02 * beamOn) * (1 - kT * 0.5);

        // ---- the awning flaps in the typhoon, floats off with no gravity
        for (var sl = 0; sl < S.slats.length; sl++) {
          var sla = S.slats[sl];
          sla.rotation.x = 0.32 + kT * 0.35 * Math.sin(lt * 9 + sl * 0.9) - kG * 0.4 * Math.sin(lt * 0.6 + sl);
          sla.position.y = 2.05 + kG * (0.5 + 0.25 * sl % 3 + 0.15 * Math.sin(lt * 0.7 + sl));
        }

        // ---- the stars hold still (they only float with no gravity)
        S.starMesh.position.y = kG * 0.6;

        // ---- rain
        var RN = S.rain;
        RN.mesh.visible = kT > 0.02;
        if (RN.mesh.visible) {
          var rq = TMP.q.setFromAxisAngle(TMP.z, -0.45);
          for (var ri = 0; ri < RN.n; ri++) {
            var dd2 = RN.d[ri];
            if (!still) { dd2[1] -= dt * 14; dd2[0] -= dt * 6.5; }
            if (dd2[1] < ctx.groundY(dd2[0], dd2[2]) || dd2[0] < -11) { dd2[1] = 10 + Math.random() * 3; dd2[0] = -6 + Math.random() * 17; }
            TMP.p.set(dd2[0], dd2[1], dd2[2]); TMP.s.set(1, kT, 1);
            RN.mesh.setMatrixAt(ri, m4.compose(TMP.p, rq, TMP.s));
          }
          RN.mesh.instanceMatrix.needsUpdate = true;
        }

        // ---- the ad (or its poster), and the 9:16 side masks
        tickScreen(ctx);
        var mGoal = ADS[S.ai].a < 0.7 ? 1 : 0;
        S.maskK = still ? mGoal : clamp(S.maskK + (mGoal ? 1 : -1) * dt / 0.4, 0, 1);
        var mk = S.maskK * S.maskK * (3 - 2 * S.maskK);
        for (var mi = 0; mi < 2; mi++) { S.masks[mi].visible = mk > 0.002; S.masks[mi].scale.x = Math.max(0.001, mk); }
      },

      onPointer: function (ev, ctx) {
        if (!S) return false;
        var o = ev.hit && ev.hit.object, tag = null, car = null;
        while (o) {
          if (o === S.screen.mesh) { tag = 'screen'; break; }
          for (var i = 0; i < S.cars.length; i++) if (o === S.cars[i].g) { car = S.cars[i]; tag = 'car'; break; }
          if (tag) break;
          o = o.parent;
        }
        if (ev.type === 'click') {
          if (tag === 'screen') {
            // low tier / reduced motion: a tap on the screen plays the ad
            if (!S.userPlay) { S.userPlay = true; sfx('blip'); }
            return true;
          }
          if (car) { car.flash = ctx.time; sfx('blip'); return true; }
        }
        return ev.type === 'click' && !!tag;
      },

      whatIf: function (mode, ctx) {
        if (!S) return false;
        var was = S.mode;
        S.mode = mode;
        if (mode === 'gravity') { S.seq = { kind: 'float', t0: ctx.time }; ctx.you.play('Float', { loop: true }); S.youClip = 'Float'; }
        else if (mode === 'typhoon') { /* he stays on the bonnet and leans into it */ }
        else if (mode === 'stop') { S.seq = { kind: 'flung', t0: ctx.time }; ctx.you.play('Idle'); ctx.you.play('Roll', { then: 'StandUp' }); S.youClip = 'Roll'; S.stopT = 0; }
        else if (was === 'gravity' || was === 'stop') { S.seq = { kind: was === 'stop' ? 'back' : 'resit', t0: ctx.time }; ctx.you.play('Idle'); S.youClip = 'Idle'; }
        return true;
      },

      setQuality: function (q) { setQ(q); },

      // fix r4 (QA bug 6): WORLD.pause() (the page's full ad player, Quick view) stops the drive-in's own video too;
      // after WORLD.resume() the next frame's tickScreen plays it again if the place is still arrived
      pause: function (on) {
        if (!S || !S.vid || !on) return;
        try { S.vid.pause(); } catch (e) { /* fine */ }
      },

      dispose: function () {
        if (!S) return;
        if (S.vid) { try { S.vid.pause(); S.vid.removeAttribute('src'); S.vid.load(); } catch (e) { /* gone */ } }
        S.screen.mat.map = null;
        if (S.vtex) S.vtex.dispose();
        Object.keys(S.posters).forEach(function (k) { if (S.posters[k] && S.posters[k].dispose) S.posters[k].dispose(); });
        S.mats.forEach(function (m) { m.dispose(); });
        S.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        S = null; TMP = null;
      }
    });

    // ---------- lights on a car ----------
    var LM = null;
    function lightMats() {
      if (LM && LM.alive === S) return LM;
      var T = S.T;
      function b(c) { var m = new T.MeshBasicMaterial({ color: c }); m.toneMapped = false; S.mats.push(m); return m; }
      LM = { alive: S, headOn: b('#fff4cc'), headOff: S.ctx.mat('#3a3d42'), tailOn: b('#ff3b30'), tailOff: S.ctx.mat('#4a1d1d') };
      return LM;
    }
    function setLights(car, head, tail) {
      var L = lightMats();
      var hk = head ? 1 : 0, tk2 = tail ? 1 : 0;
      if (car.on === hk && car.brake === tk2) return;
      car.on = hk; car.brake = tk2;
      for (var i = 0; i < 2; i++) { car.lights.head[i].material = head ? L.headOn : L.headOff; car.lights.tail[i].material = tail ? L.tailOn : L.tailOff; }
      car.beam.visible = head;
    }

    // ---------- YOU ----------
    function youClip(ctx, name, o) { if (S.youClip === name) return; S.youClip = name; ctx.you.play(name, o); }
    function stepYou(t, dt, ctx, kG, kT, kS, slide) {
      var car = S.youCar;
      if (!car) return;
      var cd = car.d;
      // fix r4: his spot is on a blanket beside his car (right-hand side, level with the front door), facing the screen
      var sp = seatSpot(cd, 1, 0), sx = sp[0], sz = sp[1];
      var faceRy = cd.ry + Math.PI;
      plantBlanket(S.youBlanket, sx + slide * 3.0, sz, faceRy);
      if (ctx.arrived && !S.arrivedWas) { S.arrivedWas = true; S.seq = ctx.reduced ? { kind: 'still', t0: t } : (S.mode ? S.seq : { kind: 'resit', t0: t }); S.everArrived = true; if (ctx.reduced) { ctx.you.place(sx, sz, faceRy); youClip(ctx, 'Idle'); } }
      if (!ctx.arrived && S.arrivedWas) {
        // the camera is leaving: he stands up
        S.arrivedWas = false;
        if (S.youClip === 'SitDown') { S.youClip = 'StandUp'; ctx.you.play('StandUp'); }
        S.seq = null;
        ctx.you.offset(0, 0, 0, 0, 0);
        return;
      }
      if (!ctx.arrived || !S.seq) return;
      var q = S.seq, u = t - q.t0;
      var lift = 0, back = 0;
      // the seated height (on the blanket) and how far back he sits (none: the blanket is on the ground)
      var LIFT = 0.04, BACK = 0;
      var sn = Math.sin(cd.ry), cs = Math.cos(cd.ry);
      if (q.kind === 'still') { ctx.you.place(sx, sz, faceRy); ctx.you.offset(0, 0, 0, 0, 0); return; }
      if (q.kind === 'arrive') {
        var ax = S.youStart[0], az = S.youStart[1], mx = ax, mz = sz + 0.3;
        var l1 = Math.abs(az - mz), l2 = Math.hypot(mx - sx, mz - sz), wsp = walkSpeed();
        var tw1 = l1 / wsp, tw2 = l2 / wsp;
        if (u < tw1) { ctx.you.place(ax, az + (mz - az) * (u / tw1), Math.PI); youClip(ctx, 'Walk', { loop: true }); }
        else if (u < tw1 + tw2) {
          var k = (u - tw1) / tw2;
          ctx.you.place(mx + (sx - mx) * k, mz + (sz - mz) * k, Math.atan2(sx - mx, sz - mz));
          youClip(ctx, 'Walk', { loop: true });
        } else if (u < tw1 + tw2 + 0.5) {
          var k3 = smooth(0, 0.5, u - tw1 - tw2), r0 = Math.atan2(sx - mx, sz - mz), dd = faceRy - r0;
          while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
          ctx.you.place(sx, sz, r0 + dd * k3); youClip(ctx, 'Idle');
        } else {
          ctx.you.place(sx, sz, faceRy);
          youClip(ctx, 'SitDown');
          var su = u - tw1 - tw2 - 0.5;
          lift = LIFT * smooth(0.25, 0.95, su); back = BACK * smooth(0.15, 0.9, su);
        }
      } else if (q.kind === 'resit' || q.kind === 'back') {
        var wait = q.kind === 'back' ? 1.3 : 0.35;
        ctx.you.place(sx, sz, faceRy);
        if (u < wait) youClip(ctx, q.kind === 'back' ? 'Walk' : 'Idle', { loop: q.kind === 'back' });
        else { youClip(ctx, 'SitDown'); var su2 = u - wait; lift = LIFT * smooth(0.25, 0.95, su2); back = BACK * smooth(0.15, 0.9, su2); }
      } else if (q.kind === 'float') {
        ctx.you.place(sx, sz, faceRy);
      } else if (q.kind === 'flung') {
        ctx.you.place(sx, sz, faceRy);
      }
      // the seat offset is along the car's own back direction (scene axes)
      var ox = sn * back, oz = cs * back;
      var fx = slide * 3.0, fy = kG * (1.6 + 0.2 * Math.sin(t * 0.9));
      ctx.you.offset(ox + fx, lift * (1 - kG) + fy, oz, kG * 0.2 * Math.sin(t * 0.7), kG * 0.25 * Math.sin(t * 0.5 + 1) + kT * 0.12);
    }
    function walkSpeed() { var d = W.debug; return d && d.walkSpeed ? d.walkSpeed * 1.2 : 1.4; }

    // a point beside a car in its own frame (side +1 = the car's right, `along` toward its front), in scene x, z
    function seatSpot(cd, side, slide) {
      var sn = Math.sin(cd.ry), cs = Math.cos(cd.ry), lx = side * 1.42, lz = -0.55;
      return [cd.x + lx * cs + lz * sn + (slide || 0), cd.z - lx * sn + lz * cs];
    }
    function plantBlanket(bl, x, z, ry) { if (bl) S.ctx.plant(bl, x, z, ry); }
    // the other watchers on blankets beside their cars: the same seat as YOU's, carried by the what-ifs
    function seatOn(pe, kG, kT, slide, t, i) {
      var g = pe.g, car = pe.car, cd = car.d;
      var sp = seatSpot(cd, pe.side, slide * (1.4 + car.k * 0.35));
      plantBlanket(pe.bl, sp[0], sp[1], cd.ry + Math.PI);
      S.ctx.plant(g, sp[0], sp[1], cd.ry + Math.PI);
      g.position.y += 0.04 + kG * (1.4 + 0.3 * i + 0.2 * Math.sin(t * 0.8 + i));
      if (kG > 0.002 || kT > 0.002) g.rotateZ(kG * 0.25 * Math.sin(t * 0.5 + i) + kT * 0.1);
    }

    // ---------- the screen: the ad while arrived; its poster on low / reduced motion until the screen is tapped ----------
    function setQ(q) {
      if (!S) return;
      S.lo = q === 'low';
      if (S.lo && S.vid && !S.userPlay) { try { S.vid.pause(); } catch (e) { /* fine */ } }
      // the phone version: three cars only
      for (var i = 0; i < S.cars.length; i++) S.cars[i].g.visible = !S.lo || !!LOW_CARS[S.cars[i].k];
    }
    // a texture's mapping for an ad of aspect a (width / height) on the 4:5 picture: centred, full height
    function fitTex(tex, a) {
      var r = (S.SW / S.SH) / a;
      tex.repeat.set(r, 1); tex.offset.set(0.5 - r / 2, 0);
    }
    function posterTex(i, cb) {
      if (S.posters[i]) { if (S.posters[i] !== 'loading') cb(S.posters[i]); return; }
      S.posters[i] = 'loading';
      var me = S;
      new S.T.TextureLoader().load(S.ctx.base + 'video/ads/' + ADS[i].n + '.jpg', function (tex) {
        if (S !== me) { tex.dispose(); return; }
        tex.colorSpace = S.T.SRGBColorSpace;
        fitTex(tex, ADS[i].a);
        S.posters[i] = tex; cb(tex);
      }, undefined, function () { if (S === me) S.posters[i] = null; });
    }
    function showMap(tex) {
      var m = S.screen.mat;
      if (m.map === tex) return;
      m.map = tex; m.color.set('#ffffff'); m.needsUpdate = true;
    }
    function makeVideo(ctx) {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
      // the mapping follows the ad that is really in the element once its first frame is there
      v.addEventListener('loadeddata', function () { if (S && S.vid === v) { S.vidAd = S.ai; if (S.vtex) fitTex(S.vtex, ADS[S.ai].a); } });
      v.src = ctx.base + 'video/ads/' + ADS[S.ai].n + '.mp4';
      S.vid = v;
    }
    // swap the one video element's source (the one VideoTexture stays and keeps its last frame until the new one is in)
    function switchAd(i) {
      if (!S || i === S.ai) return;
      S.ai = i;
      if (S.vid) {
        var wasPlaying = !S.vid.paused;
        S.vid.src = S.ctx.base + 'video/ads/' + ADS[i].n + '.mp4';
        try { S.vid.load(); } catch (e) { /* fine */ }
        if (wasPlaying) S.vid.play().catch(function () {});
      }
      S.showingPoster = -1;
    }
    function tickScreen(ctx) {
      // r13 pass A: the screen shows the still until the visitor taps it (no video plays by itself)
      var stillMode = !S.userPlay;
      var want = ctx.arrived && !document.hidden && !stillMode;
      if ((want || (ctx.dive > 0.3 && !stillMode)) && !S.vid) makeVideo(ctx);
      if (S.vid) {
        if (want && S.vid.paused) S.vid.play().catch(function () {});
        if (!want && !S.vid.paused) S.vid.pause();
      }
      ctx.live = !!(S.vid && !S.vid.paused && !stillMode);   // r13 pass A: world.js keeps drawing only while it plays
      // the video texture only while the ad is really playing (a paused video gives the texture no frame: three.js
      // uploads video frames as they are presented); otherwise the ad's poster
      var vidReady = S.vid && S.vid.readyState >= 2 && S.vid.videoWidth && S.vidAd === S.ai && !S.vid.paused && S.vid.currentTime > 0.05;
      if (vidReady && !stillMode) {
        if (!S.vtex) {
          S.vtex = new S.T.VideoTexture(S.vid);
          S.vtex.colorSpace = S.T.SRGBColorSpace;
          fitTex(S.vtex, ADS[S.ai].a);
        }
        S.screen.tex = S.vtex;
        showMap(S.vtex);
      } else if (ctx.dive > 0.2) {
        // the ad's poster until the video has a frame (and on low / reduced motion until tapped)
        if (S.showingPoster !== S.ai) {
          var ai = S.ai;
          posterTex(ai, function (tx) { if (S && S.ai === ai) { S.showingPoster = ai; showMap(tx); } });
        }
      }
    }

  }
  if (window.WORLD) go(); else window.addEventListener('DOMContentLoaded', go);
})();
