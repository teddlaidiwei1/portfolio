/* scenes/tinyworld.js: Marina Bay, live (Builder W, v4: street level). The camera dives into this place in the
   tinyworld section and lands on the promenade beside YOU, then glides along the water to the Merlion, rises past the
   Flyer and ends low by the gorilla (the `shots` list below).
   A low-poly Marina Bay squeezed onto the curve of the planet, in the house style (flat colours, no sky dome, no fog):
   Marina Bay Sands (window fins, floor bands, the SkyPark with its glass edge and pool), the Shoppes with doors and a
   screen playing his reels, the ArtScience lotus, the Merlion (face, mane, scales) and its jet, the Singapore Flyer
   with its capsules, Supertrees, a skyline with windows, a bridge with cars, bumboats (canopy, rails, painted eyes, a
   driver), the promenade (paving bands, railing, lamps, benches, bins, cafe umbrellas, an ice-cream cart), people who
   walk, sit and take photos, and the silverback. Click the gorilla for the fight.
   What-ifs run in three stages (ctx.whatIfStage / ctx.whatIfT from world.js) and put themselves back.
   Shapes ported (simplified, rescaled) from tinyworld-base/engine/sets/mbs.js and marinabay.js.
   Scene units: YOU is 1.8 tall. See briefs/world-api.md. */
