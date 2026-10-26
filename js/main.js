(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------------- i18n ---------------- */
  var ES = window.UNIKO_ES || {};
  var EN = {};
  var EN_EXTRA = {
    "form.sending": "Opening your email app…",
    "form.sent": "Thanks! Your email app should open with the message ready to send.",
    "form.fix": "Please fix the highlighted fields above.",
    "nav.menu": "Open menu",
    "hero.scroll": "Scroll to services",
    "marquee.label": "Tools we build with"
  };
  var currentLang = "en";

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    EN[el.getAttribute("data-i18n")] = el.innerHTML;
  });
  Object.keys(EN_EXTRA).forEach(function (k) { if (!(k in EN)) EN[k] = EN_EXTRA[k]; });

  function t(key) {
    var dict = currentLang === "es" ? ES : EN;
    return dict[key] != null ? dict[key] : EN[key] || "";
  }

  function setLang(lang) {
    currentLang = lang === "es" ? "es" : "en";
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-aria"));
      if (v) el.setAttribute("aria-label", v);
    });
    document.querySelectorAll(".lang__btn").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === currentLang));
    });
    try { localStorage.setItem("uniko-lang", currentLang); } catch (e) {}
  }

  var saved = null;
  try { saved = localStorage.getItem("uniko-lang"); } catch (e) {}
  var initial = saved || ((navigator.language || "").toLowerCase().indexOf("es") === 0 ? "es" : "en");
  if (initial !== "en") setLang(initial);

  document.querySelectorAll(".lang__btn").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });

  /* ---------------- Nav ---------------- */
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("mobile-menu");

  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 20); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    menu.hidden = open;
    toggle.setAttribute("aria-expanded", String(!open));
    nav.classList.add("is-scrolled");
  });
  menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) { closeMenu(); toggle.focus(); }
  });

  // Active section highlight
  var links = document.querySelectorAll(".nav__links a");
  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (l) {
        var active = l.getAttribute("href") === "#" + entry.target.id;
        l.classList.toggle("is-active", active);
        if (active) l.setAttribute("aria-current", "true"); else l.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["services", "process", "pricing", "contact"].forEach(function (id) {
    var s = document.getElementById(id);
    if (s) sectionObserver.observe(s);
  });

  /* ---------------- Reveal on scroll ---------------- */
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });

  /* ---------------- Pricing → form preset ---------------- */
  var typeSelect = document.getElementById("f-type");
  var budgetSelect = document.getElementById("f-budget");
  document.querySelectorAll("[data-plan]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var plan = btn.dataset.plan;
      if (plan === "starter") { typeSelect.value = "New website"; budgetSelect.value = "Under $500"; }
      if (plan === "growth") { typeSelect.value = "New website"; budgetSelect.value = "$500 – $1,000"; }
      if (plan === "pro") { typeSelect.value = "Online store"; budgetSelect.value = "$1,000 – $2,000"; }
    });
  });

  /* ---------------- Contact form ----------------
     No backend yet: the form validates, then opens the visitor's email app
     with the message pre-filled. To receive submissions directly, point the
     form at a service like Formspree and replace the mailto step below. */
  var form = document.getElementById("contact-form");
  var statusEl = form.querySelector(".form__status");
  var CONTACT_EMAIL = "nelson@unikodigital.com";

  var rules = {
    name: function (v) { return v.trim().length > 0; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    message: function (v) { return v.trim().length >= 10; }
  };

  function validateField(input) {
    var rule = rules[input.name];
    if (!rule) return true;
    var ok = rule(input.value);
    var field = input.closest(".field");
    var err = field.querySelector(".field__error");
    field.classList.toggle("has-error", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    if (err) err.hidden = ok;
    return ok;
  }

  Object.keys(rules).forEach(function (name) {
    var input = form.elements[name];
    input.addEventListener("blur", function () { if (input.value) validateField(input); });
    input.addEventListener("input", function () {
      if (input.closest(".field").classList.contains("has-error")) validateField(input);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = null;
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      if (!validateField(input) && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      statusEl.style.color = "var(--error)";
      statusEl.textContent = t("form.fix");
      firstInvalid.focus();
      return;
    }

    var d = form.elements;
    var body =
      "Name: " + d.name.value + "\n" +
      "Email: " + d.email.value + "\n" +
      "Phone: " + d.phone.value + "\n" +
      "Project: " + d.type.value + "\n" +
      "Budget: " + d.budget.value + "\n\n" +
      d.message.value;
    statusEl.style.color = "";
    statusEl.textContent = t("form.sending");
    window.location.href = "mailto:" + CONTACT_EMAIL +
      "?subject=" + encodeURIComponent("New project: " + d.type.value + " — " + d.name.value) +
      "&body=" + encodeURIComponent(body);
    setTimeout(function () { statusEl.textContent = t("form.sent"); }, 800);
  });

  /* ---------------- Misc ---------------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
