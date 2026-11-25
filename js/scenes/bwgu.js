/* scenes/bwgu.js: "Before We Grow Up", on set (scene builder C, v3). See briefs/world-api.md.
   A small film set on the curve, generic on purpose (the series' subject is not shown): a plain backdrop flat on a
   wooden frame with two stools in front as "the scene", a camera on a tripod, two light stands with barn doors, a boom
   mic held over the scene, a director's monitor, two folding director's chairs, a clapperboard on a stool at the front,
   cable reels and an equipment case. Five generic crew (the team of six with YOU), each with a job and two taped marks.
   YOU plays his three real roles as the visitor scrolls (site:beat p for this stop, or a slow loop of its own):
     p < 0.33 behind the tripod, looking through the camera (Documentation Director)
     0.33 to 0.66 walks in front of the lens and sits on the second stool as the clapper snaps (on camera)
     p > 0.66 steps off to the side and films the crew with a phone (the behind-the-scenes video)
   Click the clapperboard: it snaps, both lights come on, the crew hold their working poses, the tally goes solid. */
(function () {
  'use strict';
  function go() {
    var W = window.WORLD;
    if (!W || !W.registerScene) return;

    var S = null, TMP = null;
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function ease(k, goal, dt, tau) { return k + (goal - k) * (1 - Math.exp(-dt / tau)); }
    function frac(x) { return x - Math.floor(x); }
    function hash(n) { var h = Math.imul((n | 0) ^ 0x2545f491, 0x9e3779b1); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
    function sfx(n) { try { if (window.SFX && window.SFX.play) window.SFX.play(n); } catch (e) { /* sound is optional */ } }
    function angTo(fx, fz, tx, tz) { return Math.atan2(tx - fx, tz - fz); }
    function angLerp(a, b, k) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; }

    var INK = '#141414', WOOD = '#B07A47', WOOD2 = '#8a5a33', PAPER = '#f4f1ea';
    var HUD = { value: '6', caption: 'people on the team' };
    // the set (+x right, +z toward the camera)
    var FLAT = { x: -3.3, z: -2.5, ry: 0.55, w: 5.0, h: 3.6 };
    var STOOL1 = { x: -3.75, z: -0.95 }, STOOL2 = { x: -2.45, z: -0.45 }, STOOL_H = 0.46;
    var CAM = { x: 1.3, z: 0.95 };
    var AIM = { x: -3.1, z: -0.7 };
    var L1 = { x: -0.9, z: -2.3 }, L2 = { x: -2.3, z: 1.75 };
    var MON = { x: 2.9, z: -1.05 };
    var CLAP = { x: -0.45, z: 3.05 };
    var CASE = { x: 0.55, z: 2.25 }, REEL = { x: 0.25, z: -2.55 };
    var CHAIRS = [{ x: 4.2, z: 0.35 }, { x: 4.85, z: -0.6 }];

    function boxG(T, w, h, d) { var g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }
    function cylG(T, rt, rb, h, seg) { var g = new T.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0); return g; }
    function colorize(T, g, color) {
      g = g.index ? g.toNonIndexed() : g;
      var c = new T.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(arr, 3));
      if (g.attributes.uv) g.deleteAttribute('uv');
      return g;
    }

    // ---------- a baker: static parts merged into one mesh with vertex colours ----------
    function Baker(T, X) { this.T = T; this.X = X; this.list = []; this.m = new T.Matrix4(); this.o = new T.Object3D(); }
    Baker.prototype.part = function (geo, color, frame, x, y, z, rx, ry, rz, sx, sy, sz) {
      var o = this.o, T = this.T;
      o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0, 'YXZ');
      o.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); o.updateMatrix();
      this.m.copy(o.matrix);
      if (frame) this.m.premultiply(frame);
      var g = colorize(T, geo.index ? geo.toNonIndexed() : geo.clone(), color);
      if (g.attributes.uv1) g.deleteAttribute('uv1');
      g.applyMatrix4(this.m); g.computeVertexNormals(); g.clearGroups();
      this.list.push(g); geo.dispose();
    };
    Baker.prototype.mesh = function (mat) {
      if (!this.list.length) return null;
      var g = this.X.mergeGeometries(this.list, false);
      this.list.forEach(function (x) { x.dispose(); });
      this.list = [];
      var me = new this.T.Mesh(g, mat); me.castShadow = true; me.receiveShadow = true;
      return me;
    };

    // ---------- the crew: instanced people (shins, thighs, torso, head with hair, two arms), upright to the sphere ----------
    var CREW = [
      { job: 'boom', shirt: '#E8412B', pants: '#2f3b5c', a: { x: -1.45, z: -1.95 }, b: { x: -1.75, z: -1.7 }, per: 9 },
      { job: 'lights', shirt: '#FF8A5B', pants: '#5a5f66', a: { x: -0.45, z: -1.95 }, b: { x: 0.65, z: -2.2 }, per: 11 },
      { job: 'camera', shirt: '#f4f4f2', pants: '#2f3b5c', a: { x: 1.6, z: 0.3 }, b: { x: 1.0, z: 2.0 }, per: 10 },
      { job: 'actor', shirt: '#8ccbe6', pants: '#5a5f66', a: STOOL1, b: STOOL1, per: 7 },
      { job: 'monitor', shirt: '#9aa0a6', pants: '#2f3b5c', a: { x: 3.55, z: -0.75 }, b: { x: 4.2, z: 0.35 }, per: 13 }
    ];

    // ---------- the street-level camera's shots (scene space), lined up with YOU's three roles ----------
    function gyR(x, z) { var r2 = x * x + z * z; return Math.sqrt(196 - Math.min(r2, 195)) - 14; }
    function shot(x, z, h, lx, lz, lh, fov, p) { return { pos: [x, gyR(x, z) + h, z], look: [lx, gyR(lx, lz) + lh, lz], fov: fov, p: p }; }
    var SHOTS = [
      shot(4.64, 1.66, 1.9, AIM.x, AIM.z, 1.3, 55, 0.0),         // arrival: low behind the tripod, past YOU at the set
      shot(4.25, 0.98, 2.5, -3.0, -0.7, 1.0, 50, 0.25),         // over his shoulder at the viewfinder
      shot(-0.2, 1.75, 1.55, STOOL2.x, STOOL2.z, 0.9, 52, 0.5),  // in front of the lens: he sits, the clapper snaps
      shot(1.0, 4.1, 1.9, 2.4, 1.8, 1.0, 55, 0.75),              // he steps off to the side
      shot(4.5, 3.55, 2.3, -0.6, -0.9, 1.1, 52, 1.0)            // over his raised phone at the crew
    ];

    W.registerScene('bwgu', {
      shots: SHOTS,
      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, P = ctx.palette, lo = ctx.quality === 'low';
        var root = new T.Group();
        TMP = { m4: new T.Matrix4(), mP: new T.Matrix4(), mT: new T.Matrix4(), mL: new T.Matrix4(), q: new T.Quaternion(), q2: new T.Quaternion(),
          p: new T.Vector3(), p2: new T.Vector3(), p3: new T.Vector3(), s: new T.Vector3(1, 1, 1), one: new T.Vector3(1, 1, 1), up: new T.Vector3(),
          e: new T.Euler(), X: new T.Vector3(1, 0, 0), Y: new T.Vector3(0, 1, 0), Z: new T.Vector3(0, 0, 1), c: new T.Color() };
        S = { T: T, ctx: ctx, root: root, lo: lo, ck: 0, cc: 0, mode: null, kG: 0, kT: 0, kS: 0, stopT: 0, beatP: 0, gotBeat: false, fromPage: false,
          arrT: 0, wasArrived: false, toy: null, own: [], props: [], you: { x: 0, z: 0, ry: 0, role: null, phase: 'pose', t: 0, cmd: [99, 99, 99], off: [0, 0, 0, 0, 0], look: '' },
          clap: { snapT: -9 }, monK: -1 };
        var vcol = ctx.mat('#ffffff', { vertexColors: true });
        var bake = new Baker(T, X);
        var dummy = new T.Object3D();
        function frameAt(x, z, ry) { ctx.plant(dummy, x, z, ry); dummy.updateMatrix(); return dummy.matrix.clone(); }
        function ownBasic(color) { var m = new T.MeshBasicMaterial({ color: color }); m.toneMapped = false; S.own.push(m); return m; }
        function prop(g, x, z, ry, lift) { ctx.plant(g, x, z, ry); root.add(g); S.props.push({ g: g, x: x, z: z, ry: ry, lift: lift || 1, ph: S.props.length * 1.7 }); return g; }

        // ---------- ground: grass, with the set's floor (grey boards) and taped marks ----------
        var RINGS = lo ? 12 : 20, SEG = lo ? 32 : 52, RMAX = 10.2;
        var cap = new T.BufferGeometry(), pos = [], cols = [];
        var cF = new T.Color('#cfc8b9'), cF2 = new T.Color('#c4bcab'), cG = new T.Color(P.land), cG2 = new T.Color(P.land2);
        function vtx(r, a) { var x = r * Math.cos(a), z = r * Math.sin(a); return [x, ctx.groundY(x, z) + 0.03, z]; }
        function zone(x, z) {
          var floor = x > -6.6 && x < 6.0 && z > -4.2 && z < 3.9 && (x * x / 49 + z * z / 19) < 1;
          if (floor) return (Math.floor(x * 1.1) % 2) ? cF : cF2;
          return (Math.floor(x * 0.8) + Math.floor(z * 0.8)) % 3 ? cG : cG2;
        }
        for (var ri = 0; ri < RINGS; ri++) {
          var r0 = RMAX * ri / RINGS, r1 = RMAX * (ri + 1) / RINGS;
          for (var si = 0; si < SEG; si++) {
            var a0 = si / SEG * Math.PI * 2, a1 = (si + 1) / SEG * Math.PI * 2;
            var p00 = vtx(r0, a0), p01 = vtx(r0, a1), p10 = vtx(r1, a0), p11 = vtx(r1, a1);
            var tris = ri === 0 ? [[p00, p11, p10]] : [[p00, p11, p10], [p00, p01, p11]];
            tris.forEach(function (tr) {
              var c = zone((tr[0][0] + tr[1][0] + tr[2][0]) / 3, (tr[0][2] + tr[1][2] + tr[2][2]) / 3);
              tr.forEach(function (pp) { pos.push(pp[0], pp[1], pp[2]); cols.push(c.r, c.g, c.b); });
            });
          }
        }
        cap.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        cap.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
        cap.computeVertexNormals();
        var capMesh = new T.Mesh(cap, vcol); capMesh.receiveShadow = true; root.add(capMesh);
        // taped marks (an X of tape at each crew mark)
        if (!lo) CREW.forEach(function (c, i) {
          if (c.job === 'actor') return;
          [c.a, c.b].forEach(function (m) {
            var f = frameAt(m.x, m.z, 0.6 + i);
            bake.part(boxG(T, 0.42, 0.012, 0.07), i % 2 ? P.yellow : P.red, f, 0, 0.005, 0, 0, 0.785, 0);
            bake.part(boxG(T, 0.42, 0.012, 0.07), i % 2 ? P.yellow : P.red, f, 0, 0.006, 0, 0, -0.785, 0);
          });
        });

        // ---------- the backdrop flat: a paper-coloured wall on a wooden frame, braced from behind ----------
        var fF = frameAt(FLAT.x, FLAT.z, FLAT.ry);
        bake.part(boxG(T, FLAT.w + 0.22, FLAT.h + 0.5, 0.1), WOOD, fF, 0, -0.36, -0.08);
        bake.part(boxG(T, FLAT.w + 0.3, 0.12, 0.5), WOOD2, fF, 0, -0.08, -0.2);            // the sill on the floor
        bake.part(boxG(T, FLAT.w, FLAT.h, 0.06), PAPER, fF, 0, 0.07, 0);
        if (!lo) for (var st = -2; st <= 2; st++) bake.part(boxG(T, 0.1, FLAT.h, 0.08), WOOD2, fF, st * 1.2, 0.05, -0.17);
        bake.part(boxG(T, FLAT.w, 0.1, 0.08), WOOD2, fF, 0, FLAT.h * 0.55, -0.17);
        [-1.7, 1.7].forEach(function (bx) {
          bake.part(new T.BoxGeometry(0.08, 2.9, 0.08), WOOD2, fF, bx, 1.3, -1.05, 0.62, 0, 0);
          bake.part(boxG(T, 0.4, 0.22, 0.32), '#5a5f66', fF, bx, 0, -1.9);      // a sandbag on the brace foot
        });

        // ---------- stools (the scene) ----------
        function stool(x, z, h) {
          var g = new T.Group();
          ctx.cyl(g, 0.24, 0.24, 0.06, 10, WOOD, 0, h - 0.06, 0);
          [0, 1, 2, 3].forEach(function (k) { var a = k * Math.PI / 2 + 0.78, leg = ctx.box(g, 0.05, h - 0.06, 0.05, WOOD2, Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); leg.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08); });
          ctx.box(g, 0.32, 0.03, 0.03, WOOD2, 0, h * 0.4, 0.15); ctx.box(g, 0.32, 0.03, 0.03, WOOD2, 0, h * 0.4, -0.15);
          return prop(g, x, z, 0.3, 0.8);
        }
        stool(STOOL1.x, STOOL1.z, STOOL_H); stool(STOOL2.x, STOOL2.z, STOOL_H);

        // ---------- the camera on its tripod ----------
        var camRy = angTo(CAM.x, CAM.z, AIM.x, AIM.z);
        S.camRy = camRy;
        var camG = new T.Group();
        var cb = new Baker(T, X);
        [0, 1, 2].forEach(function (k) { var a = k * Math.PI * 2 / 3 + 0.4; cb.part(new T.CylinderGeometry(0.025, 0.03, 1.42, 5), INK, null, Math.cos(a) * 0.22, 0.66, Math.sin(a) * 0.22, Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32); });
        cb.part(cylG(T, 0.1, 0.12, 0.1, 8), '#3d4147', null, 0, 1.3, 0);
        cb.part(boxG(T, 0.36, 0.38, 0.66), '#1d1d1f', null, 0, 1.4, 0.0);
        cb.part(cylG(T, 0.12, 0.13, 0.32, 10), '#2b2d30', null, 0, 1.59, 0.33, Math.PI / 2, 0, 0);
        cb.part(boxG(T, 0.34, 0.3, 0.05), INK, null, 0, 1.44, 0.68);                      // matte box
        cb.part(boxG(T, 0.12, 0.12, 0.2), '#3d4147', null, 0.06, 1.62, -0.38);            // viewfinder
        cb.part(cylG(T, 0.055, 0.05, 0.08, 8), INK, null, 0.06, 1.68, -0.46, -Math.PI / 2, 0, 0);   // eyecup
        [0.42, 0.55].forEach(function (z) { cb.part(cylG(T, 0.145, 0.145, 0.035, 12), '#55595f', null, 0, 1.59, z, Math.PI / 2, 0, 0); });
        cb.part(cylG(T, 0.05, 0.05, 0.06, 10), '#9aa0a6', null, 0.16, 1.5, 0.48, 0, 0, -Math.PI / 2);  // follow-focus wheel
        cb.part(boxG(T, 0.03, 0.1, 0.12), INK, null, 0.19, 1.45, 0.05);                     // side buttons
        [0, 1, 2].forEach(function (k) { var a = k * Math.PI * 2 / 3 + 0.4; cb.part(boxG(T, 0.07, 0.1, 0.07), '#55595f', null, Math.cos(a) * 0.22, 0.62, Math.sin(a) * 0.22); cb.part(boxG(T, 0.4, 0.03, 0.03), INK, null, Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2, 0, -a, 0); cb.part(boxG(T, 0.08, 0.03, 0.08), INK, null, Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); });
        cb.part(boxG(T, 0.06, 0.06, 0.42), INK, null, 0, 1.84, 0.02);                      // top handle
        cb.part(boxG(T, 0.04, 0.06, 0.04), INK, null, 0, 1.78, 0.2); cb.part(boxG(T, 0.04, 0.06, 0.04), INK, null, 0, 1.78, -0.16);
        cb.part(boxG(T, 0.05, 0.4, 0.05), '#3d4147', null, -0.12, 1.15, -0.32, 0.9, 0, 0); // pan handle
        camG.add(cb.mesh(vcol));
        var tallyMat = ownBasic('#ff2a1a');
        var tA = new T.Mesh(new T.BoxGeometry(0.08, 0.04, 0.08), tallyMat); tA.position.set(0.12, 1.8, 0.24); camG.add(tA);
        var tB = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.02), tallyMat); tB.position.set(-0.1, 1.7, -0.34); camG.add(tB);
        S.tally = { mat: tallyMat, on: -1 };
        prop(camG, CAM.x, CAM.z, camRy, 0.6);

        // ---------- light stands with barn doors (flat bright faces when on) ----------
        S.lights = [];
        function lightStand(L, target, tall) {
          var g = new T.Group();
          var lb = new Baker(T, X);
          [0, 1, 2].forEach(function (k) { var a = k * Math.PI * 2 / 3; lb.part(new T.BoxGeometry(0.04, 0.04, 0.62), INK, null, Math.cos(a) * 0.27, 0.1, Math.sin(a) * 0.27, 0.32, -a + Math.PI / 2, 0); });
          lb.part(cylG(T, 0.035, 0.04, tall, 6), INK, null, 0, 0, 0);
          lb.part(boxG(T, 0.5, 0.05, 0.05), '#3d4147', null, 0, tall - 0.05, 0);
          lb.part(boxG(T, 0.34, 0.15, 0.2), '#7a6a55', null, 0.3, 0.03, 0, 0, 0.3, 0.12); lb.part(boxG(T, 0.06, 0.06, 0.22), '#5a4c3c', null, 0.3, 0.17, 0);
          lb.part(cylG(T, 0.045, 0.045, 0.06, 8), P.red, null, 0.27, tall - 0.05, 0, 0, 0, -Math.PI / 2);
          g.add(lb.mesh(vcol));
          var head = new T.Group(); head.position.y = tall + 0.1; g.add(head);
          head.rotation.order = 'YXZ';
          head.rotation.y = angTo(L.x, L.z, target.x, target.z); head.rotation.x = 0.28;
          var hb = new Baker(T, X);
          hb.part(boxG(T, 0.52, 0.46, 0.42), '#2b2d30', null, 0, -0.23, -0.21);
          hb.part(boxG(T, 0.3, 0.3, 0.12), '#3d4147', null, 0, -0.15, -0.48);
          [[0, 0.25, 0, 0.52, 0.04, 0.34, -0.7, 0], [0, -0.25, 0, 0.52, 0.04, 0.34, 0.7, 0], [0.28, 0, 0, 0.04, 0.46, 0.3, 0, 0.7], [-0.28, 0, 0, 0.04, 0.46, 0.3, 0, -0.7]].forEach(function (d) {
            var bg = new T.BoxGeometry(d[3], d[4], d[5]); bg.translate(0, 0, d[5] / 2);
            hb.part(bg, INK, null, d[0], d[1], 0.02, d[6], d[7], 0);
          });
          head.add(hb.mesh(vcol));
          var faceMat = ownBasic('#55595f');
          var face = new T.Mesh(new T.PlaneGeometry(0.44, 0.38), faceMat); face.position.set(0, 0, 0.012); head.add(face);
          S.lights.push({ mat: faceMat, on: -1, head: head, top: tall + 0.1 });
          return prop(g, L.x, L.z, 0, 0.5);
        }
        if (!lo) {
          lightStand(L1, { x: -3.2, z: -0.7 }, 2.25);
          lightStand(L2, { x: -3.0, z: -0.6 }, 2.05);
        }

        // ---------- the boom pole and its mic (follows the boom op's hands) ----------
        var boom = new T.Group(); root.add(boom);
        var pole = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 1, 5), ctx.mat('#3d4147')); boom.add(pole);
        var mic = new T.Group(); boom.add(mic);
        var blimp = new T.Mesh(new T.IcosahedronGeometry(0.1, 1), ctx.mat('#8a7f72')); blimp.scale.set(1.15, 1.15, 2.6); mic.add(blimp);
        var fur = new T.Mesh(new T.IcosahedronGeometry(0.11, 0), ctx.mat('#a39684')); fur.scale.set(1.05, 1.05, 2.2); fur.rotation.z = 0.4; mic.add(fur);
        S.boom = { g: boom, pole: pole, mic: mic };

        // ---------- the director's monitor on a stand: flat colour blocks and a red REC dot ----------
        var monG = new T.Group();
        var mb = new Baker(T, X);
        mb.part(cylG(T, 0.32, 0.36, 0.06, 8), INK, null, 0, 0, 0);
        mb.part(cylG(T, 0.03, 0.03, 1.25, 6), INK, null, 0, 0, 0);
        mb.part(boxG(T, 1.06, 0.72, 0.1), '#1d1d1f', null, 0, 1.2, 0);
        mb.part(boxG(T, 1.1, 0.12, 0.3), INK, null, 0, 1.92, 0.1);                  // the hood
        [-0.56, 0.56].forEach(function (x) { mb.part(boxG(T, 0.04, 0.6, 0.3), INK, null, x, 1.26, 0.1); });
        [1.27, 1.33].forEach(function (y, k) { mb.part(cylG(T, 0.025, 0.025, 0.03, 8), k ? P.red : '#9aa0a6', null, 0.42 - k * 0.1, y, 0.05, Math.PI / 2, 0, 0); });
        [0, 1, 2].forEach(function (k) { var a = k * Math.PI * 2 / 3; mb.part(boxG(T, 0.5, 0.04, 0.05), INK, null, Math.cos(a) * 0.22, 0.02, Math.sin(a) * 0.22, 0, -a, 0); });
        monG.add(mb.mesh(vcol));
        var NB = 6;
        var blocks = ctx.instanced(new T.PlaneGeometry(0.3, 0.27), ownBasic('#ffffff'), NB);
        blocks.userData.noBounds = true;
        for (var bi = 0; bi < NB; bi++) {
          TMP.m4.makeTranslation(-0.32 + (bi % 3) * 0.32, 1.42 + Math.floor(bi / 3) * 0.29, 0.055);
          blocks.setMatrixAt(bi, TMP.m4); blocks.setColorAt(bi, TMP.c.set('#8ccbe6'));
        }
        blocks.instanceMatrix.needsUpdate = true;
        monG.add(blocks);
        var rec = new T.Mesh(new T.CircleGeometry(0.045, 10), ownBasic('#ff2a1a')); rec.position.set(-0.4, 1.83, 0.058); monG.add(rec);
        S.mon = { blocks: blocks, rec: rec, n: NB };
        prop(monG, MON.x, MON.z, -0.25, 0.7);

        // ---------- two folding director's chairs ----------
        if (!lo) CHAIRS.forEach(function (c, i) {
          var g = new T.Group();
          var chb = new Baker(T, X);
          [-1, 1].forEach(function (sx) {
            chb.part(new T.BoxGeometry(0.05, 0.72, 0.05), WOOD, null, sx * 0.27, 0.33, 0, 0.52, 0, 0);
            chb.part(new T.BoxGeometry(0.05, 0.72, 0.05), WOOD, null, sx * 0.27, 0.33, 0, -0.52, 0, 0);
            chb.part(boxG(T, 0.05, 0.62, 0.05), WOOD, null, sx * 0.27, 0.6, -0.22);
            chb.part(boxG(T, 0.05, 0.05, 0.46), WOOD, null, sx * 0.27, 0.86, 0.0);
          });
          chb.part(boxG(T, 0.54, 0.03, 0.42), i ? INK : P.red, null, 0, 0.6, 0);
          chb.part(boxG(T, 0.56, 0.24, 0.03), i ? INK : P.red, null, 0, 1.0, -0.22);
          g.add(chb.mesh(vcol));
          prop(g, c.x, c.z, angTo(c.x, c.z, AIM.x, AIM.z), 0.9);
        });

        // ---------- cable reel, equipment case, hanging cables ----------
        if (!lo) {
          var reel = new T.Group();
          var rb = new Baker(T, X);
          [-0.16, 0.16].forEach(function (z) { rb.part(cylG(T, 0.32, 0.32, 0.04, 12), INK, null, 0, 0.36, z - 0.02, Math.PI / 2, 0, 0); });
          rb.part(cylG(T, 0.24, 0.24, 0.3, 12), P.orange, null, 0, 0.36, -0.15, Math.PI / 2, 0, 0);
          rb.part(boxG(T, 0.5, 0.04, 0.3), INK, null, 0, 0, 0);
          reel.add(rb.mesh(vcol));
          prop(reel, REEL.x, REEL.z, 0.5, 1.0);
          var cs = new T.Group();
          var csb = new Baker(T, X);
          csb.part(boxG(T, 0.9, 0.48, 0.58), '#2b2d31', null, 0, 0, 0);
          [[0, 0, 0.29, 0.92, 0.05, 0.03], [0, 0, -0.29, 0.92, 0.05, 0.03], [0, 0.45, 0.29, 0.92, 0.05, 0.03], [0, 0.45, -0.29, 0.92, 0.05, 0.03]].forEach(function (d) { csb.part(boxG(T, d[3], d[4], d[5]), '#a7adb3', null, d[0], d[1], d[2]); });
          csb.part(boxG(T, 0.3, 0.06, 0.06), '#a7adb3', null, 0, 0.48, 0);
          cs.add(csb.mesh(vcol));
          prop(cs, CASE.x, CASE.z, 0.35, 1.1);
          var NCB = 2 * 10;
          var cab = ctx.instanced(new T.BoxGeometry(0.035, 1, 0.035), ctx.mat(INK), NCB);
          cab.userData.noBounds = true;
          root.add(cab);
          S.cables = { mesh: cab, n: 10, ends: [] };
        }

        // ---------- the clapperboard on a stool at the front (the click toy) ----------
        var clapG = new T.Group();
        var clStool = new T.Group(); clapG.add(clStool);
        ctx.cyl(clStool, 0.3, 0.3, 0.06, 10, WOOD, 0, 0.6, 0);
        [0, 1, 2, 3].forEach(function (k) { var a = k * Math.PI / 2 + 0.78; ctx.box(clStool, 0.06, 0.6, 0.06, WOOD2, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); });
        var board = new T.Group(); board.position.set(0, 0.66, 0.02); board.rotation.x = -0.12; clapG.add(board);
        var slB = new Baker(T, X);
        slB.part(boxG(T, 1.1, 0.78, 0.07), '#222326', null, 0, 0, 0);
        [0.2, 0.4].forEach(function (y) { slB.part(boxG(T, 1.0, 0.025, 0.02), '#e9e4d6', null, 0, y, 0.04); });
        slB.part(boxG(T, 0.025, 0.2, 0.02), '#e9e4d6', null, -0.1, 0.2, 0.04); slB.part(boxG(T, 0.025, 0.2, 0.02), '#e9e4d6', null, 0.25, 0.2, 0.04);
        for (var cs2 = 0; cs2 < 6; cs2++) slB.part(boxG(T, 1.1 / 6, 0.13, 0.08), cs2 % 2 ? INK : '#f4f4f2', null, -0.55 + (cs2 + 0.5) * 1.1 / 6, 0.78, 0);
        board.add(slB.mesh(vcol));
        var arm = new T.Group(); arm.position.set(-0.55, 0.92, 0.0); board.add(arm);
        var arB = new Baker(T, X);
        for (var ca = 0; ca < 6; ca++) arB.part(boxG(T, 1.1 / 6, 0.13, 0.08), ca % 2 ? '#f4f4f2' : INK, null, (ca + 0.5) * 1.1 / 6, 0, 0, 0, 0, ca % 2 ? 0 : 0);
        arm.add(arB.mesh(vcol));
        ctx.cyl(arm, 0.05, 0.05, 0.1, 8, '#9aa0a6', 0, -0.03, -0.05).rotation.x = Math.PI / 2;
        var hitMat = new T.MeshBasicMaterial({ visible: false }); S.own.push(hitMat);
        var hit = new T.Mesh(new T.BoxGeometry(2.0, 2.1, 1.6), hitMat); hit.position.y = 0.95; hit.userData.noBounds = true; clapG.add(hit);
        clapG.userData.clickable = 'clapper';
        prop(clapG, CLAP.x, CLAP.z, -0.12, 0.7);
        S.clap.g = clapG; S.clap.arm = arm;

        // ---------- the crew ----------
        var crew = lo ? [CREW[0], CREW[3]] : CREW;
        var NP = crew.length;
        function part(geo, mat) { var im = ctx.instanced(geo, mat, NP); im.castShadow = true; im.userData.noBounds = true; root.add(im); return im; }
        var shinG = new T.BoxGeometry(0.32, 0.42, 0.2); shinG.translate(0, -0.21, 0);
        var thighG = new T.BoxGeometry(0.34, 0.4, 0.22); thighG.translate(0, -0.2, 0);
        var torsoG = new T.BoxGeometry(0.46, 0.56, 0.26); torsoG.translate(0, 0.28, 0);
        var headG = (function () {
          var h = colorize(T, boxG(T, 0.28, 0.3, 0.28), P.skin), hair = colorize(T, boxG(T, 0.31, 0.08, 0.31), '#1f1a17');
          hair.translate(0, 0.27, 0);
          var back = colorize(T, boxG(T, 0.31, 0.2, 0.07), '#1f1a17'); back.translate(0, 0.12, -0.13);
          var g = X.mergeGeometries([h, hair, back], false); [h, hair, back].forEach(function (x) { x.dispose(); });
          return g;
        })();
        var armG = new T.BoxGeometry(0.1, 0.52, 0.1); armG.translate(0, -0.26, 0);
        var white = ctx.mat('#ffffff');
        S.crew = { list: crew, n: NP, shin: part(shinG, white), thigh: part(thighG, white), torso: part(torsoG, white), head: part(headG, vcol),
          armL: part(armG, ctx.mat(P.skin)), armR: part(armG, ctx.mat(P.skin)), st: [] };
        crew.forEach(function (c, i) {
          S.crew.shin.setColorAt(i, TMP.c.set(c.pants)); S.crew.thigh.setColorAt(i, TMP.c.set(c.pants)); S.crew.torso.setColorAt(i, TMP.c.set(c.shirt));
          S.crew.st.push({ x: c.a.x, z: c.a.z, ry: 0, lift: 0 });
        });

        // ---------- YOU's phone (the behind-the-scenes video) ----------
        var phone = new T.Group(); root.add(phone);
        ctx.box(phone, 0.12, 0.22, 0.03, "#1a1a1c", 0, -0.11, 0);
        var phScr = new T.Mesh(new T.PlaneGeometry(0.08, 0.16), ownBasic('#8ccbe6')); phScr.position.set(0, 0, -0.014); phScr.rotation.y = Math.PI; phone.add(phScr);
        phone.visible = false;
        S.phone = phone;

        // ---------- rain for the typhoon ----------
        var NRN = lo ? 50 : 110;
        var rain = ctx.instanced(new T.BoxGeometry(0.03, 0.9, 0.03), ownBasic('#4a6b85'), NRN);
        rain.visible = false; rain.userData.noBounds = true; root.add(rain);
        S.rain = { mesh: rain, n: NRN, d: [] };
        for (var rr = 0; rr < NRN; rr++) S.rain.d.push([-10 + ctx.rand() * 22, ctx.rand() * 13, -7 + ctx.rand() * 13]);

        if (!lo) {
          // cable runs taped to the floor: camera to monitor, light 1 to the reel, light 2 to the camera
          [[CAM, MON], [L1, REEL], [L2, CAM]].forEach(function (run) {
            var a = run[0], b = run[1], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.round(len / 0.5)), ry = angTo(a.x, a.z, b.x, b.z);
            for (var k = 0; k < n; k++) {
              var u = (k + 0.5) / n, wob = 0.12 * Math.sin(u * Math.PI * 2), x = a.x + (b.x - a.x) * u + wob * Math.cos(ry), z = a.z + (b.z - a.z) * u - wob * Math.sin(ry);
              var cf = frameAt(x, z, ry);
              bake.part(boxG(T, 0.05, 0.03, len / n + 0.06), '#26262a', cf, 0, 0, 0);
              if (k % 3 === 1) bake.part(boxG(T, 0.2, 0.035, 0.09), P.yellow, cf, 0, 0, 0);
            }
          });
          // T marks for the actors in front of the stools
          [STOOL1, STOOL2].forEach(function (st2) {
            var tf = frameAt(st2.x + 0.6, st2.z + 0.35, 1.0);
            bake.part(boxG(T, 0.3, 0.012, 0.06), P.red, tf, 0, 0.005, 0); bake.part(boxG(T, 0.06, 0.012, 0.3), P.red, tf, 0, 0.005, 0.15);
          });
          // an apple box beside the first stool
          var ab = frameAt(STOOL1.x - 0.6, STOOL1.z + 0.4, 0.3);
          bake.part(boxG(T, 0.5, 0.2, 0.3), WOOD, ab, 0, 0, 0); bake.part(boxG(T, 0.18, 0.06, 0.02), WOOD2, ab, 0, 0.08, 0.15);
          // a folding craft table: water bottles, a stack of pages, a flask
          var ctf = frameAt(4.7, -2.3, -0.6);
          bake.part(boxG(T, 1.3, 0.05, 0.6), '#e9e4d6', ctf, 0, 0.74, 0); bake.part(boxG(T, 1.32, 0.03, 0.62), INK, ctf, 0, 0.72, 0);
          [[-0.55, -0.24], [0.55, -0.24], [-0.55, 0.24], [0.55, 0.24]].forEach(function (c) { bake.part(boxG(T, 0.04, 0.72, 0.04), INK, ctf, c[0], 0, c[1]); });
          [-0.45, -0.32, -0.19].forEach(function (x, k) { bake.part(cylG(T, 0.04, 0.04, 0.2, 8), '#8ccbe6', ctf, x, 0.79, -0.08 + k * 0.05); bake.part(cylG(T, 0.022, 0.022, 0.04, 6), '#2f3b5c', ctf, x, 0.99, -0.08 + k * 0.05); });
          bake.part(boxG(T, 0.3, 0.06, 0.4), '#f6f1e4', ctf, 0.1, 0.79, 0.02, 0, 0.15, 0); bake.part(boxG(T, 0.3, 0.012, 0.03), INK, ctf, 0.1, 0.85, -0.17, 0, 0.15, 0);
          bake.part(cylG(T, 0.08, 0.08, 0.32, 10), '#55595f', ctf, 0.45, 0.79, 0); bake.part(cylG(T, 0.05, 0.08, 0.06, 10), INK, ctf, 0.45, 1.11, 0);
        }
        root.add(bake.mesh(vcol));

        // YOU's three marks
        var bx = CAM.x - Math.sin(camRy) * 0.78, bz = CAM.z - Math.cos(camRy) * 0.78;
        S.spots = {
          A: { x: bx, z: bz, ry: camRy },
          B: { x: STOOL2.x + Math.sin(angTo(STOOL2.x, STOOL2.z, CAM.x, CAM.z)) * 0.12, z: STOOL2.z + Math.cos(angTo(STOOL2.x, STOOL2.z, CAM.x, CAM.z)) * 0.12, ry: angTo(STOOL2.x, STOOL2.z, CAM.x, CAM.z) },
          C: { x: 2.75, z: 2.55, ry: angTo(2.75, 2.55, -0.6, -0.9) },
          Cin: { x: 2.05, z: 1.83 }
        };
        S.way = [{ x: CAM.x + 0.35, z: CAM.z + 0.75 }, { x: CAM.x + Math.sin(camRy) * 1.4, z: CAM.z + Math.cos(camRy) * 1.4 }];
        S.you.x = S.spots.A.x; S.you.z = S.spots.A.z; S.you.ry = S.spots.A.ry; S.you.prev = 'A';
        ctx.you.place(S.you.x, S.you.z, S.you.ry);
        ctx.hud({ left: HUD });
        S.onBeat = function (e) {
          var d = e && e.detail;
          if (!S || !d || (d.stop !== 'bwgu' && d.stop !== 'uncooked')) return;
          var p = +d.p; if (!isFinite(p)) return;
          S.beatP = clamp(p, 0, 1); S.gotBeat = true; S.fromPage = true;
        };
        window.addEventListener('site:beat', S.onBeat);
        return root;
      },

      update: function (t, dt, ctx) {
        if (!S) return;
        var still = ctx.reduced;
        S.ck += dt;
        var ck = S.ck;
        if (ctx.arrived && !S.wasArrived) { S.wasArrived = true; S.arrT = ck; S.you.role = null; S.you.cmd[0] = 99; S.you.off[0] = 99; S.you.look = '-'; S.you.snap = true; }
        if (!ctx.arrived && S.wasArrived) { S.wasArrived = false; S.toy = null; }

        var gG = S.mode === 'gravity' ? 1 : 0, gT = S.mode === 'typhoon' ? 1 : 0, gS = S.mode === 'stop' ? 1 : 0;
        if (still) { S.kG = gG; S.kT = gT; S.kS = gS; }
        else { S.kG = ease(S.kG, gG, dt, 0.5); S.kT = ease(S.kT, gT, dt, 0.35); S.kS = ease(S.kS, gS, dt, gS ? 0.25 : 0.6); }
        if (S.mode === 'stop') S.stopT += dt; else if (S.kS < 0.01) S.stopT = 0;
        var kG = S.kG, kT = S.kT, kS = S.kS, slide = kS * (1 - Math.exp(-S.stopT * 2.4));

        // the toy: snap, lights on, everyone holds their working pose for a second
        var toyW = 0, toyLights = false;
        if (S.toy) {
          S.toy.t += still ? 0 : dt;
          if (still && performance.now() - S.toy.wall > 1600) S.toy.t = 9;
          var tt = S.toy.t;
          toyW = still ? 1 : smooth(0.0, 0.15, tt) * (1 - smooth(1.2, 1.6, tt));
          toyLights = tt < 1.45;
          if (tt > 1.7) S.toy = null;
        }
        S.cc += dt * (1 - toyW) * (1 - kG * 0.8) * (1 - kS);

        // the beats: p from the page, or a slow loop of our own
        var p = S.gotBeat ? S.beatP : (ctx.arrived && ck - S.arrT > 2 ? frac((ck - S.arrT - 2) / 27) : 0);
        if (still && !S.gotBeat) p = 0.5;

        stepProps(ctx, ck, kG, kT, slide, still);
        stepClap(ctx, ck, still);
        stepCrew(ctx, ck, dt, toyW, kG, kT, slide, still);
        stepBoom(ctx, ck, kT, still);
        stepLights(ctx, ck, toyLights, still);
        stepMonitor(ctx, ck, toyW > 0.01, still);
        stepCables(ctx, ck, kT, still);
        stepYou(ctx, dt, ck, p, kG, kT, kS, slide, still);
        stepRain(ctx, dt, kT, still);
      },

      onPointer: function (ev, ctx) {
        if (!S || ev.type !== 'click' || !ev.hit) return false;
        var o = ev.hit.object, on = false;
        while (o) { if (o === S.clap.g) { on = true; break; } o = o.parent; }
        if (!on) return false;
        S.toy = { t: 0, wall: performance.now() };
        S.clap.snapT = S.ck;
        sfx('clap');
        return true;
      },

      whatIf: function (mode, ctx) {
        if (!S) return false;
        var was = S.mode;
        S.mode = mode;
        S.toy = null;
        if (mode === 'gravity') ctx.you.play('Float', { loop: true });
        else if (mode === 'typhoon') { /* he keeps his role and leans into the wind */ }
        else if (mode === 'stop') { ctx.you.play('Idle'); ctx.you.play('Roll', { then: 'StandUp' }); S.stopT = 0; }
        else { ctx.you.play('Idle'); if (was === 'gravity') ctx.you.play('Jump'); }
        if (mode !== 'typhoon') { S.you.role = null; S.you.wait = mode ? 0 : (was === 'stop' ? 1.6 : 0.9); }
        return true;
      },

      setQuality: function (q) { if (S) S.lo = q === 'low'; },

      dispose: function () {
        if (!S) return;
        window.removeEventListener('site:beat', S.onBeat);
        S.own.forEach(function (m) { m.dispose(); });
        S = null; TMP = null;
      }
    });

    // ---------- props: what-ifs lift, lean and slide them ----------
    function stepProps(ctx, ck, kG, kT, slide, still) {
      for (var i = 0; i < S.props.length; i++) {
        var pr = S.props[i], dx = slide * (1.6 + (i % 4) * 0.35);
        if (kG < 0.001 && kT < 0.001 && slide < 0.001) { if (pr.moved) { ctx.plant(pr.g, pr.x, pr.z, pr.ry); pr.moved = false; } continue; }
        pr.moved = true;
        ctx.plant(pr.g, pr.x + dx, pr.z, pr.ry);
        if (kG > 0.001) {
          pr.g.translateY(kG * pr.lift * (1.0 + 0.5 * (i % 3) + 0.2 * Math.sin(ck * 0.8 + pr.ph)));
          pr.g.rotateX(kG * 0.5 * Math.sin(ck * 0.45 + pr.ph)); pr.g.rotateZ(kG * 0.6 * Math.sin(ck * 0.37 + pr.ph));
        }
        if (kT > 0.001) pr.g.rotateZ(kT * (0.08 + (still ? 0 : 0.05 * Math.sin(ck * 5 + pr.ph))));
        if (slide > 0.001) pr.g.rotateZ(-slide * 0.25);
      }
    }

    // ---------- the clapperboard: open, a small twitch now and then, the snap ----------
    function stepClap(ctx, ck, still) {
      var C = S.clap, open = 0.42, since = ck - C.snapT, a;
      if (since >= 0 && since < 1.0) a = since < 0.07 ? open * (1 - since / 0.07) : since < 0.35 ? 0 : open * smooth(0.35, 0.8, since);
      else if (still) a = open;
      else { var tw = frac(ck / 2.6); a = open + (tw < 0.12 ? 0.18 * Math.sin(tw / 0.12 * Math.PI) : 0); }
      C.arm.rotation.z = a;
    }

    // ---------- the crew ----------
    function personMatrix(x, z, ry, lift, out) {
      var gy = S.ctx.groundY(x, z), up = TMP.up;
      up.set(x, gy + 14, z).normalize();
      TMP.q.setFromUnitVectors(TMP.Y, up).multiply(TMP.q2.setFromAxisAngle(TMP.Y, ry));
      TMP.p.set(x + up.x * lift, gy + up.y * lift, z + up.z * lift);
      return out.compose(TMP.p, TMP.q, TMP.one);
    }
    function local(px, py, pz, rx, ry, rz, out) {
      TMP.e.set(rx, ry, rz, 'YXZ'); TMP.q2.setFromEuler(TMP.e); TMP.p2.set(px, py, pz);
      return out.compose(TMP.p2, TMP.q2, TMP.one);
    }
    // pose: {sit, hip, lean, legL (thigh swing), armL, armR (pitch), armLz, armRz, head}
    var POSE = { sit: 0, hip: 0.82, lean: 0, leg: 0, armL: 0, armR: 0, armLz: 0.08, armRz: -0.08, head: 0 };
    function writePerson(i, x, z, ry, lift, extraRx, extraRz, pose) {
      var C = S.crew, M = TMP.mP, L = TMP.mL, Tm = TMP.mT, out = TMP.m4;
      personMatrix(x, z, ry, lift, M);
      if (extraRx || extraRz) M.multiply(local(0, 0.9, 0, extraRx, 0, extraRz, L)).multiply(local(0, -0.9, 0, 0, 0, 0, L));
      var hip = pose.hip;
      if (pose.sit) {
        C.thigh.setMatrixAt(i, out.multiplyMatrices(M, local(0, hip, 0, -Math.PI / 2, 0, 0, L)));
        C.shin.setMatrixAt(i, out.multiplyMatrices(M, local(0, hip, 0.4, 0, 0, 0, L)));
      } else {
        C.thigh.setMatrixAt(i, out.multiplyMatrices(M, local(0, hip, 0, pose.leg, 0, 0, L)));
        var kz = Math.sin(pose.leg) * 0.4, ky = hip - Math.cos(pose.leg) * 0.4;
        C.shin.setMatrixAt(i, out.multiplyMatrices(M, local(0, ky, kz, -Math.abs(pose.leg) * 0.6 + pose.leg * 0.4, 0, 0, L)));
      }
      Tm.multiplyMatrices(M, local(0, hip, 0, pose.lean, 0, 0, L));
      C.torso.setMatrixAt(i, Tm);
      C.head.setMatrixAt(i, out.multiplyMatrices(Tm, local(0, 0.58, 0, 0, pose.head, 0, L)));
      C.armL.setMatrixAt(i, out.multiplyMatrices(Tm, local(-0.29, 0.54, 0, pose.armL, 0, pose.armLz, L)));
      C.armR.setMatrixAt(i, out.multiplyMatrices(Tm, local(0.29, 0.54, 0, pose.armR, 0, pose.armRz, L)));
      if (i === 0) { S.boomHand = S.boomHand || new S.T.Vector3(); S.boomHand.set(0, -0.52, 0).applyMatrix4(TMP.m4.multiplyMatrices(Tm, local(0.29, 0.54, 0, pose.armR, 0, pose.armRz, L))); }
    }
    var PS = { sit: 0, hip: 0.82, lean: 0, leg: 0, armL: 0, armR: 0, armLz: 0.08, armRz: -0.08, head: 0 };
    function stepCrew(ctx, ck, dt, toyW, kG, kT, slide, still) {
      var C = S.crew, cc = S.cc;
      for (var i = 0; i < C.n; i++) {
        var c = C.list[i], st = C.st[i], ph = i * 1.37;
        // between two marks: stay, walk, stay, walk back
        var u = still ? 0.1 : frac(cc / c.per + i * 0.23), x, z, walking = false, at = 0, ry;
        if (u < 0.38) { x = c.a.x; z = c.a.z; at = 0; }
        else if (u < 0.5) { var k = smooth(0.38, 0.5, u); x = c.a.x + (c.b.x - c.a.x) * k; z = c.a.z + (c.b.z - c.a.z) * k; walking = true; ry = angTo(c.a.x, c.a.z, c.b.x, c.b.z); }
        else if (u < 0.88) { x = c.b.x; z = c.b.z; at = 1; }
        else { var k2 = smooth(0.88, 1, u); x = c.b.x + (c.a.x - c.b.x) * k2; z = c.b.z + (c.a.z - c.b.z) * k2; walking = true; ry = angTo(c.b.x, c.b.z, c.a.x, c.a.z); }
        if (c.job === 'boom' || c.job === 'actor') walking = false;
        // the pose for this job at this mark
        var P0 = PS; P0.sit = 0; P0.hip = 0.82; P0.lean = 0; P0.leg = 0; P0.armL = 0; P0.armR = 0; P0.armLz = 0.08; P0.armRz = -0.08; P0.head = 0;
        var wiggle = still ? 0 : Math.sin(ck * 1.3 + ph);
        if (c.job === 'boom') { ry = angTo(x, z, -3.2, -0.6) + 0.5; P0.armL = -2.55; P0.armR = -2.75; P0.armLz = 0.25; P0.armRz = -0.1; P0.lean = -0.12; P0.head = -0.35 + 0.1 * wiggle * (1 - toyW); }
        else if (c.job === 'lights') {
          if (!walking) { ry = at === 0 ? angTo(x, z, L1.x, L1.z) : angTo(x, z, REEL.x, REEL.z); }
          if (!walking && at === 0) { P0.armR = -2.5 + 0.25 * wiggle * (1 - toyW); P0.armL = -0.3; }
          if (!walking && at === 1) { P0.lean = 0.45; P0.armL = -0.7; P0.armR = -0.7; }
        } else if (c.job === 'camera') {
          if (!walking) ry = at === 0 ? angTo(x, z, CAM.x, CAM.z) : angTo(x, z, CASE.x, CASE.z);
          if (!walking && at === 0) { P0.armL = -1.25; P0.armR = -1.35 + 0.15 * wiggle * (1 - toyW); }
          if (!walking && at === 1) { P0.lean = 0.55 * (1 - toyW); P0.armL = -0.9; P0.armR = -0.9; }
          if (toyW > 0.01 && at === 1) { P0.lean = 0.0; P0.armL = -1.2; P0.armR = -1.2; }
        } else if (c.job === 'actor') {
          ry = angTo(x, z, CAM.x, CAM.z) - 0.35; P0.sit = 1; P0.hip = STOOL_H + 0.02;
          P0.armL = -0.5 + 0.35 * Math.sin(ck * 1.7) * (1 - toyW); P0.armR = -0.35 + 0.3 * Math.sin(ck * 1.3 + 1) * (1 - toyW); P0.head = 0.2 * Math.sin(ck * 0.6) * (1 - toyW);
        } else if (c.job === 'monitor') {
          if (!walking) ry = at === 0 ? angTo(x, z, MON.x, MON.z) : angTo(x, z, AIM.x, AIM.z);
          if (!walking && at === 0) { P0.armR = -1.45; P0.lean = 0.12; P0.armL = -0.2; }
          if (!walking && at === 1) { P0.sit = 1; P0.hip = 0.58; P0.armL = -0.5; P0.armR = -0.5; }
        }
        if (walking) { var sw = Math.sin(cc * 7.5 + ph); P0.leg = 0.45 * sw; P0.armL = -0.4 * sw; P0.armR = 0.4 * sw; }
        // smooth facing
        st.ry = still ? ry : angLerp(st.ry, ry, 1 - Math.exp(-dt / 0.15));
        var bob = walking ? Math.abs(Math.cos(cc * 7.5 + ph)) * 0.04 : 0;
        var lift = bob, erx = 0, erz = 0, ox = slide * (1.8 + i * 0.4);
        if (kG > 0.001) { lift += kG * (1.0 + 0.45 * (i % 3) + 0.2 * Math.sin(ck * 0.8 + i)); erx = kG * 0.7 * Math.sin(ck * 0.6 + i); erz = kG * 0.5 * Math.cos(ck * 0.5 + i); }
        if (kT > 0.001) erz += kT * 0.25;
        if (slide > 0.001) erz -= slide * 0.4;
        writePerson(i, x + ox, z, st.ry, lift, erx, erz, P0);
      }
      ['shin', 'thigh', 'torso', 'head', 'armL', 'armR'].forEach(function (k) { C[k].instanceMatrix.needsUpdate = true; });
    }

    function stepBoom(ctx, ck, kT, still) {
      var B = S.boom, h = S.boomHand;
      if (!h) return;
      var sway = still ? 0 : 0.12 * Math.sin(ck * 0.7) + 0.05 * Math.sin(ck * 1.9) + kT * 0.35 * Math.sin(ck * 3.1);
      var tx = -3.1 + sway, tz = -0.65 + 0.6 * sway, ty = S.ctx.groundY(tx, tz) + 2.65 + 0.08 * Math.sin(ck * 0.9);
      var dx = tx - h.x, dy = ty - h.y, dz = tz - h.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // the pole runs from just behind the hands to the mic
      TMP.p.set(dx / len, dy / len, dz / len);
      B.pole.position.set(h.x + dx * 0.5 - TMP.p.x * 0.2, h.y + dy * 0.5 - TMP.p.y * 0.2, h.z + dz * 0.5 - TMP.p.z * 0.2);
      B.pole.quaternion.setFromUnitVectors(TMP.Y, TMP.p);
      B.pole.scale.set(1, len + 0.4, 1);
      B.mic.position.set(tx, ty - 0.1, tz);
      B.mic.quaternion.copy(B.pole.quaternion).multiply(TMP.q2.setFromAxisAngle(TMP.X, -Math.PI / 2));
    }

    function stepLights(ctx, ck, toyOn, still) {
      if (!S.lights.length) return;
      // light 1 is being adjusted while the lights tech stands at it: it flicks on and off
      var tech = S.crew.list[1] && S.crew.list[1].job === 'lights' ? S.crew.st[1] : null;
      var atL1 = !!tech && !still && frac(S.cc / 11 + 0.23) < 0.38;
      var flick = atL1 ? (hash(Math.floor(ck * 3.2)) > 0.45 ? 1 : 0) : 1;
      var want = [toyOn ? 1 : flick, toyOn ? 1 : 0];
      for (var i = 0; i < S.lights.length; i++) {
        var L = S.lights[i];
        if (L.on !== want[i]) { L.on = want[i]; L.mat.color.set(want[i] ? '#fff3c4' : '#55595f'); }
      }
    }

    var MONCOLS = ['#8ccbe6', '#e9b730', '#7CCB5B', '#E8412B', '#f4efe2', '#2f3b5c', '#FF8A5B', '#29A8C9'];
    function stepMonitor(ctx, ck, toy, still) {
      var M = S.mon, k = still ? 3 : Math.floor(ck / 1.3);
      if (k !== S.monK) {
        S.monK = k;
        for (var i = 0; i < M.n; i++) M.blocks.setColorAt(i, TMP.c.set(MONCOLS[Math.floor(hash(k * 7 + i) * MONCOLS.length)]));
        M.blocks.instanceColor.needsUpdate = true;
      }
      var blink = still || toy || frac(ck) < 0.5;
      M.rec.visible = blink;
      var on = blink ? 1 : 0;
      if (S.tally.on !== on) { S.tally.on = on; S.tally.mat.color.set(on ? '#ff2a1a' : '#5a1a14'); }
    }

    function stepCables(ctx, ck, kT, still) {
      var Cb = S.cables; if (!Cb || !S.lights.length) return;
      var m4 = TMP.m4, a = TMP.p, b = TMP.p2, q = TMP.q, s = TMP.s;
      for (var c = 0; c < 2; c++) {
        var L = S.props[c === 0 ? 3 : 4];          // the two light stands, in build order after the stools and the camera
        var lx = L.g.position.x, ly = L.g.position.y, lz = L.g.position.z;
        var ex = c === 0 ? REEL.x - 0.15 : L2.x + 0.7, ez = c === 0 ? REEL.z + 0.1 : L2.z + 0.5, ey = ctx.groundY(ex, ez) + 0.03;
        var topY = ly + S.lights[c].top - 0.15, prevX = lx, prevY = topY, prevZ = lz;
        for (var j = 1; j <= Cb.n; j++) {
          var u = j / Cb.n, sag = Math.sin(Math.PI * u);
          var sw = still ? 0 : (0.05 + kT * 0.25) * Math.sin(ck * 1.4 + c * 2 + u * 2) * sag;
          var px = lx + (ex - lx) * u + sw, pz = lz + (ez - lz) * u + sw * 0.6, py = topY + (ey - topY) * Math.pow(u, 0.7) - 0.25 * sag;
          a.set(prevX, prevY, prevZ); b.set(px - prevX, py - prevY, pz - prevZ);
          var ln = b.length(); b.divideScalar(ln || 1);
          q.setFromUnitVectors(TMP.Y, b);
          a.addScaledVector(b, ln / 2); s.set(1, ln + 0.02, 1);
          Cb.mesh.setMatrixAt(c * Cb.n + j - 1, m4.compose(a, q, s));
          prevX = px; prevY = py; prevZ = pz;
        }
      }
      s.set(1, 1, 1);
      Cb.mesh.instanceMatrix.needsUpdate = true;
    }

    // ---------- YOU: his three real roles, in order ----------
    function sendPlace(ctx, x, z, ry) { var c = S.you.cmd; if (Math.abs(c[0] - x) + Math.abs(c[1] - z) + Math.abs(c[2] - ry) < 0.002) return; c[0] = x; c[1] = z; c[2] = ry; ctx.you.place(x, z, ry); }
    function sendOffset(ctx, dx, dy, dz, rx, rz) { var o = S.you.off; if (Math.abs(o[0] - dx) + Math.abs(o[1] - dy) + Math.abs(o[2] - dz) + Math.abs(o[3] - rx) + Math.abs(o[4] - rz) < 0.001) return; o[0] = dx; o[1] = dy; o[2] = dz; o[3] = rx; o[4] = rz; ctx.you.offset(dx, dy, dz, rx, rz); }
    function look(ctx, key, x, y, z) { if (S.you.look === key) return; S.you.look = key; if (key === '') ctx.you.lookAt(null); else ctx.you.lookAt(x, y, z); }
    function stepYou(ctx, dt, ck, p, kG, kT, kS, slide, still) {
      var Y = S.you;
      if (kG > 0.02) sendOffset(ctx, 0, kG * (1.4 + 0.2 * Math.sin(ck * 0.9)), 0, kG * 0.2 * Math.sin(ck * 0.7), kG * 0.25 * Math.sin(ck * 0.5 + 1));
      else if (kT > 0.02) sendOffset(ctx, 0, 0, 0, 0, kT * 0.2);
      else if (kS > 0.02 || S.stopT > 0) sendOffset(ctx, slide * 2.4, 0, 0, 0, 0);
      else sendOffset(ctx, 0, 0, 0, 0, 0);
      S.phone.visible = false;
      if (S.mode === 'gravity' || S.mode === 'stop' || kG > 0.05 || kS > 0.05) { sendPlace(ctx, Y.x, Y.z, Y.ry); return; }
      if (Y.wait > 0) { Y.wait -= dt; sendPlace(ctx, Y.x, Y.z, Y.ry); return; }
      var role = p < 0.33 ? 'A' : p < 0.66 ? 'B' : 'C', T0 = S.spots[role];
      if (role !== Y.role) {
        var wasSit = Y.role === 'B' && Y.phase === 'pose';
        Y.role = role; Y.t = 0;
        // the walk between the tripod and the stool goes round the camera and across the front of the lens
        var W1 = S.way[0], W2 = S.way[1];
        Y.path = role === 'B' && Y.prev === 'A' ? [W1, W2, T0] : role === 'A' && Y.prev === 'B' ? [W2, W1, T0] : [T0];
        Y.prev = role;
        if (Y.snap || still) {
          Y.snap = false; Y.x = T0.x; Y.z = T0.z; Y.ry = T0.ry; Y.phase = 'arrive';
        } else if (wasSit) { Y.phase = 'stand'; ctx.you.play('StandUp'); }
        else { Y.phase = 'walk'; ctx.you.play('Walk', { loop: true }); }
        look(ctx, '', 0, 0, 0);
      }
      Y.t += dt;
      if (Y.phase === 'stand' && Y.t > 1.0) { Y.phase = 'walk'; Y.t = 0; ctx.you.play('Walk', { loop: true }); }
      if (Y.phase === 'walk') {
        var wp = Y.path[0], dx = wp.x - Y.x, dz = wp.z - Y.z, d = Math.hypot(dx, dz), stepL = 1.35 * dt;
        if (d <= stepL || d < 0.02) { Y.x = wp.x; Y.z = wp.z; if (Y.path.length > 1) Y.path.shift(); else Y.phase = 'arrive'; }
        else {
          Y.x += dx / d * stepL; Y.z += dz / d * stepL;
          Y.ry = angLerp(Y.ry, Math.atan2(dx, dz), 1 - Math.exp(-dt / 0.12));
        }
      }
      if (Y.phase === 'arrive') {
        Y.phase = 'pose'; Y.t = 0;
        if (role === 'A') { ctx.you.play('Idle'); }
        else if (role === 'B') { ctx.you.play('Idle'); ctx.you.play('SitDown', { hold: true }); }
        else { ctx.you.play('Walk_Carry', { loop: true }); Y.ct = 0; }
      }
      if (Y.phase === 'pose') {
        if (role !== 'C') Y.ry = still ? T0.ry : angLerp(Y.ry, T0.ry, 1 - Math.exp(-dt / 0.15));
        if (role === 'A') look(ctx, 'vf', CAM.x - Math.sin(S.camRy) * 0.38, S.ctx.groundY(CAM.x, CAM.z) + 1.66, CAM.z - Math.cos(S.camRy) * 0.38);
        if (role === 'B' && Y.t > 0.85 && !Y.snapped) { Y.snapped = true; S.clap.snapT = S.ck; if (S.fromPage) sfx('clap'); }
        if (role === 'C') {
          // he films the crew on the move: a slow walk in toward them with the phone up, a turn, a walk back out
          var Ci = S.spots.Cin, IN = 2.9, OUT = 2.0, TURN = 0.6, CY = IN + OUT + 2 * TURN;
          Y.ct = (Y.ct || 0) + dt;
          var u = still ? 0 : Y.ct % CY, inRy = T0.ry, outRy = T0.ry + Math.PI;
          if (u < IN) { var k = u / IN; Y.x = T0.x + (Ci.x - T0.x) * k; Y.z = T0.z + (Ci.z - T0.z) * k; Y.ry = angLerp(Y.ry, inRy, 1 - Math.exp(-dt / 0.15)); }
          else if (u < IN + TURN) { Y.x = Ci.x; Y.z = Ci.z; Y.ry = angLerp(Y.ry, outRy, 1 - Math.exp(-dt / 0.12)); }
          else if (u < IN + TURN + OUT) { var k2 = (u - IN - TURN) / OUT; Y.x = Ci.x + (T0.x - Ci.x) * k2; Y.z = Ci.z + (T0.z - Ci.z) * k2; Y.ry = angLerp(Y.ry, outRy, 1 - Math.exp(-dt / 0.15)); }
          else { Y.x = T0.x; Y.z = T0.z; Y.ry = angLerp(Y.ry, inRy, 1 - Math.exp(-dt / 0.12)); }
          if (u < IN + TURN * 0.5 || u > CY - TURN * 0.5) look(ctx, 'crew', -0.6, S.ctx.groundY(-0.6, -0.9) + 1.3, -0.9); else look(ctx, '', 0, 0, 0);
          // the phone held up in both hands, screen toward him
          var fx = Math.sin(Y.ry), fz = Math.cos(Y.ry);
          S.ctx.plant(S.phone, Y.x + fx * 0.47, Y.z + fz * 0.47, Y.ry);
          S.phone.translateY(0.9);
          S.phone.rotateX(-0.12);
          S.phone.visible = true;
        }
      }
      if (Y.role !== 'B' || Y.phase !== 'pose') Y.snapped = false;
      sendPlace(ctx, Y.x, Y.z, Y.ry);
    }

    function stepRain(ctx, dt, kT, still) {
      var RN = S.rain, m4 = TMP.m4, pV = TMP.p, sV = TMP.s;
      RN.mesh.visible = kT > 0.02;
      if (!RN.mesh.visible) return;
      var rq = TMP.q.setFromAxisAngle(TMP.Z, -0.45);
      for (var ri = 0; ri < RN.n; ri++) {
        var d = RN.d[ri];
        if (!still) { d[1] -= dt * 14; d[0] -= dt * 6.5; }
        if (d[1] < ctx.groundY(d[0], d[2]) || d[0] < -11) { d[1] = 10 + Math.random() * 3; d[0] = -6 + Math.random() * 17; }
        pV.set(d[0], d[1], d[2]); sV.set(1, kT, 1);
        RN.mesh.setMatrixAt(ri, m4.compose(pV, rq, sV));
      }
      RN.mesh.instanceMatrix.needsUpdate = true;
      sV.set(1, 1, 1);
    }
  }
  if (window.WORLD) go(); else window.addEventListener('DOMContentLoaded', go);
})();
