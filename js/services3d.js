/* Services fly-through: on large screens the Services section pins in place and scrolling
   moves a virtual camera through the six glass cards, with drifting particles behind them.
   Small screens and reduced-motion users keep the plain grid. No sound. */
(function () {
  "use strict";
  var section = document.getElementById("services");
  if (!section) return;
  var cards = Array.prototype.slice.call(section.querySelectorAll(".service"));
  var canvas = section.querySelector(".svc3d__particles");
  var counter = section.querySelector(".svc3d__current");
  var bar = section.querySelector(".svc3d__bar span");
  var N = cards.length;

  var wide = window.matchMedia("(min-width: 1024px)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var GAP = 760;           // depth between cards (px)
  var on = false, raf = 0, visible = false;
  var focus = 0;           // which card is in front (0..N-1, fractional)

  /* ---------- Particles ---------- */
  var ctx = canvas.getContext("2d");
  var COLORS = ["46,230,214", "30,167,255", "255,107,74", "220,250,248"];
  var particles = [];
  var DEPTH = GAP * (N + 2);
  for (var i = 0; i < 220; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 2600,
      y: (Math.random() - 0.5) * 1600,
      z: Math.random() * DEPTH,
      r: Math.random() * 1.6 + 0.4,
      c: COLORS[i % COLORS.length],
      drift: Math.random() * 0.4 + 0.1
    });
  }
  var cw = 0, ch = 0, dpr = 1, t0 = performance.now();
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawParticles(now) {
    ctx.clearRect(0, 0, cw, ch);
    var cam = focus * GAP;
    var time = (now - t0) / 1000;
    var fl = 900;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var z = ((p.z - cam - time * 40 * p.drift) % DEPTH + DEPTH) % DEPTH; // distance in front of camera
      if (z < 10) continue;
      var s = fl / z;
      var x = cw * 0.62 + p.x * s;
      var y = ch * 0.5 + p.y * s;
      if (x < -10 || x > cw + 10 || y < -10 || y > ch + 10) continue;
      var a = Math.min(1, z / 300) * Math.max(0, 1 - z / DEPTH);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.3, p.r * s * 1.4), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + p.c + "," + (a * 0.85).toFixed(3) + ")";
      ctx.fill();
    }
  }

  /* ---------- Cards ---------- */
  var PATH = [ // gentle spiral offsets for each card (px)
    [-60, -10], [150, 40], [-140, 30], [120, -40], [-110, -30], [90, 20]
  ];
  function layoutCards() {
    var rect = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    var p = Math.min(Math.max(-rect.top / total, 0), 1);
    focus = -0.15 + p * (N - 1 + 0.3);

    var active = Math.min(N - 1, Math.max(0, Math.round(focus)));
    for (var i = 0; i < N; i++) {
      var d = i - focus;                       // >0: ahead of camera, <0: passed
      var z = -d * GAP;
      var off = PATH[i % PATH.length];
      var x = off[0] * Math.min(Math.abs(d) + 0.4, 2);
      var y = off[1] * Math.min(Math.abs(d) + 0.4, 2);
      var ry = (off[0] > 0 ? -1 : 1) * Math.min(Math.abs(d), 2) * 9;
      var opacity = d < 0 ? Math.max(0, 1 + d / 0.6) : Math.max(0, Math.min(1, 1 - (d - 2.2) / 1.2));
      var card = cards[i];
      card.style.transform = "translate(-50%, -50%) translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px," + z.toFixed(1) + "px) rotateY(" + ry.toFixed(2) + "deg)";
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      card.style.visibility = opacity < 0.01 ? "hidden" : "visible";
      card.classList.toggle("is-active", i === active && Math.abs(d) < 0.5);
    }
    if (counter) counter.textContent = ("0" + (active + 1)).slice(-2);
    if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }

  function frame(now) {
    raf = 0;
    if (!on) return;
    layoutCards();
    drawParticles(now);
    if (visible) raf = requestAnimationFrame(frame);
  }
  function kick() { if (on && !raf) raf = requestAnimationFrame(frame); }

  /* ---------- Enable / disable ---------- */
  function enable() {
    on = true;
    section.classList.add("svc3d--on");
    cards.forEach(function (c) { c.classList.remove("reveal"); });
    sizeCanvas();
    layoutCards();
    kick();
  }
  function disable() {
    on = false;
    section.classList.remove("svc3d--on");
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    cards.forEach(function (c) {
      c.style.transform = c.style.opacity = c.style.zIndex = c.style.visibility = "";
      c.classList.remove("is-active");
      c.classList.add("is-visible");
    });
  }
  function update() { if (wide.matches && !reduce.matches) { if (!on) enable(); } else if (on) disable(); }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    kick();
  }).observe(section);
  window.addEventListener("scroll", function () { if (on) { layoutCards(); kick(); } }, { passive: true });
  window.addEventListener("resize", function () { if (on) { sizeCanvas(); layoutCards(); kick(); } }, { passive: true });
  [wide, reduce].forEach(function (mq) {
    if (mq.addEventListener) mq.addEventListener("change", update); else mq.addListener(update);
  });
  update();
})();
