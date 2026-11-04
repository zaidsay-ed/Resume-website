(function () {
  "use strict";

  var S = (window.fieldState = window.fieldState || { p: 0, x: 0, y: 0, alpha: 1, intro: 0, scale: 1 });
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var mqDesk = window.matchMedia("(min-width: 721px)");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- Data / Software mode ---------- */
  var root = document.documentElement;
  var modeBtns = $$("[data-set-mode]");
  S.mode = root.dataset.mode === "swe" ? 1 : 0;
  function syncModeButtons() {
    modeBtns.forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.setMode === root.dataset.mode)); });
  }
  function setMode(m) {
    if (m === root.dataset.mode) return;
    root.dataset.mode = m;
    S.mode = m === "swe" ? 1 : 0;
    try { localStorage.setItem("mode", m); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set("mode", m); history.replaceState(null, "", u); } catch (e) {}
    syncModeButtons();
    document.dispatchEvent(new CustomEvent("modechange", { detail: m }));
    if (window.gsap && !reduce) gsap.fromTo("main", { opacity: 0.35 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
    if (window.ScrollTrigger) requestAnimationFrame(function () { ScrollTrigger.refresh(); });
  }
  modeBtns.forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.setMode); });
    b.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); var n = b.dataset.setMode === "data" ? "swe" : "data"; setMode(n); $('[data-set-mode="' + n + '"]').focus(); }
    });
  });
  syncModeButtons();

  /* ---------- split hero name into letters ---------- */
  $$(".hero-name .word").forEach(function (w) {
    var txt = w.textContent; w.textContent = "";
    txt.split("").forEach(function (c) { var s = document.createElement("span"); s.className = "ch"; s.textContent = c; s.setAttribute("aria-hidden", "true"); w.appendChild(s); });
  });

  /* ---------- count-up numbers ---------- */
  function countUp(el, dur) {
    var from = parseFloat(el.dataset.from || 0), to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || 0, 10), suf = el.dataset.suffix || "", pre = el.dataset.prefix || "";
    var fmt = function (v) { var s = v.toFixed(dec); if (el.dataset.sep) s = Number(s).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }); return pre + s + suf; };
    if (reduce || !hasGsap) { el.textContent = fmt(to); return; }
    var o = { v: from };
    gsap.to(o, { v: to, duration: dur || 1.4, ease: "power3.out", onUpdate: function () { el.textContent = fmt(o.v); } });
  }

  /* ---------- static fallback ---------- */
  if (!hasGsap || reduce) {
    document.documentElement.classList.add("static");
    document.querySelector(".nav").classList.add("solid");
    document.querySelector(".nav-stage").hidden = true;
    S.intro = 1; S.p = 0; S.alpha = 0.6;
    $$(".count").forEach(function (el) { countUp(el); });
    setupRest();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href"); if (id.length < 2) return;
        var target = document.querySelector(id); if (!target) return;
        e.preventDefault(); lenis.scrollTo(target, { offset: id === "#top" ? 0 : -10, duration: 1.4 });
      });
    });
  }

  /* ---------- intro: one orchestrated moment ---------- */
  S.x = mqDesk.matches ? 3.2 : 0; S.y = mqDesk.matches ? 0.6 : 3.2;
  var intro = gsap.timeline({ delay: 0.15 });
  intro.to(S, { intro: 1, duration: 2.4, ease: "power2.out" }, 0)
       .from(".hero-name .ch", { yPercent: 110, rotate: 6, duration: 1.1, ease: "power4.out", stagger: 0.045 }, 0.25)
       .from(".reveal-up", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 }, 0.8);

  /* ---------- hero scroll: raw cloud starts streaming ---------- */
  gsap.to(S, {
    p: 1, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".hero-name", { yPercent: -18, opacity: 0.15, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  /* ---------- pinned pipeline ---------- */
  var stages = $$(".stage"), rail = $$(".pipe-rail li"), label = $("#stageLabel");
  var NAMES = { data: ["ingest", "transform", "serve"], swe: ["design", "build", "review"] };
  var current = -1;
  var counted = {};
  function setStage(i) {
    rail.forEach(function (li, k) { li.classList.toggle("on", k === i); });
    current = i;
    var names = NAMES[root.dataset.mode] || NAMES.data;
    label.textContent = i < 0 ? (root.dataset.mode === "swe" ? "idle" : "raw input") : i >= 3 ? "done" : names[i];
    if (i >= 0 && i < 3 && !counted[i]) { counted[i] = true; $$(".count", stages[i]).forEach(function (el) { countUp(el); }); }
  }

  document.addEventListener("modechange", function () { setStage(current); $$(".count", stages[Math.max(0, Math.min(current, 2))]).forEach(function (el) { countUp(el, 1); }); });

  var mm = gsap.matchMedia();
  mm.add({ desk: "(min-width: 721px)", mob: "(max-width: 720px)" }, function (ctx) {
    var desk = ctx.conditions.desk;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".pipeline", start: "top top", end: "+=" + (window.innerHeight * 3.4), pin: ".pipe-pin", scrub: 0.6,
        onUpdate: function (st) {
          var pr = st.progress;
          setStage(pr >= 1 ? 3 : pr < 0.33 ? 0 : pr < 0.66 ? 1 : 2);
        },
        onLeave: function () { setStage(3); },
        onLeaveBack: function () { setStage(-1); }
      }
    });
    var sx = desk ? -3.4 : 0, sy = desk ? -0.4 : 3.4, ss = desk ? 0.6 : 0.85;
    tl.set(stages, { autoAlpha: 0, y: 40 })
      .to(S, { x: sx, y: sy, scale: ss, duration: 0.5 }, 0)
      .to(stages[0], { autoAlpha: 1, y: 0, duration: 0.5 }, 0.1)
      .to({}, { duration: 1 })
      .to(stages[0], { autoAlpha: 0, y: -40, duration: 0.4 })
      .to(S, { p: 2, duration: 1 }, "<")
      .to(stages[1], { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.4")
      .to({}, { duration: 1 })
      .to(stages[1], { autoAlpha: 0, y: -40, duration: 0.4 })
      .to(S, { p: 3, duration: 1 }, "<")
      .to(stages[2], { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.4")
      .to({}, { duration: 1.2 });
    return function () { gsap.set(stages, { clearProps: "all" }); };
  });

  /* after the story: chart drifts to the side and dims so text stays readable */
  gsap.timeline({ scrollTrigger: { trigger: "#experience", start: "top bottom", end: "top 30%", scrub: true } })
    .to(S, { alpha: 0.22, x: mqDesk.matches ? 5.5 : 0, y: mqDesk.matches ? -1 : 3, scale: 0.8, ease: "none" });

  /* section headings and rows slide in once */
  $$(".section-head h2").forEach(function (h) {
    gsap.from(h, { yPercent: 40, opacity: 0, duration: 1, ease: "power4.out", scrollTrigger: { trigger: h, start: "top 88%" } });
  });
  gsap.from(".roles li", { x: -30, opacity: 0, duration: 0.7, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: ".roles", start: "top 80%" } });
  gsap.from(".card", { y: 50, opacity: 0, duration: 0.9, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: ".bento", start: "top 82%" } });
  gsap.from(".edu-grid > article", { y: 50, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: ".edu-grid", start: "top 82%" } });
  ScrollTrigger.create({ trigger: ".edu-grid", start: "top 80%", once: true, onEnter: function () { $$(".edu-stat .count").forEach(function (el) { countUp(el, 1.6); }); } });
  ScrollTrigger.create({ trigger: ".card-tall", start: "top 80%", once: true, onEnter: function () { $$(".card-tall .count").forEach(function (el) { countUp(el, 1.8); }); } });

  /* nav background once past the hero */
  ScrollTrigger.create({ start: 80, end: "max", toggleClass: { targets: ".nav", className: "solid" } });

  /* magnetic buttons */
  if (window.matchMedia("(hover: hover)").matches) {
    $$(".magnetic").forEach(function (b) {
      var xTo = gsap.quickTo(b, "x", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
      var yTo = gsap.quickTo(b, "y", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3); yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      b.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  setupRest();

  /* ====================================================================== */
  function setupRest() {
    /* card spotlight + tilt */
    var canHover = window.matchMedia("(hover: hover)").matches;
    $$(".card").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.setProperty("--mx", px * 100 + "%"); c.style.setProperty("--my", py * 100 + "%");
        if (canHover && !reduce && hasGsap) gsap.to(c, { rotateY: (px - 0.5) * 6, rotateX: (0.5 - py) * 6, transformPerspective: 900, duration: 0.4, ease: "power2.out" });
      });
      c.addEventListener("pointerleave", function () { if (hasGsap) gsap.to(c, { rotateY: 0, rotateX: 0, duration: 0.6, ease: "power3.out" }); });
    });

    /* project tabs */
    var cards = $$(".card"), tabs = $$(".tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var tr = t.dataset.track;
        tabs.forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
        var show = cards.filter(function (c) { return tr === "all" || c.dataset.track.split(" ").indexOf(tr) !== -1; });
        cards.forEach(function (c) { c.classList.toggle("is-out", show.indexOf(c) === -1); });
        if (hasGsap && !reduce) gsap.fromTo(show, { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.05, ease: "power3.out" });
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });

    /* SQL console */
    var input = $("#qInput"), out = $("#qOut");
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function runQuery() {
      var src = input.value;
      try {
        var r = window.ZaidSQL.run(src);
        var html = '<p class="q-meta">' + r.rows.length + (r.rows.length === 1 ? " row" : " rows") + " in " + r.ms.toFixed(2) + " ms</p>";
        if (r.rows.length) {
          html += '<table class="q-table"><thead><tr>' + r.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
          r.rows.forEach(function (row, i) {
            html += '<tr style="animation-delay:' + Math.min(i * 30, 400) + 'ms">' + r.columns.map(function (c) {
              return row[c] == null ? '<td class="q-null">null</td>' : "<td>" + esc(row[c]) + "</td>";
            }).join("") + "</tr>";
          });
          html += "</tbody></table>";
        } else html += '<p class="q-err" style="color:var(--dim)">No rows match. Try removing the WHERE clause.</p>';
        out.innerHTML = html;
      } catch (e) {
        out.innerHTML = '<p class="q-err">Error: ' + esc(e.message || e) + "</p>";
      }
    }
    $("#qForm").addEventListener("submit", function (e) { e.preventDefault(); runQuery(); });
    $$(".preset").forEach(function (b) {
      b.addEventListener("click", function () { typeInto(b.dataset.q); });
    });
    var typing = null;
    function typeInto(q) {
      clearInterval(typing);
      if (reduce) { input.value = q; runQuery(); return; }
      var i = 0; input.value = "";
      typing = setInterval(function () {
        i += 3; input.value = q.slice(0, i);
        if (i >= q.length) { clearInterval(typing); runQuery(); }
      }, 16);
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus(); input.select();
        if (lenis) lenis.scrollTo("#query", { offset: -40 }); else $("#query").scrollIntoView();
      }
    });
    runQuery();

    /* copy email */
    var copyBtn = $("#copyEmail");
    copyBtn.addEventListener("click", function () {
      var done = function () { copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = "Copy"; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText("zaidsayedbusiness@gmail.com").then(done, function () { copyBtn.textContent = "Select the address to copy"; });
    });

    /* Vancouver clock */
    var clock = $("#clock");
    function tick() {
      try { clock.textContent = new Date().toLocaleTimeString("en-CA", { timeZone: "America/Vancouver", hour: "numeric", minute: "2-digit" }); } catch (e) {}
    }
    tick(); setInterval(tick, 30000);

    /* contact form → Google Sheets */
    var SHEET_URL = "https://script.google.com/macros/s/AKfycby1vZzv79Xex50FJk1kjpzVY0cJQUWyrU-S9ob54KoWCaC6bCLnGLgPk7_cpzTbeAsKeQ/exec";
    var form = $("#contactForm"), status = $("#cStatus"), send = $("#cSend");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send.disabled = true; send.textContent = "Sending…"; status.className = "form-msg"; status.textContent = "";
      fetch(SHEET_URL, { method: "POST", body: new FormData(form) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); status.className = "form-msg ok"; status.textContent = "Message sent. I'll reply to the email you gave."; form.reset(); })
        .catch(function () { status.className = "form-msg err"; status.textContent = "Message not sent. Check your connection, or email zaidsayedbusiness@gmail.com directly."; })
        .finally(function () { send.disabled = false; send.textContent = "Send message"; });
    });
  }
})();