(function () {
  'use strict';
  function go() {
    var W = window.WORLD;
    if (!W || !W.registerScene) return;

    var S = null, TMP = null; // everything built lives here, so dispose() can drop it

    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function ease(k, goal, dt, tau) { return k + (goal - k) * (1 - Math.exp(-dt / tau)); }
    var BAY = { cx: -0.5, cz: -0.6, rx: 7.0, rz: 2.9 };
    function inBay(x, z) { var a = (x - BAY.cx) / BAY.rx, b = (z - BAY.cz) / BAY.rz; return a * a + b * b; }
    // the promenade edge: the bay ellipse grown to the top of the sea wall; points are found by angle a (0..PI is the
    // south side, nearest the camera) and distance d out from the wall
    var S0 = 1.06, ERX = BAY.rx * S0, ERZ = BAY.rz * S0;
    var EP = [0, 0, 0, 0];
    function edge(a, d, out) {
      var ca = Math.cos(a), sa = Math.sin(a), nx = ca / BAY.rx, nz = sa / BAY.rz, nl = Math.sqrt(nx * nx + nz * nz);
      var tx = -ERX * sa, tz = ERZ * ca, tl = Math.sqrt(tx * tx + tz * tz);
      out = out || EP;
      out[0] = BAY.cx + ERX * ca + nx / nl * d; out[1] = BAY.cz + ERZ * sa + nz / nl * d;
      out[2] = tx / tl; out[3] = tz / tl;
      return out;
    }
    function aAtX(x) { return Math.acos(clamp((x - BAY.cx) / ERX, -1, 1)); }
    // W4: the big reel screen on the bay's east bank (scene units; 9:16 picture w x h, its bottom y0 above the ground)
    var SCR = { x: 4.6, z: -4.3, ry: -0.3, w: 3.6, h: 6.4, y0: 1.35 };
    // YOU's spot and the gorilla's line. W4: he faces the reel screen (his back three-quarters to the camera)
    var YX = 0.5, YZ = 3.0, YRY = Math.atan2(SCR.x - YX, SCR.z - YZ), GZ = 3.3, G0 = -6.0, G1 = -4.6;
    function faceScreen(x, z) { return Math.atan2(SCR.x - x, SCR.z - z); }

    // the stop what-if: how far things have slid east, accelerating each stage, then still
    var SL_A = [0.25, 1.0, 5.0], SL_T = [0, 1.8, 3.6, 5.0];
    function slideD(t) {
      t = Math.min(t, SL_T[3]);
      var x = 0, v = 0;
      for (var i = 0; i < 3; i++) {
        if (t <= SL_T[i]) break;
        var tau = Math.min(t, SL_T[i + 1]) - SL_T[i];
        x += v * tau + 0.5 * SL_A[i] * tau * tau; v += SL_A[i] * tau;
      }
      return x;
    }

    // ---------- a baker: static parts merged into one mesh with vertex colours (one draw call) ----------
    function Baker(T, X) { this.T = T; this.X = X; this.list = []; this.m = new T.Matrix4(); this.o = new T.Object3D(); this.c = new T.Color(); }
    // color: a colour, or function(triangleIndex) -> colour
    Baker.prototype.add = function (geo, color, matrix) {
      var T = this.T, g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.deleteAttribute('uv');
      if (g.attributes.uv1) g.deleteAttribute('uv1');
      if (matrix) g.applyMatrix4(matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      var n = g.attributes.position.count, arr = new Float32Array(n * 3), c = this.c, fn = typeof color === 'function';
      if (!fn) c.set(color);
      for (var i = 0; i < n; i++) {
        if (fn && i % 3 === 0) c.set(color(i / 3));
        arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(arr, 3));
      g.clearGroups();
      this.list.push(g);
      geo.dispose();
    };
    // a part at local position/rotation/scale, inside a frame matrix
    Baker.prototype.part = function (geo, color, frame, x, y, z, rx, ry, rz, sx, sy, sz) {
      var o = this.o;
      o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0, 'YXZ');
      o.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); o.updateMatrix();
      this.m.copy(o.matrix);
      if (frame) this.m.premultiply(frame);
      this.add(geo, color, this.m);
    };
    Baker.prototype.geo = function () {
      if (!this.list.length) return null;
      var g = this.X.mergeGeometries(this.list, false);
      this.list.forEach(function (x) { x.dispose(); });
      this.list = [];
      return g;
    };
    Baker.prototype.mesh = function (mat) {
      var g = this.geo();
      if (!g) return null;
      var me = new this.T.Mesh(g, mat);
      me.castShadow = true; me.receiveShadow = true;
      return me;
    };

    function boxG(T, w, h, d) { var g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }
    function cylG(T, rt, rb, h, seg) { var g = new T.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0); return g; }

    W.registerScene('tinyworld', {
      // the camera's path once arrived (scene units): beside YOU with MBS behind him, along the water to the Merlion,
      // up past the Flyer, then low by the gorilla
      // calm pass: one settled framing. Only the heading (straight on from the promenade side), the height angle
      // (about 16 degrees) and the lens are read; world.js works out the distance so the whole bay fits the stage.
      shots: [
        { pos: [0, 7.0, 18], look: [0, 2.0, 0], fov: 34, you: [0.5, 3.0] }
      ],

      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, P = ctx.palette, lo = ctx.quality === 'low';
        var root = new T.Group();
        TMP = { m4: new T.Matrix4(), mA: new T.Matrix4(), mB: new T.Matrix4(), mP: new T.Matrix4(), inv: new T.Matrix4(),
          q: new T.Quaternion(), q2: new T.Quaternion(), p: new T.Vector3(), s: new T.Vector3(), one: new T.Vector3(1, 1, 1),
          z: new T.Vector3(0, 0, 1), x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), up: new T.Vector3(), qq: new T.Quaternion(),
          qy: new T.Quaternion(), qw: new T.Quaternion(), e: new T.Euler(), c: new T.Color(),
          cp: new T.Vector3(), cr: new T.Vector3(), cu: new T.Vector3(), cf: new T.Vector3(), ep: [0, 0, 0, 0] };
        S = { root: root, T: T, ck: 0, mode: null, wm: null, wt: 0, env: 0, lastStage: 0, fight: null, lastHud: '', vid: null, vtex: null, ri: 0, vidR: -1, posters: {}, showingPoster: -1, paused: false, userPlay: false, lo: lo,
          k: { g1: 0, g2: 0, g3: 0, t1: 0, t2: 0, t3: 0, s1: 0, s2: 0, s3: 0, kT: 0, kG: 0, slide: 0, env: 0 }, wv: { rise: 0, amp: 1, tilt: 0, ck: 0 } };
        var vcol = ctx.mat('#ffffff', { vertexColors: true });
        var bake = new Baker(T, X);
        var dummy = new T.Object3D();
        function frameAt(x, z, ry, dy) { ctx.plant(dummy, x, z, ry); dummy.position.y += dy || 0; dummy.updateMatrix(); return dummy.matrix.clone(); }
        // calm pass: tall landmarks stand only partly tipped with the curve (k of the full tilt), sunk a little so no
        // edge of their base floats, so the bay reads upright in the settled framing
        var upV = new T.Vector3(), upQ2 = new T.Quaternion(), Y1 = new T.Vector3(0, 1, 0);
        function plantUp(obj, x, z, ry, k, dy) {
          var gy = ctx.groundY(x, z);
          upV.set(x, gy + ctx.R, z).normalize().lerp(Y1, 1 - k).normalize();
          obj.position.set(x, gy + (dy || 0), z);
          obj.quaternion.setFromUnitVectors(Y1, upV).multiply(upQ2.setFromAxisAngle(Y1, ry || 0));
          return obj;
        }
        function frameUp(x, z, ry, k, dy) { plantUp(dummy, x, z, ry, k, dy); dummy.updateMatrix(); return dummy.matrix.clone(); }
        function rnd() { return ctx.rand(); }

        // ---------- ground: a curved cap with the bay sunk into it, promenade paving, grass ----------
        var RINGS = lo ? 12 : 26, SEG = lo ? 32 : 72, RMAX = 10.2;
        var cap = new T.BufferGeometry(), pos = [], colsA = [];
        var cPave = new T.Color('#E6DDCB'), cPave2 = new T.Color('#ddd2bd'), cGrass = new T.Color(P.land), cGrass2 = new T.Color(P.land2), cBed = new T.Color('#1f7f9c'), cRoad = new T.Color('#6b6f73'), cEdge = new T.Color('#cfc5b1');
        function vtx(r, a) {
          var x = r * Math.cos(a), z = r * Math.sin(a), y = ctx.groundY(x, z) + 0.03;
          var e = inBay(x, z);
          if (e < 1) y -= 0.32 * smooth(1, 0.82, e);
          return [x, y, z];
        }
        function zone(x, z) {
          var e = inBay(x, z);
          if (e < 0.98) return cBed;
          if (e < S0 * S0) return cEdge;
          if (Math.abs(x - 5.0) < 0.45 && z > -6 && z < 4) return cRoad;
          var bx = (x - BAY.cx) / (ERX + 3.0), bz = (z - BAY.cz) / (ERZ + 3.0);
          var pave = (z > BAY.cz && bx * bx + bz * bz < 1) || (z < BAY.cz && e < 1.9) || (z < -2.6 && z > -6.2 && x > -5.2 && x < 3.4);
          if (pave) return z < BAY.cz ? cPave2 : cPave;
          var hsh = Math.sin(Math.floor(x * 0.9) * 12.99 + Math.floor(z * 0.9) * 78.23) * 43758.5; hsh -= Math.floor(hsh);
          return hsh > 0.72 ? cGrass2 : cGrass;
        }
        for (var ri = 0; ri < RINGS; ri++) {
          var r0 = RMAX * ri / RINGS, r1 = RMAX * (ri + 1) / RINGS;
          for (var si = 0; si < SEG; si++) {
            var a0 = si / SEG * Math.PI * 2, a1 = (si + 1) / SEG * Math.PI * 2;
            var p00 = vtx(r0, a0), p01 = vtx(r0, a1), p10 = vtx(r1, a0), p11 = vtx(r1, a1);
            var tris = ri === 0 ? [[p00, p11, p10]] : [[p00, p11, p10], [p00, p01, p11]];
            tris.forEach(function (tr) {
              var mx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, mz = (tr[0][2] + tr[1][2] + tr[2][2]) / 3;
              var c = zone(mx, mz);
              tr.forEach(function (p) { pos.push(p[0], p[1], p[2]); colsA.push(c.r, c.g, c.b); });
            });
          }
        }
        cap.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        cap.setAttribute('color', new T.Float32BufferAttribute(colsA, 3));
        cap.computeVertexNormals();
        var capMesh = new T.Mesh(cap, vcol);
        capMesh.receiveShadow = true;
        root.add(capMesh);

        // ---------- the bay water: a sheet that moves (waves in a typhoon, sloshes when the Earth stops) ----------
        var WR = lo ? 8 : 12, WS = lo ? 28 : 44;
        var wg = new T.BufferGeometry(), wpos = [], wbase = [];
        for (var wi = 0; wi < WR; wi++) {
          for (var wj = 0; wj < WS; wj++) {
            var q = [[wi, wj], [wi + 1, wj + 1], [wi + 1, wj], [wi, wj], [wi, wj + 1], [wi + 1, wj + 1]];
            for (var qi = 0; qi < (wi === 0 ? 3 : 6); qi++) {
              var rr = q[qi][0] / WR * 0.99, aa = q[qi][1] / WS * Math.PI * 2;
              var x = BAY.cx + BAY.rx * rr * Math.cos(aa), z = BAY.cz + BAY.rz * rr * Math.sin(aa);
              wbase.push(x, ctx.groundY(x, z) + 0.01, z);
              wpos.push(x, 0, z);
            }
          }
        }
        wg.setAttribute('position', new T.Float32BufferAttribute(wpos, 3));
        var water = new T.Mesh(wg, ctx.mat('#2aa3c4', { roughness: 0.35, metalness: 0.05 }));
        water.receiveShadow = true;
        water.userData.noBounds = true;
        root.add(water);
        S.water = { mesh: water, base: new Float32Array(wbase), pos: wg.attributes.position };

        // ---------- the flood: a water sheet over the promenade that climbs out of the bay (typhoon, stop) ----------
        var FA = lo ? 24 : 44, FD = lo ? 6 : 10, fpos = [], fidx = [], fbase = [];
        for (var fi = 0; fi <= FD; fi++) {
          for (var fj = 0; fj <= FA; fj++) {
            var fa = 0.3 + (Math.PI - 0.6) * fj / FA, fd = -0.4 + 4.2 * fi / FD;
            edge(fa, fd, TMP.ep);
            fpos.push(TMP.ep[0], -5, TMP.ep[1]);
            fbase.push(TMP.ep[0], ctx.groundY(TMP.ep[0], TMP.ep[1]) + 0.03, TMP.ep[1], fd);
            if (fi < FD && fj < FA) { var v0 = fi * (FA + 1) + fj; fidx.push(v0, v0 + 1, v0 + FA + 1, v0 + 1, v0 + FA + 2, v0 + FA + 1); }
          }
        }
        var fg = new T.BufferGeometry();
        fg.setAttribute('position', new T.Float32BufferAttribute(fpos, 3));
        fg.setIndex(fidx);
        var flood = new T.Mesh(fg, ctx.mat('#3fb0cf', { roughness: 0.3, transparent: true, opacity: 0.86 }));
        flood.userData.noBounds = true; flood.visible = false; flood.receiveShadow = true;
        root.add(flood);
        S.flood = { mesh: flood, base: new Float32Array(fbase), pos: fg.attributes.position };

        // ---------- Marina Bay Sands: three towers (straight east leg, curved west leg), the SkyPark, the Shoppes ----------
        // towers and deck are their own meshes so the gravity what-if can stretch the towers and tug the deck up
        // 1.25x the old size, so it towers over YOU from street level (deck about 9.5 up, inside the 12 limit)
        var mbsF = frameUp(-0.3, -5.45, 0.22, 0.45, -0.25).multiply(new T.Matrix4().makeScale(1.25, 1.25, 1.25));
        var mbsG = new T.Group(); mbsG.matrixAutoUpdate = false; mbsG.matrix.copy(mbsF); root.add(mbsG);
        var bT = new Baker(T, X), bD = new Baker(T, X);
        // tower glass held at 1.5:1 or more against the sky field, so the towers stand off the sky (ctx.separate)
        var sep = ctx.separate || function (c) { return c; };
        var TH = 7.2, TD = 0.78, glassA = sep('#8fb4c8', 1.6), glassB = sep('#6f97ad', 1.9), slab = '#f4f2ec', fin = sep('#4f7891', 2.4);
        var JOIN = 0.62 * TH;
        var fy = function (y) { return Math.pow(Math.max(0, 1 - y / JOIN), 1.7); };
        function legShape(z0, z1) {
          var sh = new T.Shape(), N = 12, k;
          sh.moveTo(z1 + 0.95 * fy(0), 0);
          for (k = 1; k <= N; k++) { var y = TH * k / N; sh.lineTo(z1 + 0.95 * fy(y), y); }
          for (k = N; k >= 0; k--) { var y2 = TH * k / N; sh.lineTo(z0 + 0.95 * fy(y2), y2); }
          return sh;
        }
        [-3.0, -0.8, 1.4].forEach(function (tx) {
          // east leg: a straight slab at the back
          bT.part(boxG(T, TD, TH, 0.34), glassB, null, tx, 0, -0.42);
          // west leg: a side profile curving out toward the bay at the bottom, extruded across the tower's width
          var leg = new T.ExtrudeGeometry(legShape(-0.08, 0.3), { depth: TD, bevelEnabled: false, curveSegments: 1 });
          leg.rotateY(-Math.PI / 2); leg.translate(TD / 2, 0, 0);
          bT.part(leg, glassA, null, tx, 0, 0);
          // vertical window fins that follow the curve, so the glass reads close up
          if (!lo) [-0.27, -0.09, 0.09, 0.27].forEach(function (fx) {
            var f = new T.ExtrudeGeometry(legShape(0.27, 0.325), { depth: 0.035, bevelEnabled: false, curveSegments: 1 });
            f.rotateY(-Math.PI / 2); f.translate(0.0175, 0, 0);
            bT.part(f, fin, null, tx + fx, 0, 0);
          });
          // floor slabs: white bands that make it read as a hotel
          for (var fl = 0.55; fl < TH - 0.2; fl += lo ? 1.1 : 0.55) {
            var zf = 0.3 + 0.95 * fy(fl);
            bT.part(boxG(T, TD + 0.02, 0.06, 0.38), slab, null, tx, fl, zf - 0.19);
            bT.part(boxG(T, TD + 0.02, 0.06, 0.36), slab, null, tx, fl, -0.42);
          }
          // the roof crown where each tower meets the deck
          bT.part(boxG(T, TD + 0.06, 0.12, 0.8), '#e4e1d8', null, tx, TH - 0.12, -0.12);
        });
        var towersMesh = bT.mesh(vcol);
        mbsG.add(towersMesh);
        // the SkyPark: a long boat-shaped deck, overhanging past the north (left) tower, with the infinity pool on the bay side
        function hullShape(sc, cxh) {
          var f = function (x, y) { return [cxh + (x - cxh) * sc, y * sc]; }, sh = new T.Shape(), p;
          p = f(-5.4, 0.12); sh.moveTo(p[0], p[1]);
          var q1 = f(-4.6, 0.62), e1 = f(-3.6, 0.66); sh.quadraticCurveTo(q1[0], q1[1], e1[0], e1[1]);
          p = f(1.9, 0.66); sh.lineTo(p[0], p[1]);
          var q2 = f(2.7, 0.62), e2 = f(2.7, 0); sh.quadraticCurveTo(q2[0], q2[1], e2[0], e2[1]);
          var q3 = f(2.7, -0.62), e3 = f(1.9, -0.66); sh.quadraticCurveTo(q3[0], q3[1], e3[0], e3[1]);
          p = f(-3.6, -0.66); sh.lineTo(p[0], p[1]);
          var q4 = f(-4.6, -0.62), e4 = f(-5.4, -0.12); sh.quadraticCurveTo(q4[0], q4[1], e4[0], e4[1]);
          p = f(-5.4, 0.12); sh.lineTo(p[0], p[1]);
          return sh;
        }
        var cseg = lo ? 3 : 6;
        var deckG = new T.ExtrudeGeometry(hullShape(1, -1.35), { depth: 0.36, bevelEnabled: false, curveSegments: cseg });
        deckG.rotateX(-Math.PI / 2);
        bD.part(deckG, '#eeece6', null, 0, 0, -0.12);
        var keel = new T.ExtrudeGeometry(hullShape(1, -1.35), { depth: 0.14, bevelEnabled: false, curveSegments: cseg });
        keel.rotateX(-Math.PI / 2);
        bD.part(keel, '#c9ccd0', null, 0, -0.12, -0.12, 0, 0, 0, 0.985, 1, 0.86);
        // the glass edge all round the deck
        var rim = hullShape(1, -1.35); rim.holes.push(hullShape(0.975, -1.35));
        var rimG = new T.ExtrudeGeometry(rim, { depth: 0.13, bevelEnabled: false, curveSegments: cseg });
        rimG.rotateX(-Math.PI / 2);
        bD.part(rimG, '#d8eff7', null, 0, 0.36, -0.12);
        bD.part(boxG(T, 4.7, 0.04, 0.38), '#dcd8cf', null, -1.0, 0.34, 0.3);            // pool surround
        bD.part(boxG(T, 4.6, 0.05, 0.3), '#4fd0ee', null, -1.0, 0.36, 0.3);              // the infinity pool
        for (var tr = 0; tr < (lo ? 5 : 10); tr++) bD.part(new T.IcosahedronGeometry(0.16, 0), '#3E9B4F', null, -3.8 + tr * 0.62, 0.5, -0.4);
        bD.part(boxG(T, 0.8, 0.22, 0.5), '#3e5566', null, 0.9, 0.36, -0.3);              // a pavilion
        bD.part(boxG(T, 0.6, 0.18, 0.4), '#3e5566', null, -2.5, 0.36, -0.3);
        if (!lo) for (var lu = 0; lu < 7; lu++) bD.part(boxG(T, 0.1, 0.03, 0.22), '#f4f2ec', null, -3.0 + lu * 0.55, 0.36, 0.06); // loungers
        var deckGrp = new T.Group(); deckGrp.position.y = TH; mbsG.add(deckGrp);
        deckGrp.add(bD.mesh(vcol));
        // the Shoppes podium on the waterfront: glass shopfront, mullions, doors, a canopy
        bake.part(boxG(T, 7.2, 0.62, 0.9), '#ece6da', mbsF, -0.9, 0, 0.85);
        bake.part(boxG(T, 7.0, 0.06, 0.96), '#9cc3d6', mbsF, -0.9, 0.62, 0.85);
        bake.part(boxG(T, 7.0, 0.3, 0.03), '#6f97ad', mbsF, -0.9, 0.08, 1.3);
        bake.part(boxG(T, 7.3, 0.04, 0.32), '#f4f2ec', mbsF, -0.9, 0.45, 1.42);
        for (var mu = 0; mu < (lo ? 10 : 21); mu++) bake.part(boxG(T, 0.035, 0.3, 0.04), '#f4f2ec', mbsF, -4.3 + mu * 6.8 / (lo ? 9 : 20), 0.08, 1.31);
        [-3.4, -0.9, 1.6].forEach(function (dx) { bake.part(boxG(T, 0.34, 0.34, 0.04), '#2b3a44', mbsF, dx, 0, 1.33); });
        S.mbs = { g: mbsG, towers: towersMesh, deck: deckGrp, TH: TH };

        // ---------- W4: the big outdoor screen on the bay's east bank, playing his reels ----------
        // A 9:16 LED wall (3.6 x 6.4, about two thirds of MBS's height) on a steel frame, facing the promenade, so his
        // real reels are the first thing in the place. Nothing on it but the reel (no text, no logo).
        var scrF = frameUp(SCR.x, SCR.z, SCR.ry, 0.1, -0.1);
        var SW = SCR.w, SH = SCR.h, SY0 = SCR.y0, steelD = '#3d444a', steelL = '#69737b';
        bake.part(boxG(T, SW + 0.26, SH + 0.26, 0.24), '#1b1d20', scrF, 0, SY0 - 0.13, -0.16);       // the bezel
        bake.part(boxG(T, SW + 0.3, 0.1, 0.36), steelL, scrF, 0, SY0 + SH + 0.13, -0.18);            // a top rail
        bake.part(boxG(T, SW - 0.2, SH * 0.8, 0.08), '#2a2e33', scrF, 0, SY0 + SH * 0.1, -0.34);     // the back box
        [-1, 1].forEach(function (s) {
          var px = s * (SW / 2 - 0.55);
          bake.part(boxG(T, 0.24, SY0 + SH * 0.82, 0.24), steelD, scrF, px, -0.05, -0.5);           // the two masts
          bake.part(boxG(T, 0.8, 0.3, 0.9), '#cfc5b1', scrF, px, -0.1, -0.5);                        // their footings
          bake.part(boxG(T, 0.08, 2.21, 0.08), steelL, scrF, px, -0.05, -1.5, 0.49);                // a rear brace up to the mast
          bake.part(boxG(T, 0.3, 0.16, 0.3), '#cfc5b1', scrF, px, -0.1, -1.5);
          for (var cb2 = 0; cb2 < (lo ? 1 : 3); cb2++) bake.part(boxG(T, 0.5, 0.06, 0.06), steelL, scrF, px, SY0 + 0.6 + cb2 * SH * 0.3, -0.42);
        });
        var scrMat = new T.MeshBasicMaterial({ color: '#202326' });
        scrMat.toneMapped = false;
        var scr = new T.Mesh(new T.PlaneGeometry(SW, SH), scrMat);
        scr.userData.cast = false;
        var scrHolder = new T.Group();
        scrHolder.matrixAutoUpdate = false; scrHolder.matrix.copy(scrF);
        scr.position.set(0, SY0 + SH / 2, -0.03);
        scrHolder.add(scr);
        root.add(scrHolder);
        S.screen = { mat: scrMat, tex: null, mesh: scr };

        // ---------- ArtScience Museum: the white lotus ----------
        var asF = frameAt(-5.2, -3.15, 0.4, 0);
        bake.part(cylG(T, 0.55, 0.65, 0.3, 10), '#d8d4ca', asF, 0, 0, 0);
        for (var pt = 0; pt < 7; pt++) {
          var pa = -1.2 + pt * 0.4;
          var petal = new T.ConeGeometry(0.34, 1.6, 5);
          petal.translate(0, 0.8, 0);
          bake.part(petal, pt % 2 ? '#f4f2ec' : '#e8e4da', asF, Math.sin(pa) * 0.28, 0.25, -Math.cos(pa) * 0.1, -0.35 * Math.cos(pa), 0, -pa * 0.85, 1, 1, 0.45);
        }

        // ---------- north-shore blocks (left), a small skyline (right): window bands and mullions ----------
        function tower(f, w, h, col, band) {
          bake.part(boxG(T, w, h, w), col, f, 0, 0, 0);
          for (var yb = 0.5; yb < h - 0.2; yb += lo ? 1.0 : 0.5) bake.part(boxG(T, w + 0.02, 0.05, w + 0.02), band, f, 0, yb, 0);
          if (!lo) [-1, 1].forEach(function (s) {
            [-0.22, 0.22].forEach(function (u) {
              bake.part(boxG(T, 0.03, h - 0.3, 0.02), band, f, u * w, 0.15, s * (w / 2 + 0.005));
              bake.part(boxG(T, 0.02, h - 0.3, 0.03), band, f, s * (w / 2 + 0.005), 0.15, u * w);
            });
          });
        }
        // calm pass: the far north-shore blocks and the outer skyline are gone (a narrower, quieter bay); the rest
        // stand nearly upright
        // W4: the three blocks east of the bay stood round the big reel screen and cluttered it: gone
        [].forEach(function (b, k) {
          var f = frameUp(b[0], b[1], 0.3 * k, 0.25, -0.3);
          tower(f, 0.85, b[2], b[3], '#9cb6c4');
          if (k % 2) bake.part(boxG(T, 0.55, 0.3, 0.55), '#d8dcdc', f, 0, b[2], 0);
        });

        // fix r4 detail: the distant skyline and the north-shore blocks come back as STILL, pale background buildings
        // behind the three landmarks: lower than MBS, inside the footprint, sunk with the curve so only their upper
        // floors show; the distance fade softens them further. Nothing here moves.
        (lo ? [[-3.0, -7.7, 5.0, 0.9, '#dfe9ee'], [1.6, -7.7, 4.6, 0.8, '#e8eff2'], [3.0, -7.2, 5.4, 0.9, '#d6e2e8']]
            : [[-3.0, -7.7, 5.2, 0.9, '#dfe9ee'], [-2.1, -7.9, 4.1, 0.75, '#edf1f2'], [-1.0, -8.1, 4.8, 0.8, '#d9e4ea'],
               [1.4, -7.9, 4.6, 0.8, '#e8eff2'], [2.6, -7.5, 5.4, 0.9, '#d6e2e8'], [3.9, -7.0, 4.3, 0.75, '#edf1f2'],
               [-7.0, -4.0, 2.4, 0.7, '#dfe9ee']]).forEach(function (b, k) {
          tower(frameUp(b[0], b[1], 0.35 * k, 0.25, -0.3), b[3], b[2], b[4], '#c4d5dd');
        });

        // ---------- the bridge (cars cross it) ----------
        var brF = frameAt(5.0, -0.6, 0, 0);
        bake.part(boxG(T, 1.0, 0.16, 6.8), '#d8d4ca', brF, 0, 0.42, 0);
        [-2.4, -0.8, 0.8, 2.4].forEach(function (z) { bake.part(boxG(T, 0.22, 0.5, 0.22), '#bcb6aa', brF, 0, -0.1, z); });
        [-1, 1].forEach(function (s) {
          bake.part(boxG(T, 0.05, 0.05, 6.8), '#9aa3a8', brF, s * 0.48, 0.74, 0);
          for (var bp = 0; bp < (lo ? 4 : 17); bp++) bake.part(boxG(T, 0.035, 0.16, 0.035), '#9aa3a8', brF, s * 0.48, 0.58, -3.3 + bp * 6.6 / (lo ? 3 : 16));
        });
        var cb = new Baker(T, X);
        cb.part(boxG(T, 0.34, 0.14, 0.66), '#ffffff', null, 0, 0.04, 0);
        cb.part(boxG(T, 0.28, 0.12, 0.36), '#ffffff', null, 0, 0.18, -0.02);
        cb.part(boxG(T, 0.29, 0.07, 0.37), '#26343e', null, 0, 0.2, -0.02);
        [-1, 1].forEach(function (s) {
          [-1, 1].forEach(function (u) { cb.part(cylG(T, 0.06, 0.06, 0.05, 8), '#1c1c1c', null, s * 0.15, 0.06, u * 0.2, 0, 0, Math.PI / 2); });
          cb.part(boxG(T, 0.07, 0.04, 0.02), '#fff7d6', null, s * 0.11, 0.1, 0.33);
        });
        var NC = lo ? 3 : 6;
        var cars = ctx.instanced(cb.geo(), vcol, NC);
        var carCols = [P.orange, P.sea, P.white, P.red, '#9aa1a8', '#2f3b5c'];
        for (var ci = 0; ci < NC; ci++) cars.setColorAt(ci, new T.Color(carCols[ci % carCols.length]));
        cars.castShadow = true;
        var carHolder = new T.Group(); carHolder.matrixAutoUpdate = false; carHolder.matrix.copy(brF);
        carHolder.add(cars); root.add(carHolder);
        S.cars = { mesh: cars, n: NC };

        // ---------- the promenade: sea-wall railing, paving bands, kerb, lamp posts, an ice-cream cart, a cafe ----------
        var ep = TMP.ep;
        function along(aFrom, aTo, d, step, fn) {
          // walk the edge curve from aFrom to aTo (radians) at distance d, calling fn(x, z, tx, tz) every `step` units
          var a = aFrom, prevX = null, prevZ = null, acc = step;
          for (var k = 0; k < 4000 && a <= aTo; k++) {
            edge(a, d, ep);
            if (prevX !== null) acc += Math.hypot(ep[0] - prevX, ep[1] - prevZ);
            prevX = ep[0]; prevZ = ep[1];
            if (acc >= step) { acc = 0; if (ep[0] * ep[0] + ep[1] * ep[1] < 9.4 * 9.4) fn(ep[0], ep[1], ep[2], ep[3]); }
            a += 0.004;
          }
        }
        var aMer = 2.24;   // where the Merlion stands on the wall
        // the railing: posts and two rails, gap for the Merlion
        var RSTEP = lo ? 1.2 : 0.45, rPrev = null;
        function railRun(aFrom, aTo) {
          rPrev = null;
          along(aFrom, aTo, 0.07, RSTEP, function (x, z) {
            var f = frameAt(x, z, 0, 0);
            bake.part(boxG(T, 0.045, 0.98, 0.045), '#8f989e', f, 0, 0, 0);
            if (rPrev) {
              var dx = x - rPrev[0], dz = z - rPrev[1], L = Math.hypot(dx, dz), mx = (x + rPrev[0]) / 2, mz = (z + rPrev[1]) / 2;
              var fm = frameAt(mx, mz, Math.atan2(dx, dz), 0);
              bake.part(boxG(T, 0.05, 0.05, L + 0.02), '#b7bec3', fm, 0, 0.96, 0);
              if (!lo) bake.part(boxG(T, 0.025, 0.025, L), '#8f989e', fm, 0, 0.55, 0);
            }
            rPrev = [x, z];
          });
        }
        railRun(0.62, aMer - 0.16); railRun(aMer + 0.2, 2.95);
        // paving bands and a kerb where the promenade meets the grass
        [[0.45, '#cdbfa5', 0.14], [1.15, '#cdbfa5', 0.1], [2.0, '#cdbfa5', 0.14], [3.05, '#bdb3a2', 0.2]].forEach(function (b, bi) {
          if (lo && bi !== 3) return;
          var prev = null;
          along(0.5, 2.98, b[0], lo ? 0.9 : 0.5, function (x, z) {
            if (prev) {
              var dx = x - prev[0], dz = z - prev[1], L = Math.hypot(dx, dz);
              bake.part(boxG(T, b[2], bi === 3 ? 0.06 : 0.018, L + 0.03), b[1], frameAt((x + prev[0]) / 2, (z + prev[1]) / 2, Math.atan2(dx, dz), 0.035), 0, 0, 0);
            }
            prev = [x, z];
          });
        });
        if (!lo) along(0.55, 2.95, 1.55, 1.1, function (x, z, tx, tz) {   // cross joints between the bands
          bake.part(boxG(T, 0.75, 0.018, 0.08), '#d4c7ae', frameAt(x, z, Math.atan2(tx, tz), 0.035), 0, 0, 0);
        });

        // loose things: lamp heads, benches, bins, umbrellas, hats. Each is one instance that the what-ifs can move.
        S.loose = [];
        function lamp(x0) {
          var a = aAtX(x0); edge(a, 2.2, ep);
          var x = ep[0], z = ep[1], ry = Math.atan2(ep[2], ep[3]) - Math.PI / 2;   // local +z toward the bay
          var f = frameAt(x, z, ry, 0);
          bake.part(cylG(T, 0.035, 0.055, 2.05, 6), '#4a5560', f, 0, 0, 0);
          bake.part(cylG(T, 0.09, 0.1, 0.12, 6), '#4a5560', f, 0, 0, 0);
          bake.part(boxG(T, 0.035, 0.035, 0.32), '#4a5560', f, 0, 2.0, 0.14);
          S.loose.push({ kind: 'lamp', x: x, z: z, ry: ry, dy: 1.98, dz: 0.3, i: 0 });
        }
        [-6.4, 2.2, 5.8].forEach(lamp);
        function onEdge(x0, d, faceBay) {
          var a = aAtX(x0); edge(a, d, ep);
          // facing the bay: turn so local +z points back at the water
          var ry = Math.atan2(ep[2], ep[3]) + (faceBay ? -Math.PI / 2 : 0);
          return [ep[0], ep[1], ry];
        }
        [[-6.6, 2.75], [2.0, 2.75], [2.9, 2.75], [-0.45, 2.8]].forEach(function (b) {
          var e = onEdge(b[0], b[1], true); S.loose.push({ kind: 'bench', x: e[0], z: e[1], ry: e[2], i: 0 });
        });
        [[-6.0, 2.85], [2.45, 2.9], [4.4, 2.85], [0.1, 2.95]].forEach(function (b) {
          var e = onEdge(b[0], b[1], true); S.loose.push({ kind: 'bin', x: e[0], z: e[1], ry: e[2], i: 0 });
        });
        // the cafe: two tables under red umbrellas
        [[3.6, 3.0], [4.3, 3.4]].forEach(function (b) {
          var e = onEdge(b[0], b[1], true), f = frameAt(e[0], e[1], e[2], 0);
          bake.part(cylG(T, 0.24, 0.24, 0.04, 10), '#f4f2ec', f, 0, 0.7, 0);
          bake.part(cylG(T, 0.03, 0.06, 0.7, 6), '#4a5560', f, 0, 0, 0);
          [-1, 1].forEach(function (s) { bake.part(boxG(T, 0.22, 0.42, 0.22), '#3d444a', f, s * 0.42, 0, 0); });
          S.loose.push({ kind: 'umb', x: e[0], z: e[1], ry: e[2], i: 0, col: '#E8412B' });
        });
        // the ice-cream cart (the uncle with the rainbow umbrella)
        var icE = onEdge(1.0, 2.45, true), icF = frameAt(icE[0], icE[1], icE[2] + Math.PI / 2, 0);
        bake.part(boxG(T, 0.82, 0.5, 0.44), '#f4f1ea', icF, 0, 0.2, 0);
        bake.part(boxG(T, 0.84, 0.18, 0.46), '#5fb8e0', icF, 0, 0.32, 0);
        bake.part(boxG(T, 0.86, 0.04, 0.48), '#e2ddd2', icF, 0, 0.7, 0);
        [-1, 1].forEach(function (s) { bake.part(cylG(T, 0.13, 0.13, 0.05, 10), '#222222', icF, s * 0.27, 0.13, 0.24, Math.PI / 2, 0, 0); });
        bake.part(cylG(T, 0.13, 0.13, 0.05, 10), '#222222', icF, 0.0, 0.13, -0.27, Math.PI / 2, 0, 0);
        S.loose.push({ kind: 'umb', x: icE[0], z: icE[1], ry: icE[2], i: 0, col: '#FF8A5B', dx: 0.0 });
        // fix r4 detail: still promenade dressing: two more lamp posts, planters, blank signs, two moored boats
        [4.2].forEach(function (x0) {
          var a = aAtX(x0); edge(a, 2.2, ep);
          var f = frameAt(ep[0], ep[1], Math.atan2(ep[2], ep[3]) - Math.PI / 2, 0);
          bake.part(cylG(T, 0.035, 0.055, 2.05, 6), '#4a5560', f, 0, 0, 0);
          bake.part(cylG(T, 0.09, 0.1, 0.12, 6), '#4a5560', f, 0, 0, 0);
          bake.part(boxG(T, 0.035, 0.035, 0.32), '#4a5560', f, 0, 2.0, 0.14);
          bake.part(cylG(T, 0.13, 0.08, 0.13, 8), '#4a5560', f, 0, 1.79, 0.3);
          bake.part(cylG(T, 0.07, 0.07, 0.05, 8), '#fff4c9', f, 0, 1.75, 0.3);
        });
        (lo ? [-4.8, 0.2] : [-4.8, -3.6, -1.6, 0.2, 3.1]).forEach(function (x0) {
          var e = onEdge(x0, 3.45, true), f = frameAt(e[0], e[1], e[2], 0);
          bake.part(boxG(T, 0.62, 0.34, 0.62), '#cfc5b1', f, 0, 0, 0);
          bake.part(boxG(T, 0.66, 0.05, 0.66), '#bdb3a2', f, 0, 0.34, 0);
          bake.part(new T.IcosahedronGeometry(0.3, 0), x0 > 0 ? '#3f8f45' : '#4f9a45', f, 0, 0.55, 0, 0, x0, 0, 1, 0.75, 1);
        });
        [[-5.2, 3.3], [4.9, 3.1]].forEach(function (sg) {   // signs: a plain coloured board on a post, no words
          var e = onEdge(sg[0], sg[1], true), f = frameAt(e[0], e[1], e[2], 0);
          bake.part(boxG(T, 0.06, 1.3, 0.06), '#4a5560', f, 0, 0, 0);
          bake.part(boxG(T, 0.7, 0.46, 0.05), '#2f3b5c', f, 0, 1.15, 0.04);
          bake.part(boxG(T, 0.56, 0.08, 0.02), '#e9e4da', f, 0, 1.42, 0.07);
          bake.part(boxG(T, 0.4, 0.06, 0.02), '#9cb6c4', f, -0.08, 1.27, 0.07);
        });
        if (!lo) [[-3.8, -0.55], [3.4, -0.5]].forEach(function (mb) {   // moored boats by the wall (still)
          var a = aAtX(mb[0]); edge(a, mb[1], ep);
          var ry = Math.atan2(ep[2], ep[3]), f = frameAt(ep[0], ep[1], ry, -0.27);
          bake.part(boxG(T, 0.5, 0.22, 1.25), '#f4f1ea', f, 0, 0, 0);
          bake.part(boxG(T, 0.52, 0.06, 1.27), '#2f3b5c', f, 0, 0.16, 0);
          bake.part(boxG(T, 0.36, 0.2, 0.42), '#d8453a', f, 0, 0.22, 0.1);
          bake.part(cylG(T, 0.02, 0.02, 0.35, 5), '#8f989e', f, 0.32, 0.0, -0.2);   // its mooring post on the wall side
        });

        // ---------- shapes for the loose things ----------
        var lb = new Baker(T, X);
        lb.part(cylG(T, 0.13, 0.08, 0.13, 8), '#4a5560', null, 0, -0.1, 0);
        lb.part(cylG(T, 0.07, 0.07, 0.05, 8), '#fff4c9', null, 0, -0.14, 0);
        var lampHead = ctx.instanced(lb.geo(), vcol, 3);
        var bb = new Baker(T, X);
        bb.part(boxG(T, 0.95, 0.05, 0.34), '#a8754a', null, 0, 0.42, 0.02);
        bb.part(boxG(T, 0.95, 0.06, 0.04), '#a8754a', null, 0, 0.53, -0.16, 0.12);
        bb.part(boxG(T, 0.95, 0.06, 0.04), '#a8754a', null, 0, 0.66, -0.17, 0.12);
        [-0.4, 0.4].forEach(function (s) { bb.part(boxG(T, 0.05, 0.42, 0.32), '#3d444a', null, s, 0, 0); bb.part(boxG(T, 0.05, 0.3, 0.04), '#3d444a', null, s, 0.42, -0.16); });
        var benches = ctx.instanced(bb.geo(), vcol, 4);
        var nb = new Baker(T, X);
        nb.part(cylG(T, 0.17, 0.15, 0.58, 10), '#2f7a57', null, 0, 0, 0);
        nb.part(cylG(T, 0.19, 0.19, 0.06, 10), '#3d444a', null, 0, 0.58, 0);
        nb.part(boxG(T, 0.12, 0.08, 0.04), '#1c1c1c', null, 0, 0.42, 0.17);
        var bins = ctx.instanced(nb.geo(), vcol, 4);
        var ub = new Baker(T, X);
        ub.part(cylG(T, 0.022, 0.022, 1.95, 5), '#e6e6e6', null, 0, 0, 0);
        var canopy = new T.ConeGeometry(0.78, 0.34, 8, 1, true); canopy.translate(0, 1.92, 0);
        ub.add(canopy, function (k) { return k % 2 ? '#ffffff' : '#bdbdbd'; });
        var umbs = ctx.instanced(ub.geo(), vcol, 3);
        [lampHead, benches, bins, umbs].forEach(function (m) { m.castShadow = true; root.add(m); });
        var counts = { lamp: 0, bench: 0, bin: 0, umb: 0 };
        S.loose.forEach(function (o, k) {
          o.mesh = { lamp: lampHead, bench: benches, bin: bins, umb: umbs }[o.kind];
          o.i = counts[o.kind]++;
          o.ph = k * 1.37; o.lim = 7.2 - (k % 4) * 0.45; o.r = rnd(); o.q = new T.Quaternion(); o.wx = o.x; o.wy = 0; o.wz = o.z;
          if (o.col) o.mesh.setColorAt(o.i, new T.Color(o.col));
        });

        // ---------- trees: promenade rain trees (they lean in a typhoon), Supertrees ----------
        var treeSpots = [[-4.4, 5.6], [4.6, 5.3], [-5.6, 4.4]];
        var NT = lo ? 2 : treeSpots.length;
        var trunk = ctx.instanced(cylG(T, 0.07, 0.11, 1.1, 6), ctx.mat(P.trunk), NT);
        var cbk = new Baker(T, X);
        cbk.part(new T.IcosahedronGeometry(0.55, 0), '#ffffff', null, 0, 1.25, 0, 0, 0, 0, 1.25, 0.7, 1.25);
        cbk.part(new T.IcosahedronGeometry(0.42, 0), '#e2e2e2', null, 0.3, 1.5, 0.1, 0, 0.6, 0, 1.1, 0.75, 1.1);
        cbk.part(new T.IcosahedronGeometry(0.38, 0), '#d6d6d6', null, -0.28, 1.45, -0.12, 0, 1.2, 0, 1.1, 0.7, 1.1);
        var crown = ctx.instanced(cbk.geo(), vcol, NT);
        S.trees = [];
        for (var ti = 0; ti < NT; ti++) {
          var tsp = treeSpots[ti];
          crown.setColorAt(ti, new T.Color(ti % 2 ? P.tree : '#4f9a45'));
          S.trees.push({ x: tsp[0], z: tsp[1], ry: ti * 1.3, ph: ti * 0.9, s: 0.9 + (ti % 3) * 0.12 });
        }
        trunk.castShadow = crown.castShadow = true;
        root.add(trunk); root.add(crown);
        S.treeM = { trunk: trunk, crown: crown };
        var crownCols = ['#d0577f', '#e0703a', '#c94f6e', '#d0577f', '#e0703a'];
        S.supers = [];
        // W4: moved out from behind the big reel screen to the east bank beside it
        [[6.7, -2.4, 2.9], [7.3, -3.4, 2.4], [6.4, -1.3, 2.1], [7.4, -1.8, 2.6], [6.9, -4.3, 2.2]].forEach(function (t3, k) {
          var tg = new T.Group();
          plantUp(tg, t3[0], t3[1], k, 0.35, -0.05);
          root.add(tg);
          var bend = new T.Group(); tg.add(bend);
          ctx.cyl(bend, 0.1, 0.22, t3[2], 7, '#7a6a62', 0, 0, 0);
          var crn = new T.Mesh(new T.CylinderGeometry(t3[2] * 0.3, 0.12, t3[2] * 0.2, 9, 1, true), ctx.mat(crownCols[k], { side: T.DoubleSide }));
          crn.position.y = t3[2] * 1.06;
          bend.add(crn);
          S.supers.push({ g: bend, ph: k * 1.3, h: t3[2] });
        });

        // ---------- the Merlion, with its jet into the bay: lion head (mane, eyes, open mouth), scaled fish body ----------
        var merl = new T.Group();
        edge(aMer, 0.12, ep);
        plantUp(merl, ep[0], ep[1], 0.12, 0.4, -0.04);
        root.add(merl);
        var stone = ctx.mat('#9a948a');
        ctx.cyl(merl, 0.92, 0.98, 0.14, 12, ctx.mat('#cfc5b1'), 0, 0, 0);
        ctx.cyl(merl, 0.6, 0.7, 0.5, 10, stone, 0, 0.14, 0);
        ctx.cyl(merl, 0.36, 0.5, 0.4, 8, stone, -0.3, 0.6, 0);
        var K = 0.36, mb = new Baker(T, X), WH = '#ece8de', WH2 = '#dcd6c8', Y0 = -0.35;
        var curve = new T.CatmullRomCurve3([[-2.6, 4.8, 0], [-3.0, 3.3, 0], [-2.2, 2.7, 0], [-0.9, 2.6, 0], [0, 3.2, 0], [0.3, 4.6, 0], [0.25, 5.8, 0]].map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
        var NB = lo ? 9 : 16;
        for (var bi2 = 0; bi2 <= NB; bi2++) {
          var u = bi2 / NB, cp = curve.getPoint(u), br = (0.35 + 1.15 * Math.pow(u, 1.2)) * K;
          mb.part(new T.IcosahedronGeometry(br, lo ? 0 : 1), WH, null, cp.x * K, cp.y * K + Y0, 0, 0, 0, 0, 1, 1, 0.9);
          // rows of scales down both flanks
          if (!lo && u > 0.08 && u < 0.92) [-1, 1].forEach(function (s) {
            [-0.45, 0.1].forEach(function (h) {
              mb.part(new T.OctahedronGeometry(0.13 * K, 0), WH2, null, cp.x * K, cp.y * K + Y0 + h * br, s * br * 0.86, 0, 0, 0, 1.5, 0.9, 0.45);
            });
          });
        }
        [-1, 1].forEach(function (s) {
          // the tail fins (a fan of three) and the side fins
          [-0.35, 0, 0.35].forEach(function (f) {
            mb.part(new T.ConeGeometry(0.45 * K, 2.3 * K, 5), WH, null, -2.75 * K, 5.3 * K + Y0, s * 0.3 * K, s * 0.5, f, 0.9 + f * 0.4);
          });
          mb.part(new T.ConeGeometry(0.35 * K, 1.6 * K, 5), WH, null, 0.5 * K, 3.9 * K + Y0, s * 1.25 * K, s * 1.2, 0, -0.6);
          mb.part(new T.ConeGeometry(0.28 * K, 1.2 * K, 4), WH2, null, -0.6 * K, 2.9 * K + Y0, s * 1.05 * K, s * 1.3, 0, 0.4);
        });
        var hx = 0.5 * K, hy = 7.1 * K + Y0;
        mb.part(new T.IcosahedronGeometry(1.2 * K, 1), WH, null, hx, hy, 0, 0, 0, 0, 1.08, 1, 1);
        // the mane: a ring of points round the face
        var NM = lo ? 10 : 18;
        for (var mi = 0; mi < NM; mi++) {
          var ma = mi / NM * Math.PI * 2;
          mb.part(new T.ConeGeometry(0.38 * K, 1.0 * K, 4), mi % 2 ? WH : WH2, null, hx - 0.3 * K, hy + Math.cos(ma) * 1.3 * K, Math.sin(ma) * 1.3 * K, ma, 0, 0.4, 1, 1, 1);
        }
        // the face: muzzle, open mouth, jaw, nose, eyes with pupils, brows
        mb.part(new T.IcosahedronGeometry(0.6 * K, 1), WH, null, hx + 0.85 * K, hy - 0.4 * K, 0, 0, 0, 0, 1.15, 0.8, 1.05);
        mb.part(boxG(T, 0.55 * K, 0.34 * K, 0.78 * K), '#3a2f2a', null, hx + 1.2 * K, hy - 0.95 * K, 0);
        mb.part(boxG(T, 0.95 * K, 0.22 * K, 0.95 * K), WH, null, hx + 0.85 * K, hy - 1.2 * K, 0);
        mb.part(boxG(T, 0.12 * K, 0.1 * K, 0.6 * K), '#f8f6f0', null, hx + 1.45 * K, hy - 0.72 * K, 0);
        mb.part(new T.IcosahedronGeometry(0.16 * K, 0), '#5a524a', null, hx + 1.55 * K, hy - 0.2 * K, 0);
        [-1, 1].forEach(function (s) {
          mb.part(new T.IcosahedronGeometry(0.24 * K, 1), '#ffffff', null, hx + 1.17 * K, hy + 0.22 * K, s * 0.46 * K, 0, 0, 0, 0.55, 1, 1);
          mb.part(new T.IcosahedronGeometry(0.12 * K, 0), '#1e1a18', null, hx + 1.3 * K, hy + 0.2 * K, s * 0.47 * K);
          mb.part(boxG(T, 0.32 * K, 0.13 * K, 0.46 * K), WH2, null, hx + 1.12 * K, hy + 0.44 * K, s * 0.46 * K, 0, 0, -0.25);
        });
        var merlBody = mb.mesh(vcol);
        merlBody.position.y = 0.64;
        merl.add(merlBody);
        var NJ = lo ? 14 : 28;
        var jet = ctx.instanced(new T.IcosahedronGeometry(0.075, 0), ctx.mat('#f4fbff', { roughness: 0.2 }), NJ);
        jet.castShadow = false;
        merl.add(jet);
        S.jet = { mesh: jet, n: NJ, mx: hx + 1.45 * K, my: hy - 0.85 * K + 0.64 };

        // ---------- the Singapore Flyer, turning, with its glass capsules ----------
        var fly = new T.Group();
        plantUp(fly, -5.4, -5.4, 0.5, 0.3, -0.3);
        root.add(fly);
        var steel = ctx.mat('#e8ecef', { roughness: 0.45, metalness: 0.2 });
        var FR = 2.6, FC = FR + 0.55;
        [-1, 1].forEach(function (s) {
          var legM = ctx.box(fly, 0.14, FC + 0.1, 0.14, steel, s * 0.62, 0, 0.16);
          legM.rotation.z = s * 0.2;
          var legB = ctx.box(fly, 0.14, FC + 0.1, 0.14, steel, s * 0.62, 0, -0.16);
          legB.rotation.z = s * 0.2;
        });
        ctx.box(fly, 3.2, 0.42, 1.0, '#dcdad3', 0, 0, 0);
        ctx.box(fly, 3.0, 0.18, 1.02, '#9cc3d6', 0, 0.12, 0);
        var wheel = new T.Group(); wheel.position.y = FC; fly.add(wheel);
        var ring = new T.Mesh(new T.TorusGeometry(FR, 0.055, lo ? 4 : 5, lo ? 28 : 72), steel); wheel.add(ring);
        var ring2 = new T.Mesh(new T.TorusGeometry(FR - 0.18, 0.03, lo ? 3 : 4, lo ? 28 : 72), steel); wheel.add(ring2);
        var hub = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.42, 10), steel); hub.rotation.x = Math.PI / 2; wheel.add(hub);
        var NS = lo ? 10 : 14;
        for (var sp = 0; sp < NS; sp++) {
          var sa = sp / NS * Math.PI;
          var spoke = new T.Mesh(new T.BoxGeometry(0.025, FR * 2, 0.025), steel);
          spoke.rotation.z = sa;
          wheel.add(spoke);
        }
        var cab = new Baker(T, X);
        var cylA = new T.CylinderGeometry(0.115, 0.115, 0.34, lo ? 6 : 10); cylA.rotateX(Math.PI / 2);
        cab.add(cylA, '#cfe6f3');
        if (!lo) [-0.16, 0.16].forEach(function (z) { var rg = new T.CylinderGeometry(0.125, 0.125, 0.035, 10); rg.rotateX(Math.PI / 2); rg.translate(0, 0, z); cab.add(rg, '#f6f6f6'); });
        cab.part(boxG(T, 0.05, 0.08, 0.05), '#f6f6f6', null, 0, 0.1, 0);
        var NCap = lo ? 14 : 28;
        var caps = ctx.instanced(cab.geo(), vcol, NCap);
        caps.castShadow = true;
        wheel.add(caps);
        S.flyer = { wheel: wheel, caps: caps, n: NCap, r: FR + 0.2, ang: 0, spin: 0.12, FC: FC };

        // ---------- bumboats on the bay: hull with painted eyes, canopy, rails, benches, a driver ----------
        function hullS(sc) {
          var sh = new T.Shape(), pts = [[-0.21, 0.55], [0.21, 0.55], [0.235, 0.0], [0.2, -0.35], [0, -0.7], [-0.2, -0.35], [-0.235, 0.0]];
          sh.moveTo(pts[0][0] * sc, pts[0][1] * sc);
          for (var k = 1; k < pts.length; k++) sh.lineTo(pts[k][0] * sc, pts[k][1] * sc);
          return sh;
        }
        function boatGeo(col, roof) {
          var b = new Baker(T, X), h;
          h = new T.ExtrudeGeometry(hullS(1), { depth: 0.2, bevelEnabled: false }); h.rotateX(-Math.PI / 2); b.add(h, col);
          h = new T.ExtrudeGeometry(hullS(1.04), { depth: 0.04, bevelEnabled: false }); h.rotateX(-Math.PI / 2); h.translate(0, 0.19, 0); b.add(h, '#f2ebdd');
          h = new T.ExtrudeGeometry(hullS(0.86), { depth: 0.02, bevelEnabled: false }); h.rotateX(-Math.PI / 2); h.translate(0, 0.215, 0); b.add(h, '#b98a5e');
          [-1, 1].forEach(function (s) {
            b.part(new T.IcosahedronGeometry(0.05, lo ? 0 : 1), '#ffffff', null, s * 0.2, 0.11, 0.33, 0, 0, 0, 0.35, 0.8, 1.3);
            b.part(new T.IcosahedronGeometry(0.025, 0), '#141414', null, s * 0.215, 0.11, 0.35);
            b.part(boxG(T, 0.02, 0.02, 0.62), '#3a3a3a', null, s * 0.19, 0.36, -0.02);
            b.part(boxG(T, 0.035, 0.07, 0.07), '#1c1c1c', null, s * 0.24, 0.07, -0.12);
            [-0.28, 0.28].forEach(function (z) { b.part(boxG(T, 0.025, 0.34, 0.025), '#3a3a3a', null, s * 0.17, 0.22, z); });
          });
          b.part(boxG(T, 0.5, 0.04, 0.8), roof, null, 0, 0.56, 0);
          b.part(boxG(T, 0.52, 0.02, 0.82), '#f2ebdd', null, 0, 0.55, 0);
          [-0.12, 0.14].forEach(function (z) { b.part(boxG(T, 0.34, 0.04, 0.08), '#8a5a3b', null, 0, 0.3, z); });
          // (calm pass: no block-person driver; the outboard box stays)
          b.part(boxG(T, 0.1, 0.12, 0.12), '#2b2b2b', null, 0, 0.22, -0.5);
          return b.geo();
        }
        S.boats = [];
        [[-1.5, -0.7, 3.8, 1.2, 0.22, P.red, '#c0392b'], [1.6, -1.2, 2.4, 0.85, -0.3, '#2f3b5c', '#3d4f73'], [-3.6, 0.0, 1.5, 0.65, 0.34, P.orange, '#e0703a']].forEach(function (b, k) {
          if (lo && k === 2) return;
          var bg = new T.Group(); root.add(bg);
          var inner = new T.Group(); bg.add(inner);
          var bm = new T.Mesh(boatGeo(b[5], b[6]), vcol); bm.castShadow = true;
          bm.scale.setScalar(1.15);
          inner.add(bm);
          S.boats.push({ g: bg, inner: inner, cx: b[0], cz: b[1], a: b[2], b: b[3], w: b[4], ph: k * 2.1 });
        });

        // ---------- people (calm pass): a few, made from YOU's own model (ctx.person), held in still poses ----------
        // two at the railing looking at the bay, one on a bench, two chatting on the promenade. Never a yellow shirt.
        var PEOPLE = [
          { kind: 'rail', x0: -3.2, d: 0.42, shirt: '#ffffff', pants: '#2f3b5c', skin: '#c68a62', hair: '#141414', pose: 'idle' },
          { kind: 'rail', x0: 2.7, d: 0.42, shirt: '#E8412B', pants: '#55595f', skin: '#f1c7a3', hair: '#5a3a22', pose: 'idle' },
          { kind: 'sit', bench: 1, shirt: '#8fd3f4', pants: '#2b2b2b', skin: '#8d5a3b', hair: '#141414', pose: 'sit' },
          { kind: 'stand', x0: -2.6, d: 1.7, face: -0.9, shirt: '#2f7a57', pants: '#c9b99a', skin: '#e0ac85', hair: '#2b2018', pose: 'idle' },
          { kind: 'stand', x0: -1.85, d: 1.75, face: 2.4, shirt: '#9aa1a8', pants: '#2f3b5c', skin: '#d79c74', hair: '#8a6a4a', pose: 'idle' }
        ];
        var plist = [];
        PEOPLE.forEach(function (pd, k) {
          if (lo && k > 2) return;
          var g = ctx.person ? ctx.person(pd) : null;
          if (!g) return;
          var p = { kind: pd.kind, g: g, r: rnd(), ph: k * 1.7 };
          if (pd.kind === 'sit') {
            var bn = S.loose.filter(function (o) { return o.kind === 'bench'; })[pd.bench];
            p.benchO = bn;
          } else {
            var e = onEdge(pd.x0, pd.d, true);
            p.x = e[0]; p.z = e[1];
            // W4: everyone on the promenade watches the reel screen (the two chatting turn half toward each other)
            p.yaw = faceScreen(p.x, p.z) + (pd.kind === 'stand' ? (pd.face > 0 ? 0.35 : -0.35) : 0);
          }
          root.add(g);
          plist.push(p);
        });
        S.people = { list: plist, n: plist.length };

        // ---------- the pool's water as wobbling blobs (gravity), droplets off the bay ----------
        var balls = ctx.instanced(new T.IcosahedronGeometry(0.16, lo ? 0 : 1), ctx.mat('#4fd0ee', { roughness: 0.2 }), 9);
        mbsG.add(balls);
        balls.visible = false;
        S.balls = { mesh: balls, n: 9 };
        var ND = lo ? 16 : 36;
        var drops = ctx.instanced(new T.IcosahedronGeometry(0.07, 0), ctx.mat('#7fd6ec', { roughness: 0.2 }), ND);
        drops.visible = false; root.add(drops);
        S.drops = { mesh: drops, n: ND, d: [] };
        for (var di = 0; di < ND; di++) {
          var dr = Math.sqrt(rnd()) * 0.9, da = rnd() * Math.PI * 2;
          S.drops.d.push([BAY.cx + BAY.rx * dr * Math.cos(da), BAY.cz + BAY.rz * dr * Math.sin(da), rnd()]);
        }

        // ---------- rain and wind streaks for the typhoon: they live in a box in front of the camera ----------
        var NR = lo ? 60 : 260;
        var rain = ctx.instanced(new T.BoxGeometry(0.022, 0.75, 0.022), new T.MeshBasicMaterial({ color: '#5c7f99', transparent: true, opacity: 0.8 }), NR);
        rain.castShadow = false; rain.visible = false;
        root.add(rain);
        var NWs = lo ? 14 : 36;
        var streaks = ctx.instanced(new T.BoxGeometry(1.6, 0.018, 0.018), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }), NWs);
        streaks.castShadow = false; streaks.visible = false;
        root.add(streaks);
        S.rain = { mesh: rain, n: NR, d: [], st: streaks, ns: NWs, sd: [] };
        for (var rI = 0; rI < NR; rI++) S.rain.d.push([rnd() * 12, rnd() * 10, rnd() * 12]);
        for (var sI = 0; sI < NWs; sI++) S.rain.sd.push([rnd() * 14, rnd() * 6, rnd() * 12, 0.6 + rnd() * 0.8]);

        // ---------- the silverback: a rig of groups (original low-poly, plain zoo-style silverback) ----------
        var fur = ctx.mat('#26262b'), fur2 = ctx.mat('#1d1d21'), silver = ctx.mat('#6e7076'), skin = ctx.mat('#3b3330'), skinD = ctx.mat('#2a2420');
        function blob(parent, r, sx, sy, sz, m, x, y, z) {
          var me = new T.Mesh(new T.IcosahedronGeometry(r, lo ? 0 : 1), m);
          me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.castShadow = true;
          parent.add(me); return me;
        }
        var gor = new T.Group(); root.add(gor);
        gor.userData.clickable = 'gorilla';
        var hips = new T.Group(); hips.position.y = 0.78; gor.add(hips);
        blob(hips, 0.3, 1.1, 0.8, 0.95, fur, 0, 0, -0.02);
        var torso = new T.Group(); hips.add(torso);
        blob(torso, 0.34, 1.0, 0.9, 0.9, fur, 0, 0.28, 0.02);
        blob(torso, 0.42, 1.25, 0.85, 0.95, fur, 0, 0.7, 0);
        blob(torso, 0.3, 0.85, 0.5, 0.35, skin, 0, 0.7, 0.3);
        blob(torso, 0.32, 0.9, 0.75, 0.5, silver, 0, 0.42, -0.2);
        var head = new T.Group(); head.position.set(0, 1.02, 0.16); torso.add(head);
        blob(head, 0.24, 1, 1, 1, fur, 0, 0.06, -0.02);
        blob(head, 0.12, 0.6, 1.1, 1.2, fur2, 0, 0.24, -0.08);
        blob(head, 0.17, 1.05, 0.85, 0.5, skin, 0, 0.04, 0.17);
        blob(head, 0.15, 1.1, 0.35, 0.5, skinD, 0, 0.13, 0.19);
        blob(head, 0.11, 1.1, 0.75, 0.75, skin, 0, -0.05, 0.22);
        [-1, 1].forEach(function (s) { blob(head, 0.025, 1, 1, 1, ctx.mat('#e9e2d4'), s * 0.07, 0.08, 0.27); });
        function limb(parent, x, y, z, l1, l2, r1, r2, hand) {
          var sh = new T.Group(); sh.position.set(x, y, z); parent.add(sh);
          blob(sh, r1, 1, l1 / r1 / 2, 1, fur, 0, -l1 / 2, 0);
          var el = new T.Group(); el.position.y = -l1; sh.add(el);
          blob(el, r2, 1, l2 / r2 / 2, 1, fur, 0, -l2 / 2, 0);
          if (hand) blob(el, r2 * 1.1, 1, 0.8, 1.1, skinD, 0, -l2, 0.02);
          return { sh: sh, el: el };
        }
        var armL = limb(torso, -0.55, 0.86, 0.06, 0.6, 0.58, 0.17, 0.15, true);
        var armR = limb(torso, 0.55, 0.86, 0.06, 0.6, 0.58, 0.17, 0.15, true);
        var legL = limb(hips, -0.25, -0.02, 0, 0.42, 0.36, 0.17, 0.14, true);
        var legR = limb(hips, 0.25, -0.02, 0, 0.42, 0.36, 0.17, 0.14, true);
        var hit = new T.Mesh(new T.BoxGeometry(1.7, 2.1, 1.9), new T.MeshBasicMaterial({ visible: false }));
        hit.position.y = 1.0; hit.userData.noBounds = true;
        gor.add(hit);
        S.gor = { g: gor, hips: hips, torso: torso, head: head, armL: armL, armR: armR, legL: legL, legR: legR, x: -5.3, dir: 1, ry: Math.PI / 2, gait: 0 };

        var staticMesh = bake.mesh(vcol);
        root.add(staticMesh);

        ctx.you.place(YX, YZ, YRY);
        // W4: no default HUD reading from the scene any more (the page leaves that readout empty); fight readings stay
        S.ctx = ctx;
        // W4: the page's reel tiles pick the reel on the big screen (media events do not bubble: listen in capture)
        document.addEventListener('play', onReelPlay, true);
        // the reel a tile is already playing, if any (the scene is built a section early)
        [].some.call(document.querySelectorAll('.clip--reel video, .reels video'), function (v) {
          if (v.paused) return false;
          var i = reelIndex(v.getAttribute('src') || v.currentSrc);
          if (i >= 0) S.ri = i;
          return i >= 0;
        });
        setQ(ctx.quality);
        reelPoster(S.ri, function () {});   // fetch the cover now, so nothing loads mid-dive
        return root;
      },

      update: function (t, dt, ctx) {
        if (!S) return;
        var still = ctx.reduced;
        S.ck += dt;
        var ck = S.ck;
        // calm pass: an ambient clock that only runs while a what-if or the fight is on, so the water, the bridge
        // traffic, two of the boats and the gorilla stand still while someone is reading. What moves on its own:
        // the Flyer, one boat, the Merlion's jet and YOU's idle.
        var busy = !!(S.mode || S.wm || S.fight);
        if (busy && !still) S.ak = (S.ak || 0) + dt;
        var ak = S.ak || 0;

        // ---- what-if levels: three stages from the what-if clock; an envelope puts it all back on reset
        if (S.mode) {
          S.wm = S.mode; S.env = 1;
          S.wt = ctx.whatIfT > 0 ? ctx.whatIfT : S.wt + dt;
        } else if (S.wm) {
          S.env = still ? 0 : ease(S.env, 0, dt, S.wm === 'stop' ? 0.3 : 0.2);
          if (S.env < 0.003) { S.wm = null; S.env = 0; S.wt = 0; }
        }
        var env = S.env, wm = S.wm;
        var stage = S.mode ? (still ? 3 : (ctx.whatIfStage || (S.wt < 1.8 ? 1 : S.wt < 3.6 ? 2 : 3))) : 0;
        var wt = still && S.mode ? 4.8 : S.wt;
        var l1 = smooth(0, 0.9, wt) * env, l2 = smooth(1.8, 2.6, wt) * env, l3 = smooth(3.6, 4.3, wt) * env;
        var g1 = wm === 'gravity' ? l1 : 0, g2 = wm === 'gravity' ? l2 : 0, g3 = wm === 'gravity' ? l3 : 0;
        var t1 = wm === 'typhoon' ? l1 : 0, t2 = wm === 'typhoon' ? l2 : 0, t3 = wm === 'typhoon' ? l3 : 0;
        var s1 = wm === 'stop' ? l1 : 0, s2 = wm === 'stop' ? l2 : 0, s3 = wm === 'stop' ? l3 : 0;
        var kT = Math.max(t1, t2, t3), kG = Math.max(g1, g2, g3);
        var slide = wm === 'stop' ? slideD(wt) * env : 0;
        // typhoon stage 3: things in flight, 0..1 over the stage (umbrellas already from stage 2)
        var fly3 = wm === 'typhoon' ? clamp((wt - 3.6) / 1.6, 0, 1) : 0, fly2 = wm === 'typhoon' ? clamp((wt - 2.0) / 3.0, 0, 1) : 0;
        var LK = S.k;
        LK.g1 = g1; LK.g2 = g2; LK.g3 = g3; LK.t1 = t1; LK.t2 = t2; LK.t3 = t3; LK.s1 = s1; LK.s2 = s2; LK.s3 = s3;
        LK.kT = kT; LK.kG = kG; LK.slide = slide; LK.env = env;
        var sinS = still ? 0 : 1;   // no wobble under reduced motion
        var m4 = TMP.m4, qI = TMP.q, pV = TMP.p, sV = TMP.s;

        // ---- bay water
        var w = S.water, wp = w.pos.array, wb = w.base;
        var amp = 1 + t1 * 1.6 + t2 * 2.2 + t3 * 1.4, rise = t2 * 0.16 + t3 * 0.08 + g1 * 0.05;
        var tilt = (s1 * 0.12 + s2 * 0.3 + s3 * 0.3) * (1 + 0.15 * sinS * Math.sin(ak * 2.4));
        for (var i = 0; i < wp.length; i += 3) {
          var x = wb[i], z = wb[i + 2];
          wp[i] = x; wp[i + 2] = z;
          var wy = wb[i + 1] + rise + amp * (0.08 + 0.045 * Math.sin(x * 1.3 + ak * 1.1) + 0.035 * Math.sin(z * 1.9 - ak * 1.4 + x * 0.5)) + tilt * (x - BAY.cx) / BAY.rx + g1 * 0.1 * (1 + Math.sin(x * 0.8 + ak * 0.9) * Math.sin(z + ak));
          wp[i + 1] = wy > wb[i + 1] ? wy : wb[i + 1];
        }
        w.pos.needsUpdate = true;
        S.wv.rise = rise; S.wv.amp = amp; S.wv.tilt = tilt; S.wv.ck = ak;

        // ---- the flood over the promenade
        var F = S.flood, lvl = t2 * 0.8 + t3 * 0.45 + s2 * 0.45 + s3 * 0.6;
        F.mesh.visible = lvl > 0.01;
        if (F.mesh.visible) {
          var fpa = F.pos.array, fb = F.base;
          for (var fi = 0, vi = 0; fi < fpa.length; fi += 3, vi += 4) {
            var fx = fb[vi], fz = fb[vi + 2], fd = fb[vi + 3];
            var east = (s2 + s3) * 0.3 * (fx - BAY.cx) / BAY.rx;
            var h = lvl * 0.3 - 0.07 * Math.max(0, fd) * (1.1 - Math.min(1, lvl) * 0.6) + east + amp * 0.03 * Math.sin(fx * 1.7 + ck * 2.6) * Math.sin(fz * 2.1 - ck * 1.9);
            fpa[fi] = fx; fpa[fi + 2] = fz;
            fpa[fi + 1] = fb[vi + 1] + (h > -0.02 ? h : -0.4);
          }
          F.pos.needsUpdate = true;
        }

        // ---- Merlion jet (bends in the wind, rises with no gravity)
        var J = S.jet;
        for (var j = 0; j < J.n; j++) {
          var u = (j / J.n + ck * 0.55) % 1, reach = 3.4 - kT * 0.9, wind = kT * 1.4 * u * u;
          pV.set(J.mx + reach * u, J.my - 0.4 * u - 1.9 * u * u * (1 - kG * 0.85) + kG * 1.4 * u, wind);
          var sc = 0.7 + 0.5 * Math.sin(j * 2.3);
          sV.set(sc, sc, sc);
          J.mesh.setMatrixAt(j, m4.compose(pV, qI.identity(), sV));
        }
        J.mesh.instanceMatrix.needsUpdate = true;

        // ---- Flyer: turns slowly; stops in a typhoon (capsules swing); spins on when the Earth stops (inertia)
        var Fl = S.flyer;
        var spinGoal = 0.12 * (1 - Math.min(1, t1 * 2)) + (s1 * 0.3 + s2 * 0.6 + s3 * 0.6);
        Fl.spin = still ? spinGoal : ease(Fl.spin, spinGoal, dt, 0.6);
        Fl.ang += Fl.spin * dt;
        Fl.wheel.rotation.z = Fl.ang;
        var swing = (t2 * 0.45 + t3 * 0.35) * sinS;
        for (var c = 0; c < Fl.n; c++) {
          var ca = c / Fl.n * Math.PI * 2 + Fl.ang;
          pV.set(Math.cos(ca) * Fl.r, Math.sin(ca) * Fl.r, 0);
          // capsules hang level (undo the wheel's turn), and swing in the storm
          qI.setFromAxisAngle(TMP.z, -Fl.ang + swing * Math.sin(ck * 3.3 + c * 0.9) + (still ? 0.25 * t2 * (c % 2 ? 1 : -1) : 0));
          pV.applyAxisAngle(TMP.z, -Fl.ang);
          Fl.caps.setMatrixAt(c, m4.compose(pV, qI, TMP.one));
        }
        Fl.caps.instanceMatrix.needsUpdate = true;
        Fl.wheel.position.y = Fl.FC + g3 * (0.35 + 0.1 * sinS * Math.sin(ck * 0.7));

        // ---- promenade trees lean and then bend flat in the typhoon; lean east when the Earth stops
        var TM = S.treeM, up = TMP.up, qq = TMP.qq, qy = TMP.qy, qw = TMP.qw, UP = TMP.y;
        for (var ti = 0; ti < S.trees.length; ti++) {
          var tr = S.trees[ti], gust = sinS * (0.08 * Math.sin(ck * 5.5 + tr.ph) + 0.04 * Math.sin(ck * 11 + ti));
          var bendA = t1 * (0.22 + gust) + t2 * (0.75 + gust * 2) + t3 * 0.25 - (s1 * 0.1 + s2 * 0.2 + s3 * 0.25) + kG * 0.06 * sinS * Math.sin(ck * 0.8 + tr.ph);
          var gy0 = S.ctx.groundY(tr.x, tr.z);
          up.set(tr.x, gy0 + 14, tr.z).normalize();
          qw.setFromAxisAngle(TMP.z, bendA);
          qq.setFromUnitVectors(UP, up).premultiply(qw).multiply(qy.setFromAxisAngle(UP, tr.ry));
          pV.set(tr.x, gy0, tr.z); sV.set(tr.s, tr.s, tr.s);
          m4.compose(pV, qq, sV);
          TM.trunk.setMatrixAt(ti, m4); TM.crown.setMatrixAt(ti, m4);
        }
        TM.trunk.instanceMatrix.needsUpdate = true; TM.crown.instanceMatrix.needsUpdate = true;
        for (var sti = 0; sti < S.supers.length; sti++) {
          var st = S.supers[sti], gust2 = sinS * (0.1 * Math.sin(ck * 6 + st.ph) + 0.05 * Math.sin(ck * 11));
          st.g.rotation.z = t1 * (0.18 + gust2) + t2 * (0.3 + gust2) + t3 * 0.1 - (s2 * 0.12 + s3 * 0.15);
          st.g.position.y = g2 * (0.4 + 0.15 * sinS * Math.sin(ck * 0.8 + st.ph));
          st.g.rotation.x = g2 * 0.15 * Math.sin(ck * 0.5 + st.ph + 1);
        }

        // ---- Marina Bay Sands: the deck tugs upward and tilts, the towers strain (gravity stage 3)
        var M = S.mbs, strain = g3 * (0.16 + 0.02 * sinS * Math.sin(ck * 9));
        M.towers.scale.y = 1 + strain;
        M.deck.position.y = M.TH * (1 + strain) + g3 * (0.2 + 0.1 * sinS * Math.sin(ck * 1.3));
        M.deck.rotation.z = g3 * (0.09 + 0.03 * sinS * Math.sin(ck * 0.9)) - s3 * 0.03;
        M.deck.rotation.x = g3 * 0.035 * Math.sin(ck * 0.7 + 1) * sinS + g3 * 0.02;
        M.deck.position.x = s3 * 0.15;

        // ---- boats: float off (gravity), thrown about (typhoon), slide east and pile up (stop)
        for (var bk = 0; bk < S.boats.length; bk++) {
          var b = S.boats[bk], k = bk;
          var a = b.ph + (k === 0 ? ck * 0.6 : ak) * b.w * (1 - kT * 0.5) * (1 - Math.max(s1, s2, s3));
          var bx = b.cx + b.a * Math.cos(a), bz = b.cz + b.b * Math.sin(a);
          var hd = Math.atan2(b.a * -Math.sin(a) * b.w, b.b * Math.cos(a) * b.w);
          var sx = Math.min(slide * (1.0 + k * 0.2), Math.max(0, 5.6 - k * 0.6 - bx));
          bx += sx;
          S.ctx.plant(b.g, bx, bz, hd);
          b.g.position.y = waterY(bx, bz) + (g2 * (1.3 + 0.5 * k) + g3 * 0.6) * (1 + 0.15 * sinS * Math.sin(ck * 0.9 + k)) + (t2 + t3) * 0.18 * Math.max(0, Math.sin(ck * 4.1 + k * 2)) * sinS;
          b.inner.rotation.z = (t1 * 0.12 + t2 * 0.42 + t3 * 0.25) * (sinS ? Math.sin(ck * 3.1 + k) : 0.8) + g2 * 0.6 * Math.sin(ck * 0.5 + k) * sinS + g2 * 0.3 + (s2 + s3) * 0.35 + sx * 0.12;
          b.inner.rotation.x = (t1 * 0.08 + t2 * 0.3 + t3 * 0.2) * (sinS ? Math.sin(ck * 2.3 + k * 2) : 0.4) + g2 * 0.4 * Math.cos(ck * 0.4 + k) * sinS;
        }

        // ---- cars on the bridge: float (gravity), crawl (typhoon), slide off east and drop (stop)
        var C = S.cars;
        for (var ci = 0; ci < C.n; ci++) {
          var dirC = ci % 2 ? 1 : -1, speed = 1.3 * (1 - kT * 0.6) * (1 - Math.max(s1, s2, s3));
          var zc = ((((ci * 2.3 + ak * speed) % 6.4) + 6.4) % 6.4 - 3.2) * dirC;
          var xc = (dirC > 0 ? 0.2 : -0.2), off = Math.min(slide * (0.9 + ci * 0.15), 2.2 + ci * 0.15), yc = 0.58;
          if (xc + off > 0.5) yc = Math.max(0.0, 0.58 - (xc + off - 0.5) * 1.4);
          xc += off;
          yc += g2 * (0.9 + ci * 0.25 + 0.2 * sinS * Math.sin(ck + ci)) + g3 * 0.5;
          pV.set(xc, yc, zc);
          qI.setFromEuler(TMP.e.set(g2 * 0.5 * Math.sin(ck * 0.6 + ci) * sinS, dirC > 0 ? 0 : Math.PI, g2 * 0.4 * Math.cos(ck * 0.5 + ci) * sinS - off * 0.9));
          C.mesh.setMatrixAt(ci, m4.compose(pV, qI, TMP.one));
        }
        C.mesh.instanceMatrix.needsUpdate = true;

        // ---- loose things: lamp tops, benches, bins, umbrellas
        for (var li = 0; li < S.loose.length; li++) {
          var o = S.loose[li], ox = o.x, oz = o.z, lift = 0, dxo = 0, rot = 0, rotX = 0, spin = 0;
          var bob = sinS * Math.sin(ck * 0.9 + o.ph);
          if (o.kind === 'lamp') {
            lift = g1 * (0.35 + o.r * 0.4 + 0.1 * bob) + g2 * 0.5 + g3 * 0.4;
            rot = g1 * 0.3 * Math.sin(ck * 0.6 + o.ph) * sinS + g1 * 0.2;
          } else {
            // gravity: the small things go first
            lift = o.kind === 'bench' || o.kind === 'umb' ? g1 * (0.25 + o.r * 0.2 + 0.08 * bob) + g2 * 0.45 + g3 * 0.25
              : g1 * (0.4 + o.r * 0.8 + 0.12 * bob) + g2 * (0.8 + o.r * 0.5) + g3 * 0.5;
            rot = (g1 + g2) * (0.4 * Math.sin(ck * 0.5 + o.ph) * sinS + 0.3);
            spin = (g1 + g2) * ck * 0.3 * sinS;
            // typhoon: rattle, then blow across the frame (umbrellas go at stage 2)
            var f = (o.kind === 'umb' ? fly2 : fly3) * env;
            if (f > 0) {
              f = clamp(f * (1.1 - o.r * 0.25), 0, 1);
              dxo -= 12 * f; lift += 2.8 * Math.sin(f * Math.PI * 0.85) * (0.7 + o.r * 0.5);
              rot += f * (5 + o.r * 4); rotX += f * 3;
            } else rot += (t1 + t2) * 0.06 * Math.sin(ck * 23 + o.ph) * sinS;
            // stop: slide east, tumbling, pile up
            if (slide > 0) { var sx2 = Math.min(slide * (0.9 + o.r * 0.4), Math.max(0, o.lim - ox)); dxo += sx2; rot -= sx2 / 0.3; }
          }
          var gx2 = ox + dxo, gyo = S.ctx.groundY(gx2, oz);
          up.set(gx2, gyo + 14, oz).normalize();
          qq.setFromUnitVectors(UP, up);
          if (rot || rotX) { qw.setFromEuler(TMP.e.set(rotX, 0, rot)); qq.premultiply(qw); }
          qq.multiply(qy.setFromAxisAngle(UP, o.ry + spin));
          if (o.kind === 'lamp') {
            // the head hangs off the end of the arm
            pV.set(0, o.dy, o.dz).applyQuaternion(qq);
            pV.x += gx2; pV.y += gyo + lift; pV.z += oz;
          } else pV.set(gx2, gyo + lift, oz);
          o.mesh.setMatrixAt(o.i, m4.compose(pV, qq, TMP.one));
          o.wx = pV.x; o.wy = pV.y; o.wz = pV.z; o.q.copy(qq);
          o.mesh.instanceMatrix.needsUpdate = true;
        }

        // ---- people
        stepPeople(dt, ck, still, sinS, fly3);

        // ---- the pool's water floats up off the deck as wobbling blobs (gravity stage 2), droplets off the bay (stage 1)
        var B = S.balls;
        B.mesh.visible = g2 > 0.02;
        if (B.mesh.visible) {
          for (var bi = 0; bi < B.n; bi++) {
            pV.set(-3.2 + bi * 0.55, M.deck.position.y + 0.45 + g2 * (0.5 + (bi % 3) * 0.55 + 0.2 * sinS * Math.sin(ck + bi)) + g3 * 0.8, 0.3 + 0.2 * Math.sin(bi * 1.7));
            var wob = sinS * 0.25 * Math.sin(ck * 4 + bi * 1.3), bs = g2 * (0.8 + 0.4 * Math.sin(bi));
            sV.set(bs * (1 + wob), bs * (1 - wob), bs * (1 + wob * 0.5));
            B.mesh.setMatrixAt(bi, m4.compose(pV, qI.identity(), sV));
          }
          B.mesh.instanceMatrix.needsUpdate = true;
        }
        var D = S.drops;
        D.mesh.visible = g1 > 0.02;
        if (D.mesh.visible) {
          for (var dk = 0; dk < D.n; dk++) {
            var dd = D.d[dk], dl = g1 * (0.25 + dd[2] * 1.6) + g2 * (0.8 + dd[2]) + g3 * 0.6 + 0.15 * sinS * Math.sin(ck * 1.3 + dk);
            pV.set(dd[0], waterY(dd[0], dd[1]) + dl, dd[1]);
            var ds = g1 * (0.7 + dd[2] * 0.8) * (1 + 0.2 * sinS * Math.sin(ck * 5 + dk));
            sV.set(ds, ds * 1.15, ds);
            D.mesh.setMatrixAt(dk, m4.compose(pV, qI.identity(), sV));
          }
          D.mesh.instanceMatrix.needsUpdate = true;
        }

        // ---- rain and wind streaks, in front of the camera
        stepRain(dt, ck, still, kT, t3);

        // ---- the screen plays his reels (high tier, arrived, not reduced motion)
        tickScreen(ctx);

        // ---- the gorilla and the fight
        stepGorilla(dt, ck, sinS);

        // ---- W4: YOU watches the reel screen (his head turns up to it); not during the fight
        var lookNow = ctx.dive > 0.5 && !S.fight && !S.mode;
        if (lookNow) ctx.you.lookAt(SCR.x, 3.0, SCR.z);   // every frame: world.js clears it when the place is left
        else if (S.looking) ctx.you.lookAt(null);
        S.looking = lookNow;

        // ---- YOU in the what-ifs (the fight drives him on its own)
        if (!S.fight) {
          if (S.mode && stage !== S.lastStage) youStage(ctx, S.mode, stage, still);
          S.lastStage = S.mode ? stage : 0;
          if (kG > 0.002) ctx.you.offset(0, g1 * 0.3 + g2 * 0.8 + g3 * 0.7 + kG * 0.15 * sinS * Math.sin(ck * 0.9), 0, kG * 0.2 * Math.sin(ck * 0.7) * sinS, kG * 0.25 * Math.sin(ck * 0.5 + 1) * sinS + g3 * 0.2);
          else if (kT > 0.002) ctx.you.offset(-t3 * 0.9 * (0.6 + 0.4 * fly3), 0, 0, 0, t1 * 0.12 + t2 * 0.12 + t3 * 0.1);
          else if (wm === 'stop') ctx.you.offset(Math.min(slide * 0.35, 0.6), 0, 0, 0, 0);
          else ctx.you.offset(0, 0, 0, 0, 0);
          // after the stop what-if he walks back to his spot
          var back = !S.mode && wm === 'stop' && env > 0.05;
          if (back !== !!S.walkBack) { S.walkBack = back; ctx.you.play(back ? 'Walk' : 'Idle', { loop: true }); }
        }
        // the fight ends if the camera leaves
        if (!ctx.arrived && S.fight) endFight(ctx);
      },

      onPointer: function (ev, ctx) {
        if (!S || ev.type !== 'click' || !ev.hit) return false;
        // W4: low tier / reduced motion show the reel's cover; a tap on the screen plays the reel
        if (ev.hit.object === S.screen.mesh) {
          if (!S.userPlay) S.userPlay = true;
          return true;
        }
        var o = ev.hit.object, isG = false;
        while (o) { if (o === S.gor.g) { isG = true; break; } o = o.parent; }
        if (!isG) return false;
        if (S.fight) endFight(ctx); else startFight(ctx);
        return true;
      },

      whatIf: function (mode, ctx) {
        if (!S) return false;
        if (S.fight) endFight(ctx);
        var was = S.mode;
        S.mode = mode || null;
        if (mode) { S.wm = mode; S.wt = 0; S.env = 1; S.lastStage = 0; }
        if (mode === 'gravity') ctx.you.play('Float', { loop: true });
        else if (mode === 'typhoon') ctx.you.play('Walk', { loop: true });
        else if (mode === 'stop') ctx.you.play('Idle');
        else { ctx.you.play('Idle'); if (was === 'gravity') ctx.you.play('Jump'); }
        return true;
      },

      setQuality: function (q) { setQ(q); },

      // W4: WORLD.pause() / resume() (the page's full player, Quick view): the reel on the big screen stops too;
      // after resume the next frame plays it again if the place is still arrived
      pause: function (on) {
        if (!S) return;
        S.paused = !!on;
        if (on && S.vid) { try { S.vid.pause(); } catch (e) { /* fine */ } }
      },

      dispose: function () {
        document.removeEventListener('play', onReelPlay, true);
        if (S && S.vid) { try { S.vid.pause(); S.vid.removeAttribute('src'); S.vid.load(); } catch (e) { /* gone */ } }
        // world.js removes the group and frees its geometries and non-shared materials after this
        if (S) {
          S.screen.mat.map = null;
          if (S.vtex) S.vtex.dispose();
          Object.keys(S.posters).forEach(function (k) { if (S.posters[k] && S.posters[k].dispose) S.posters[k].dispose(); });
        }
        S = null; TMP = null;
      }
    });

    // the bay's surface height at (x, z) this frame (never below the planet's own surface)
    function waterY(x, z) {
      var V = S.wv, b0 = S.ctx.groundY(x, z) + 0.01;
      var y0 = b0 + V.rise + V.amp * (0.08 + 0.045 * Math.sin(x * 1.3 + V.ck * 1.1) + 0.035 * Math.sin(z * 1.9 - V.ck * 1.4 + x * 0.5)) + V.tilt * (x - BAY.cx) / BAY.rx;
      return y0 > b0 ? y0 : b0;
    }

    // YOU's beats inside each what-if (one-shot clips at each new stage)
    function youStage(ctx, mode, stage, still) {
      if (mode === 'stop') {
        if (still) { ctx.you.play('Defeat', { hold: true }); return; }
        if (stage === 1) ctx.you.play('RecieveHit');
        else if (stage === 2) ctx.you.play('Roll', { then: 'StandUp' });
        else if (stage === 3) ctx.you.play('Roll', { then: 'StandUp' });
      } else if (mode === 'typhoon') {
        if (stage === 3 && !still) ctx.you.play('RecieveHit');
      } else if (mode === 'gravity') {
        if (stage === 3 && !still) ctx.you.play('Float', { loop: true });
      }
    }

    function setQ(q) {
      if (!S) return;
      S.lo = q === 'low';
      if (S.lo && S.vid) { try { S.vid.pause(); } catch (e) { /* fine */ } }
    }

    // ---------- people (calm pass): still poses, upright to the sphere; the what-ifs carry them ----------
    var SEAT_Y = 0.4, SEAT_Z = 0.02;
    function stepPeople(dt, ck, still, sinS) {
      var PP = S.people, k = S.k, ctx = S.ctx, up = TMP.up, qq = TMP.qq, qy = TMP.qy, qw = TMP.qw, UP = TMP.y;
      for (var i = 0; i < PP.n; i++) {
        var p = PP.list[i], g = p.g;
        if (p.kind === 'sit') {
          // riding the bench: whatever the bench does, they do
          var bn = p.benchO;
          TMP.p.set(0, SEAT_Y, SEAT_Z).applyQuaternion(bn.q);
          g.position.set(bn.wx + TMP.p.x, bn.wy + TMP.p.y, bn.wz + TMP.p.z);
          g.quaternion.copy(bn.q);
          continue;
        }
        // what-if moves: float (gravity), lean into the wind (typhoon), slide east and tumble (stop)
        var lift = k.g2 * (0.9 + (i % 5) * 0.35 + 0.2 * sinS * Math.sin(ck * 0.8 + i)) + k.g3 * 0.7 + k.g1 * 0.05;
        var dx = 0, rz = 0, rx = 0, x = p.x, z = p.z;
        if (k.slide > 0) { dx = Math.min(k.slide * (0.85 + p.r * 0.5), Math.max(0, 7.0 - (i % 4) * 0.4 - x)); rz -= dx / 0.45; }
        rz -= (k.t1 * 0.12 + k.t2 * 0.16 + k.t3 * 0.1) * (1 + 0.3 * sinS * Math.sin(ck * 7 + i));
        rx += k.g2 * (0.9 * Math.sin(ck * 0.6 + i) * sinS + 0.35);
        x += dx;
        var gy = ctx.groundY(x, z);
        up.set(x, gy + 14, z).normalize();
        qq.setFromUnitVectors(UP, up);
        if (rz || rx) { qw.setFromEuler(TMP.e.set(rx, 0, rz)); qq.premultiply(qw); }
        qq.multiply(qy.setFromAxisAngle(UP, p.yaw));
        g.position.set(x, gy + lift, z);
        g.quaternion.copy(qq);
      }
    }

    // ---------- rain and wind streaks: drops fixed in the scene, wrapped round a box in front of the camera ----------
    function stepRain(dt, ck, still, kT, t3) {
      var RN = S.rain, vis = kT > 0.02;
      RN.mesh.visible = RN.st.visible = vis;
      if (!vis) return;
      var cam = S.ctx.camera, inv = TMP.inv, cp = TMP.cp, cf = TMP.cf;
      S.root.updateWorldMatrix(true, false);
      inv.copy(S.root.matrixWorld).invert();
      cp.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(inv);
      cf.set(0, 0, -1).transformDirection(cam.matrixWorld).transformDirection(inv);
      // calm pass: the camera is far off now, so the box sits over the place itself: 16 wide, 11 tall, 14 deep
      var bx = -8, by = -1, bz = -7;
      var tt = still ? 0.37 : ck, m4 = TMP.m4, pV = TMP.p, sV = TMP.s;
      var q = TMP.q2.setFromAxisAngle(TMP.z, -0.5);
      var n = Math.round(RN.n * (0.45 + 0.35 * S.k.t2 / Math.max(kT, 0.01) + 0.2 * t3 / Math.max(kT, 0.01)));
      RN.mesh.count = Math.min(RN.n, n);
      sV.set(1, 0.4 + 0.8 * kT, 1);
      for (var i = 0; i < RN.mesh.count; i++) {
        var d = RN.d[i];
        pV.set(bx + wrap(d[0] * 1.33 - tt * 7 - bx, 16), by + wrap(d[1] * 1.1 - tt * 15 - by, 11), bz + wrap(d[2] * 1.17 - bz, 14));
        RN.mesh.setMatrixAt(i, m4.compose(pV, q, sV));
      }
      RN.mesh.instanceMatrix.needsUpdate = true;
      sV.set(0.6 + kT * 0.6, 1, 1);
      for (var j = 0; j < RN.ns; j++) {
        var s = RN.sd[j];
        pV.set(bx + wrap(s[0] * 1.15 - tt * 22 * s[3] - bx, 16), by + wrap(s[1] + 2 - by, 6) + 1, bz + wrap(s[2] * 1.17 - bz, 14));
        RN.st.setMatrixAt(j, m4.compose(pV, TMP.q.identity(), sV));
      }
      RN.st.instanceMatrix.needsUpdate = true;
    }
    function wrap(v, L) { return ((v % L) + L) % L; }

    // W4: the big screen plays his real reels. Which reel: the one the visitor last played on the page (a reel tile's
    // video firing `play`: hover, press, or the tile in view), else the first. High tier: the reel itself, muted and
    // looping, only while the place is arrived and the world is not paused; low tier and reduced motion: the reel's
    // cover (a still) until the screen is tapped. One video element and one VideoTexture; covers are cached.
    var REELS = ['tw-gorilla', 'tw-gravity', 'tw-earth', 'tw-typhoon'];
    function reelIndex(src) {
      var name = String(src || '').split('/').pop().split('?')[0].replace(/\.mp4$/i, '');
      return REELS.indexOf(name);
    }
    function onReelPlay(e) {
      var v = e.target;
      if (!S || !v || v.tagName !== 'VIDEO' || !v.closest || !(v.closest('.clip--reel') || v.closest('.reels'))) return;
      var i = reelIndex(v.getAttribute('src') || v.currentSrc);
      if (i >= 0) switchReel(i);
    }
    function switchReel(i) {
      if (!S || i === S.ri) return;
      S.ri = i;
      S.showingPoster = -1;
      if (S.vid) {
        var was = !S.vid.paused;
        S.vid.src = S.ctx.base + 'video/' + REELS[i] + '.mp4';
        try { S.vid.load(); } catch (e) { /* fine */ }
        if (was) S.vid.play().catch(function () {});
      }
    }
    function reelPoster(i, cb) {
      var P = S.posters;
      if (P[i]) { if (P[i] !== 'loading') cb(P[i]); return; }
      P[i] = 'loading';
      var me = S;
      new S.T.TextureLoader().load(S.ctx.base + 'img/' + REELS[i] + '.jpg', function (tex) {
        if (S !== me) { tex.dispose(); return; }
        tex.colorSpace = S.T.SRGBColorSpace;
        P[i] = tex; cb(tex);
      }, undefined, function () { if (S === me) P[i] = null; });
    }
    function showMap(tex) {
      var m = S.screen.mat;
      if (m.map === tex) return;
      m.map = tex; m.color.set('#ffffff'); m.needsUpdate = true;
    }
    function tickScreen(ctx) {
      // r13 pass A: the screen shows the still until the visitor taps it (no video plays by itself)
      var stillMode = !S.userPlay;
      var want = ctx.arrived && !document.hidden && !S.paused && !stillMode;
      if (want && !S.vid) {
        var v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
        v.addEventListener('loadeddata', function () { if (S && S.vid === v) S.vidR = S.ri; });
        v.src = ctx.base + 'video/' + REELS[S.ri] + '.mp4';
        S.vid = v;
      }
      if (S.vid) {
        if (want && S.vid.paused) S.vid.play().catch(function () {});
        if (!want && !S.vid.paused) S.vid.pause();
      }
      ctx.live = !!(S.vid && !S.vid.paused && !stillMode);   // r13 pass A: world.js keeps drawing only while it plays
      // the video texture only while the reel is really playing (a paused or loading video has no frame to give);
      // otherwise the reel's cover, so the screen is never black
      var vidReady = want && S.vid && S.vid.readyState >= 2 && S.vid.videoWidth && S.vidR === S.ri && !S.vid.paused && S.vid.currentTime > 0.05;
      if (vidReady) {
        if (!S.vtex) { S.vtex = new S.T.VideoTexture(S.vid); S.vtex.colorSpace = S.T.SRGBColorSpace; }
        S.screen.tex = S.vtex;
        showMap(S.vtex);
      } else if (ctx.dive > 0.2 && S.showingPoster !== S.ri && !(S.screen.tex === S.vtex && S.vtex && S.vidR === S.ri)) {
        var ri = S.ri;
        reelPoster(ri, function (tx) { if (S && S.ri === ri) { S.showingPoster = ri; S.screen.tex = tx; showMap(tx); } });
      }
    }

    // ---------- the gorilla: knuckle-walks the promenade; the fight beat ----------
    var FIGHT_END = 4.2;
    function startFight(ctx) {
      S.fight = { t: 0, from: S.gor.x, stage: 0, frozen: false };
      ctx.you.offset(0, 0, 0, 0, 0);
      ctx.you.play('Idle');
    }
    function endFight(ctx) {
      var f = S.fight;
      S.fight = null;
      ctx.you.offset(0, 0, 0, 0, 0);
      ctx.you.place(YX, YZ, YRY);
      if (f && f.t > 3.0) ctx.you.play('StandUp'); else ctx.you.play('Idle');
      // W4: the fight clock goes away again (an empty reading, the page's default for this readout)
      if (S.lastHud) ctx.hud({ left: { value: '', caption: '' } });
      S.lastHud = '';
    }
    function fmt(t) { var s = Math.floor(t), d = Math.floor((t - s) * 10); return '0:0' + s + '.' + d; }
    function pose(G, p) {
      // p: {pitch, armL:[x,z,elbow], armR:[x,z,elbow], legL, legR, head, hipY}
      G.torso.rotation.x = p.pitch;
      G.armL.sh.rotation.set(p.armL[0], 0, p.armL[1]); G.armL.el.rotation.x = p.armL[2];
      G.armR.sh.rotation.set(p.armR[0], 0, p.armR[1]); G.armR.el.rotation.x = p.armR[2];
      G.legL.sh.rotation.x = p.legL; G.legR.sh.rotation.x = p.legR;
      G.legL.el.rotation.x = 0.35; G.legR.el.rotation.x = 0.35;
      G.head.rotation.x = p.head || 0;
      G.hips.position.y = p.hipY;
    }
    function walkPose(ph, amt) {
      var s = Math.sin(ph) * amt;
      return { pitch: 0.82, armL: [-0.82 + s * 0.45, 0.08, -0.15], armR: [-0.82 - s * 0.45, -0.08, -0.15], legL: -s * 0.5 - 0.15, legR: s * 0.5 - 0.15, head: -0.6, hipY: 0.74 + Math.abs(Math.cos(ph)) * 0.04 * amt };
    }
    function mixPose(a, b, k) {
      var o = {};
      for (var key in a) {
        if (Array.isArray(a[key])) o[key] = a[key].map(function (v, i) { return v + (b[key][i] - v) * k; });
        else o[key] = a[key] + (b[key] - a[key]) * k;
      }
      return o;
    }
    function stepGorilla(dt, ck, sinS) {
      var G = S.gor, ctx = S.ctx, f = S.fight, k = S.k;
      var ry, gx, gz = GZ, p;
      if (!f) {
        // patrol the west end of the promenade, in front of the Merlion
        var spd = (S.wm ? 0.45 : 0) * (1 - k.kT * 0.6) * (1 - Math.max(k.s1, k.s2, k.s3)) * (1 - k.kG);
        G.x += G.dir * spd * dt;
        if (G.x > G1) { G.x = G1; G.dir = -1; }
        if (G.x < G0) { G.x = G0; G.dir = 1; }
        G.gait += dt * 5.2 * (spd > 0.05 ? 1 : 0);
        var turnGoal = G.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        G.ry += (turnGoal - G.ry) * (1 - Math.exp(-dt / 0.25));
        ry = G.ry; gx = G.x;
        p = walkPose(G.gait, spd > 0.05 ? 1 : 0);
        p.pitch += k.kT * 0.2;
        if (k.t3 > 0) { gx -= k.t3 * 0.5; p.armL[0] -= k.t3 * 0.6; p.armR[0] -= k.t3 * 0.6; }
      } else {
        f.t += dt;
        var t = f.t, target = YX - 1.35;
        gx = f.from + (target - f.from) * smooth(0, 0.9, t);
        G.x = gx;
        ry = G.ry + (Math.PI / 2 - G.ry) * smooth(0, 0.3, t);
        if (t < 0.9) { G.gait += dt * 9; p = walkPose(G.gait, 1.3); }
        else if (t < 1.9) {
          // rears up and beats its chest
          var kk = smooth(0.9, 1.15, t), beat = Math.sin((t - 0.9) * Math.PI * 8);
          var stand = { pitch: 0.08, armL: [-1.25 + (beat > 0 ? 0.35 : 0), 0.55, -1.75], armR: [-1.25 + (beat < 0 ? 0.35 : 0), -0.55, -1.75], legL: 0.05, legR: 0.05, head: 0.15, hipY: 0.95 };
          p = mixPose(walkPose(G.gait, 0), stand, kk);
        } else if (t < 2.5) {
          var flinch = smooth(2.15, 2.3, t) * (1 - smooth(2.3, 2.5, t));
          p = { pitch: 0.12 - flinch * 0.25, armL: [-0.6, 0.3, -0.8], armR: [-0.6, -0.3, -0.8], legL: 0, legR: 0, head: -0.1 - flinch * 0.3, hipY: 0.95 };
          gx -= flinch * 0.25;
        } else if (t < 3.1) {
          // the swing
          var sw = smooth(2.5, 2.8, t);
          p = { pitch: 0.2 + sw * 0.25, armL: [-0.6, 0.3, -0.8], armR: [-2.6 + sw * 3.1, -0.4 + sw * 0.6, -0.4], legL: -0.15, legR: 0.2, head: 0, hipY: 0.9 };
        } else {
          var bt = Math.sin((t - 3.3) * Math.PI * 7), k2 = smooth(3.1, 3.4, t) * (t < 5.4 ? 1 : 1 - smooth(5.4, 6.0, t));
          var win = { pitch: 0.05, armL: [-1.3 + (bt > 0 ? 0.3 : 0), 0.55, -1.8], armR: [-1.3 + (bt < 0 ? 0.3 : 0), -0.55, -1.8], legL: 0.05, legR: 0.05, head: 0.25, hipY: 0.97 };
          p = mixPose(walkPose(0, 0), win, k2);
        }
        gz = GZ + (YZ + 0.15 - GZ) * smooth(0, 0.9, t);
        // YOU's side of it
        var youRy = -Math.PI / 2 + 0.25, dRy = youRy - YRY;
        while (dRy > Math.PI) dRy -= 2 * Math.PI; while (dRy < -Math.PI) dRy += 2 * Math.PI;   // W4: turn the short way
        ctx.you.place(YX, YZ, YRY + dRy * smooth(0, 0.35, t));
        if (f.stage === 0 && t > 1.9) { f.stage = 1; ctx.you.play('Punch'); }
        if (f.stage === 1 && t > 2.75) { f.stage = 2; ctx.you.play('RecieveHit'); }
        if (f.stage === 2 && t > 3.05) { f.stage = 3; ctx.you.play('Roll'); }
        if (f.stage === 3 && t > 3.95) { f.stage = 4; ctx.you.play('Defeat', { hold: true }); }
        ctx.you.offset(1.5 * smooth(3.05, 3.9, t), 0, 0, 0, 0);
        // the fight clock on the HUD
        var shown = t < FIGHT_END ? fmt(t) : fmt(FIGHT_END);
        var cap = t < FIGHT_END ? 'fight clock' : 'how long you lasted';
        if (shown + cap !== S.lastHud) { S.lastHud = shown + cap; ctx.hud({ left: { value: shown, caption: cap }, extra: { fight: true } }); }
        if (t > 12) endFight(ctx);
      }
      // the stop what-if: slides east, tumbling
      var sdx = 0;
      if (k.slide > 0 && !f) { sdx = Math.min(k.slide * 1.1, Math.max(0, 6.2 - gx)); gx += sdx; }
      pose(G, p);
      ctx.plant(G.g, gx, gz, ry);
      if (sdx > 0) G.g.rotateX(-sdx / 0.9);
      if (k.kG > 0.002) {
        G.g.position.y += k.g2 * (1.3 + 0.2 * sinS * Math.sin(ck * 0.7)) + k.g3 * 0.6 + k.g1 * 0.08;
        G.g.rotateX(k.g2 * (0.4 * Math.sin(ck * 0.45) * sinS + 0.25));
        G.g.rotateZ(k.g2 * 0.5 * Math.sin(ck * 0.38) * sinS);
      }
    }
  }
  if (window.WORLD) go(); else window.addEventListener('DOMContentLoaded', go);
})();
