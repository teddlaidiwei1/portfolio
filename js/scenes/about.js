/* scenes/about.js: the About stop, the race route (scene builder B, v3).
   A race road curving across the place under the flat yellow field: red and white race barriers with a small crowd and
   a grandstand with a chequered banner (he has worked as event crew at an F1 event; no F1 or sponsor marks), three
   Supertrees (Gardens by the Bay, where he has also worked), a strip of blue water with a small plain island, a pier and
   a ferry (usher in the Kusu Island pilgrimage season; the island stays plain), a water station, and the finish chute
   with the arch. The only words in 3D: the roadside board `21.1 km` and `42.195 km` on the arch (the page's finish line).
   YOU runs the route as the visitor scrolls (site:beat p for 'about'; a slow loop of his own if no beat arrives), snaps
   the tape at p 0.85 and plays Victory. Toys: press and hold anywhere to pace him; click the crowd for a wave.
   Scene units: YOU is 1.8 tall. See briefs/world-api.md and briefs/scene-builders-v3.md. */
(function () {
  'use strict';
  function go() {
    var W = window.WORLD;
    if (!W || !W.registerScene) return;

    var S = null, TMP = null;

    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function ease(k, goal, dt, tau) { return k + (goal - k) * (1 - Math.exp(-dt / tau)); }
    function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
    function sfx(n) { try { if (window.SFX && window.SFX.play) window.SFX.play(n); } catch (e) { /* no sound layer */ } }
    function noHit() { /* not a pointer target */ }
    function lcg(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

    // ---------- a baker: static parts merged into one mesh with vertex colours ----------
    function Baker(T, X) { this.T = T; this.X = X; this.list = []; this.m = new T.Matrix4(); this.o = new T.Object3D(); }
    Baker.prototype.add = function (geo, color, matrix) {
      var T = this.T, g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (g.attributes.uv) g.deleteAttribute('uv');
      if (g.attributes.uv1) g.deleteAttribute('uv1');
      if (matrix) g.applyMatrix4(matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) {
        var c = new T.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
        for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
        g.setAttribute('color', new T.BufferAttribute(arr, 3));
      }
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

    // ---------- a curve sampled by length, for cheap lookups every frame ----------
    function lut(T, pts, n) {
      var c = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], 0, p[1]); }), false, 'centripetal');
      var L = c.getLength(), o = { n: n, L: L, x: new Float32Array(n + 1), z: new Float32Array(n + 1), tx: new Float32Array(n + 1), tz: new Float32Array(n + 1) };
      var p = new T.Vector3(), t = new T.Vector3();
      for (var i = 0; i <= n; i++) {
        c.getPointAt(i / n, p); c.getTangentAt(clamp(i / n, 0.0005, 0.9995), t);
        o.x[i] = p.x; o.z[i] = p.z; var tl = Math.hypot(t.x, t.z) || 1; o.tx[i] = t.x / tl; o.tz[i] = t.z / tl;
      }
      return o;
    }
    function nearestS(l, x, z) {
      var best = 1e9, bs = 0;
      for (var i = 0; i <= l.n; i++) { var d = (l.x[i] - x) * (l.x[i] - x) + (l.z[i] - z) * (l.z[i] - z); if (d < best) { best = d; bs = i; } }
      return bs / l.n * l.L;
    }
    function at(l, s, out) {
      var f = clamp(s / l.L, 0, 1) * l.n, i = Math.min(l.n - 1, Math.floor(f)), k = f - i;
      out.x = l.x[i] + (l.x[i + 1] - l.x[i]) * k; out.z = l.z[i] + (l.z[i + 1] - l.z[i]) * k;
      out.tx = l.tx[i] + (l.tx[i + 1] - l.tx[i]) * k; out.tz = l.tz[i] + (l.tz[i + 1] - l.tz[i]) * k;
      return out;
    }

    // the routes
    var ROAD = [[-9.8, -1.6], [-6.6, 0.45], [-3.2, 1.45], [0.4, 1.65], [3.4, 0.95], [6.4, -0.45], [9.8, -2.2]];
    var CHUTE = [[1.6, 1.62], [2.9, 2.45], [3.5, 3.6], [3.7, 5.0]];
    var YOU = [[-5.9, 1.3], [-4.6, 1.68], [-3.2, 1.95], [0.2, 2.15], [1.9, 2.15], [2.95, 2.75], [3.48, 3.6], [3.66, 4.8]];
    var ARCH = [3.5, 3.62];
    var SHIRTS = ['#ffffff', '#7fc8e8', '#FF8A5B', '#9aa0a6', '#E8412B', '#3b4a70', '#f2ebdd', '#2a9d8f'];
    var SKINS = ['#e0ac85', '#c68a62', '#8d5a3b', '#f1c9a5', '#b07850'];
    var PANTS = ['#2f3b5c', '#3a3a3a', '#1f1f24', '#5a626c'];

    // ---------- instanced people: one InstancedMesh per body part; per-person colours ----------
    function People(ctx, n, parent) {
      var T = ctx.THREE;
      function part(w, h, d, top) { var g = new T.BoxGeometry(w, h, d); g.translate(0, top ? -h / 2 : h / 2, 0); return g; }
      var white = ctx.mat('#ffffff');
      this.n = n;
      this.legL = ctx.instanced(part(0.15, 0.8, 0.17, true), white, n);
      this.legR = ctx.instanced(part(0.15, 0.8, 0.17, true), white, n);
      this.torso = ctx.instanced(part(0.44, 0.62, 0.25, false), white, n);
      this.armL = ctx.instanced(part(0.1, 0.56, 0.11, true), white, n);
      this.armR = ctx.instanced(part(0.1, 0.56, 0.11, true), white, n);
      this.head = ctx.instanced(part(0.25, 0.25, 0.25, false), white, n);
      this.hair = ctx.instanced(part(0.27, 0.08, 0.27, false), ctx.mat('#1e1a18'), n);
      this.all = [this.legL, this.legR, this.torso, this.armL, this.armR, this.head, this.hair];
      this.all.forEach(function (m) { m.castShadow = true; m.raycast = noHit; parent.add(m); });
      this.B = new T.Matrix4(); this.Mt = new T.Matrix4(); this.L = new T.Matrix4(); this.R = new T.Matrix4(); this.e = new T.Euler(); this.o = new T.Object3D();
      this.hand = new T.Vector3(); this.zero = new T.Matrix4().makeScale(0, 0, 0);
      this.c = new T.Color();
    }
    People.prototype.colors = function (i, shirt, pants, skin) {
      var c = this.c;
      this.torso.setColorAt(i, c.set(shirt));
      this.legL.setColorAt(i, c.set(pants)); this.legR.setColorAt(i, c);
      this.armL.setColorAt(i, c.set(skin)); this.armR.setColorAt(i, c); this.head.setColorAt(i, c);
    };
    // base: this.o already planted (position + facing); p = {legL, legR, armLx, armLz, armRx, armRz, lean, seat}
    People.prototype.set = function (i, p) {
      var o = this.o; o.updateMatrix();
      var B = this.B.copy(o.matrix), L = this.L, R = this.R, e = this.e, Mt = this.Mt;
      var hipY = p.seat ? 0.45 : 0.8;
      // legs hang from the hips (forward when seated)
      L.makeRotationFromEuler(e.set(p.legL, 0, 0)); L.setPosition(-0.11, hipY, 0); this.legL.setMatrixAt(i, R.multiplyMatrices(B, L));
      L.makeRotationFromEuler(e.set(p.legR, 0, 0)); L.setPosition(0.11, hipY, 0); this.legR.setMatrixAt(i, R.multiplyMatrices(B, L));
      // torso leans about the hips; arms, head and hair ride on it
      L.makeRotationFromEuler(e.set(p.lean, 0, 0)); L.setPosition(0, hipY, 0); Mt.multiplyMatrices(B, L);
      this.torso.setMatrixAt(i, Mt);
      L.makeRotationFromEuler(e.set(p.armLx, 0, p.armLz)); L.setPosition(-0.28, 0.58, 0); this.armL.setMatrixAt(i, R.multiplyMatrices(Mt, L));
      L.makeRotationFromEuler(e.set(p.armRx, 0, p.armRz)); L.setPosition(0.28, 0.58, 0); R.multiplyMatrices(Mt, L); this.armR.setMatrixAt(i, R);
      this.hand.set(0, -0.58, 0.04).applyMatrix4(R);
      L.makeTranslation(0, 0.64, 0); this.head.setMatrixAt(i, R.multiplyMatrices(Mt, L));
      L.makeTranslation(0, 0.88, 0); this.hair.setMatrixAt(i, R.multiplyMatrices(Mt, L));
    };
    People.prototype.hide = function (i) { for (var k = 0; k < 7; k++) this.all[k].setMatrixAt(i, this.zero); };
    People.prototype.done = function () {
      for (var k = 0; k < 7; k++) { this.all[k].instanceMatrix.needsUpdate = true; if (this.all[k].instanceColor) this.all[k].instanceColor.needsUpdate = true; }
    };

    // ---------- canvas text (the only words in 3D) ----------
    function textTex(T, txt, w, h, fg, bg, size) {
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      function draw() {
        var g = cv.getContext('2d');
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '900 ' + size + 'px Archivo, "Arial Black", Arial, sans-serif';
        g.fillText(txt, w / 2, h / 2 + size * 0.04);
        tex.needsUpdate = true;
      }
      draw();
      try { if (document.fonts && document.fonts.load) document.fonts.load('900 ' + size + 'px Archivo').then(function (f) { if (f && f.length) draw(); }, function () {}); } catch (e) { /* fine */ }
      return tex;
    }

    W.registerScene('about', {
      // street-level camera shots in scene space, in step with the scroll beat p (YOU's run uses the same p):
      // low on the road behind him at the start; beside him by the water station and the 21.1 km board; past the
      // grandstand crowd; at the turn into the finish chute; low in front of the arch as he breaks the tape (p 0.85)
      shots: [
        { pos: [-8.4, -0.55, 1.5], look: [-4.4, 0.4, 1.4], fov: 55, p: 0 },
        { pos: [-4.9, -0.6, 5.6], look: [-3.0, 0.9, 1.0], fov: 55, p: 0.25 },
        { pos: [-2.4, 0.4, 4.9], look: [-1.0, 1.2, -2.8], fov: 55, p: 0.5 },
        { pos: [5.5, 0.15, 5.6], look: [2.8, 0.9, 2.5], fov: 55, p: 0.75 },
        { pos: [4.1, -1.15, 8.0], look: [3.5, 1.4, 3.5], fov: 55, p: 1 }
      ],
      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, P = ctx.palette, lo = ctx.quality === 'low';
        var root = new T.Group();
        root.userData.clickable = 'pace';
        TMP = { m4: new T.Matrix4(), q: new T.Quaternion(), p: new T.Vector3(), s: new T.Vector3(), v: new T.Vector3(), z: new T.Vector3(0, 0, 1),
          a: { x: 0, z: 0, tx: 0, tz: 0 }, b: { x: 0, z: 0, tx: 0, tz: 0 } };
        S = { root: root, T: T, ctx: ctx, mats: [], texs: [], lo: lo, mode: null, kG: 0, kT: 0, kS: 0, stopT: 0, lt: 0,
          pace: 0, hold: false, gotBeat: false, beatP: 0, arrivedAt: -1, s: 0, ry: Math.PI / 2, clip: '', snapped: false, snapT: -99,
          tieT: -99, loopPh: 'rest', loopT: 0, waveP: 0, bigWave: -99, jumpT: -99, hiOnly: [], listeners: [] };
        var vcol = ctx.mat('#ffffff', { vertexColors: true });
        function basic(color, o) { var m = new T.MeshBasicMaterial({ color: color }); m.toneMapped = false; if (o) for (var k in o) m[k] = o[k]; S.mats.push(m); return m; }
        var bake = new Baker(T, X);
        var dummy = new T.Object3D();
        function frameAt(x, z, ry, dy) { ctx.plant(dummy, x, z, ry); dummy.position.y += dy || 0; dummy.updateMatrix(); return dummy.matrix.clone(); }

        S.road = lut(T, ROAD, 240); S.chute = lut(T, CHUTE, 80); S.path = lut(T, YOU, 300);
        // where the tape is along YOU's route
        var best = 1e9, sTape = 0;
        for (var i = 0; i <= S.path.n; i++) { var dd = Math.hypot(S.path.x[i] - ARCH[0], S.path.z[i] - ARCH[1]); if (dd < best) { best = dd; sTape = i / S.path.n * S.path.L; } }
        S.sTape = sTape; S.sEnd = sTape + 0.45;

        // ---------- ground: grass on the curve, the water strip sunk into it ----------
        var WAT = { cx: -6.4, cz: -2.95, rx: 2.7, rz: 1.55 };
        function inW(x, z) { var a = (x - WAT.cx) / WAT.rx, b = (z - WAT.cz) / WAT.rz; return a * a + b * b; }
        S.WAT = WAT;
        var RINGS = lo ? 14 : 22, SEG = lo ? 36 : 56, RMAX = 10.2;
        var cap = new T.BufferGeometry(), pos = [], cols = [];
        var cG = new T.Color('#3f8a4a'), cG2 = new T.Color('#46924f'), cBed = new T.Color('#1f6f8c'), cShore = new T.Color('#b9b08a');
        function vtx(r, a) {
          var x = r * Math.cos(a), z = r * Math.sin(a), y = ctx.groundY(x, z) + 0.02, e = inW(x, z);
          if (e < 1) y -= 0.22 * smooth(1, 0.8, e);
          return [x, y, z];
        }
        function zone(x, z) {
          var e = inW(x, z);
          if (e < 0.98) return cBed;
          if (e < 1.18) return cShore;
          var h = Math.sin(Math.floor(x * 0.9) * 12.99 + Math.floor(z * 0.9) * 78.23) * 43758.5; h -= Math.floor(h);
          return h > 0.72 ? cG2 : cG;
        }
        for (var ri = 0; ri < RINGS; ri++) {
          var r0 = RMAX * ri / RINGS, r1 = RMAX * (ri + 1) / RINGS;
          for (var si = 0; si < SEG; si++) {
            var a0 = si / SEG * Math.PI * 2, a1 = (si + 1) / SEG * Math.PI * 2;
            var p00 = vtx(r0, a0), p01 = vtx(r0, a1), p10 = vtx(r1, a0), p11 = vtx(r1, a1);
            var tris = ri === 0 ? [[p00, p11, p10]] : [[p00, p11, p10], [p00, p01, p11]];
            for (var tk = 0; tk < tris.length; tk++) {
              var tr = tris[tk], c = zone((tr[0][0] + tr[1][0] + tr[2][0]) / 3, (tr[0][2] + tr[1][2] + tr[2][2]) / 3);
              for (var pk = 0; pk < 3; pk++) { pos.push(tr[pk][0], tr[pk][1], tr[pk][2]); cols.push(c.r, c.g, c.b); }
            }
          }
        }
        cap.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        cap.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
        cap.computeVertexNormals();
        var capMesh = new T.Mesh(cap, vcol); capMesh.receiveShadow = true; root.add(capMesh);

        // the water sheet (moves; rises in the typhoon)
        var WR = lo ? 5 : 8, WS = lo ? 20 : 32, wpos = [], wbase = [];
        for (var wi = 0; wi < WR; wi++) for (var wj = 0; wj < WS; wj++) {
          var q = [[wi, wj], [wi + 1, wj + 1], [wi + 1, wj], [wi, wj], [wi, wj + 1], [wi + 1, wj + 1]];
          for (var qi = 0; qi < (wi === 0 ? 3 : 6); qi++) {
            var rr = q[qi][0] / WR * 0.99, aa = q[qi][1] / WS * Math.PI * 2;
            var wx = WAT.cx + WAT.rx * rr * Math.cos(aa), wz = WAT.cz + WAT.rz * rr * Math.sin(aa);
            wbase.push(wx, ctx.groundY(wx, wz) - 0.03, wz); wpos.push(wx, 0, wz);
          }
        }
        var wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wpos, 3));
        var water = new T.Mesh(wg, ctx.mat('#2a8fb8', { roughness: 0.35, metalness: 0.05 }));
        water.userData.noBounds = true; water.raycast = noHit; root.add(water);
        S.water = { pos: wg.attributes.position, base: new Float32Array(wbase) };

        // ---------- the road and the finish chute, draped on the curve ----------
        function strip(l, w, dy, color, s0, s1, off) {
          // several columns across, so a wide strip follows the curve and never dips under the ground
          var g = new T.BufferGeometry(), ps = [], N = Math.max(4, Math.round((s1 - s0) / 0.25)), A = TMP.a, B = TMP.b, M = Math.max(1, Math.ceil(w / 0.45));
          var y = function (x, z) { return ctx.groundY(x, z) + dy; };
          for (var k = 0; k < N; k++) {
            at(l, s0 + (s1 - s0) * k / N, A); at(l, s0 + (s1 - s0) * (k + 1) / N, B);
            for (var m = 0; m < M; m++) {
              var o0 = (off || 0) - w / 2 + w * m / M, o1 = (off || 0) - w / 2 + w * (m + 1) / M;
              var ax0 = A.x - A.tz * o0, az0 = A.z + A.tx * o0, ax1 = A.x - A.tz * o1, az1 = A.z + A.tx * o1;
              var bx0 = B.x - B.tz * o0, bz0 = B.z + B.tx * o0, bx1 = B.x - B.tz * o1, bz1 = B.z + B.tx * o1;
              ps.push(ax0, y(ax0, az0), az0, bx1, y(bx1, bz1), bz1, ax1, y(ax1, az1), az1, ax0, y(ax0, az0), az0, bx0, y(bx0, bz0), bz0, bx1, y(bx1, bz1), bz1);
            }
          }
          g.setAttribute('position', new T.Float32BufferAttribute(ps, 3));
          g.computeVertexNormals();
          // keep the side that faces up
          var nrm = g.attributes.normal; if (nrm.getY(0) < 0) { for (var j = 0; j < ps.length; j += 9) { var t0 = [ps[j + 3], ps[j + 4], ps[j + 5]]; ps[j + 3] = ps[j + 6]; ps[j + 4] = ps[j + 7]; ps[j + 5] = ps[j + 8]; ps[j + 6] = t0[0]; ps[j + 7] = t0[1]; ps[j + 8] = t0[2]; } g.setAttribute('position', new T.Float32BufferAttribute(ps, 3)); g.computeVertexNormals(); }
          bake.add(g, color, null);
        }
        var RW = 2.3;
        strip(S.road, RW, 0.035, '#55595f', 0, S.road.L);
        strip(S.road, 0.07, 0.045, '#f3f1ea', 0, S.road.L, RW / 2 - 0.14);
        strip(S.road, 0.07, 0.045, '#f3f1ea', 0, S.road.L, -RW / 2 + 0.14);
        strip(S.chute, 2.1, 0.05, '#4d5157', 0, S.chute.L);
        strip(S.chute, 0.07, 0.06, '#f3f1ea', 0.6, S.chute.L, 0.93);
        strip(S.chute, 0.07, 0.06, '#f3f1ea', 0.6, S.chute.L, -0.93);
        // the dashed centre line, kerb blocks on the near edge, cones
        for (var dsh = 0.6; dsh < S.road.L - 0.6; dsh += 1.3) strip(S.road, 0.08, 0.045, '#e9e4c8', dsh, dsh + 0.6, 0);
        for (var kb = 0.3, kk = 0; kb < S.road.L - 0.3; kb += 0.7, kk++) {
          var Ak = at(S.road, kb, TMP.a), ko = RW / 2 + 0.08;
          bake.part(boxG(T, 0.16, 0.1, 0.66), kk % 2 ? '#e8e6df' : '#d8352a', frameAt(Ak.x - Ak.tz * ko, Ak.z + Ak.tx * ko, Math.atan2(Ak.tx, Ak.tz), -0.02), 0, 0, 0);
        }
        var coneG = (function () { var a = new T.ConeGeometry(0.13, 0.42, 8); a.translate(0, 0.27, 0); var b2 = new T.BoxGeometry(0.3, 0.06, 0.3); b2.translate(0, 0.03, 0); return X.mergeGeometries([a.toNonIndexed(), b2.toNonIndexed()], false); })();
        var nCones = lo ? 0 : 10, cones = nCones ? ctx.instanced(coneG, ctx.mat('#ff7a2e'), nCones) : null;
        if (cones) {
          cones.raycast = noHit; root.add(cones);
          var co2 = new T.Object3D();
          for (var cn = 0; cn < nCones; cn++) {
            var Ac = at(S.road, S.road.L * (0.32 + cn * 0.055), TMP.a), cof = RW / 2 + 0.45;
            ctx.plant(co2, Ac.x - Ac.tz * cof, Ac.z + Ac.tx * cof, cn); co2.updateMatrix(); cones.setMatrixAt(cn, co2.matrix);
          }
          cones.instanceMatrix.needsUpdate = true;
        }
        // the start line, and a chequered finish line under the arch
        var A0 = at(S.road, nearestS(S.road, S.path.x[0], S.path.z[0]), TMP.a);
        bake.part(boxG(T, RW - 0.1, 0.02, 0.22), '#f3f1ea', frameAt(A0.x, A0.z, Math.atan2(A0.tx, A0.tz), 0.05), 0, 0, 0);
        var archRy = (function () { var A2 = at(S.path, S.sTape, TMP.a); return Math.atan2(A2.tx, A2.tz); })();
        S.archRy = archRy;
        var archF = frameAt(ARCH[0], ARCH[1], archRy, 0);
        for (var ck = 0; ck < 8; ck++) for (var cr = 0; cr < 2; cr++) bake.part(boxG(T, 0.25, 0.02, 0.18), (ck + cr) % 2 ? '#141414' : '#f3f1ea', archF, -0.875 + ck * 0.25, 0.06, -0.09 + cr * 0.18);

        // ---------- race barriers (red and white blocks) along the back edge, and along the chute ----------
        var bar = function (l, s0, s1, off, step) {
          for (var s = s0, k = 0; s < s1; s += step, k++) {
            var A3 = at(l, s, TMP.a), bx = A3.x - A3.tz * off, bz = A3.z + A3.tx * off;
            var bfr = frameAt(bx, bz, Math.atan2(A3.tx, A3.tz), 0);
            bake.part(boxG(T, 0.32, 0.62, step - 0.06), k % 2 ? '#f3f1ea' : '#d8352a', bfr, 0, -0.08, 0);
            bake.part(boxG(T, 0.36, 0.06, step - 0.04), '#9b9b9b', bfr, 0, 0.54, 0);
            // feet across the block, and the clip that joins it to the next one
            bake.part(boxG(T, 0.62, 0.07, 0.12), '#55595f', bfr, 0, -0.02, -step / 2 + 0.14);
            bake.part(boxG(T, 0.62, 0.07, 0.12), '#55595f', bfr, 0, -0.02, step / 2 - 0.14);
            bake.part(boxG(T, 0.1, 0.12, 0.12), '#3a3a3a', bfr, 0, 0.36, step / 2 - 0.02);
          }
        };
        var sB0 = S.road.L * 0.27, sB1 = S.road.L * 0.6;
        bar(S.road, sB0, sB1, -RW / 2 - 0.3, 0.9);
        bar(S.chute, 0.9, S.chute.L - 0.3, 1.35, 0.8);
        bar(S.chute, 1.4, S.chute.L - 0.3, -1.35, 0.8);

        // ---------- the grandstand: tiers, a back wall, a roof on posts with a chequered banner ----------
        var gsF = frameAt(-1.3, -3.55, 0, 0);
        var GW = 5.6;
        for (var tI = 0; tI < 4; tI++) {
          // the tiers go down into the ground, so the ends never float off the curve
          bake.part(boxG(T, GW, 0.42 * (tI + 1) + 0.45, 0.6), tI % 2 ? '#3b4a70' : '#2f3b5c', gsF, 0, -0.45, 0.9 - tI * 0.6);
          bake.part(boxG(T, GW, 0.05, 0.12), '#c7ccd6', gsF, 0, 0.42 * (tI + 1), 1.14 - tI * 0.6);
          // a row of seats on every tier, and aisle steps at both ends
          if (!lo) for (var se = 0; se < 11; se++) {
            var sx2 = -GW / 2 + 0.55 + se * 0.45;
            bake.part(boxG(T, 0.36, 0.1, 0.32), '#7fc8e8', gsF, sx2, 0.42 * (tI + 1), 0.86 - tI * 0.6);
            bake.part(boxG(T, 0.36, 0.3, 0.06), '#6ab3d4', gsF, sx2, 0.42 * (tI + 1), 0.72 - tI * 0.6);
          }
          [-1, 1].forEach(function (s) { bake.part(boxG(T, 0.4, 0.21, 0.3), '#c7ccd6', gsF, s * (GW / 2 - 0.25), 0.42 * (tI + 1), 1.05 - tI * 0.6); });
        }
        // a front rail
        bake.part(boxG(T, GW, 0.05, 0.05), '#c7ccd6', gsF, 0, 1.3, 1.17);
        for (var rp = -GW / 2 + 0.2; rp <= GW / 2; rp += 0.9) bake.part(boxG(T, 0.05, 0.88, 0.05), '#c7ccd6', gsF, rp, 0.42, 1.17);
        bake.part(boxG(T, GW + 0.2, 3.05, 0.2), '#27304a', gsF, 0, -0.45, -1.6);
        [-1, 1].forEach(function (s) { bake.part(boxG(T, 0.2, 3.05, 2.9), '#27304a', gsF, s * (GW / 2 + 0.1), -0.45, -0.25); });
        [-GW / 2 + 0.1, 0, GW / 2 - 0.1].forEach(function (px) { bake.part(boxG(T, 0.1, 3.0, 0.1), '#5c6370', gsF, px, 0, 1.15); });
        bake.part(boxG(T, GW + 0.5, 0.14, 2.9), '#e9e6df', gsF, 0, 3.0, -0.25, -0.08, 0, 0);
        var chk = (function () {
          var cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; var g = cv.getContext('2d');
          for (var x = 0; x < 32; x++) for (var y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#141414' : '#ffffff'; g.fillRect(x * 8, y * 8, 8, 8); }
          var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.magFilter = T.NearestFilter; tx.minFilter = T.LinearFilter; tx.generateMipmaps = false;
          S.texs.push(tx); return tx;
        })();
        var gsH = new T.Group(); gsH.matrixAutoUpdate = false; gsH.matrix.copy(gsF); root.add(gsH);
        var banner = new T.Mesh(new T.PlaneGeometry(GW + 0.5, 0.62), basic('#ffffff', { map: chk }));
        banner.position.set(0, 2.72, 1.37); gsH.add(banner);

        // ---------- three Supertrees: warm grey trunks, pink and orange crowns that turn slowly ----------
        S.trees = [];
        [[4.6, -3.7, 7.2, '#ff7fa6', '#f0668f'], [6.6, -2.5, 5.8, '#ff9a55', '#f08440'], [2.8, -5.1, 6.4, '#ff7fa6', '#f0668f']].forEach(function (d, k) {
          var tg = new T.Group(); ctx.plant(tg, d[0], d[1], k); root.add(tg);
          var bend = new T.Group(); tg.add(bend);
          var trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.3, d[2], lo ? 5 : 8), ctx.mat('#8a7d72'));
          trunk.position.y = d[2] / 2; trunk.castShadow = true; bend.add(trunk);
          var crown = new T.Group(); crown.position.y = d[2] * 0.97; bend.add(crown);
          var NSg = lo ? 6 : 12, cg = new T.CylinderGeometry(d[2] * 0.32, 0.14, d[2] * 0.22, NSg, 1, true).toNonIndexed();
          // alternate the crown's faces between two shades, so its slow turn reads
          var cc = [], c1 = new T.Color(d[3]), c2 = new T.Color(d[4]), np = cg.attributes.position.count;
          for (var vi = 0; vi < np; vi++) { var seg = Math.floor(vi / 6), cl = seg % 2 ? c2 : c1; cc.push(cl.r, cl.g, cl.b); }
          cg.setAttribute('color', new T.Float32BufferAttribute(cc, 3)); cg.translate(0, d[2] * 0.11, 0);
          // flat colour (unlit), so the crowns read pink and orange from any side, even seen from below
          var cmM = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }); cmM.toneMapped = false; S.mats.push(cmM);
          var cm = new T.Mesh(cg, cmM); cm.castShadow = true; crown.add(cm);
          if (!lo) for (var br = 0; br < 6; br++) {
            var arm = new T.Mesh(new T.BoxGeometry(0.06, d[2] * 0.26, 0.06), ctx.mat('#8a7d72'));
            var ba = br / 6 * Math.PI * 2; arm.position.set(Math.cos(ba) * d[2] * 0.14, d[2] * 0.08, Math.sin(ba) * d[2] * 0.14);
            arm.rotation.set(Math.sin(ba) * 0.75, 0, -Math.cos(ba) * 0.75); crown.add(arm);
          }
          S.trees.push({ g: bend, crown: crown, ph: k * 1.7, h: d[2] });
        });

        // ---------- the island (plain), the pier and the ferry ----------
        var isF = frameAt(-7.7, -3.25, 0, -0.22);
        bake.part(new T.CylinderGeometry(0.95, 1.15, 0.3, lo ? 7 : 10), '#d9cc9c', isF, 0, 0.1, 0);
        bake.part(new T.IcosahedronGeometry(0.85, lo ? 0 : 1), '#4f9a45', isF, 0, 0.25, 0, 0, 0, 0, 1, 0.42, 0.9);
        bake.part(new T.IcosahedronGeometry(0.42, 0), '#3e8a3c', isF, 0.25, 0.55, -0.15, 0, 0, 0, 1, 0.9, 1);
        bake.part(new T.IcosahedronGeometry(0.32, 0), '#3e8a3c', isF, -0.35, 0.45, 0.2);
        var prA = [-4.75, -1.15], prB = [-5.05, -2.75], prRy = Math.atan2(prB[0] - prA[0], prB[1] - prA[1]);
        for (var pi = 0; pi < 5; pi++) {
          var px2 = prA[0] + (prB[0] - prA[0]) * pi / 4, pz2 = prA[1] + (prB[1] - prA[1]) * pi / 4;
          var pf = frameAt(px2, pz2, prRy, -0.25);
          for (var pl = 0; pl < 4; pl++) bake.part(boxG(T, 0.7, 0.06, 0.1), pl % 2 ? '#8a6a4a' : '#7d5f42', pf, 0, 0.3, -0.165 + pl * 0.11);
          bake.part(boxG(T, 0.08, 0.6, 0.08), '#5d4632', pf, 0.33, -0.3, 0); bake.part(boxG(T, 0.08, 0.6, 0.08), '#5d4632', pf, -0.33, -0.3, 0);
          if (pi === 4 || pi === 2) [-1, 1].forEach(function (s) { bake.part(new T.CylinderGeometry(0.06, 0.07, 0.2, 7), '#3a3a3a', pf, s * 0.28, 0.36, 0); bake.part(new T.CylinderGeometry(0.08, 0.08, 0.04, 7), '#3a3a3a', pf, s * 0.28, 0.54, 0); });
        }
        if (!lo) {
          var ferry = new T.Group(); root.add(ferry);
          var fin = new T.Group(); ferry.add(fin);
          var fb = new Baker(T, X);
          fb.part(boxG(T, 0.62, 0.26, 1.5), '#f2efe8', null, 0, 0, 0);
          fb.part(boxG(T, 0.64, 0.08, 1.52), '#2f6fa8', null, 0, 0.06, 0);
          fb.part(new T.CylinderGeometry(0.01, 0.31, 0.5, 4), '#f2efe8', null, 0, 0.13, -0.95, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.52);
          fb.part(boxG(T, 0.5, 0.32, 0.72), '#ffffff', null, 0, 0.26, 0.15);
          fb.part(boxG(T, 0.52, 0.1, 0.62), '#1d2a38', null, 0, 0.4, 0.15);
          fb.part(boxG(T, 0.58, 0.05, 0.8), '#c9473a', null, 0, 0.58, 0.15);
          fb.part(boxG(T, 0.04, 0.4, 0.04), '#3a3a3a', null, 0, 0.6, 0.3);
          var fm = fb.mesh(vcol); fin.add(fm);
          S.ferry = { g: ferry, inner: fin };
          S.hiOnly.push(ferry);
        }

        // ---------- lamp posts on the far side of the road ----------
        [0.08, 0.36, 0.63, 0.8, 0.95].forEach(function (f) {
          var A4 = at(S.road, f * S.road.L, TMP.a), off = -RW / 2 - 0.95;
          var lf = frameAt(A4.x - A4.tz * off, A4.z + A4.tx * off, Math.atan2(A4.tx, A4.tz), 0);
          bake.part(new T.CylinderGeometry(0.06, 0.08, 3.6, 6), '#3d4248', lf, 0, 1.8, 0);
          bake.part(boxG(T, 0.75, 0.07, 0.08), '#3d4248', lf, -0.32, 3.55, 0, 0, 0, 0);
          bake.part(boxG(T, 0.32, 0.1, 0.18), '#e8e4d8', lf, -0.65, 3.47, 0);
        });

        // ---------- the 21.1 km board, on the far side where YOU passes at p 0.4 ----------
        var sBoard = S.sTape * (0.4 / 0.85), A5 = at(S.path, sBoard, TMP.a), boff = -1.75;
        var bdx = A5.x - A5.tz * boff, bdz = A5.z + A5.tx * boff;
        var bdF = frameAt(bdx, bdz, 0, 0);
        bake.part(boxG(T, 0.08, 1.4, 0.08), '#3d4248', bdF, -0.62, 0, 0); bake.part(boxG(T, 0.08, 1.4, 0.08), '#3d4248', bdF, 0.62, 0, 0);
        bake.part(boxG(T, 1.62, 0.72, 0.08), '#141414', bdF, 0, 1.25, -0.02);
        var bdH = new T.Group(); bdH.matrixAutoUpdate = false; bdH.matrix.copy(bdF); root.add(bdH);
        var t211 = textTex(T, '21.1 km', 512, 224, '#141414', '#ffffff', 132); S.texs.push(t211);
        var b211 = new T.Mesh(new T.PlaneGeometry(1.52, 0.66), basic('#ffffff', { map: t211 })); b211.position.set(0, 1.61, 0.03); bdH.add(b211);

        // ---------- the finish arch, the tape, flags and bunting ----------
        var archH = new T.Group(); archH.matrixAutoUpdate = false; archH.matrix.copy(archF); root.add(archH);
        S.archH = archH;
        // the arch: two truss legs (four posts, rungs, braces) on ballast blocks, the banner across the top
        var ab = new Baker(T, X);
        [-1, 1].forEach(function (s) {
          var lx = s * 1.75;
          [[-0.18, -0.2], [0.18, -0.2], [-0.18, 0.2], [0.18, 0.2]].forEach(function (c5) { ab.part(boxG(T, 0.07, 3.45, 0.07), '#d8352a', null, lx + c5[0], -0.3, c5[1]); });
          for (var ru = 0.1; ru < 3.1; ru += lo ? 0.9 : 0.45) {
            ab.part(boxG(T, 0.4, 0.04, 0.04), '#f3f1ea', null, lx, ru, 0.2); ab.part(boxG(T, 0.4, 0.04, 0.04), '#f3f1ea', null, lx, ru, -0.2);
            ab.part(boxG(T, 0.04, 0.04, 0.4), '#f3f1ea', null, lx + 0.18, ru, 0); ab.part(boxG(T, 0.04, 0.04, 0.4), '#f3f1ea', null, lx - 0.18, ru, 0);
            if (!lo) { ab.part(boxG(T, 0.03, 0.5, 0.03), '#b82c22', null, lx, ru, 0.2, 0, 0, 0.68); ab.part(boxG(T, 0.03, 0.5, 0.03), '#b82c22', null, lx, ru, -0.2, 0, 0, -0.68); }
          }
          ab.part(boxG(T, 0.75, 0.32, 0.8), '#55595f', null, lx, -0.3, 0);
          ab.part(boxG(T, 0.8, 0.04, 0.85), '#3a3a3a', null, lx, 0.02, 0);
        });
        ab.part(boxG(T, 4.2, 1.0, 0.4), '#141414', null, 0, 3.15, 0);
        ab.part(boxG(T, 4.3, 0.06, 0.5), '#2a2a2a', null, 0, 4.15, 0);
        archH.add(ab.mesh(vcol));
        var t42 = textTex(T, '42.195 km', 1024, 240, '#ffffff', '#141414', 172); S.texs.push(t42);
        var bm = basic('#ffffff', { map: t42 });
        var tf = new T.Mesh(new T.PlaneGeometry(3.9, 0.92), bm); tf.position.set(0, 3.65, 0.205); archH.add(tf);
        var tb = new T.Mesh(new T.PlaneGeometry(3.9, 0.92), bm); tb.position.set(0, 3.65, -0.205); tb.rotation.y = Math.PI; archH.add(tb);
        // flags on top
        S.flags = [];
        [-1.75, 0, 1.75].forEach(function (fx, k) {
          ctx.box(archH, 0.035, 0.75, 0.035, ctx.mat('#2a2a2a'), fx, 4.15, 0);
          var fg = new T.Group(); fg.position.set(fx + 0.02, 4.83, 0); archH.add(fg);
          var flg = new T.PlaneGeometry(0.56, 0.32, 4, 1); flg.translate(0.28, -0.16, 0);
          var fl = new T.Mesh(flg, ctx.mat(k === 1 ? '#f3f1ea' : '#d8352a', { side: T.DoubleSide })); fg.add(fl);
          S.flags.push({ g: fg, mesh: fl, base: new Float32Array(flg.attributes.position.array), ph: k * 1.9 });
        });
        // bunting: two strings from the arch's top corners down to short poles beside the chute
        var NPen = lo ? 8 : 14, pen = new T.BufferGeometry();
        pen.setAttribute('position', new T.Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.26, 0], 3)); pen.computeVertexNormals();
        var pens = ctx.instanced(pen, ctx.mat('#ffffff', { side: T.DoubleSide }), NPen); pens.raycast = noHit; archH.add(pens);
        var penCols = ['#d8352a', '#f3f1ea', '#7fc8e8', '#141414'], pcol = new T.Color();
        for (var pn = 0; pn < NPen; pn++) pens.setColorAt(pn, pcol.set(penCols[pn % 4]));
        [-1, 1].forEach(function (s) { ctx.box(archH, 0.06, 2.5, 0.06, ctx.mat('#2a2a2a'), s * 3.4, 0, 0); });
        S.pens = { mesh: pens, n: NPen };
        // the tape: two halves tied in the middle; each half swings away from its post when it snaps
        S.tape = [];
        [-1, 1].forEach(function (s) {
          var hg = new T.Group(); hg.position.set(s * 1.52, 1.22, 0); archH.add(hg);
          var g2 = new T.PlaneGeometry(1.54, 0.09, 10, 1); g2.translate(-s * 0.77, 0, 0);
          var m2 = new T.Mesh(g2, ctx.mat('#f6f4ee', { side: T.DoubleSide })); m2.castShadow = true; hg.add(m2);
          S.tape.push({ g: hg, mesh: m2, s: s, base: new Float32Array(g2.attributes.position.array) });
        });

        // ---------- the water station: a table, cups, a volunteer ----------
        if (!lo) {
          var A6 = at(S.road, S.road.L * 0.21, TMP.a), woff = RW / 2 + 0.75;
          var wsx = A6.x - A6.tz * woff, wsz = A6.z + A6.tx * woff, wsRy = Math.atan2(A6.tx, A6.tz);
          var wsF = frameAt(wsx, wsz, wsRy + Math.PI / 2, 0);
          bake.part(boxG(T, 1.7, 0.06, 0.6), '#f3f1ea', wsF, 0, 0.72, 0);
          bake.part(boxG(T, 1.72, 0.5, 0.02), '#2f6fa8', wsF, 0, 0.24, 0.3);
          [[-0.78, -0.25], [0.78, -0.25], [-0.78, 0.25], [0.78, 0.25]].forEach(function (lg) { bake.part(boxG(T, 0.05, 0.72, 0.05), '#9aa0a6', wsF, lg[0], 0, lg[1]); });
          var wsH = new T.Group(); wsH.matrixAutoUpdate = false; wsH.matrix.copy(wsF); root.add(wsH);
          var cupG = new T.CylinderGeometry(0.055, 0.045, 0.13, 6); cupG.translate(0, 0.065, 0);
          var cups = ctx.instanced(cupG, ctx.mat('#ffffff'), 12); cups.raycast = noHit; wsH.add(cups);
          // jugs and a crate under the table; a few cups dropped on the road beside it
          bake.part(new T.CylinderGeometry(0.1, 0.12, 0.3, 8), '#7fc8e8', wsF, 0.62, 0.78, 0.12);
          bake.part(new T.CylinderGeometry(0.1, 0.12, 0.3, 8), '#7fc8e8', wsF, -0.75, 0.78, 0.15);
          bake.part(boxG(T, 0.5, 0.3, 0.36), '#2f6fa8', wsF, -0.3, 0, -0.05);
          for (var dc = 0; dc < 5; dc++) {
            var Ad = at(S.road, S.road.L * 0.21 + 0.6 + dc * 0.45, TMP.b), dof = RW / 2 - 0.25 - (dc % 2) * 0.35;
            bake.part(new T.CylinderGeometry(0.055, 0.045, 0.13, 6), '#ffffff', frameAt(Ad.x - Ad.tz * dof, Ad.z + Ad.tx * dof, dc, 0.08), 0, 0, 0, Math.PI / 2, 0, 0);
          }
          for (var cu = 0; cu < 12; cu++) { ctx.setInstance(cups, cu, -0.65 + (cu % 6) * 0.22, 0.75, -0.12 + Math.floor(cu / 6) * 0.2, 0, 1, 1, 1); cups.setColorAt(cu, pcol.set(cu % 3 ? '#ffffff' : '#7fc8e8')); }
          cups.instanceMatrix.needsUpdate = true;
          var hcup = new T.Mesh(cupG, ctx.mat('#ffffff')); hcup.raycast = noHit; root.add(hcup);
          S.station = { x: wsx, z: wsz, ry: wsRy, cups: cups, hcup: hcup };
          S.hiOnly.push(wsH);
        }

        // ---------- people: runners, the crowd at the barriers and the arch, the grandstand, the volunteer ----------
        var rnd = lcg(19);
        var NR = lo ? 4 : 10, crowd = [], seated = [];
        // standing crowd behind the barriers
        var nStand = lo ? 8 : 15;
        for (var cI = 0; cI < nStand; cI++) {
          var f2 = sB0 + (sB1 - sB0) * (cI + 0.5) / nStand, A7 = at(S.road, f2, TMP.a), co = -RW / 2 - 0.95 - (cI % 2) * 0.42;
          crowd.push({ x: A7.x - A7.tz * co + (rnd() - 0.5) * 0.15, z: A7.z + A7.tx * co, ry: Math.atan2(A7.tz, -A7.tx) + Math.PI });
        }
        // a few at the finish, either side of the chute
        if (!lo) {
          [[1.75, 2.9], [1.6, 3.55], [5.0, 1.95], [5.35, 2.6], [4.9, 2.95], [5.7, 3.35]].forEach(function (c4) {
            crowd.push({ x: c4[0], z: c4[1], ry: c4[0] < 3.5 ? Math.PI / 2 - 0.3 : -Math.PI / 2 - 0.2, fixed: true });
          });
          for (var sI = 0; sI < 12; sI++) {
            var tier = sI % 3, sxp = -2.3 + Math.floor(sI / 3) * 1.45 + (tier % 2) * 0.5;
            seated.push({ lx: sxp, tier: tier });
          }
        }
        // facing the road: turn each standing person toward the road centre point nearest them
        crowd.forEach(function (cw) {
          if (cw.fixed) return;
          var bestS = 0, bd = 1e9;
          for (var k = 0; k <= S.road.n; k += 4) { var d2 = (S.road.x[k] - cw.x) * (S.road.x[k] - cw.x) + (S.road.z[k] - cw.z) * (S.road.z[k] - cw.z); if (d2 < bd) { bd = d2; bestS = k; } }
          cw.ry = Math.atan2(S.road.x[bestS] - cw.x, S.road.z[bestS] - cw.z);
        });
        var NP = NR + crowd.length + seated.length + (lo ? 0 : 1);
        var ppl = new People(ctx, NP, root);
        S.ppl = ppl;
        S.runners = [];
        for (var rI = 0; rI < NR; rI++) {
          S.runners.push({ i: rI, s0: rnd() * S.road.L, v: 2.6 + rnd() * 2.0, lane: rI % 2 ? -0.45 : 0.05, ph: rnd() * 6.28 });
          ppl.colors(rI, SHIRTS[rI % SHIRTS.length], PANTS[rI % PANTS.length], SKINS[(rI * 3) % SKINS.length]);
        }
        S.crowd = [];
        crowd.forEach(function (cw, k) {
          var idx = NR + k; ppl.colors(idx, SHIRTS[(k * 5 + 2) % SHIRTS.length], PANTS[k % PANTS.length], SKINS[(k * 2 + 1) % SKINS.length]);
          S.crowd.push({ i: idx, x: cw.x, z: cw.z, ry: cw.ry, ph: rnd() * 6.28 });
        });
        S.seated = [];
        seated.forEach(function (st, k) {
          var idx = NR + crowd.length + k; ppl.colors(idx, SHIRTS[(k * 3 + 1) % SHIRTS.length], PANTS[k % PANTS.length], SKINS[k % SKINS.length]);
          // in the grandstand's own frame: tier steps up and back
          var lp = new T.Vector3(st.lx, 0.42 * (st.tier + 1), 0.95 - st.tier * 0.6).applyMatrix4(gsF);
          S.seated.push({ i: idx, p: lp, x: st.lx, ph: rnd() * 6.28 });
        });
        S.gsQ = new T.Quaternion().setFromRotationMatrix(gsF);
        if (!lo) { S.vol = NP - 1; ppl.colors(S.vol, '#FF8A5B', '#2f3b5c', '#c68a62'); }
        // the crowd's click target (an invisible box over the barrier crowd and the stand)
        var hitC = new T.Mesh(new T.BoxGeometry(GW + 1.2, 3.4, 4.2), new T.MeshBasicMaterial({ visible: false })); S.mats.push(hitC.material);
        hitC.userData.noBounds = true; hitC.userData.clickable = 'crowd';
        var hcH = new T.Group(); hcH.matrixAutoUpdate = false; hcH.matrix.copy(gsF); hcH.add(hitC); hitC.position.set(0, 1.0, 1.4); root.add(hcH);
        S.hitCrowd = hitC;

        // ---------- rain for the typhoon ----------
        var NRn = lo ? 50 : 110;
        var rain = ctx.instanced(new T.BoxGeometry(0.03, 0.9, 0.03), basic('#4a6b85'), NRn);
        rain.castShadow = false; rain.visible = false; rain.raycast = noHit; root.add(rain);
        S.rain = { mesh: rain, n: NRn, d: [] };
        for (var rr2 = 0; rr2 < NRn; rr2++) S.rain.d.push([-10 + ctx.rand() * 22, ctx.rand() * 13, -7 + ctx.rand() * 13]);

        var stat = bake.mesh(vcol); root.add(stat);

        // ---------- YOU at the start line ----------
        var A8 = at(S.path, 0, TMP.a);
        S.ry = Math.atan2(A8.tx, A8.tz);
        ctx.you.place(A8.x, A8.z, S.ry);
        ctx.hud({ left: { value: '18', caption: 'years old, Year 2 at SP' } });

        // scroll beats from the page
        var onBeat = function (e) { var d = e && e.detail; if (!S || !d || d.stop !== 'about' || typeof d.p !== 'number') return; S.gotBeat = true; S.beatP = clamp(d.p, 0, 1); };
        window.addEventListener('site:beat', onBeat);
        S.listeners.push([window, 'site:beat', onBeat]);
        // the press-and-hold toy listens to the window for the release (the release can land outside the stage)
        var onDownCap = function (e) { if (S) S.pid = e.pointerId; };
        var onUp = function (e) { if (!S || !e.isTrusted) return; endHold(e.clientX, e.clientY); };
        window.addEventListener('pointerdown', onDownCap, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
        S.listeners.push([window, 'pointerdown', onDownCap, true], [window, 'pointerup', onUp, true], [window, 'pointercancel', onUp, true]);
        setQ(ctx.quality);
        return root;
      },

      update: function (t, dt, ctx) {
        if (!S) return;
        S.ctx = ctx;
        var still = ctx.reduced, live = !still && !ctx.frozen;
        var gG = S.mode === 'gravity' ? 1 : 0, gT = S.mode === 'typhoon' ? 1 : 0, gS = S.mode === 'stop' ? 1 : 0;
        if (still) { S.kG = gG; S.kT = gT; S.kS = gS; }
        else { S.kG = ease(S.kG, gG, dt, 0.5); S.kT = ease(S.kT, gT, dt, 0.35); S.kS = ease(S.kS, gS, dt, gS ? 0.25 : 0.6); }
        if (S.mode === 'stop') S.stopT += dt; else if (S.kS < 0.01) S.stopT = 0;
        var kG = S.kG, kT = S.kT, kS = S.kS, slide = kS * (1 - Math.exp(-S.stopT * 2.4));
        // the pace: holding speeds him (and the crowd) up; it settles on release
        S.pace = still ? 0 : ease(S.pace, S.hold ? 1 : 0, dt, S.hold ? 0.25 : 0.6);
        if (live) S.lt += dt;
        var lt = S.lt, pace = S.pace;

        stepYou(t, dt, ctx, kG, kT, kS, slide);

        // ---- crowd waves (a crest runs along the barrier); faster while pacing; a click sends one big wave; the tape makes them jump
        if (live) S.waveP += dt * (1 + 1.4 * pace) * (1 - kS);
        var PP = S.ppl, o = PP.o, crest = -7 + ((S.waveP * 3.2) % 16), big = t - S.bigWave, jump = t - S.jumpT;
        var bigX = -6 + big * 7.5;
        for (var ci = 0; ci < S.crowd.length; ci++) {
          var cw = S.crowd[ci];
          var k = still ? 0 : Math.exp(-Math.pow((cw.x - crest) / 1.1, 2));
          if (big < 2.2) k = Math.max(k, Math.exp(-Math.pow((cw.x - bigX) / 1.2, 2)));
          var jk = jump < 1.8 && !still ? Math.abs(Math.sin(jump * 9 + cw.ph)) * (1 - jump / 1.8) : 0;
          var lift = 0.16 * k * (big < 2.2 ? 1.6 : 1) + 0.28 * jk;
          var arms = still ? 0.25 : 0.25 + 2.5 * Math.max(k, jk > 0 ? 0.9 : 0) + 0.12 * Math.sin(lt * 2 + cw.ph);
          ctx.plant(o, cw.x + slide * (1.6 + (ci % 4) * 0.3), cw.z, cw.ry);
          o.position.y += lift + kG * (1.1 + (ci % 5) * 0.35 + (still ? 0 : 0.2 * Math.sin(lt * 0.8 + ci)));
          if (kG > 0.01) { o.rotateX(kG * 0.6 * Math.sin(lt * 0.5 + ci)); o.rotateZ(kG * 0.5 * Math.cos(lt * 0.4 + ci)); }
          if (kT > 0.01) o.rotateZ(kT * 0.18);
          PP.set(cw.i, { legL: 0, legR: 0, armLx: 0, armLz: -arms, armRx: 0, armRz: arms, lean: 0 });
        }
        for (var sI = 0; sI < S.seated.length; sI++) {
          var st = S.seated[sI], k2 = still ? 0 : Math.exp(-Math.pow((st.x - 1.3 - crest) / 1.2, 2));
          if (big < 2.2) k2 = Math.max(k2, Math.exp(-Math.pow((st.x - 1.3 - bigX) / 1.3, 2)));
          var jk2 = jump < 1.8 && !still ? 0.9 * (1 - jump / 1.8) : 0;
          o.position.copy(st.p); o.quaternion.copy(S.gsQ);
          o.position.x += slide * 1.2; o.position.y += kG * (1.4 + (sI % 3) * 0.4);
          var a2 = 0.2 + 2.4 * Math.max(k2, jk2);
          PP.set(st.i, { legL: -1.45, legR: -1.45, armLx: 0, armLz: -a2, armRx: 0, armRz: a2, lean: 0, seat: true });
        }

        // ---- runners pass along the road (never yellow shirts); they fade in and out at the road's ends
        for (var ri = 0; ri < S.runners.length; ri++) {
          var rn = S.runners[ri], v = rn.v * (1 - kT * 0.6) * (1 - kS);
          if (rn.hidden) { PP.hide(rn.i); continue; }
          var L = S.road.L, sr = ((rn.s0 + lt * v) % L + L) % L, A = at(S.road, sr, TMP.a);
          var edge = smooth(0, 1.2, sr) * smooth(L, L - 1.2, sr);
          var rx = A.x - A.tz * rn.lane + slide * (2 + ri * 0.2), rz = A.z + A.tx * rn.lane;
          var ph = still ? 0.6 : lt * v * 2.9 + rn.ph;
          ctx.plant(o, rx, rz, Math.atan2(A.tx, A.tz));
          o.position.y += (still ? 0 : Math.abs(Math.sin(ph)) * 0.07) + kG * (1.4 + (ri % 4) * 0.5);
          if (kG > 0.01) { o.rotateX(kG * Math.sin(lt * 0.6 + ri) * 0.9); o.rotateZ(kG * 0.4 * Math.cos(lt * 0.45 + ri)); }
          if (kT > 0.01) o.rotateZ(-kT * 0.2);
          o.scale.setScalar(Math.max(0.001, edge));
          var sw = Math.sin(ph);
          PP.set(rn.i, { legL: 0.75 * sw, legR: -0.75 * sw, armLx: -0.65 * sw - 0.2, armLz: -0.08, armRx: 0.65 * sw - 0.2, armRz: 0.08, lean: 0.18 });
          o.scale.setScalar(1);
        }

        // ---- the volunteer hands out a cup every few seconds
        if (S.station && S.vol !== undefined) {
          var stn = S.station, cyc = still ? 0.45 : ((lt % 4.2) / 4.2), reach = smooth(0.15, 0.4, cyc) * (1 - smooth(0.7, 0.9, cyc));
          // stand beside the table's road end, turned to the road (and a little to the camera)
          var sx = stn.x + Math.sin(stn.ry) * 1.15, sz = stn.z + Math.cos(stn.ry) * 1.15;
          ctx.plant(o, sx + slide * 1.5, sz, Math.atan2(Math.cos(stn.ry), -Math.sin(stn.ry)) + 0.7);
          o.position.y += kG * 1.3;
          PP.set(S.vol, { legL: 0, legR: 0, armLx: 0, armLz: -0.1, armRx: -1.35 * reach, armRz: 0.1, lean: 0.04 });
          stn.hcup.visible = cyc > 0.1 && cyc < 0.62;
          stn.hcup.position.copy(PP.hand); stn.hcup.position.y -= 0.06;
          stn.hcup.quaternion.copy(o.quaternion);
        }
        PP.done();

        // ---- the ferry: docks at the pier, crosses to the island and back, bobbing all the while
        if (S.ferry) {
          var F = S.ferry, fc = still ? 0 : (lt % 26) / 26, ax = -5.35, az = -2.75, bx2 = -6.75, bz2 = -2.55;
          var m = fc < 0.3 ? 0 : fc < 0.5 ? smooth(0.3, 0.5, fc) : fc < 0.8 ? 1 : 1 - smooth(0.8, 1.0, fc);
          var fx = ax + (bx2 - ax) * m, fz = az + (bz2 - az) * m - Math.sin(m * Math.PI) * 0.35;
          var head = (fc < 0.55 ? -1 : 1) * Math.PI / 2 + 0.15;
          ctx.plant(F.g, fx + slide * 1.2, fz, head);
          F.g.position.y += -0.2 + (still ? 0 : 0.04 * Math.sin(lt * 1.7)) + kT * 0.18 + kG * (1.4 + 0.2 * Math.sin(lt * 0.7));
          F.inner.rotation.z = still ? 0 : 0.05 * Math.sin(lt * 1.3) + kT * 0.25 * Math.sin(lt * 3.1) + kG * 0.5 * Math.sin(lt * 0.4);
          F.inner.rotation.x = still ? 0 : 0.03 * Math.sin(lt * 1.1 + 1) + kT * 0.18 * Math.sin(lt * 2.3);
        }

        // ---- water
        var wp = S.water.pos.array, wb = S.water.base, amp = 1 + kT * 2.5, rise = kT * 0.16 + kG * 0.1;
        for (var wi = 0; wi < wp.length; wi += 3) {
          var x = wb[wi], z = wb[wi + 2];
          wp[wi] = x; wp[wi + 2] = z;
          wp[wi + 1] = wb[wi + 1] + rise + (still ? 0 : amp * (0.03 * Math.sin(x * 1.6 + lt * 1.2) + 0.025 * Math.sin(z * 2.1 - lt * 1.5)));
        }
        S.water.pos.needsUpdate = true;

        // ---- Supertree crowns turn slowly; lean in the typhoon; float with no gravity
        for (var ti = 0; ti < S.trees.length; ti++) {
          var tr = S.trees[ti];
          tr.crown.rotation.y = still ? 0 : lt * 0.12 * (ti % 2 ? -1 : 1) + tr.ph;
          tr.g.rotation.z = kT * (0.3 + (still ? 0 : 0.08 * Math.sin(lt * 6 + tr.ph)));
          tr.g.position.y = kG * (0.5 + 0.15 * Math.sin(lt * 0.8 + tr.ph));
          tr.g.position.x = slide * 0.6;
        }

        // ---- flags flutter (harder in the typhoon); bunting swings; the tape ripples, snaps, re-ties
        var wind = 1 + kT * 2.2;
        for (var fi = 0; fi < S.flags.length; fi++) {
          var fg = S.flags[fi], fp = fg.mesh.geometry.attributes.position, fa = fp.array, fbse = fg.base;
          for (var vi = 0; vi < fa.length; vi += 3) {
            var u = fbse[vi] / 0.56;
            fa[vi + 2] = still ? 0 : u * 0.09 * wind * Math.sin(lt * 7 * Math.min(wind, 2) + fg.ph - fbse[vi] * 7);
          }
          fp.needsUpdate = true;
          fg.g.rotation.y = still ? 0.2 : 0.25 * Math.sin(lt * 1.3 + fg.ph) * wind;
        }
        var PN = S.pens, half = PN.n / 2;
        for (var pn = 0; pn < PN.n; pn++) {
          var side = pn < half ? -1 : 1, f3 = ((pn % half) + 0.5) / half;
          var px = side * (2.0 + 1.4 * f3), py = 4.1 - 1.6 * f3 - 0.3 * Math.sin(f3 * Math.PI);
          TMP.p.set(px, py, 0.02);
          TMP.q.setFromAxisAngle(TMP.v.set(1, 0, 0), still ? 0.15 : 0.35 * wind * Math.sin(lt * 5 + pn * 0.8));
          TMP.s.set(1, 1, 1);
          PN.mesh.setMatrixAt(pn, TMP.m4.compose(TMP.p, TMP.q, TMP.s));
        }
        PN.mesh.instanceMatrix.needsUpdate = true;
        var snapK = S.snapped ? smooth(0, 0.55, t - S.snapT) : 1 - smooth(0, 0.8, t - S.tieT);
        if (still) snapK = S.snapped ? 1 : 0;
        for (var hI = 0; hI < 2; hI++) {
          var hp = S.tape[hI], ga = hp.mesh.geometry.attributes.position, ar = ga.array, bs = hp.base;
          for (var tv = 0; tv < ar.length; tv += 3) {
            var dd = Math.abs(bs[tv]) / 1.54;
            ar[tv + 2] = still ? 0 : dd * (0.05 + 0.12 * snapK) * wind * Math.sin(lt * 8 + bs[tv] * 6 + hI);
            ar[tv + 1] = bs[tv + 1] - dd * dd * 0.06 * (1 - snapK);
          }
          ga.needsUpdate = true;
          hp.g.rotation.z = hp.s * snapK * 1.25;
          hp.g.rotation.y = hp.s * snapK * 0.9;
        }

        // ---- rain
        var RN = S.rain;
        RN.mesh.visible = kT > 0.02;
        if (RN.mesh.visible) {
          var rq = TMP.q.setFromAxisAngle(TMP.z, -0.45);
          for (var rI = 0; rI < RN.n; rI++) {
            var d = RN.d[rI];
            if (!still) { d[1] -= dt * 14; d[0] -= dt * 6.5; }
            if (d[1] < ctx.groundY(d[0], d[2]) || d[0] < -11) { d[1] = 10 + Math.random() * 3; d[0] = -6 + Math.random() * 17; }
            TMP.p.set(d[0], d[1], d[2]); TMP.s.set(1, kT, 1);
            RN.mesh.setMatrixAt(rI, TMP.m4.compose(TMP.p, rq, TMP.s));
          }
          RN.mesh.instanceMatrix.needsUpdate = true;
        }
      },

      onPointer: function (ev, ctx) {
        if (!S) return false;
        if (ev.type === 'down') {
          S.hold = true; S.down = { x: ev.x, y: ev.y, t: performance.now(), crowd: isCrowd(ev.hit) };
          // world.js would freeze the world after a 0.38 s hold (its "hold the planet still"), which would stop him
          // mid-stride. Here a hold means "pace him", so release world.js's hold right after its own handler has run.
          var pid = S.pid;
          Promise.resolve().then(function () { releaseWorldHold(pid, ev.x, ev.y); });
          return true;
        }
        if (ev.type === 'up') return S.ignoreUp ? true : !!S.down;
        if (ev.type === 'click') { if (isCrowd(ev.hit)) { crowdWave(ctx); return true; } return false; }
        return false;
      },

      whatIf: function (mode, ctx) {
        if (!S) return false;
        var was = S.mode;
        S.mode = mode;
        if (mode === 'gravity') { you(ctx, 'Float', { loop: true }); }
        else if (mode === 'stop') { ctx.you.play('Idle'); ctx.you.play('Roll', { then: 'StandUp' }); S.clip = 'Roll'; S.stopT = 0; S.rollT = ctx.time; }
        else { S.clip = ''; if (was === 'gravity') ctx.you.play('Jump'); }
        return true;
      },

      setQuality: function (q) { setQ(q); },

      dispose: function () {
        if (!S) return;
        S.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        S.texs.forEach(function (tx) { tx.dispose(); });
        S.mats.forEach(function (m) { m.dispose(); });
        S = null; TMP = null;
      }
    });

    function setQ(q) {
      if (!S) return;
      S.lo = q === 'low';
      for (var i = 0; i < S.hiOnly.length; i++) S.hiOnly[i].visible = !S.lo;
      if (S.station) S.station.hcup.visible = !S.lo;
      if (S.runners) { for (var r = 4; r < S.runners.length; r++) S.runners[r].hidden = S.lo; }
    }

    function isCrowd(hit) { var o = hit && hit.object; while (o) { if (o === S.hitCrowd) return true; o = o.parent; } return false; }
    function crowdWave(ctx) { if (ctx.time - S.bigWave > 1.2) { S.bigWave = ctx.time; sfx('clap'); } }

    // the release of world.js's own hold for this pointer (see onPointer 'down'); a synthetic pointercancel for the same
    // pointer id is the only handle the API leaves. Ask: a flag on the scene (or a true return from 'down') that tells
    // world.js not to freeze on a long press in this place; then this function goes.
    function releaseWorldHold(pid, x, y) {
      if (!S || !S.hold || pid === undefined || typeof PointerEvent !== 'function') return;
      S.ignoreUp = true;
      try { window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: pid, clientX: x, clientY: y, bubbles: false })); } catch (e) { /* old browser */ }
      S.ignoreUp = false;
    }
    function endHold(x, y) {
      if (!S.hold && !S.down) return;
      var d = S.down;
      S.hold = false; S.down = null;
      // world.js no longer sees this press, so the scene makes its own click: a short, still press
      if (d && performance.now() - d.t < 450 && Math.hypot(x - d.x, y - d.y) < 10 && d.crowd) crowdWave(S.ctx);
    }

    // ---------- YOU: the run, the tape, Victory ----------
    function you(ctx, name, o) { if (S.clip === name) return; S.clip = name; ctx.you.play(name, o); }
    function runSpeed() { var d = W.debug; return d && d.runSpeed ? d.runSpeed * 1.2 : 3.8; }
    function walkSpeed() { var d = W.debug; return d && d.walkSpeed ? d.walkSpeed * 1.2 : 1.4; }
    function stepYou(t, dt, ctx, kG, kT, kS, slide) {
      if (!ctx.arrived) {
        if (S.arrivedAt >= 0) { S.arrivedAt = -1; S.clip = ''; ctx.you.offset(0, 0, 0, 0, 0); }
        return;
      }
      if (S.arrivedAt < 0) S.arrivedAt = t;
      var A = TMP.a, still = ctx.reduced;
      if (still) {
        // reduced motion: hold him one stride before the tape
        S.s = S.sTape - 0.5; at(S.path, S.s, A);
        ctx.you.place(A.x, A.z, Math.atan2(A.tx, A.tz)); you(ctx, 'Run', { loop: true });
        ctx.you.offset(0, kG * 1.5, 0, 0, kT * 0.15);
        return;
      }
      var busy = S.mode === 'gravity' || S.mode === 'stop' || kS > 0.05;
      // where he should be: from the scroll beat, or from his own slow loop
      var target = S.s;
      if (S.gotBeat) target = S.beatP >= 0.85 ? S.sEnd : S.beatP / 0.85 * S.sTape;
      else if (t - S.arrivedAt > 2) {
        if (S.loopPh === 'rest') { target = S.s; if (t - S.loopT > 1.4) { S.loopPh = 'out'; } }
        if (S.loopPh === 'out') { target = S.sEnd; if (S.s >= S.sEnd - 0.01) { S.loopPh = 'cheer'; S.loopT = t; } }
        if (S.loopPh === 'cheer') { target = S.sEnd; if (t - S.loopT > 3.6) S.loopPh = 'back'; }
        if (S.loopPh === 'back') { target = 0; if (S.s <= 0.01) { S.loopPh = 'rest'; S.loopT = t; } }
      }
      var typh = kT > 0.5, v = (typh ? walkSpeed() : runSpeed()) * (1 + 0.35 * S.pace);
      var diff = target - S.s, moving = !busy && Math.abs(diff) > 0.015;
      // a fast scroll pulls him along faster (up to twice his pace) so he never lags far behind it
      if (moving) { var step = Math.min(Math.abs(diff), v * Math.min(2, 1 + Math.abs(diff) / 6) * dt); S.s += diff > 0 ? step : -step; }
      var dir = diff > 0 ? 1 : -1;
      // the tape
      if (!S.snapped && S.s >= S.sTape) { S.snapped = true; S.snapT = t; S.jumpT = t; sfx('cheer'); you(ctx, 'Victory'); S.vicT = t; }
      if (S.snapped && S.s < S.sTape - 0.3) { S.snapped = false; S.tieT = t; }
      at(S.path, S.s, A);
      var goalRy = Math.atan2(A.tx * dir, A.tz * dir);
      if (!moving && S.s >= S.sTape) goalRy = 0.25;   // after the line he turns to the camera
      S.ry += wrapPi(goalRy - S.ry) * (1 - Math.exp(-dt / 0.12));
      ctx.you.place(A.x, A.z, S.ry);
      // the clip
      if (!busy) {
        var inVic = S.vicT !== undefined && t - S.vicT < 2.4;
        if (moving && !(inVic && S.s >= S.sTape)) you(ctx, typh ? 'Walk' : 'Run', { loop: true });
        else if (!moving && !inVic) you(ctx, 'Idle');
      } else if (S.mode === 'stop' && S.clip === 'Roll' && t - S.rollT > 2.2) S.clip = 'StandUp';
      // pace: a forward lean; what-ifs: float, lean into the wind, flung east
      var lean = 0.14 * S.pace * (moving ? 1 : 0.4);
      ctx.you.offset(slide * 3.0, kG * (1.5 + 0.2 * Math.sin(t * 0.9)), 0, lean + kG * 0.2 * Math.sin(t * 0.7), kG * 0.25 * Math.sin(t * 0.5 + 1) + kT * 0.15);
    }
  }
  if (window.WORLD) go(); else window.addEventListener('DOMContentLoaded', go);
})();
