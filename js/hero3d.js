/* Hero 3D scene: a faceted track winding through a glowing portal.
   Dark "website" coins roll down the track, pass through the portal and launch out lit up. */
(function () {
  "use strict";
  var canvas = document.getElementById("hero-canvas");
  var root = document.documentElement;
  if (!canvas) return;
  if (!window.THREE) { root.classList.add("no-webgl"); return; }

  var THREE = window.THREE;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    root.classList.add("no-webgl");
    return;
  }

  var COLORS = {
    bg: 0x04060a,
    turquoise: new THREE.Color(0x2ee6d6),
    ocean: new THREE.Color(0x1ea7ff),
    coral: new THREE.Color(0xff6b4a),
    dimRim: new THREE.Color(0x1a222c)
  };

  renderer.setClearColor(COLORS.bg, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 20);

  /* ---------- Environment for metallic reflections ---------- */
  (function buildEnv() {
    var envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x05070a);
    function panel(color, w, h, pos, intensity) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
      );
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    }
    panel(0xffffff, 6, 3, new THREE.Vector3(-6, 8, 6), 1.4);
    panel(0x2ee6d6, 8, 4, new THREE.Vector3(8, -2, 4), 1.2);
    panel(0xff6b4a, 6, 4, new THREE.Vector3(2, -8, -4), 1.0);
    panel(0x1ea7ff, 6, 6, new THREE.Vector3(-8, -4, -6), 0.7);
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  })();

  /* ---------- Lights ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  var key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-6, 10, 8);
  scene.add(key);

  var world = new THREE.Group();
  scene.add(world);

  /* ---------- Path ---------- */
  var curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 12, -7),
    new THREE.Vector3(-1.5, 8.6, -3.5),
    new THREE.Vector3(2.0, 5.6, -1.2),
    new THREE.Vector3(2.8, 2.6, 0.4),
    new THREE.Vector3(1.0, 0.0, 1.4),
    new THREE.Vector3(-0.6, -2.6, 1.8),
    new THREE.Vector3(0.2, -5.6, 1.0),
    new THREE.Vector3(2.6, -8.2, -1.2),
    new THREE.Vector3(5.0, -11.5, -4)
  ], false, "catmullrom", 0.5);

  var PORTAL_U = 0.47;
  var BANK = new THREE.Vector3(0.75, 0.3, 0.6).normalize();

  function frameAt(u) {
    var p = curve.getPointAt(u);
    var t = curve.getTangentAt(u);
    var s = new THREE.Vector3().crossVectors(t, BANK).normalize();
    var n = new THREE.Vector3().crossVectors(s, t).normalize();
    return { p: p, t: t, s: s, n: n };
  }

  /* ---------- Faceted texture ---------- */
  function facetTexture() {
    var size = 256, cell = 32;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    for (var y = 0; y < size; y += cell) {
      for (var x = 0; x < size; x += cell) {
        var flip = ((x + y) / cell) % 2 === 0;
        var tris = flip
          ? [[[x, y], [x + cell, y], [x, y + cell]], [[x + cell, y], [x + cell, y + cell], [x, y + cell]]]
          : [[[x, y], [x + cell, y + cell], [x, y + cell]], [[x, y], [x + cell, y], [x + cell, y + cell]]];
        tris.forEach(function (tri) {
          var v = 22 + Math.floor(Math.random() * 46);
          g.fillStyle = "rgb(" + v + "," + (v + 4) + "," + (v + 10) + ")";
          g.beginPath();
          g.moveTo(tri[0][0], tri[0][1]);
          g.lineTo(tri[1][0], tri[1][1]);
          g.lineTo(tri[2][0], tri[2][1]);
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(0,0,0,0.55)";
          g.lineWidth = 1.5;
          g.stroke();
        });
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }
  var facet = facetTexture();

  /* ---------- Track (ribbon with thickness + raised rails) ---------- */
  var TRACK_W = 2.4, TRACK_T = 0.28;
  var trackMat = new THREE.MeshStandardMaterial({
    color: 0x8a96a2, map: facet, bumpMap: facet, bumpScale: 0.05,
    metalness: 0.8, roughness: 0.34, envMapIntensity: 0.8
  });
  var railMat = new THREE.MeshStandardMaterial({ color: 0x1b232d, metalness: 0.9, roughness: 0.25 });

  function buildTrack(u0, u1, segs) {
    var pos = [], uv = [], idx = [];
    var len = curve.getLength() * (u1 - u0);
    var edgesL = [], edgesR = [];

    // 4 strips: top, bottom, left side, right side
    var strips = [
      function (f) { return [f.p.clone().addScaledVector(f.s, -TRACK_W / 2), f.p.clone().addScaledVector(f.s, TRACK_W / 2)]; },
      function (f) { var d = f.n.clone().multiplyScalar(-TRACK_T); return [f.p.clone().addScaledVector(f.s, TRACK_W / 2).add(d), f.p.clone().addScaledVector(f.s, -TRACK_W / 2).add(d)]; },
      function (f) { var a = f.p.clone().addScaledVector(f.s, -TRACK_W / 2); return [a.clone().addScaledVector(f.n, -TRACK_T), a]; },
      function (f) { var a = f.p.clone().addScaledVector(f.s, TRACK_W / 2); return [a, a.clone().addScaledVector(f.n, -TRACK_T)]; }
    ];

    strips.forEach(function (edgeFn, si) {
      var base = pos.length / 3;
      for (var i = 0; i <= segs; i++) {
        var u = u0 + (u1 - u0) * (i / segs);
        var f = frameAt(u);
        var e = edgeFn(f);
        pos.push(e[0].x, e[0].y, e[0].z, e[1].x, e[1].y, e[1].z);
        var v = (i / segs) * (len / TRACK_W) * 1.5;
        uv.push(0, v, 1.5, v);
        if (si === 0) {
          edgesL.push(e[0].clone().addScaledVector(f.n, 0.06));
          edgesR.push(e[1].clone().addScaledVector(f.n, 0.06));
        }
      }
      for (var j = 0; j < segs; j++) {
        var a = base + j * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    });

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, trackMat);
    trackMat.side = THREE.DoubleSide;
    world.add(mesh);

    [edgesL, edgesR].forEach(function (pts) {
      var rail = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, 0.09, 8, false),
        railMat
      );
      world.add(rail);
    });
  }
  buildTrack(0.0, PORTAL_U - 0.075, 160);
  buildTrack(PORTAL_U + 0.075, 1.0, 160);

  /* ---------- Portal ---------- */
  var portal = new THREE.Group();
  var pf = frameAt(PORTAL_U);
  portal.position.copy(pf.p);
  portal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pf.t);
  world.add(portal);

  var portalBase = new THREE.Mesh(
    new THREE.TorusGeometry(2.25, 0.26, 32, 160),
    new THREE.MeshStandardMaterial({ color: 0x141b23, metalness: 0.9, roughness: 0.22 })
  );
  portal.add(portalBase);

  var portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.95, 0.055, 16, 160),
    new THREE.MeshBasicMaterial({ color: COLORS.turquoise.clone().multiplyScalar(1.6) })
  );
  portal.add(portalRing);

  var outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.025, 12, 160),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbff8f3) })
  );
  portal.add(outerRing);

  var blobMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uA: { value: COLORS.turquoise },
      uB: { value: COLORS.ocean },
      uC: { value: COLORS.coral }
    },
    vertexShader: [
      "uniform float uTime;",
      "varying vec2 vP;",
      "varying float vEdge;",
      "void main(){",
      "  vec3 p = position;",
      "  float r = length(p.xy);",
      "  float a = atan(p.y, p.x);",
      "  float w = 1.0 + 0.09*sin(a*6.0 + uTime*1.2) + 0.06*sin(a*3.0 - uTime*0.9) + 0.03*sin(a*11.0 + uTime*2.0);",
      "  p.xy *= mix(1.0, w, smoothstep(0.0, 1.6, r));",
      "  p.z += 0.12*sin(a*4.0 + uTime) * (r/1.6);",
      "  vP = p.xy; vEdge = r/1.6;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;",
      "varying vec2 vP; varying float vEdge;",
      "void main(){",
      "  float sweep = 0.5 + 0.5*sin(vP.x*1.4 + vP.y*0.8 + uTime*0.8);",
      "  vec3 col = mix(vec3(0.55,0.95,0.95), uA, smoothstep(0.0, 0.35, vEdge));",
      "  col = mix(col, uB, smoothstep(0.45, 0.85, vEdge) * sweep);",
      "  col = mix(col, uC * 1.4, smoothstep(0.75, 1.0, vEdge) * (1.0 - sweep));",
      "  col += uA * smoothstep(0.86, 1.0, vEdge) * 1.6;",
      "  gl_FragColor = vec4(col * 0.7, 0.92);",
      "}"
    ].join("\n")
  });
  var blob = new THREE.Mesh(new THREE.CircleGeometry(1.6, 128, 0, Math.PI * 2), blobMat);
  // add radial segments so the wobble deforms smoothly
  blob.geometry = new THREE.RingGeometry(0.001, 1.6, 128, 12);
  portal.add(blob);

  function glowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = glowTexture();
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: COLORS.turquoise, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  halo.scale.set(10, 10, 1);
  halo.position.copy(pf.p);
  world.add(halo);

  var portalLight = new THREE.PointLight(0x2ee6d6, 3.2, 14, 1.6);
  portalLight.position.copy(pf.p).add(new THREE.Vector3(0, 0, 1.5));
  world.add(portalLight);
  var coralLight = new THREE.PointLight(0xff6b4a, 2.4, 14, 1.6);
  coralLight.position.copy(frameAt(0.8).p).add(new THREE.Vector3(-1.5, 0, 2.5));
  world.add(coralLight);

  /* ---------- Coins ---------- */
  var GLYPHS = ["</>", "Aa", "#", "{ }", "▲", "$", "◎"];
  function iconTexture(glyph) {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 6;
    g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#fff";
    g.font = "700 92px Outfit, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(glyph, 128, 136);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  var COIN_R = 0.85, COIN_H = 0.26;
  var coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 72, 1);
  var rimGeo = new THREE.TorusGeometry(COIN_R - 0.02, 0.05, 12, 96);
  var sideMat = new THREE.MeshStandardMaterial({ color: 0x1a222c, metalness: 0.9, roughness: 0.25 });

  var coins = [];
  var COUNT = 7;
  for (var i = 0; i < COUNT; i++) {
    var icon = iconTexture(GLYPHS[i % GLYPHS.length]);
    var faceMat = new THREE.MeshStandardMaterial({
      color: 0x10161d, metalness: 0.85, roughness: 0.3,
      emissive: 0xffffff, emissiveMap: icon, emissiveIntensity: 0.55
    });
    var coin = new THREE.Group();
    var body = new THREE.Mesh(coinGeo, [sideMat, faceMat, faceMat]);
    coin.add(body);
    var rimMat = new THREE.MeshBasicMaterial({ color: COLORS.dimRim.clone() });
    [-1, 1].forEach(function (sgn) {
      var r = new THREE.Mesh(rimGeo, rimMat);
      r.rotation.x = Math.PI / 2;
      r.position.y = sgn * (COIN_H / 2 + 0.005);
      coin.add(r);
    });
    world.add(coin);
    coins.push({
      group: coin, body: body, faceMat: faceMat, rimMat: rimMat,
      u: i / COUNT, roll: Math.random() * Math.PI * 2,
      glowColor: i % 3 === 2 ? COLORS.coral : COLORS.turquoise
    });
  }

  var tmpM = new THREE.Matrix4();
  var tmpX = new THREE.Vector3(), tmpY = new THREE.Vector3(), tmpZ = new THREE.Vector3();
  var lit = new THREE.Color();

  function placeCoin(c, dt) {
    c.u += dt * 0.022;
    if (c.u > 1) c.u -= 1;
    var u = Math.min(Math.max(c.u, 0.0001), 0.9999);
    var f = frameAt(u);

    // axis tilted toward the viewer so the faces read clearly
    tmpY.copy(f.s).addScaledVector(BANK, 0.9).normalize();
    tmpX.copy(f.t);
    tmpZ.crossVectors(tmpX, tmpY).normalize();
    tmpX.crossVectors(tmpY, tmpZ).normalize();
    tmpM.makeBasis(tmpX, tmpY, tmpZ);
    c.group.quaternion.setFromRotationMatrix(tmpM);
    c.group.position.copy(f.p).addScaledVector(f.n, COIN_R * 0.95);

    c.roll -= dt * 1.4;
    c.body.rotation.y = c.roll;

    var edge = Math.min(u / 0.05, (1 - u) / 0.05, 1);
    var s = Math.max(edge, 0.001);
    c.group.scale.setScalar(s);

    // Light up after passing through the portal
    var k = THREE.MathUtils.smoothstep(u, PORTAL_U - 0.01, PORTAL_U + 0.05);
    lit.copy(COLORS.dimRim).lerp(c.glowColor, k);
    c.rimMat.color.copy(lit).multiplyScalar(1 + k * 0.15);
    c.faceMat.emissiveIntensity = 0.45 + k * 0.9;
  }

  /* ---------- Particles ---------- */
  var PCOUNT = 140;
  var pGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(PCOUNT * 3);
  for (var p = 0; p < PCOUNT; p++) {
    pPos[p * 3] = (Math.random() - 0.5) * 18;
    pPos[p * 3 + 1] = (Math.random() - 0.5) * 24;
    pPos[p * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.08, map: glowTex, color: 0x9ff5ee, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  world.add(particles);

  /* ---------- Post-processing (bloom) ---------- */
  var composer = null, bloom = null;
  if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.6, 0.62);
    composer.addPass(bloom);
  }

  /* ---------- Layout ---------- */
  var baseX = 0, baseY = 0, baseScale = 1;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
    }
    var aspect = w / h;
    if (aspect >= 1.2) {          // desktop: scene sits on the right like the reference
      baseX = 3.6 + (aspect - 1.2) * 1.6; baseY = 0; baseScale = 1;
    } else if (aspect >= 0.8) {   // tablet
      baseX = 2.4; baseY = 1.0; baseScale = 0.85;
    } else {                      // phone: above the copy
      baseX = 0.4; baseY = 3.2; baseScale = 0.62;
    }
    world.scale.setScalar(baseScale);
    renderOnce();
  }

  /* ---------- Interaction ---------- */
  var mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  window.addEventListener("pointermove", function (e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var scrollY = 0;
  window.addEventListener("scroll", function () { scrollY = window.scrollY; }, { passive: true });

  function render() {
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  var time = 0;
  function update(dt) {
    time += dt;
    blobMat.uniforms.uTime.value = time;
    coins.forEach(function (c) { placeCoin(c, dt); });

    smooth.x += (mouse.x - smooth.x) * Math.min(dt * 3, 1);
    smooth.y += (mouse.y - smooth.y) * Math.min(dt * 3, 1);
    var scrollShift = Math.min(scrollY / window.innerHeight, 1);
    world.position.set(baseX, baseY + scrollShift * 3, 0);
    world.rotation.y = -0.18 + smooth.x * 0.12;
    world.rotation.x = smooth.y * 0.06;

    portalRing.material.color.copy(COLORS.turquoise).multiplyScalar(1.1 + Math.sin(time * 2) * 0.15);
    halo.material.opacity = 0.45 + Math.sin(time * 1.5) * 0.08;
    particles.rotation.y = time * 0.02;
    particles.position.y = Math.sin(time * 0.3) * 0.3;
  }

  function renderOnce() {
    update(0);
    render();
  }

  var running = false, visible = true, last = 0, raf = 0;
  function loop(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) start(); else stop();
  }).observe(canvas);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });

  // Spread coins so the static/reduced-motion frame looks composed
  coins.forEach(function (c) { placeCoin(c, 0); });
  resize();
  // Re-render once fonts load so coin glyphs use Outfit
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      coins.forEach(function (c, i) {
        c.faceMat.emissiveMap = iconTexture(GLYPHS[i % GLYPHS.length]);
        c.faceMat.needsUpdate = true;
      });
      renderOnce();
    });
  }
  start();
})();
