/* scenes/contact.js: Let's talk, live (scene builder A, v3). A void deck at night, squeezed onto the curve of the
   planet in the house style. The sky is the flat ink field, so everything reads by flat colour contrast: mid blues and
   warm greys for the block, flat bright patches for lights and windows (no glows, no gradients, no fog).
   The ground floor of an HDB block seen from the front: square pillars, a tiled floor, tube lights, a wall of
   letterboxes (the click target), a stone chess table, a lift lobby; the block rises above with corridor lights and
   TV-light windows; a road in front with a double-decker passing. YOU waits by the letterboxes with an envelope and
   waves when you arrive. When the visitor copies the email (site:copied) or clicks the letterboxes or the envelope,
   YOU posts the envelope into the letterbox with his name on it.
   Shapes and proportions from the reel sets tinyworld-base/engine/sets/estate.js and tvwindows.js (rescaled). */
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

    // ---------- layout (scene units; +z toward the camera) ----------
    var BLK = { x: 0, z: -2.6, w: 10, d: 4.4, deck: 2.6, ph: 1.45 };   // the block; its void deck is the stage
    var WALL = { x: -2.45, z: -0.9, ry: 0.0, cols: 6, rows: 5, dw: 0.44, dh: 0.34 };   // the letterbox wall
    var TEDD = { c: 5, r: 1 };                       // his letterbox: column, row (from the bottom)
    var WAIT = [-0.35, -0.3, 0.3];                  // where YOU waits (x, z, facing)
    var ROADZ = 4.2;                                 // the road runs along x
    var POST = 2.6;                                  // seconds for one post

    // street-level camera shots (scene space): world.js glides along them with the section's scroll p
    var SHOTS = [
      { pos: [1.6, 1.35, 3.0], look: [-2.0, 1.0, -1.2], fov: 55 },    // arrive at the void deck: pillars, the letterbox wall ahead, YOU
      { pos: [4.4, 1.2, 1.6], look: [1.4, 0.3, -1.5], fov: 55 },      // drift past the chess table and the pigeon
      { pos: [0.5, 0.9, 3.4], look: [0.0, 7.5, -1.6], fov: 58 },      // look up the block: TV windows, corridor lights
      { pos: [0.6, 1.1, 1.9], look: [-1.5, 0.9, -0.7], fov: 50 }      // end close on YOU and his letterbox
    ];
    W.registerScene('contact', {
      shots: SHOTS,
      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, P = ctx.palette, lo = ctx.quality === 'low';
        var root = new T.Group();
        TMP = { m4: new T.Matrix4(), q: new T.Quaternion(), q2: new T.Quaternion(), p: new T.Vector3(), s: new T.Vector3(), v: new T.Vector3(),
          up: new T.Vector3(), Y: new T.Vector3(0, 1, 0), Xa: new T.Vector3(1, 0, 0), Za: new T.Vector3(0, 0, 1), col: new T.Color() };
        S = { root: root, T: T, ctx: ctx, lo: lo, kG: 0, kT: 0, kS: 0, mode: null, stopT: 0, own: [],
          post: null, queued: false, arrived: false, hudUntil: 0, hudKey: '', ry: WAIT[2], px: WAIT[0], pz: WAIT[1], walking: false, envBack: -10 };
        var vcol = ctx.mat('#ffffff', { vertexColors: true });
        var bake = new Baker(T, X);
        var dummy = new T.Object3D();
        function frameAt(x, z, ry, dy) { ctx.plant(dummy, x, z, ry); dummy.position.y += dy || 0; dummy.updateMatrix(); return dummy.matrix.clone(); }
        function holderAt(F) { var h = new T.Group(); h.matrixAutoUpdate = false; h.matrix.copy(F); root.add(h); return h; }
        function basic(color) { var m = new T.MeshBasicMaterial({ color: color }); m.toneMapped = false; S.own.push(m); return m; }

        // ---------- ground: night paving in front of the block, dark lawn at the sides ----------
        var RINGS = lo ? 14 : 22, SEG = lo ? 36 : 56, RMAX = 10.2;
        var cap = new T.BufferGeometry(), pos = [], cols = [];
        var cG1 = new T.Color('#3f6a46'), cG2 = new T.Color('#386140'), cPave = new T.Color('#5f5c57'), cPave2 = new T.Color('#585550');
        function zone(x, z) {
          var hsh = hash(Math.floor(x * 0.9) * 12.99 + Math.floor(z * 0.9) * 78.23);
          if (Math.abs(x) < 6.2 && z > -5.6 && z < ROADZ - 1.1) return hsh > 0.5 ? cPave : cPave2;
          return hsh > 0.7 ? cG2 : cG1;
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
        function zLim(x) { return Math.sqrt(Math.max(0, 9.9 * 9.9 - x * x)); }
        // a strip laid on the curve (the road)
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
        if (!lo) {
          var rx = Math.sqrt(Math.max(0, 9.9 * 9.9 - (ROADZ + 1.1) * (ROADZ + 1.1)));
          strip(-rx, rx, ROADZ - 1.0, ROADZ + 1.0, '#3a3d44', 0.06);
          strip(-rx, rx, ROADZ - 1.16, ROADZ - 1.0, '#9a958c', 0.1);
          for (var dx = -8; dx < 8; dx += 1.3) if (Math.abs(dx) < rx - 0.8) bake.part(boxG(T, 0.6, 0.02, 0.07), '#d8d4ca', frameAt(dx, ROADZ, 0, 0.06), 0, 0, 0);
        }

        // ---------- the block: void deck (human scale) and the floors above ----------
        var F = frameAt(BLK.x, BLK.z, 0, 0), w = BLK.w, d = BLK.d, deck = BLK.deck, ph = BLK.ph, NF = 5, H = NF * ph;
        var face = d / 2 - 0.2, top = deck + 0.35 + H;
        bake.part(boxG(T, w + 0.7, 1.5, d + 1.2), '#5e5a54', F, 0, -1.5, 0.1);
        bake.part(boxG(T, w + 0.7, 0.06, 0.35), '#8e8a82', F, 0, -0.3, d / 2 + 0.85);                 // plinth (level on the curve)
        bake.part(boxG(T, w + 0.7, 0.08, d + 1.2), '#a8a397', F, 0, -0.06, 0.1);                   // the tiled floor
        if (!lo) {
          for (var gx = -w / 2; gx <= w / 2 + 0.01; gx += 0.9) bake.part(boxG(T, 0.035, 0.012, d + 1.1), '#8d887e', F, gx, 0.02, 0.1);
          for (var gz = -d / 2; gz <= d / 2 + 0.6; gz += 0.9) bake.part(boxG(T, w + 0.6, 0.012, 0.035), '#8d887e', F, 0, 0.02, gz);
        }
        var front = [-4.6, -0.7, 2.0, 4.6], back = [-4.6, -2.3, 0.0, 4.6];
        front.forEach(function (px) { bake.part(boxG(T, 0.5, deck, 0.5), '#b9b3a8', F, px, 0, d / 2 - 0.35); bake.part(boxG(T, 0.53, 0.85, 0.53), '#3f7f7a', F, px, 0, d / 2 - 0.35); });
        if (!lo) back.forEach(function (px) { bake.part(boxG(T, 0.5, deck, 0.5), '#aaa49a', F, px, 0, -d / 2 + 0.35); bake.part(boxG(T, 0.53, 0.85, 0.53), '#3f7f7a', F, px, 0, -d / 2 + 0.35); });
        bake.part(boxG(T, w, deck, 0.2), '#6f6a62', F, 0, 0, -d / 2 + 0.1);                     // back wall of the void deck
        bake.part(boxG(T, w + 0.1, 0.35, d), '#9d978c', F, 0, deck, 0);                         // slab over the void deck
        S.panes = []; S.lamps = [];
        if (lo) {
          // low: the block above as one dark slab with lit windows
          bake.part(boxG(T, w, H, d - 0.4), '#2a3346', F, 0, deck + 0.35, -0.1);
          for (var lf = 0; lf < NF; lf++) for (var lk = 0; lk < 7; lk++) S.panes.push({ x: -w / 2 + (lk + 0.5) * w / 7, y: deck + 0.35 + lf * ph + 0.55, z: face + 0.02, f: lf, k: lk });
        } else {
          bake.part(boxG(T, w, H, d - 0.4), '#4f5f7d', F, 0, deck + 0.35, -0.2);                // the floors: mid blue
          for (var f = 0; f < NF; f++) {
            var y0 = deck + 0.35 + f * ph;
            bake.part(boxG(T, w + 0.02, 0.86, 0.1), '#262d3d', F, 0, y0 + 0.08, face);         // corridor recess
            bake.part(boxG(T, w + 0.04, 0.42, 0.18), '#8d8679', F, 0, y0 + 0.94, face + 0.03);  // parapet: warm grey
            bake.part(boxG(T, w + 0.05, 0.07, 0.2), '#3f8f88', F, 0, y0 + 1.27, face + 0.04);   // the stripe
            for (var k = 0; k < 7; k++) {
              var wx = -w / 2 + (k + 0.5) * w / 7;
              bake.part(boxG(T, 0.34, 0.7, 0.04), '#5b4438', F, wx + 0.5, y0 + 0.1, face + 0.06);   // a door
              S.panes.push({ x: wx - 0.15, y: y0 + 0.42, z: face + 0.075, f: f, k: k });
              if (k % 2 === 0) S.lamps.push({ x: wx + 0.25, y: y0 + 0.86, z: face + 0.03, f: f, k: k });
            }
          }
          [-1, 1].forEach(function (s) { bake.part(boxG(T, 0.08, H, 0.4), '#3f8f88', F, s * (w / 2 + 0.02), deck + 0.35, face - 0.6); });
          bake.part(boxG(T, w + 0.14, 0.3, d - 0.3), '#8d8679', F, 0, top, -0.2);                 // roof parapet
          bake.part(boxG(T, 2.0, 0.7, 1.6), '#6f6a62', F, -2.6, top + 0.3, -0.4);
          bake.part(boxG(T, 1.4, 0.55, 1.3), '#6f6a62', F, 2.8, top + 0.3, -0.4);
        }

        // ---------- tube lights under the slab: flat bright bars (one of them flickers) ----------
        var tubeOn = basic('#f4fbff'), tubeOff = basic('#4a5160');
        S.tubeMats = { on: tubeOn, off: tubeOff };
        var tubes = new T.Group(); tubes.matrixAutoUpdate = false; tubes.matrix.copy(F); root.add(tubes);
        S.tubes = [];
        [-3.5, -1.2, 1.2, 3.5].forEach(function (tx) { [0.9, -0.9].forEach(function (tz) {
          if (lo && tz < 0) return;
          var tb = new T.Mesh(new T.BoxGeometry(1.25, 0.09, 0.14), tubeOn); tb.position.set(tx, deck - 0.42, tz); tb.castShadow = false;
          tubes.add(tb); S.tubes.push(tb);
          [-0.45, 0.45].forEach(function (rx2) { var rod = new T.Mesh(new T.BoxGeometry(0.03, 0.36, 0.03), ctx.mat('#3a3a3a')); rod.position.set(tx + rx2, deck - 0.36, tz); tubes.add(rod); });
        }); });
        S.flickTube = S.tubes[2];

        // ---------- lift lobby: two lifts, doors open once in a while (a lit car inside) ----------
        S.lifts = [];
        if (!lo) {
          var lz = -d / 2 + 0.2;
          bake.part(boxG(T, 3.0, deck, 1.0), '#b5aea2', F, 2.6, 0, lz + 0.5 - 0.5 + 0.0);
          var lh = holderAt(F), lit = basic('#fff1c8'), steel = ctx.mat('#a9adb3', { roughness: 0.4 });
          [1.95, 3.25].forEach(function (lx, i) {
            bake.part(boxG(T, 0.92, 1.95, 0.05), '#5f5c58', F, lx, 0.05, lz + 1.02);
            var car = new T.Mesh(new T.PlaneGeometry(0.78, 1.85), lit); car.position.set(lx, 1.0, lz + 1.035); lh.add(car);
            var halves = [-1, 1].map(function (s) { return ctx.box(lh, 0.4, 1.86, 0.04, steel, lx + s * 0.2, 0.06, lz + 1.07); });
            S.lifts.push({ lx: lx, halves: halves, ph: i * 5.3 });
          });
          bake.part(boxG(T, 0.1, 0.24, 0.04), '#3a3a3a', F, 2.6, 1.15, lz + 1.05);
        }

        // ---------- stone chess table and stools ----------
        var tableAt = new T.Vector3(3.1, 0, 1.15);
        if (!lo) {
          bake.part(cylG(T, 0.55, 0.55, 0.08, 12), '#c2bbad', F, tableAt.x, 0.68, tableAt.z);
          bake.part(cylG(T, 0.18, 0.26, 0.68, 8), '#b3ac9e', F, tableAt.x, 0, tableAt.z);
          for (var ci = 0; ci < 4; ci++) { var ca = ci * Math.PI / 2 + 0.6; bake.part(cylG(T, 0.17, 0.21, 0.42, 8), '#b3ac9e', F, tableAt.x + Math.cos(ca) * 0.9, 0, tableAt.z + Math.sin(ca) * 0.9); }
          for (var cx = 0; cx < 4; cx++) for (var cy = 0; cy < 4; cy++) if ((cx + cy) % 2) bake.part(boxG(T, 0.14, 0.01, 0.14), '#5f564a', F, tableAt.x - 0.21 + cx * 0.14, 0.76, tableAt.z - 0.21 + cy * 0.14);
        }

        // ---------- the letterbox wall (click target) with HIS box ----------
        var WF = new T.Matrix4().makeRotationY(WALL.ry).setPosition(WALL.x - BLK.x, 0.02, WALL.z - BLK.z).premultiply(F);   // in the block's frame: stands level on its floor
        var wallG = holderAt(WF);
        var wallInner = new T.Group(); wallG.add(wallInner);
        wallInner.userData.clickable = 'letterbox';
        var LW = WALL.cols * WALL.dw + 0.24, LH = WALL.rows * WALL.dh + 0.3, L0 = 0.25;
        var wb = new Baker(T, X);
        wb.part(boxG(T, LW, LH + L0, 0.42), '#6c7885', null, 0, 0, 0);                               // the cabinet
        wb.part(boxG(T, LW + 0.08, 0.08, 0.5), '#4e5864', null, 0, LH + L0, 0);
        function doorPos(c, r) { return [-LW / 2 + 0.12 + (c + 0.5) * WALL.dw, L0 + 0.15 + (r + 0.5) * WALL.dh]; }
        for (var c = 0; c < WALL.cols; c++) for (var r = 0; r < WALL.rows; r++) {
          if (c === TEDD.c && r === TEDD.r) continue;
          var dp = doorPos(c, r);
          wb.part(boxG(T, WALL.dw - 0.05, WALL.dh - 0.05, 0.03), (c + r) % 3 ? '#a7b0b9' : '#9ea8b2', null, dp[0], dp[1] - (WALL.dh - 0.05) / 2, 0.22);
          wb.part(boxG(T, WALL.dw * 0.45, 0.035, 0.012), '#2c3138', null, dp[0], dp[1] + 0.06, 0.24);
        }
        var wallMesh = wb.mesh(vcol); wallInner.add(wallMesh);
        // his door: the flap clacks; a nameplate reading "Tedd" (the only text in 3D)
        var td = doorPos(TEDD.c, TEDD.r);
        var flapPivot = new T.Group(); flapPivot.position.set(td[0], td[1] + (WALL.dh - 0.05) / 2, 0.235); wallInner.add(flapPivot);
        var flapG = new T.BoxGeometry(WALL.dw - 0.05, WALL.dh - 0.05, 0.03); flapG.translate(0, -(WALL.dh - 0.05) / 2, 0);
        var flap = new T.Mesh(flapG, ctx.mat('#c9d1d8')); flapPivot.add(flap);
        var slot = ctx.box(flapPivot, WALL.dw * 0.5, 0.04, 0.012, '#1d2228', 0, -0.13, 0.02);
        var cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
        var g2 = cv.getContext('2d');
        g2.fillStyle = '#f4f2ec'; g2.fillRect(0, 0, 256, 96);
        g2.fillStyle = '#141414'; g2.font = '700 64px Archivo, "Helvetica Neue", Arial, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
        g2.fillText('Tedd', 128, 52);
        var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; S.own.push(tex);
        var plateM = new T.MeshBasicMaterial({ map: tex }); plateM.toneMapped = false; S.own.push(plateM);
        var plate = new T.Mesh(new T.PlaneGeometry(0.34, 0.13), plateM); plate.position.set(0, -0.06, 0.02); flapPivot.add(plate);
        S.flap = flapPivot;
        // a bigger invisible hit box so the target is easy to tap
        var hitM = new T.MeshBasicMaterial({ visible: false }); S.own.push(hitM);
        var hit = new T.Mesh(new T.BoxGeometry(LW + 1.4, LH + L0 + 1.6, 1.2), hitM);
        hit.position.y = (LH + L0) / 2; hit.userData.noBounds = true; wallInner.add(hit);
        S.wall = wallInner;
        S.slotPt = new T.Vector3(td[0], td[1] - 0.13, 0.3).applyMatrix4(WF);
        S.slotIn = new T.Vector3(td[0], td[1] - 0.13, 0.0).applyMatrix4(WF);
        // where YOU stands to post, and which way he faces then
        S.postSpot = new T.Vector3(td[0] + 0.5, 0, 0.62).applyMatrix4(WF);
        S.postRy = WALL.ry + Math.atan2(-0.5, -0.62);

        // ---------- the envelope (in his hand; clickable too) ----------
        var env = new T.Group(); root.add(env);
        env.userData.clickable = 'letterbox';
        var envBody = new T.Group(); env.add(envBody);
        ctx.box(envBody, 0.36, 0.24, 0.025, basic('#f4f2ec'), 0, -0.12, 0);
        var fl1 = ctx.box(envBody, 0.22, 0.022, 0.03, '#b9b3a8', -0.08, -0.03, 0.005); fl1.rotation.z = -0.55;
        var fl2 = ctx.box(envBody, 0.22, 0.022, 0.03, '#b9b3a8', 0.08, -0.03, 0.005); fl2.rotation.z = 0.55;
        var envHitM = new T.MeshBasicMaterial({ visible: false }); S.own.push(envHitM);
        var envHit = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 0.6), envHitM); envHit.position.y = -0.12; envHit.userData.noBounds = true; env.add(envHit);
        S.env = env; S.envBody = envBody;

        // ---------- corridor lights and TV-light windows (instanced, flat colours) ----------
        if (S.panes.length) {
          var paneM = basic('#ffffff');
          var pm = ctx.instanced(new T.PlaneGeometry(lo ? 0.55 : 0.5, lo ? 0.45 : 0.46), paneM, S.panes.length);
          pm.castShadow = false;
          S.panes.forEach(function (p, i) { TMP.m4.makeTranslation(p.x, p.y, p.z).premultiply(F); pm.setMatrixAt(i, TMP.m4); pm.setColorAt(i, TMP.col.set('#1b2230')); });
          pm.instanceMatrix.needsUpdate = true; root.add(pm);
          S.paneMesh = pm; S.paneLast = new Int8Array(S.panes.length).fill(-1);
        }
        if (S.lamps.length) {
          var lm = ctx.instanced(new T.BoxGeometry(0.22, 0.06, 0.08), basic('#ffffff'), S.lamps.length);
          lm.castShadow = false;
          S.lamps.forEach(function (p, i) { TMP.m4.makeTranslation(p.x, p.y, p.z).premultiply(F); lm.setMatrixAt(i, TMP.m4); lm.setColorAt(i, TMP.col.set('#ffe2a0')); });
          lm.instanceMatrix.needsUpdate = true; root.add(lm);
          S.lampMesh = lm; S.lampLast = new Int8Array(S.lamps.length).fill(-1);
        }
        S.cols = ['#1b2230', '#ffd98a', '#3b7bff', '#29d3c7', '#ff9a4a', '#6b5cff', '#e8f0ff', '#ffe2a0', '#3a4152'].map(function (c) { return new T.Color(c); });

        // ---------- street lamps by the road (flat bright heads) ----------
        if (!lo) [-5.0, 5.0].forEach(function (lx2) {
          var LF = frameAt(lx2, ROADZ - 1.4, -Math.PI / 2, 0);
          bake.part(cylG(T, 0.06, 0.08, 2.7, 6), '#5c6168', LF, 0, 0, 0);
          bake.part(boxG(T, 0.75, 0.07, 0.09), '#5c6168', LF, 0.32, 2.65, 0);
          var head = new T.Mesh(boxG(T, 0.38, 0.09, 0.2), basic('#fff1c8')); head.applyMatrix4(new T.Matrix4().makeTranslation(0.6, 2.56, 0).premultiply(LF)); root.add(head);
        });
        // rain trees at the sides, dark at night
        S.trees = [];
        (lo ? [] : [[-7.4, 1.2, 1.0], [7.0, 0.8, 0.95], [-6.6, 3.8, 0.8]]).forEach(function (tp, k) {
          var TF = frameAt(tp[0], tp[1], k, 0), sk = tp[2];
          bake.part(cylG(T, 0.1 * sk, 0.15 * sk, 1.6 * sk, 6), '#4a3b30', TF, 0, 0, 0);
          var cb = new Baker(T, X);
          for (var i = 0; i < 4; i++) cb.part(new T.IcosahedronGeometry(0.8 * sk, 0), ['#2f5a36', '#376640', '#2a5030'][(i + k) % 3], null, Math.cos(i * 2.1) * 0.6 * sk, 1.65 * sk + (i % 2) * 0.22 * sk, Math.sin(i * 2.1) * 0.6 * sk, 0, i, 0, 1.35, 0.6, 1.2);
          var g = holderAt(TF), sw = new T.Group(); g.add(sw); sw.add(cb.mesh(vcol));
          S.trees.push({ g: sw, ph: k * 1.9 });
        });

        // ---------- the pigeon (high tier) ----------
        if (!lo) {
          var pig = new T.Group(); root.add(pig);
          var pb = new Baker(T, X);
          pb.part(new T.IcosahedronGeometry(0.17, 0), '#8f96a3', null, 0, 0.17, 0, 0, 0, 0, 0.85, 0.8, 1.35);
          pb.part(boxG(T, 0.12, 0.05, 0.2), '#6f7684', null, 0, 0.18, -0.24, -0.3);
          pb.part(cylG(T, 0.012, 0.012, 0.1, 4), '#d0705a', null, -0.05, 0, 0.02); pb.part(cylG(T, 0.012, 0.012, 0.1, 4), '#d0705a', null, 0.05, 0, 0.02);
          pig.add(pb.mesh(vcol));
          var neck = new T.Group(); neck.position.set(0, 0.24, 0.16); pig.add(neck);
          var hb = new Baker(T, X);
          hb.part(new T.IcosahedronGeometry(0.075, 0), '#7c8391', null, 0, 0.06, 0.04);
          hb.part(boxG(T, 0.05, 0.03, 0.06), '#5b8f78', null, 0, -0.02, -0.02);
          hb.part(boxG(T, 0.03, 0.025, 0.07), '#e6c8a0', null, 0, 0.04, 0.13);
          neck.add(hb.mesh(vcol));
          pig.scale.setScalar(1.6);
          S.pig = { g: pig, neck: neck, home: new T.Vector3(1.0, 0, 1.3).applyMatrix4(F) };
        }

        // ---------- the double-decker (high tier): generic livery, no logo ----------
        if (!lo) {
          var bus = new T.Group(); root.add(bus);
          var bb = new Baker(T, X), BL = 4.4;
          bb.part(boxG(T, BL, 1.05, 1.15), '#e9e4d6', null, 0, 0.25, 0);
          bb.part(boxG(T, BL, 0.95, 1.15), '#e9e4d6', null, 0, 1.3, 0);
          bb.part(boxG(T, BL + 0.02, 0.18, 1.17), '#2a8f84', null, 0, 1.12, 0);                       // a band
          bb.part(boxG(T, BL - 0.1, 0.06, 1.1), '#cfc8b8', null, 0, 2.25, 0);
          [[-1, 0.66], [1, 0.66]].forEach(function (s) {
            bb.part(boxG(T, BL - 0.6, 0.5, 0.02), '#20263a', null, -0.15, 0.62, s[0] * 0.585);
            bb.part(boxG(T, BL - 0.3, 0.5, 0.02), '#20263a', null, 0, 1.55, s[0] * 0.585);
          });
          bb.part(boxG(T, 0.02, 0.62, 1.0), '#20263a', null, BL / 2 + 0.005, 0.55, 0);
          bb.part(boxG(T, 0.02, 0.55, 1.0), '#20263a', null, BL / 2 + 0.005, 1.5, 0);
          [-1.4, 1.3].forEach(function (wx2) { [-1, 1].forEach(function (s) { bb.part(cylG(T, 0.27, 0.27, 0.16, 10), '#1d1d1d', null, wx2, 0.0, s * 0.56, Math.PI / 2, 0, 0); }); });
          bus.add(bb.mesh(vcol));
          // lit windows inside: flat bright strips on both decks
          var busLit = basic('#ffe9b0');
          [-1, 1].forEach(function (s) {
            var lo1 = new T.Mesh(new T.PlaneGeometry(BL - 0.8, 0.36), busLit); lo1.position.set(-0.15, 0.87, s * 0.598); if (s < 0) lo1.rotation.y = Math.PI; bus.add(lo1);
            var up1 = new T.Mesh(new T.PlaneGeometry(BL - 0.5, 0.36), busLit); up1.position.set(0, 1.8, s * 0.598); if (s < 0) up1.rotation.y = Math.PI; bus.add(up1);
          });
          var hl = new T.Mesh(new T.BoxGeometry(0.04, 0.12, 0.9), basic('#fff6dc')); hl.position.set(BL / 2 + 0.02, 0.36, 0); bus.add(hl);
          S.bus = { g: bus };
        }

        // ---------- rain for the typhoon ----------
        var NR = lo ? 50 : 110;
        var rain = ctx.instanced(new T.BoxGeometry(0.03, 0.9, 0.03), basic('#8fa3b8'), NR);
        rain.castShadow = false; rain.visible = false; root.add(rain);
        S.rain = { mesh: rain, n: NR, d: [] };
        for (var rI = 0; rI < NR; rI++) S.rain.d.push([-10 + ctx.rand() * 22, ctx.rand() * 13, -7 + ctx.rand() * 13]);

        // ---------- street-level detail: bins, a notice board, potted plants, a parked bicycle, drains, a stop sign shape ----------
        function bin(lx, lz) { bake.part(cylG(T, 0.2, 0.17, 0.62, 8), '#2f6d4c', F, lx, 0.02, lz); bake.part(cylG(T, 0.22, 0.22, 0.06, 8), '#245a3e', F, lx, 0.64, lz); }
        bin(1.35, 2.05); bin(-4.15, 2.05);
        if (!lo) {
          var nbz = -d / 2 + 0.22;
          bake.part(boxG(T, 1.7, 1.05, 0.05), '#6b4a30', F, -1.6, 0.95, nbz);
          ['#fff7c2', '#ffd6d6', '#d6ecff', '#ffffff', '#e0ffd6', '#fff7c2'].forEach(function (c, i) { bake.part(boxG(T, 0.38, 0.4, 0.02), c, F, -2.2 + (i % 3) * 0.55, 1.03 + Math.floor(i / 3) * 0.48, nbz + 0.04); });
          [[4.25, 1.55], [-4.3, 0.9], [0.45, 1.6]].forEach(function (pp2, i) {
            bake.part(cylG(T, 0.2, 0.15, 0.36, 8), '#8a5a3b', F, pp2[0], 0.02, pp2[1]);
            bake.part(new T.IcosahedronGeometry(0.3, 0), i % 2 ? '#3f7f3a' : '#4f8f45', F, pp2[0], 0.62, pp2[1], 0, i, 0, 1, 1.2, 1);
          });
          var bk = new T.Matrix4().makeRotationY(0.25).setPosition(-3.2, 0.02, -1.0).premultiply(F);         // a parked bicycle
          [-0.42, 0.42].forEach(function (wx2) { bake.part(new T.TorusGeometry(0.28, 0.03, 4, 12), '#1d1d1d', bk, wx2, 0.3, 0); });
          bake.part(boxG(T, 0.84, 0.04, 0.04), '#2f6fbf', bk, 0, 0.5, 0); bake.part(boxG(T, 0.04, 0.42, 0.04), '#2f6fbf', bk, -0.08, 0.3, 0, 0, 0, 0.35);
          bake.part(boxG(T, 0.22, 0.05, 0.08), '#1d1d1d', bk, -0.12, 0.72, 0); bake.part(boxG(T, 0.04, 0.05, 0.4), '#9aa0a6', bk, 0.38, 0.78, 0);
          for (var dxx = -6; dxx <= 6; dxx += 2.4) bake.part(boxG(T, 0.42, 0.02, 0.24), '#2b2e33', frameAt(dxx, ROADZ - 0.82, 0, 0.06), 0, 0, 0);   // drain covers
          var SP = frameAt(3.4, ROADZ - 1.35, 0, 0);                                                    // a plain stop pole, no text
          bake.part(cylG(T, 0.04, 0.04, 2.3, 6), '#7d838a', SP, 0, 0, 0);
          bake.part(boxG(T, 0.5, 0.36, 0.04), '#2a8f84', SP, 0, 2.05, 0); bake.part(boxG(T, 0.5, 0.08, 0.05), '#e9e4d6', SP, 0, 2.18, 0);
        }
        root.add(bake.mesh(vcol));

        // the page tells us when the email was copied
        S.onCopied = function () { if (S) trigger(S.ctx, true); };
        window.addEventListener('site:copied', S.onCopied);

        ctx.you.place(WAIT[0], WAIT[1], WAIT[2]);
        setHud(ctx, 'open');
        S.ctx = ctx;
        setQ(ctx.quality);
        return root;
      },

      update: function (t, dt, ctx) {
        if (!S) return;
        var T = S.T, still = ctx.reduced, m4 = TMP.m4, qI = TMP.q, pV = TMP.p, sV = TMP.s;
        var gG = S.mode === 'gravity' ? 1 : 0, gT = S.mode === 'typhoon' ? 1 : 0, gS = S.mode === 'stop' ? 1 : 0;
        if (still) { S.kG = gG; S.kT = gT; S.kS = gS; }
        else { S.kG = ease(S.kG, gG, dt, 0.5); S.kT = ease(S.kT, gT, dt, 0.35); S.kS = ease(S.kS, gS, dt, gS ? 0.25 : 0.6); }
        if (S.mode === 'stop') S.stopT += dt; else if (S.kS < 0.01) S.stopT = 0;
        var kG = S.kG, kT = S.kT, kS = S.kS, slide = kS * (1 - Math.exp(-S.stopT * 2.4));
        var mine = ctx.dive > 0.02;

        // ---- arrival: wave once; leaving cancels a post
        if (ctx.arrived && !S.arrived) { S.arrived = true; if (!still) { try { if (window.WORLD && window.WORLD.wave) window.WORLD.wave(); } catch (e) { /* fine */ } } }
        if (!ctx.arrived && S.arrived) { S.arrived = false; S.post = null; S.queued = false; }

        // ---- HUD: "Open for internships", or what just happened for 3 s
        var key = S.hudUntil > t ? S.hudKey : 'open';
        if (key !== S.lastHud && ctx.dive > 0.3) setHud(ctx, key);

        // ---- TV windows (flat colours that switch, now and then a quick flicker) and corridor lights
        if (S.paneMesh) {
          var PN = S.paneMesh, ch = false, tt = still ? 3 : t;
          for (var i = 0; i < S.panes.length; i++) {
            var hs = hash(i * 3.7 + 2), idx;
            if (hs < 0.3) idx = 0;                                                      // dark
            else if (hs < 0.5) idx = 1;                                                 // a warm room
            else {
              var per = 1.6 + hash(i + 11) * 2.6, n = Math.floor(tt / per + hash(i + 5) * 7);
              idx = 2 + Math.floor(hash(i * 17 + n * 3.3) * 5);                         // a TV: blue, teal, orange, violet, white
              if (!still && ((tt / per + hash(i + 5) * 7) % 1) > 0.94) idx = 6;         // a cut: a flash of white
            }
            if (kT > 0.5 && hash(i + 9) < 0.7) idx = 0;                                 // the storm: power goes on many floors
            if (idx !== S.paneLast[i]) { S.paneLast[i] = idx; PN.setColorAt(i, S.cols[idx]); ch = true; }
          }
          if (ch) PN.instanceColor.needsUpdate = true;
        }
        if (S.lampMesh) {
          var LM = S.lampMesh, ch2 = false;
          for (var j = 0; j < S.lamps.length; j++) {
            var lp = S.lamps[j], on = 1;
            // motion-sensor corridor lights: a floor's run goes dark for a while, then someone walks by
            var cyc = 9 + hash(lp.f + 1) * 7, u = ((still ? 0 : t) / cyc + hash(lp.f + 3)) % 1;
            if (hash(lp.f * 5 + 1) > 0.45 && u > 0.55 && u < 0.85) on = 0;
            if (kT > 0.5 && hash(j + 2) < 0.5) on = 0;
            var li = on ? 7 : 8;
            if (li !== S.lampLast[j]) { S.lampLast[j] = li; LM.setColorAt(j, S.cols[li]); ch2 = true; }
          }
          if (ch2) LM.instanceColor.needsUpdate = true;
        }
        // ---- one tube light flickers now and then
        if (S.flickTube) {
          var fc = (still ? 0 : t) % 7.3, off = fc > 5.6 && fc < 6.3 && Math.sin(fc * 53) > -0.2;
          if (kT > 0.3 && Math.sin(t * 31) > 0.3) off = true;
          var want = off ? S.tubeMats.off : S.tubeMats.on;
          if (S.flickTube.material !== want) S.flickTube.material = want;
        }

        // ---- lift doors open once in a while
        for (var li2 = 0; li2 < S.lifts.length; li2++) {
          var L = S.lifts[li2], lc = still ? 0 : (t + L.ph) % 11;
          var op = smooth(2.0, 2.7, lc) * (1 - smooth(6.0, 6.7, lc));
          L.halves[0].position.x = L.lx - 0.2 - 0.36 * op; L.halves[1].position.x = L.lx + 0.2 + 0.36 * op;
        }

        // ---- trees sway (gently; lean in the typhoon)
        for (var ti = 0; ti < S.trees.length; ti++) {
          var tr = S.trees[ti];
          tr.g.rotation.z = still ? 0 : 0.035 * Math.sin(t * 0.9 + tr.ph) + kT * (0.3 + 0.1 * Math.sin(t * 6 + tr.ph));
          tr.g.position.y = kG * (0.6 + 0.2 * Math.sin(t * 0.8 + tr.ph));
        }

        // ---- the pigeon: walks a little loop near the chess table, pecking
        if (S.pig && !S.lo) {
          var PG = S.pig, pc = still ? 1.0 : t % 12, walkA = still ? 0.6 : (Math.floor(pc / 3) + smooth(0, 1.4, pc % 3)) * 1.1;
          var px = PG.home.x + Math.cos(walkA) * 0.7 + slide * 2.4, pz = PG.home.z + Math.sin(walkA) * 0.45;
          var walking = !still && (pc % 3) < 1.4;
          placeOnGround(px, pz, -walkA + Math.PI, 0.06 + kG * (1.4 + 0.3 * Math.sin(t)) + (walking ? Math.abs(Math.sin(t * 14)) * 0.02 : 0), kG * Math.sin(t * 0.7), kT * 0.3);
          PG.g.position.copy(pV); PG.g.quaternion.copy(qI);
          var peck = walking || still ? 0 : Math.max(0, Math.sin(t * 9)) * 0.9;
          PG.neck.rotation.x = peck + (walking ? 0.15 * Math.sin(t * 14) : 0);
          PG.g.visible = kT < 0.6;
        }

        // ---- the bus passes now and then
        if (S.bus && !S.lo) {
          var bc = still ? -1 : t % 15, B = S.bus;
          var bx = bc < 0 ? 0 : -11 + bc * 3.2;
          B.g.visible = !still && bx > -8.6 && bx < 8.6 && kT < 0.9;
          if (B.g.visible) {
            var bs = smooth(8.5, 7.0, Math.abs(bx));
            placeOnGround(bx + slide * 3, ROADZ + 0.15, Math.PI / 2 - Math.PI / 2, kG * 1.4, 0, kT * 0.04 + kG * 0.3 * Math.sin(t * 0.5));
            B.g.position.copy(pV); B.g.quaternion.copy(qI); B.g.scale.setScalar(Math.max(0.001, bs * 0.72));
            if (bx > -3 && !S.busSfx) { S.busSfx = true; sfx('engine'); }
          }
          if (bx < -9) S.busSfx = false;
        }

        // ---- YOU: waits with the envelope; posts it when asked
        var P = S.post, envPos = TMP.v, envRy = 0, envS = 1, envVis = true;
        var tx = WAIT[0], tz = WAIT[1], tRy = WAIT[2];
        if (P) {
          P.t += dt; var pt = still ? 9 : P.t;
          if (pt < 0.55) { tx = S.postSpot.x; tz = S.postSpot.z; tRy = S.postRy; }
          else if (pt < 1.9) { tx = S.postSpot.x; tz = S.postSpot.z; tRy = S.postRy; }
          if (pt >= 0.55 && !P.picked) { P.picked = true; if (!still) ctx.you.play('PickUp'); }
          // the envelope: hand -> slot front -> in
          if (pt >= 0.7 && pt < 1.5) { var k1 = smooth(0.7, 1.15, pt), k2 = smooth(1.15, 1.45, pt); handPos(envPos); envPos.lerp(S.slotPt, k1).lerp(S.slotIn, k2); envRy = WALL.ry; envS = 1 - k2 * 0.8; P.inFlight = true; }
          else if (pt >= 1.5) envVis = false;
          // the flap: up as it goes in, then the clack
          var fl = pt < 1.05 ? 0 : pt < 1.45 ? smooth(1.05, 1.25, pt) : 1 - smooth(1.45, 1.55, pt);
          S.flap.rotation.x = -0.9 * fl + (pt > 1.55 && pt < 1.8 ? 0.08 * Math.sin((pt - 1.55) * 60) * (1.8 - pt) * 4 : 0);
          if (pt >= 1.5 && !P.clacked) { P.clacked = true; sfx('drop'); }
          if (pt >= POST) { S.post = null; S.envBack = t; S.flap.rotation.x = 0; if (S.queued) { S.queued = false; startPost(ctx); } }
        } else if (!still) {
          // his own letterbox wiggles a little now and then (it is clickable)
          var wg = t % 5;
          S.flap.rotation.x = wg < 0.5 ? -0.12 * Math.sin(wg * Math.PI * 2) * (1 - wg * 2) : 0;
        }
        if (mine) {
          var walkGo = !still && !S.mode && kS < 0.05;
          var ddx = tx - S.px, ddz = tz - S.pz, dl = Math.hypot(ddx, ddz);
          if (dl > 0.04 && walkGo) {
            var st2 = Math.min(dl, dt * 1.6);
            S.px += ddx / dl * st2; S.pz += ddz / dl * st2;
            S.ry = Math.atan2(ddx, ddz);
            if (!S.walking && dl > 0.2) { S.walking = true; ctx.you.play('Walk', { loop: true }); }
          } else {
            if (still || S.mode || !walkGo) { S.px = tx; S.pz = tz; }
            if (S.walking) { S.walking = false; ctx.you.play('Idle', { loop: true }); }
            S.ry = still ? tRy : angEase(S.ry, tRy, dt, 0.18);
          }
          ctx.you.place(S.px, S.pz, S.ry);
          if (P && P.t > 0.4 && P.t < 1.6) ctx.you.lookAt(S.slotPt.x, S.slotPt.y, S.slotPt.z); else ctx.you.lookAt(null);
          if (kG > 0.02) ctx.you.offset(0, kG * (1.4 + 0.2 * Math.sin(t * 0.9)), 0, kG * 0.2 * Math.sin(t * 0.7), kG * 0.25 * Math.sin(t * 0.5 + 1));
          else if (kT > 0.02) ctx.you.offset(0, 0, 0, 0, kT * 0.22);
          else if (kS > 0.02 || S.stopT > 0) ctx.you.offset(slide * 2.6, 0, 0, 0, 0);
          else ctx.you.offset(0, 0, 0, 0, 0);
        }
        // the envelope in his hand (or on its way in); a fresh one pops in after a post
        var E = S.env;
        if (!(P && P.inFlight && envVis && P.t < 1.5)) { handPos(envPos); envRy = S.ry + Math.PI / 2; }
        var pop = still ? 1 : smooth(0, 0.35, t - S.envBack);
        E.visible = envVis && pop > 0.01;
        E.position.copy(envPos);
        if (kG > 0.02 && !P) E.position.y += kG * (1.4 + 0.2 * Math.sin(t * 0.9));
        placeOrient(E, envPos.x, envPos.z, envRy);
        var bob = still || P ? 0 : 0.025 * Math.sin(t * 2.6);
        S.envBody.position.y = bob;
        E.scale.setScalar(Math.max(0.01, envS * pop * (P && P.t < 0.7 ? 1 : 1)));
        if (P) P.inFlight = false;

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
        var o = ev.hit.object, ok = false;
        while (o) { if (o === S.wall || o === S.env) { ok = true; break; } o = o.parent; }
        if (!ok) return false;
        trigger(ctx, false);
        return true;
      },

      whatIf: function (mode, ctx) {
        if (!S) return false;
        var was = S.mode;
        S.mode = mode; S.post = null; S.queued = false; S.walking = false; S.flap.rotation.x = 0;
        if (mode === 'gravity') ctx.you.play('Float', { loop: true });
        else if (mode === 'typhoon') ctx.you.play('Walk', { loop: true });
        else if (mode === 'stop') { ctx.you.play('Idle'); ctx.you.play('Roll', { then: 'StandUp' }); S.stopT = 0; }
        else { ctx.you.play('Idle'); if (was === 'gravity') ctx.you.play('Jump'); }
        return true;
      },

      setQuality: function (q) { setQ(q); },

      dispose: function () {
        if (!S) return;
        window.removeEventListener('site:copied', S.onCopied);
        S.own.forEach(function (m) { try { m.dispose(); } catch (e) { /* gone */ } });
        S = null; TMP = null;
      }
    });

    function setQ(q) {
      if (!S) return;
      S.lo = q === 'low';
      if (S.bus && S.lo) S.bus.g.visible = false;
      if (S.pig) S.pig.g.visible = !S.lo;
    }

    function setHud(ctx, key) {
      S.lastHud = key;
      if (key === 'copied') ctx.hud({ left: { value: 'Copied', caption: 'the email address' } });
      else if (key === 'posted') ctx.hud({ left: { value: 'Posted', caption: 'one letter' } });
      else ctx.hud({ left: { value: 'Open', caption: 'for internships' } });
    }

    // a post was asked for: from the page (copied) or a click. Never more than one waiting.
    function trigger(ctx, copied) {
      S.hudKey = copied ? 'copied' : (S.hudKey === 'copied' && S.hudUntil > ctx.time ? 'copied' : 'posted');
      S.hudUntil = ctx.time + 3;
      if (ctx.dive > 0.3) setHud(ctx, S.hudKey);
      if (S.mode || !S.arrived) return;
      if (S.post) { S.queued = true; return; }
      startPost(ctx);
    }
    function startPost(ctx) {
      S.post = { t: ctx.reduced ? 9 : 0, picked: false, clacked: false };
      if (ctx.reduced) { S.post = null; S.envBack = ctx.time; sfx('drop'); }
    }

    // his right hand, roughly, from where he stands (arms hang in Idle)
    function handPos(out) {
      var c = Math.cos(S.ry), s = Math.sin(S.ry), lx = -0.37, lz = 0.04;
      var x = S.px + lx * c + lz * s, z = S.pz - lx * s + lz * c;
      out.set(x, S.ctx.groundY(x, z) + 0.78, z);
      return out;
    }
    function placeOrient(obj, x, z, ry) {
      var up = TMP.up, gy = S.ctx.groundY(x, z);
      up.set(x, gy + 14, z).normalize();
      obj.quaternion.setFromUnitVectors(TMP.Y, up).multiply(TMP.q2.setFromAxisAngle(TMP.Y, ry));
    }
    function placeOnGround(x, z, hd, lift, rx, rz) {
      var ctx = S.ctx, up = TMP.up, q = TMP.q, q2 = TMP.q2;
      var gy = ctx.groundY(x, z);
      up.set(x, gy + 14, z).normalize();
      q.setFromUnitVectors(TMP.Y, up).multiply(q2.setFromAxisAngle(TMP.Y, hd));
      if (rx) q.multiply(q2.setFromAxisAngle(TMP.Xa, rx));
      if (rz) q.multiply(q2.setFromAxisAngle(TMP.Za, rz));
      TMP.p.set(x + up.x * lift, gy + up.y * lift, z + up.z * lift);
    }
    function angEase(a, b, dt, tau) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * (1 - Math.exp(-dt / tau)); }
  }
  if (window.WORLD) go(); else window.addEventListener('DOMContentLoaded', go);
})();
