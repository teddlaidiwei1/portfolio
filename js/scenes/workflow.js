/* W5 factory: a calm tools yard. See briefs/w5-factory.md and briefs/world-api.md. */
(function () {
  'use strict';
  function go() {
    var W = window.WORLD;
    if (!W || !W.registerScene) return;
    var MARKS = {
      claude: 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z',
      openai: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
      gemini: 'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81',
      ollama: 'M16.361 10.26a.894.894 0 0 0-.558.47l-.072.148.001.207c0 .193.004.217.059.353.076.193.152.312.291.448.24.238.51.3.872.205a.86.86 0 0 0 .517-.436.752.752 0 0 0 .08-.498c-.064-.453-.33-.782-.724-.897a1.06 1.06 0 0 0-.466 0zm-9.203.005c-.305.096-.533.32-.65.639a1.187 1.187 0 0 0-.06.52c.057.309.31.59.598.667.362.095.632.033.872-.205.14-.136.215-.255.291-.448.055-.136.059-.16.059-.353l.001-.207-.072-.148a.894.894 0 0 0-.565-.472 1.02 1.02 0 0 0-.474.007Zm4.184 2c-.131.071-.223.25-.195.383.031.143.157.288.353.407.105.063.112.072.117.136.004.038-.01.146-.029.243-.02.094-.036.194-.036.222.002.074.07.195.143.253.064.052.076.054.255.059.164.005.198.001.264-.03.169-.082.212-.234.15-.525-.052-.243-.042-.28.087-.355.137-.08.281-.219.324-.314a.365.365 0 0 0-.175-.48.394.394 0 0 0-.181-.033c-.126 0-.207.03-.355.124l-.085.053-.053-.032c-.219-.13-.259-.145-.391-.143a.396.396 0 0 0-.193.032zm.39-2.195c-.373.036-.475.05-.654.086-.291.06-.68.195-.951.328-.94.46-1.589 1.226-1.787 2.114-.04.176-.045.234-.045.53 0 .294.005.357.043.524.264 1.16 1.332 2.017 2.714 2.173.3.033 1.596.033 1.896 0 1.11-.125 2.064-.727 2.493-1.571.114-.226.169-.372.22-.602.039-.167.044-.23.044-.523 0-.297-.005-.355-.045-.531-.288-1.29-1.539-2.304-3.072-2.497a6.873 6.873 0 0 0-.855-.031zm.645.937a3.283 3.283 0 0 1 1.44.514c.223.148.537.458.671.662.166.251.26.508.303.82.02.143.01.251-.043.482-.08.345-.332.705-.672.957a3.115 3.115 0 0 1-.689.348c-.382.122-.632.144-1.525.138-.582-.006-.686-.01-.853-.042-.57-.107-1.022-.334-1.35-.68-.264-.28-.385-.535-.45-.946-.03-.192.025-.509.137-.776.136-.326.488-.73.836-.963.403-.269.934-.46 1.422-.512.187-.02.586-.02.773-.002zm-5.503-11a1.653 1.653 0 0 0-.683.298C5.617.74 5.173 1.666 4.985 2.819c-.07.436-.119 1.04-.119 1.503 0 .544.064 1.24.155 1.721.02.107.031.202.023.208a8.12 8.12 0 0 1-.187.152 5.324 5.324 0 0 0-.949 1.02 5.49 5.49 0 0 0-.94 2.339 6.625 6.625 0 0 0-.023 1.357c.091.78.325 1.438.727 2.04l.13.195-.037.064c-.269.452-.498 1.105-.605 1.732-.084.496-.095.629-.095 1.294 0 .67.009.803.088 1.266.095.555.288 1.143.503 1.534.071.128.243.393.264.407.007.003-.014.067-.046.141a7.405 7.405 0 0 0-.548 1.873c-.062.417-.071.552-.071.991 0 .56.031.832.148 1.279L3.42 24h1.478l-.05-.091c-.297-.552-.325-1.575-.068-2.597.117-.472.25-.819.498-1.296l.148-.29v-.177c0-.165-.003-.184-.057-.293a.915.915 0 0 0-.194-.25 1.74 1.74 0 0 1-.385-.543c-.424-.92-.506-2.286-.208-3.451.124-.486.329-.918.544-1.154a.787.787 0 0 0 .223-.531c0-.195-.07-.355-.224-.522a3.136 3.136 0 0 1-.817-1.729c-.14-.96.114-2.005.69-2.834.563-.814 1.353-1.336 2.237-1.475.199-.033.57-.028.776.01.226.04.367.028.512-.041.179-.085.268-.19.374-.431.093-.215.165-.333.36-.576.234-.29.46-.489.822-.729.413-.27.884-.467 1.352-.561.17-.035.25-.04.569-.04.319 0 .398.005.569.04a4.07 4.07 0 0 1 1.914.997c.117.109.398.457.488.602.034.057.095.177.132.267.105.241.195.346.374.43.14.068.286.082.503.045.343-.058.607-.053.943.016 1.144.23 2.14 1.173 2.581 2.437.385 1.108.276 2.267-.296 3.153-.097.15-.193.27-.333.419-.301.322-.301.722-.001 1.053.493.539.801 1.866.708 3.036-.062.772-.26 1.463-.533 1.854a2.096 2.096 0 0 1-.224.258.916.916 0 0 0-.194.25c-.054.109-.057.128-.057.293v.178l.148.29c.248.476.38.823.498 1.295.253 1.008.231 2.01-.059 2.581a.845.845 0 0 0-.044.098c0 .006.329.009.732.009h.73l.02-.074.036-.134c.019-.076.057-.3.088-.516.029-.217.029-1.016 0-1.258-.11-.875-.295-1.57-.597-2.226-.032-.074-.053-.138-.046-.141.008-.005.057-.074.108-.152.376-.569.607-1.284.724-2.228.031-.26.031-1.378 0-1.628-.083-.645-.182-1.082-.348-1.525a6.083 6.083 0 0 0-.329-.7l-.038-.064.131-.194c.402-.604.636-1.262.727-2.04a6.625 6.625 0 0 0-.024-1.358 5.512 5.512 0 0 0-.939-2.339 5.325 5.325 0 0 0-.95-1.02 8.097 8.097 0 0 1-.186-.152.692.692 0 0 1 .023-.208c.208-1.087.201-2.443-.017-3.503-.19-.924-.535-1.658-.98-2.082-.354-.338-.716-.482-1.15-.455-.996.059-1.8 1.205-2.116 3.01a6.805 6.805 0 0 0-.097.726c0 .036-.007.066-.015.066a.96.96 0 0 1-.149-.078A4.857 4.857 0 0 0 12 3.03c-.832 0-1.687.243-2.456.698a.958.958 0 0 1-.148.078c-.008 0-.015-.03-.015-.066a6.71 6.71 0 0 0-.097-.725C8.997 1.392 8.337.319 7.46.048a2.096 2.096 0 0 0-.585-.041Zm.293 1.402c.248.197.523.759.682 1.388.03.113.06.244.069.292.007.047.026.152.041.233.067.365.098.76.102 1.24l.002.475-.12.175-.118.178h-.278c-.324 0-.646.041-.954.124l-.238.06c-.033.007-.038-.003-.057-.144a8.438 8.438 0 0 1 .016-2.323c.124-.788.413-1.501.696-1.711.067-.05.079-.049.157.013zm9.825-.012c.17.126.358.46.498.888.28.854.36 2.028.212 3.145-.019.14-.024.151-.057.144l-.238-.06a3.693 3.693 0 0 0-.954-.124h-.278l-.119-.178-.119-.175.002-.474c.004-.669.066-1.19.214-1.772.157-.623.434-1.185.68-1.382.078-.062.09-.063.159-.012z',
      blender: 'M12.51 13.214c.046-.8.438-1.506 1.03-2.006a3.424 3.424 0 0 1 2.212-.79c.85 0 1.631.3 2.211.79.592.5.983 1.206 1.028 2.005.045.823-.285 1.586-.865 2.153a3.389 3.389 0 0 1-2.374.938 3.393 3.393 0 0 1-2.376-.938c-.58-.567-.91-1.33-.865-2.152M7.35 14.831c.006.314.106.922.256 1.398a7.372 7.372 0 0 0 1.593 2.757 8.227 8.227 0 0 0 2.787 2.001 8.947 8.947 0 0 0 3.66.76 8.964 8.964 0 0 0 3.657-.772 8.285 8.285 0 0 0 2.785-2.01 7.428 7.428 0 0 0 1.592-2.762 6.964 6.964 0 0 0 .25-3.074 7.123 7.123 0 0 0-1.016-2.779 7.764 7.764 0 0 0-1.852-2.043h.002L13.566 2.55l-.02-.015c-.492-.378-1.319-.376-1.86.002-.547.382-.609 1.015-.123 1.415l-.001.001 3.126 2.543-9.53.01h-.013c-.788.001-1.545.518-1.695 1.172-.154.665.38 1.217 1.2 1.22V8.9l4.83-.01-8.62 6.617-.034.025c-.813.622-1.075 1.658-.563 2.313.52.667 1.625.668 2.447.004L7.414 14s-.069.52-.063.831zm12.09 1.741c-.97.988-2.326 1.548-3.795 1.55-1.47.004-2.827-.552-3.797-1.538a4.51 4.51 0 0 1-1.036-1.622 4.282 4.282 0 0 1 .282-3.519 4.702 4.702 0 0 1 1.153-1.371c.942-.768 2.141-1.183 3.396-1.185 1.256-.002 2.455.41 3.398 1.175.48.391.87.854 1.152 1.367a4.28 4.28 0 0 1 .522 1.706 4.236 4.236 0 0 1-.239 1.811 4.54 4.54 0 0 1-1.035 1.626',
      threejs: 'M.38 0a.268.268 0 0 0-.256.332l2.894 11.716a.268.268 0 0 0 .01.04l2.89 11.708a.268.268 0 0 0 .447.128L23.802 7.15a.268.268 0 0 0-.112-.45l-5.784-1.667a.268.268 0 0 0-.123-.035L6.38 1.715a.268.268 0 0 0-.144-.04L.456.01A.268.268 0 0 0 .38 0zm.374.654L5.71 2.08 1.99 5.664zM6.61 2.34l4.864 1.4-3.65 3.515zm-.522.12l1.217 4.926-4.877-1.4zm6.28 1.538l4.878 1.404-3.662 3.53zm-.52.13l1.208 4.9-4.853-1.392zm6.3 1.534l4.947 1.424-3.715 3.574zm-.524.12l1.215 4.926-4.876-1.398zm-15.432.696l4.964 1.424-3.726 3.586zM8.047 8.15l4.877 1.4-3.66 3.527zm-.518.137l1.236 5.017-4.963-1.432zm6.274 1.535l4.965 1.425-3.73 3.586zm-.52.127l1.235 5.012-4.958-1.43zm-9.63 2.438l4.873 1.406-3.656 3.523zm5.854 1.687l4.863 1.403-3.648 3.51zm-.54.04l1.214 4.927-4.875-1.4zm-3.896 4.02l5.037 1.442-3.782 3.638z'
    };

    // W5: one still tools yard. No line clock, scroll beats, HUD or autonomous machine loops.
    var S = null;
    var STATIONS = [
      { x: -4.25, tool: 'gemini', color: '#b69b4d' },
      { x: -2.20, tool: 'claude', color: '#78a4ad' },
      { x: -0.10, tool: 'threejs', color: '#aa7050' },
      { x: 2.00, tool: 'ollama', color: '#465352' },
      { x: 4.05, tool: 'openai', color: '#b5b6a8' }
    ];
    var YOU = { x: 1.10, z: 3.30, yaw: 2.70 };   // lead r7: front and centre, facing his line (at x 5.8 he leaned 22 degrees with the curve and left the frame)
    var INK = '#232928', PAPER = '#ddd7c7', WOOD = '#a28761';

    // Static parts share one vertex-colour mesh per machine and per tier.
    function Baker(T, X, mat) { this.T = T; this.X = X; this.mat = mat; this.list = []; }
    Baker.prototype.part = function (geo, color, x, y, z, rx, ry, rz) {
      var T = this.T, g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      g.deleteAttribute('uv'); g.deleteAttribute('uv1');
      var obj = new T.Object3D();
      obj.position.set(x || 0, y || 0, z || 0);
      obj.rotation.set(rx || 0, ry || 0, rz || 0); obj.updateMatrix();
      g.applyMatrix4(obj.matrix);
      var c = new T.Color(color), a = new Float32Array(g.attributes.position.count * 3);
      for (var i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3)); g.clearGroups(); this.list.push(g);
    };
    Baker.prototype.box = function (w, h, d, color, x, y, z, rx, ry, rz) {
      var g = new this.T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
      this.part(g, color, x, y, z, rx, ry, rz);
    };
    Baker.prototype.cyl = function (r, h, n, color, x, y, z, rx, ry, rz) {
      this.part(new this.T.CylinderGeometry(r, r, h, n), color, x, y, z, rx, ry, rz);
    };
    Baker.prototype.finish = function (parent, name) {
      if (!this.list.length) return;
      var g = this.X.mergeGeometries(this.list, false);
      this.list.forEach(function (p) { p.dispose(); }); this.list = [];
      var mesh = new this.T.Mesh(g, this.mat); mesh.name = name || 'Still parts'; parent.add(mesh);
      return mesh;
    };

    function markTexture(T, keys) {
      var cv = document.createElement('canvas'), dual = keys.length > 1;
      cv.width = dual ? 1024 : 512; cv.height = 512;
      var g = cv.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, cv.width, cv.height);
      var size = dual ? 432 : 408, gap = dual ? 32 : 0;
      var left = (cv.width - (keys.length * size + (keys.length - 1) * gap)) / 2;
      g.fillStyle = INK;
      keys.forEach(function (k, i) {
        g.save(); g.translate(left + i * (size + gap), (512 - size) / 2); g.scale(size / 24, size / 24);
        g.fill(new Path2D(MARKS[k])); g.restore();
      });
      var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return tex;
    }
    function crateTexture(T, words) {
      var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640;
      var g = cv.getContext('2d'); g.fillStyle = WOOD; g.fillRect(0, 0, 1024, 640);
      // Broad planks, two battens and a large direct ink stencil: no paper label.
      g.fillStyle = '#8b7251';
      [14, 606].forEach(function (y) { g.fillRect(0, y, 1024, 20); });
      [26, 930].forEach(function (x) { g.fillRect(x, 0, 68, 640); });
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 270px Arial';
      var lines = words ? words.split(' ') : [];
      if (!words) { /* plain crate: planks and battens only */ }
      else if (lines.length > 1) {
        g.fillText(lines[0], 512, 220, 790); g.fillText(lines[1], 512, 430, 790);
      } else { g.font = '900 260px Arial'; g.fillText(words, 512, 330, 790); }
      var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return tex;
    }

    W.registerScene('workflow', {
      // Only the heading and lens are supplied. world.js owns distance, shift and dive easing.
      shots: [{ pos: [0.7, 6.4, 20], look: [0, 1.0, 0], fov: 34, you: [YOU.x, YOU.z] }],
      build: function (ctx) {
        var T = ctx.THREE, X = ctx.THREEX, root = new T.Group(); root.name = 'W5 tools factory';
        var hi = new T.Group(), low = new T.Group(); hi.name = 'High detail'; low.name = 'Low detail';
        root.add(hi, low);
        S = { ctx: ctx, root: root, hi: hi, low: low, machines: [], clock: 0, active: null,
          until: 0, paused: false, arrived: false, quality: ctx.quality,
          // r11 pass 4: the page's active pipeline step (site:pipeline), so the lamps follow the words
          step: (window.SITE && typeof window.SITE.pipelineStep === 'function') ? window.SITE.pipelineStep() : 0 };
        window.addEventListener('site:pipeline', onStep);
        var sep = function (c, r) { return ctx.separate ? ctx.separate(c, r || 1.6) : c; };
        var vm = ctx.mat('#ffffff', { vertexColors: true, roughness: 0.88 });
        var Y = new T.Vector3(0, 1, 0), up = new T.Vector3(), yaw = new T.Quaternion();
        function bake() { return new Baker(T, X, vm); }
        function plant(parent, x, z, turn, tilt, rise) {
          var g = new T.Group(), gy = ctx.groundY(x, z);
          up.set(x, gy + ctx.R, z).normalize().lerp(Y, 1 - (tilt === undefined ? 0.18 : tilt)).normalize();
          g.position.set(x, gy + 0.025 + (rise || 0), z);
          g.quaternion.setFromUnitVectors(Y, up).multiply(yaw.setFromAxisAngle(Y, turn || 0));
          parent.add(g); return g;
        }
        function groundLocal(g, x, z) {
          g.updateMatrix();
          var p = new T.Vector3(x, 0, z).applyMatrix4(g.matrix);
          p.y = ctx.groundY(p.x, p.z) + 0.022;
          return p.applyMatrix4(g.matrix.clone().invert());
        }
        function plinth(g, w, d, z) {
          var points = [], corners = [[-w / 2, z - d / 2], [w / 2, z - d / 2],
            [w / 2, z + d / 2], [-w / 2, z + d / 2]];
          corners.forEach(function (c) { points.push(c[0], 0, c[1]); });
          corners.forEach(function (c) { var p = groundLocal(g, c[0], c[1]); points.push(p.x, p.y, p.z); });
          var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
          geo.setIndex([0, 3, 1, 1, 3, 2, 0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5,
            2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7]); geo.computeVertexNormals();
          var m = new T.Mesh(geo, ctx.mat(sep('#7f8b78'))); m.name = 'Footing meeting the curved ground'; g.add(m);
        }
        function textured(parent, w, h, tex, x, y, z, name) {
          var mat = new T.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
          var pl = new T.Mesh(new T.PlaneGeometry(w, h), mat); pl.position.set(x, y, z); pl.name = name;
          parent.add(pl); return pl;
        }

        // A small continuous slab on the curve, without seams, stripes or a surrounding busy yard.
        function yard(parent, nx, nz) {
          var pos = [], ind = [], w = 12.6, d = 4.4;
          for (var j = 0; j <= nz; j++) for (var i = 0; i <= nx; i++) {
            var x = -w / 2 + w * i / nx, z = -1.85 + d * j / nz;
            pos.push(x, ctx.groundY(x, z) + 0.018, z);
          }
          for (var b = 0; b < nz; b++) for (var a = 0; a < nx; a++) {
            var k = b * (nx + 1) + a;
            ind.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
          }
          var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
          geo.setIndex(ind); geo.computeVertexNormals();
          var mesh = new T.Mesh(geo, ctx.mat(sep('#b5b6a4', 1.65))); mesh.name = 'Curved yard slab'; parent.add(mesh);
        }
        yard(hi, 36, 12); yard(low, 12, 4);

        // Fixed roller conveyor. Each short frame follows the ground; jobs never move or change slots.
        function belt(parent, lo) {
          var group = new T.Group(); parent.add(group); parent = group;
          var b = bake(), n = lo ? 24 : 44, seg = lo ? 6 : 18;
          for (var i = 0; i < 14; i++) {
            var x = -5.65 + (i + 0.5) * 10.55 / 14;
            var frame = plant(parent, x, 0.55, 0, 1), f = bake();
            [-0.43, 0.43].forEach(function (z) { f.box(0.77, 0.12, 0.08, '#52615c', 0, 0.48, z); });
            if (i % 2 === 0) [-0.34, 0.34].forEach(function (z) { f.box(0.08, 0.48, 0.08, '#52615c', 0, 0, z); });
            f.finish(frame, 'Fixed conveyor frame');
          }
          for (var r = 0; r < n; r++) {
            var rx = -5.65 + (r + 0.5) * 10.55 / n, rg = plant(parent, rx, 0.55, 0, 1), rb = bake();
            rb.cyl(0.055, 0.77, seg, '#8d9990', 0, 0.59, 0, Math.PI / 2); rb.finish(rg, 'Still roller');
          }
          STATIONS.forEach(function (s, i) {
            var job = plant(parent, s.x, 0.55, 0, 1), jb = bake();
            jb.box(0.48, 0.40, 0.46, i === 2 ? '#9b6550' : '#999d8f', 0, 0.65, 0);
            jb.box(0.10, 0.405, 0.465, '#c3b99e', 0.02, 0.65, 0); jb.finish(job, 'Fixed job at ' + s.tool);
          });
          b.finish(parent);
          // Bake the full fixed belt into one draw call, including its curved placement.
          parent.updateMatrixWorld(true);
          var pieces = [], inv = parent.matrixWorld.clone().invert();
          parent.traverse(function (m) {
            if (!m.isMesh) return;
            pieces.push(m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
            m.geometry.dispose();
          });
          parent.clear();
          var merged = X.mergeGeometries(pieces, false); pieces.forEach(function (p) { p.dispose(); });
          var fixed = new T.Mesh(merged, vm); fixed.name = 'Fixed belt and five held jobs'; parent.add(fixed);
        }
        belt(hi, false); belt(low, true);

        STATIONS.forEach(function (data, index) {
          var g = plant(root, data.x, -0.53, 0, 0.18, 0.34); g.name = data.tool + ' machine';
          plinth(g, 1.43, 1.12, -0.16);
          g.userData.clickable = data.tool;
          var h = new T.Group(), l = new T.Group(); g.add(h, l);
          var keys = [data.tool];   // lead r7: tinyworld is built with three.js only
          var boardW = index === 2 ? 1.98 : 1.40, boardH = index === 2 ? 0.99 : 1.40;
          var body = bake(), color = sep(data.color);
          // All signs are kept on both tiers, above rather than pasted on the body.
          body.box(0.065, 1.05, 0.065, '#626b60', 0, 2.16, -0.05);
          body.box(boardW + 0.08, boardH + 0.08, 0.12, '#404a43', 0, 3.41 - boardH / 2 - 0.04, -0.05);
          textured(g, boardW, boardH, markTexture(T, keys), 0, 3.41, 0.016, data.tool + ' sign');
          var light = new T.Mesh(new T.BoxGeometry(0.15, 0.09, 0.04), ctx.mat('#536056'));
          light.position.set(0.50, 2.50, 0.22); light.name = data.tool + ' response lamp'; g.add(light);
          var station = { g: g, tool: data.tool, high: h, low: l, light: light, off: light.material, on: ctx.mat('#d0b46e') };
          S.machines.push(station);

          function machine(parent, lo) {
            var b = bake(), n = lo ? 6 : 24;
            // The shared footing follows the curve under this mostly upright body.
            if (index === 0) {
              // Gemini: a research cabinet with a held reading and two deep paper trays.
              b.box(1.25, 2.22, 0.82, color, 0, 0, -0.20);
              b.box(0.96, 1.03, 0.045, '#303d3d', 0, 0.98, 0.225);
              [0.0, 0.23, 0.46].forEach(function (y, k) {
                b.box(0.67 - k * 0.13, 0.045, 0.018, '#adb8aa', -0.08, 1.78 - y, 0.255);
              });
              [0.22, 0.51].forEach(function (y) {
                b.box(0.93, 0.075, 0.55, '#7b754e', 0, y, 0.08);
                b.box(0.72, 0.07, 0.39, PAPER, 0, y + 0.075, 0.08);
              });
              if (!lo) for (var v = 0; v < 4; v++) b.box(0.70, 0.04, 0.02, '#837a4d', 0, 0.67 + v * 0.08, 0.223);
            } else if (index === 1) {
              // Claude: a typewriter, with one sheet held in the platen.
              b.box(1.32, 0.84, 0.88, '#657e7c', 0, 0, -0.05);
              b.box(1.39, 0.23, 1.0, color, 0, 0.84, -0.03);
              b.box(1.15, 0.16, 0.56, color, 0, 1.08, 0.22, 0.18);
              b.box(0.95, 1.12, 0.055, PAPER, 0, 1.20, -0.35, -0.08);
              [0.0, 0.23, 0.46, 0.69].forEach(function (y, k) {
                var sy = 0.92 - y;
                b.box(k % 2 ? 0.60 : 0.70, 0.035, 0.018, '#566052', -0.03,
                  1.20 + sy * Math.cos(0.08) + 0.036 * Math.sin(0.08),
                  -0.35 - sy * Math.sin(0.08) + 0.036 * Math.cos(0.08), -0.08);
              });
              b.cyl(0.10, 1.38, n, '#384b49', 0, 1.22, -0.28, 0, 0, Math.PI / 2);
              for (var row = 0; row < 3; row++) for (var key = 0; key < (lo ? 5 : 7); key++) {
                var kx = (key - (lo ? 2 : 3)) * (lo ? 0.19 : 0.145);
                if (lo) b.box(0.13, 0.055, 0.11, '#314946', kx, 1.22 - row * 0.027, 0.17 + row * 0.15);
                else b.cyl(0.054, 0.065, 16, '#314946', kx, 1.22 - row * 0.027, 0.17 + row * 0.15);
              }
            } else if (index === 2) {
              // Blender + three.js: a printer holding a small, completely finished planet.
              b.box(1.45, 0.79, 1.10, color, 0, 0, -0.10);
              b.box(1.48, 0.09, 1.12, '#7e6c53', 0, 0.79, -0.10);
              [-0.65, 0.65].forEach(function (x) {
                [-0.58, 0.38].forEach(function (z) { b.box(0.085, 1.62, 0.085, color, x, 0.88, z); });
                b.box(0.09, 0.10, 1.06, color, x, 2.42, -0.10);
              });
              [-0.58, 0.38].forEach(function (z) { b.box(1.38, 0.10, 0.09, color, 0, 2.42, z); });
              b.box(1.13, 0.065, 0.83, '#586357', 0, 0.92, -0.09);
              b.box(1.26, 0.07, 0.07, '#636e60', 0, 2.14, 0.10);
              b.box(0.22, 0.24, 0.22, '#37433c', 0.28, 2.02, 0.10);
              b.part(new T.IcosahedronGeometry(0.36, lo ? 0 : 2), '#718f8a', 0, 1.36, -0.05);
              b.part(new T.IcosahedronGeometry(0.20, lo ? 0 : 1), '#96a478', -0.13, 1.51, 0.15);
              b.cyl(0.25, 0.10, n, '#5d8078', 0.48, 1.80, -0.50, Math.PI / 2);
              b.cyl(0.09, 0.13, n, '#35463d', 0.48, 1.80, -0.44, Math.PI / 2);
              if (!lo) [-0.53, 0.53].forEach(function (x) { b.cyl(0.025, 1.48, 12, '#929b87', x, 1.65, -0.29); });
            } else if (index === 3) {
              // Ollama: a local computer/speaker cabinet. No audio meters or pulsing cones.
              b.box(1.26, 2.18, 0.87, color, 0, 0, -0.17);
              [0.64, 1.48].forEach(function (y) {
                b.cyl(0.36, 0.065, n, '#78877a', 0, y, 0.29, Math.PI / 2);
                b.cyl(0.29, 0.085, n, '#303f3a', 0, y, 0.34, Math.PI / 2);
                b.part(new T.SphereGeometry(0.12, lo ? 6 : 20, lo ? 4 : 12), '#84917f', 0, y, 0.37);
              });
              b.box(0.28, 0.035, 0.025, '#a4ab8f', -0.28, 1.98, 0.28);
              if (!lo) for (var q = 0; q < 5; q++) b.box(0.06, 0.055, 0.03, '#8d9885', -0.38 + q * 0.18, 0.20, 0.29);
            } else {
              // ChatGPT: a scanner arch; the job is held beneath its reading head.
              [-0.56, 0.56].forEach(function (x) {
                [-0.35, 0.73].forEach(function (z) { b.box(0.13, 1.94, 0.13, color, x, 0, z); });
                b.box(0.15, 0.10, 1.22, '#677569', x, 1.94, 0.19);
              });
              b.box(1.39, 0.37, 1.25, color, 0, 2.01, 0.19);
              b.box(1.12, 0.10, 0.055, '#62776d', 0, 2.14, 0.84);
              b.box(0.24, 0.20, 0.28, '#495f53', 0, 1.80, 0.20);
              if (!lo) for (var j = 0; j < 4; j++) b.cyl(0.035, 0.035, 12, '#526d60', -0.38 + j * 0.24, 2.22, 0.858, Math.PI / 2);
            }
            b.finish(parent, data.tool + (lo ? ' low parts' : ' high parts'));
          }
          body.finish(g, 'Shop sign frame'); machine(h, false); machine(l, true);
        });

        // The only lettering: two substantial wooden crates, nearer the camera at the feed end.
        var pallet = plant(root, -4.85, 1.65, 0, 0.12, 0.48), pb = bake();
        [-1.01, 0, 1.01].forEach(function (x) {
          var p = groundLocal(pallet, x, 0); pb.box(0.18, 0.12 - p.y, 1.05, '#7f7655', x, p.y, 0);
        });
        for (var sl = 0; sl < 4; sl++) pb.box(2.60, 0.07, 0.22, '#8e815e', 0, 0.12, -0.37 + sl * 0.25);
        pb.finish(pallet, 'Trying now pallet');
        // Plain crates (22 Nov, Tedd: the Grok Bot / Muse labels are cut until those agents have made a reel).
        ['Crate one', 'Crate two'].forEach(function (label, i) {
          var g = new T.Group(); g.position.set(i ? 0.65 : -0.65, 0.19, 0); pallet.add(g);
          var b = bake(), w = 1.20, height = 1.22;
          b.box(w, height, 0.86, WOOD, 0, 0, 0);
          [-0.53, 0.53].forEach(function (x) { b.box(0.075, height, 0.08, '#7f704f', x, 0, 0.46); });
          if (!i) b.box(w + 0.05, 0.08, 0.90, '#8b7957', 0, height, 0);
          else {
            b.box(w + 0.08, 0.07, 0.90, '#8b7957', 0.21, height + 0.02, -0.12, -0.26, 0, 0.12);
            b.box(0.89, 0.025, 0.65, '#5c6049', 0, height - 0.03, 0);
          }
          b.finish(g, label + ' crate');
          textured(g, 1.04, height - 0.12, crateTexture(T, ''), 0, height / 2, 0.437, label + ' front');
        });

        // YOU's editing desk at the end of the belt. The screen has four static clip bars, no text or mark.
        var desk = plant(root, 5.00, 0.60, -0.06, 0.18), db = bake();
        db.box(1.42, 0.09, 0.84, '#938366', 0, 0.84, 0);
        [-0.61, 0.61].forEach(function (x) { [-0.32, 0.32].forEach(function (z) {
          var p = groundLocal(desk, x, z); db.box(0.075, 0.85 - p.y, 0.075, '#606a58', x, p.y, z);
        }); });
        db.box(0.45, 0.035, 0.25, '#4f5b51', 0.06, 0.94, -0.17);
        db.box(0.07, 0.25, 0.07, '#4f5b51', 0.06, 0.97, -0.23);
        db.box(1.03, 0.66, 0.07, '#3c4940', 0.06, 1.16, -0.23);
        db.box(0.91, 0.52, 0.018, '#263c34', 0.06, 1.23, -0.185);
        ['#859c8b', '#b19b69', '#73939a', '#a27f6c'].forEach(function (c, i) {
          db.box(0.56 - (i % 2) * 0.10, 0.055, 0.022, c, -0.04 + (i % 2) * 0.12, 1.63 - i * 0.10, -0.168);
        });
        db.box(0.025, 0.43, 0.023, '#c6c6a4', 0.20, 1.25, -0.150);
        db.box(0.64, 0.035, 0.20, '#687569', -0.02, 0.95, 0.20);
        db.finish(desk, 'CapCut editing desk');

        // Higgsfield: a compact, recognisable film camera on a stand, beside the printer.
        var camera = plant(root, 0.80, 1.69, -0.18, 0.16), cb = bake();
        cb.box(0.58, 0.33, 0.31, '#65766a', 0, 1.07, 0);
        cb.cyl(0.13, 0.28, 12, '#3c4d42', 0, 1.23, 0.28, Math.PI / 2);
        [-0.19, 0.19].forEach(function (x) {
          cb.cyl(0.21, 0.12, 12, '#788879', x, 1.53, 0, Math.PI / 2);
          cb.cyl(0.065, 0.13, 8, '#3c4d42', x, 1.53, 0.01, Math.PI / 2);
        });
        cb.box(0.075, 1.08, 0.075, '#50604f', 0, 0, 0);
        [-1, 1].forEach(function (s) { cb.box(0.065, 0.61, 0.065, '#50604f', s * 0.17, 0, 0.08, 0, 0, s * 0.36); });
        cb.box(0.065, 0.60, 0.065, '#50604f', 0, 0, -0.22, -0.38); cb.finish(camera, 'Higgsfield film camera');

        ctx.you.place(YOU.x, YOU.z, YOU.yaw);
        this.setQuality(ctx.quality);
        paintLamps();
        return root;
      },
      update: function (t, dt, ctx) {
        if (!S) return;
        if (!S.paused && !ctx.frozen && ctx.arrived) S.clock += Math.max(0, dt);
        if (ctx.arrived && !S.arrived) {
          ctx.you.place(YOU.x, YOU.z, YOU.yaw); ctx.you.play('Idle'); ctx.you.lookAt(1.2, 1.65, 0);
        }
        if (!ctx.arrived && S.arrived) resetLamp();
        S.arrived = ctx.arrived;
        // The only response is a held, flat lamp colour for two seconds after a click/tap.
        if (S.active && S.clock >= S.until) resetLamp();
      },
      onPointer: function (ev) {
        if (!S || S.paused || ev.type !== 'click' || !ev.hit) return false;
        var obj = ev.hit.object;
        while (obj && obj !== S.root) {
          for (var i = 0; i < S.machines.length; i++) if (obj === S.machines[i].g) {
            S.active = S.machines[i]; S.until = S.clock + 2;
            paintLamps(); return true;
          }
          obj = obj.parent;
        }
        return false;
      },
      // Consume place what-ifs gently: no extra motion or engine-wide fall-through effects.
      whatIf: function () { resetLamp(); return true; },
      pause: function (on) { if (S) S.paused = !!on; },
      setQuality: function (q) {
        if (!S) return;
        var lo = q === 'low'; S.quality = q; S.hi.visible = !lo; S.low.visible = lo;
        S.machines.forEach(function (s) { s.high.visible = !lo; s.low.visible = lo; });
      },
      dispose: function () {
        resetLamp();
        window.removeEventListener('site:pipeline', onStep);
        // All resources belong to the returned tree. world.js releases its geometries, maps and own materials;
        // ctx.mat resources are its shared cache. No timers, DOM listeners or detached GPU resources exist.
        S = null;
      }
    });
    function resetLamp() { if (S) { S.active = null; paintLamps(); } }
    // r11 pass 4: the lamps of the machines whose tools the active step names on the page are held on (a flat colour
    // swap, no motion, no timers); a click still lights its own machine alone for its two seconds, then the step's
    // lamps return. Ollama never lights for a step.
    var STEP_TOOLS = { 1: ['openai', 'gemini'], 2: ['openai', 'claude'], 3: ['claude', 'openai', 'threejs'], 4: ['claude', 'openai'] };
    function paintLamps() {
      if (!S) return;
      var lit = STEP_TOOLS[S.step] || [];
      S.machines.forEach(function (m) {
        var on = S.active ? m === S.active : lit.indexOf(m.tool) >= 0;
        var mat = on ? m.on : m.off;
        if (m.light.material !== mat) m.light.material = mat;
      });
    }
    function onStep(e) { if (!S) return; S.step = (e && e.detail && e.detail.step) | 0; paintLamps(); }

  }
  if (window.WORLD) go(); else addEventListener('DOMContentLoaded', go);
})();
