/* =========================================================
   DEAR, 1995 — preview.js
   Draws the finished letter experience (envelope → letter →
   memories → music → final message). Used by BOTH the live
   preview in the creator and the recipient page, so what you
   preview is exactly what they will see.
   All user text is inserted with textContent (never as HTML).
   ========================================================= */
(function () {
  "use strict";
  var D = window.Dear, el = D.el;
  var DECO = "assets/decorations/";

  function paragraphs(text) {
    return String(text || "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  }
  function textBlock(cls, text) {
    // keeps single line breaks inside a paragraph
    var wrap = el("div", { class: cls });
    paragraphs(text).forEach(function (p, i) {
      var para = el("p", { style: { "--i": i } });
      p.split("\n").forEach(function (line, j) {
        if (j) para.appendChild(el("br"));
        para.appendChild(document.createTextNode(line));
      });
      wrap.appendChild(para);
    });
    return wrap;
  }
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  function seeded(i) { var x = Math.sin(i * 9301 + 49297) * 233280; return x - Math.floor(x); }

  /* ---------- The cassette (inline SVG so the reels can spin) ---------- */
  function cassetteSVG(title) {
    var ns = "http://www.w3.org/2000/svg";
    function s(tag, attrs) { var n = document.createElementNS(ns, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
    var svg = s("svg", { viewBox: "0 0 300 190", class: "cassette", role: "img", "aria-label": "Cassette tape" });
    svg.appendChild(s("rect", { x: 4, y: 4, width: 292, height: 182, rx: 14, class: "cs-shell" }));
    svg.appendChild(s("rect", { x: 20, y: 18, width: 260, height: 104, rx: 6, class: "cs-label" }));
    svg.appendChild(s("rect", { x: 20, y: 18, width: 260, height: 22, class: "cs-band" }));
    svg.appendChild(s("rect", { x: 20, y: 40, width: 260, height: 5, class: "cs-band2" }));
    svg.appendChild(s("rect", { x: 70, y: 62, width: 160, height: 50, rx: 25, class: "cs-window" }));
    [98, 202].forEach(function (cx, i) {
      var g = s("g", { class: "cs-reel cs-reel--" + i, style: "transform-origin:" + cx + "px 87px" });
      g.appendChild(s("circle", { cx: cx, cy: 87, r: i ? 14 : 20, class: "cs-tape" }));
      g.appendChild(s("circle", { cx: cx, cy: 87, r: 9, class: "cs-hub" }));
      for (var k = 0; k < 6; k++) {
        var a = k * Math.PI / 3;
        g.appendChild(s("rect", { x: cx - 1.5 + Math.cos(a) * 6, y: 87 - 1.5 + Math.sin(a) * 6, width: 3, height: 3, class: "cs-tooth" }));
      }
      svg.appendChild(g);
    });
    svg.appendChild(s("path", { d: "M60 186l20-46h140l20 46z", class: "cs-bottom" }));
    svg.appendChild(s("circle", { cx: 110, cy: 166, r: 6, class: "cs-hole" }));
    svg.appendChild(s("circle", { cx: 190, cy: 166, r: 6, class: "cs-hole" }));
    var t = s("text", { x: 150, y: 34, "text-anchor": "middle", class: "cs-side" }); t.textContent = "SIDE A · C-60";
    svg.appendChild(t);
    var fo = s("foreignObject", { x: 26, y: 46, width: 248, height: 18 });
    var div = document.createElement("div");
    div.className = "cs-title";
    div.textContent = title || "Our song";
    fo.appendChild(div);
    svg.appendChild(fo);
    return svg;
  }

  /* =========================================================
     render(container, letter, opts)
     letter.photos[i].src and letter.music.src must be URLs.
     opts.mode: "preview" | "recipient"
     ========================================================= */
  function render(container, letter, opts) {
    opts = opts || {};
    var st = letter.style || {};
    var theme = D.THEMES[st.theme] || D.THEMES.dear1995;
    var font = D.FONTS[st.font] || D.FONTS[theme.font];
    var paper = D.PAPERS[st.paper] || D.PAPERS[theme.paper];
    var deco = st.deco || theme.deco;
    var size = D.clamp(Number(st.size) || 20, 14, 32);
    var photos = (letter.photos || []).filter(function (p) { return p && p.src; });
    var music = letter.music && letter.music.src ? letter.music : null;
    var sp = letter.surprise || {};
    var notes = (sp.notes || []).filter(function (n) { return n && n.trim(); });
    var stamps = (sp.stamps || []).filter(function (s) { return s && D.STAMPS[s.type]; });
    var recipient = (letter.recipient || "").trim() || "you";
    var sender = (letter.sender || "").trim();

    container.innerHTML = "";
    var stage = el("div", {
      class: "dl-stage theme-" + (st.theme || "dear1995") + " paper-" + (st.paper || "cream") +
        (paper.dark ? " is-dark-paper" : "") + (deco.grain ? " has-grain" : "") + (opts.mode === "preview" ? " is-preview" : ""),
      style: {
        "--ink": st.ink || theme.ink,
        "--accent": st.accent || theme.accent,
        "--bg": theme.bg,
        "--env": theme.envelope,
        "--paper-img": "url('" + new URL(DECO + paper.img, document.baseURI).href + "')",
        "--font": font.css,
        "--fs": (size * font.scale).toFixed(1) + "px",
        "--line": font.line,
        "--align": st.align || "left"
      }
    });
    container.appendChild(stage);

    /* ---------------- audio ---------------- */
    var audio = null, player = null;
    if (music) {
      audio = new Audio();
      audio.preload = "metadata";
      audio.src = music.src;
      audio.loop = true;
      audio.volume = 0.8;
    }
    function playMusic() {
      if (!audio) return;
      var p = audio.play();
      if (p && p.catch) p.catch(function () { /* blocked until another tap — the cassette button still works */ });
    }
    function toggleMusic() { if (!audio) return; if (audio.paused) playMusic(); else audio.pause(); }

    /* ---------------- scenes ---------------- */
    var scenes = [];
    function addScene(key, label, node) { node.classList.add("dl-scene", "dl-scene--" + key); node.dataset.key = key; scenes.push({ key: key, label: label, node: node }); stage.appendChild(node); }

    /* PAGE 1 — ENVELOPE */
    var envScene = el("section", { "aria-label": "Envelope" });
    var seal = el("button", { class: "dl-seal", type: "button", "aria-label": "Break the wax seal and open" }, [
      el("img", { src: DECO + "wax-seal.svg", alt: "" })
    ]);
    var envelope = el("div", { class: "dl-envelope" }, [
      el("div", { class: "dl-env-back" }),
      el("div", { class: "dl-env-letter" }, [
        el("span", { class: "dl-env-letter-line", text: (letter.greeting || ("Dear " + recipient + ",")) })
      ]),
      el("div", { class: "dl-env-pocket" }),
      el("div", { class: "dl-env-flap" }),
      el("div", { class: "dl-env-address" }, [
        el("span", { class: "dl-env-to", text: "To" }),
        el("span", { class: "dl-env-name", text: recipient }),
        sender ? el("span", { class: "dl-env-from", text: "from " + sender }) : null
      ]),
      el("img", { class: "dl-env-stamp", src: DECO + "stamp-" + (stamps[0] ? stamps[0].type : (st.theme === "midnight" ? "moon" : "rose")) + ".svg", alt: "" }),
      el("img", { class: "dl-env-postmark", src: DECO + "postmark.svg", alt: "" }),
      seal
    ]);
    var openBtn = el("button", { class: "dl-btn dl-btn--open", type: "button", text: "Open Your Letter" });
    envScene.appendChild(el("div", { class: "dl-env-wrap" }, [
      el("p", { class: "dl-kicker", text: "A letter has arrived for" }),
      el("h1", { class: "dl-env-heading", text: recipient }),
      envelope,
      openBtn,
      el("p", { class: "dl-hint", text: music ? "Tap to open · turn your sound on" : "Tap the seal to open" })
    ]));
    addScene("envelope", "Envelope", envScene);

    /* PAGE 2 — LETTER */
    var letterScene = el("section", { "aria-label": "Letter" });
    var paperEl = el("article", { class: "dl-paper" + (paper.lines ? " has-" + paper.lines : "") + (deco.airmail ? " has-airmail" : "") });
    if (deco.tape) {
      paperEl.appendChild(el("img", { class: "dl-tape dl-tape--a", src: DECO + "washi-tape.svg", alt: "" }));
      paperEl.appendChild(el("img", { class: "dl-tape dl-tape--b", src: DECO + "washi-tape.svg", alt: "" }));
    }
    if (deco.flowers) {
      paperEl.appendChild(el("img", { class: "dl-flower dl-flower--a", src: DECO + "pressed-flower.svg", alt: "" }));
      paperEl.appendChild(el("img", { class: "dl-flower dl-flower--b", src: DECO + "pressed-fern.svg", alt: "" }));
    }
    // clickable stamps
    var stampRow = null;
    var stampList = stamps.length ? stamps : (deco.stamps ? [{ type: st.theme === "midnight" ? "moon" : "rose", message: "" }] : []);
    if (stampList.length) {
      stampRow = el("div", { class: "dl-stamps" });
      stampList.forEach(function (s, i) {
        var bubble = s.message ? el("span", { class: "dl-stamp-msg", role: "status", text: s.message }) : null;
        var b = el("button", { class: "dl-stamp" + (s.message ? " has-msg" : ""), type: "button", style: { "--r": ((seeded(i + 3) - 0.5) * 14).toFixed(1) + "deg" },
          "aria-label": s.message ? "A stamp with a hidden message — tap it" : "Postage stamp" }, [
          el("img", { src: DECO + "stamp-" + s.type + ".svg", alt: "" }), bubble
        ]);
        b.addEventListener("click", function () {
          var open = b.classList.toggle("is-open");
          D.$$(".dl-stamp", stampRow).forEach(function (o) { if (o !== b) o.classList.remove("is-open"); });
          if (!s.message) { b.classList.remove("is-open"); b.classList.remove("wiggle"); void b.offsetWidth; b.classList.add("wiggle"); }
          return open;
        });
        stampRow.appendChild(b);
      });
      paperEl.appendChild(stampRow);
    }
    paperEl.appendChild(el("header", { class: "dl-paper-head" }, [
      letter.date ? el("p", { class: "dl-date", text: letter.date }) : null,
      letter.title ? el("h2", { class: "dl-title", text: letter.title }) : null
    ]));
    paperEl.appendChild(el("p", { class: "dl-greeting", text: letter.greeting || ("Dear " + recipient + ",") }));
    var bodyEl = textBlock("dl-body", letter.body || "…");
    paperEl.appendChild(bodyEl);
    if (letter.closing) paperEl.appendChild(el("p", { class: "dl-closing", text: letter.closing }));
    if (sender) paperEl.appendChild(el("p", { class: "dl-signature", text: sender }));

    // hidden notes tucked around the paper
    if (notes.length) {
      var notesWrap = el("div", { class: "dl-notes" });
      notes.forEach(function (n, i) {
        var note = el("button", { class: "dl-note dl-note--" + i, type: "button", "aria-label": "A hidden note — tap to unfold" }, [
          el("span", { class: "dl-note-fold", text: "psst" })
        ]);
        note.addEventListener("click", function () { showNote(n); note.classList.add("is-read"); });
        notesWrap.appendChild(note);
      });
      paperEl.appendChild(notesWrap);
      paperEl.appendChild(el("p", { class: "dl-notes-hint", text: notes.length === 1 ? "There is a little note hidden on this page." : "There are " + notes.length + " little notes hidden on this page." }));
    }
    letterScene.appendChild(el("div", { class: "dl-scroll" }, [paperEl]));
    addScene("letter", "Letter", letterScene);

    /* PAGE 3 — MEMORIES */
    if (photos.length) {
      var memScene = el("section", { "aria-label": "Memories" });
      var layout = st.layout || theme.layout;
      var gal = el("div", { class: "dl-gallery dl-gallery--" + layout });
      photos.forEach(function (p, i) {
        var rot = layout === "scatter" ? ((seeded(i) - 0.5) * 10).toFixed(1) : layout === "grid" ? ((seeded(i) - 0.5) * 4).toFixed(1) : 0;
        var card = el("button", { class: "dl-photo", type: "button", style: { "--r": rot + "deg", "--i": i }, "aria-label": "Open photo " + (i + 1) + (p.caption ? ": " + p.caption : "") }, [
          (deco.tape && layout !== "film") ? el("img", { class: "dl-photo-tape", src: DECO + "washi-tape.svg", alt: "" }) : null,
          el("span", { class: "dl-photo-img" }, [el("img", { src: p.src, alt: p.caption || ("Memory " + (i + 1)), loading: "lazy" })]),
          el("span", { class: "dl-photo-cap", text: p.caption || "" })
        ]);
        card.addEventListener("click", function () { openLightbox(i); });
        gal.appendChild(card);
      });
      memScene.appendChild(el("div", { class: "dl-scroll" }, [
        el("div", { class: "dl-section-head" }, [
          el("p", { class: "dl-kicker", text: "Kept safe, for you" }),
          el("h2", { class: "dl-section-title", text: "Our little memories" })
        ]),
        layout === "film" ? el("div", { class: "dl-film" }, [gal]) : gal,
        el("p", { class: "dl-hint", text: "Tap a photo to look closer" })
      ]));
      addScene("memories", "Memories", memScene);
    }

    /* PAGE 4 — MUSIC */
    if (music) {
      var musScene = el("section", { "aria-label": "Music" });
      var playBtn = el("button", { class: "dl-btn dl-btn--play", type: "button", "aria-label": "Play" }, [el("span", { class: "dl-play-icon" })]);
      var seek = el("input", { type: "range", min: 0, max: 1000, value: 0, class: "dl-range", "aria-label": "Song position" });
      var vol = el("input", { type: "range", min: 0, max: 100, value: 80, class: "dl-range dl-range--vol", "aria-label": "Volume" });
      var tCur = el("span", { text: "0:00" }), tDur = el("span", { text: "0:00" });
      var deck = el("div", { class: "dl-deck" }, [cassetteSVG(music.title)]);
      player = { deck: deck, playBtn: playBtn };
      musScene.appendChild(el("div", { class: "dl-scroll dl-scroll--center" }, [
        el("div", { class: "dl-section-head" }, [
          el("p", { class: "dl-kicker", text: "Press play" }),
          el("h2", { class: "dl-section-title", text: "A song for you" })
        ]),
        deck,
        el("p", { class: "dl-song-title", text: music.title || "Our song" }),
        el("div", { class: "dl-player" }, [
          playBtn,
          el("div", { class: "dl-seek" }, [seek, el("div", { class: "dl-times" }, [tCur, tDur])])
        ]),
        el("label", { class: "dl-vol" }, [el("span", { text: "Volume" }), vol])
      ]));
      addScene("music", "Music", musScene);

      playBtn.addEventListener("click", toggleMusic);
      vol.addEventListener("input", function () { audio.volume = vol.value / 100; });
      var seeking = false;
      seek.addEventListener("input", function () { seeking = true; if (audio.duration) tCur.textContent = fmtTime(audio.duration * seek.value / 1000); });
      seek.addEventListener("change", function () { if (audio.duration) audio.currentTime = audio.duration * seek.value / 1000; seeking = false; });
      audio.addEventListener("loadedmetadata", function () { tDur.textContent = fmtTime(audio.duration); });
      audio.addEventListener("timeupdate", function () {
        if (seeking || !audio.duration) return;
        seek.value = Math.round(audio.currentTime / audio.duration * 1000);
        tCur.textContent = fmtTime(audio.currentTime);
      });
    }

    /* PAGE 5 — FINAL MESSAGE */
    var finScene = el("section", { "aria-label": "Final message" });
    var finCard = el("div", { class: "dl-final" }, [
      el("p", { class: "dl-kicker", text: "Before you go" }),
      textBlock("dl-final-text", letter.finalMessage || (letter.closing ? letter.closing + "\n" : "") + "Thank you for reading this, " + recipient + "."),
      sender ? el("p", { class: "dl-signature", text: "— " + sender }) : null
    ]);
    if (sp.secret && sp.secret.trim()) {
      var secretBox = el("div", { class: "dl-secret" });
      var secretBtn = el("button", { class: "dl-secret-env", type: "button", "aria-label": "Open the secret message" }, [
        el("span", { class: "dl-secret-flap" }),
        el("img", { src: DECO + "wax-seal.svg", alt: "", class: "dl-secret-seal" }),
        el("span", { class: "dl-secret-label", text: "a secret, sealed for you" })
      ]);
      var secretText = textBlock("dl-secret-text", sp.secret);
      secretBtn.addEventListener("click", function () { secretBtn.classList.add("is-leaving"); setTimeout(function () { secretBox.classList.add("is-open"); }, 550); });
      secretBox.appendChild(secretBtn);
      secretBox.appendChild(secretText);
      finCard.appendChild(secretBox);
    }
    if (sp.surpriseClosing && sp.surpriseClosing.trim()) {
      var surBtn = el("button", { class: "dl-btn dl-btn--ghost", type: "button", text: "One more thing…" });
      var surText = textBlock("dl-surprise-text", sp.surpriseClosing);
      surBtn.addEventListener("click", function () { surBtn.hidden = true; surText.classList.add("is-shown"); petals(30); });
      finCard.appendChild(surBtn);
      finCard.appendChild(surText);
    }
    var again = el("button", { class: "dl-btn dl-btn--ghost dl-again", type: "button", text: "Read it again" });
    again.addEventListener("click", function () { go(1); });
    finCard.appendChild(again);
    finScene.appendChild(el("div", { class: "dl-scroll dl-scroll--center" }, [
      finCard,
      opts.mode === "recipient" ? el("a", { class: "dl-madewith", href: "index.html", text: "Made with DEAR, 1995 — letters made personal" }) : null
    ]));
    addScene("final", "Final", finScene);

    /* ---------------- navigation ---------------- */
    var current = 0, started = false;
    var dots = el("div", { class: "dl-dots" });
    var prevBtn = el("button", { class: "dl-nav-btn", type: "button", "aria-label": "Previous page", text: "‹ Back" });
    var nextBtn = el("button", { class: "dl-nav-btn dl-nav-btn--next", type: "button", "aria-label": "Next page", text: "Next ›" });
    scenes.forEach(function (s, i) {
      if (i === 0) return;
      var d = el("button", { class: "dl-dot", type: "button", "aria-label": "Go to " + s.label, title: s.label });
      d.addEventListener("click", function () { go(i); });
      dots.appendChild(d);
    });
    var nav = el("nav", { class: "dl-nav", "aria-label": "Letter pages" }, [prevBtn, dots, nextBtn]);
    stage.appendChild(nav);
    prevBtn.addEventListener("click", function () { go(current - 1); });
    nextBtn.addEventListener("click", function () {
      if (nextBtn.dataset.last === "1") {
        stage.classList.add("is-closing");
        setTimeout(function () { resetEnvelope(); go(0); stage.classList.remove("is-closing"); }, 600);
      } else { go(current + 1); }
    });
    // the stage is a fixed "page"; never let focus or scrollIntoView shift it
    stage.addEventListener("scroll", function () { if (stage.scrollLeft || stage.scrollTop) { stage.scrollLeft = 0; stage.scrollTop = 0; } });

    var mini = null;
    if (audio) {
      mini = el("button", { class: "dl-mini", type: "button", "aria-label": "Play or pause music" }, [
        el("span", { class: "dl-mini-reel" }), el("span", { class: "dl-mini-reel" }), el("span", { class: "dl-mini-label", text: "music" })
      ]);
      mini.addEventListener("click", toggleMusic);
      stage.appendChild(mini);
      function sync() {
        var playing = !audio.paused;
        stage.classList.toggle("is-playing", playing);
        if (player) player.playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
      }
      audio.addEventListener("play", sync);
      audio.addEventListener("pause", sync);
    }

    function go(i) {
      i = D.clamp(i, 0, scenes.length - 1);
      if (i === current && started) return;
      var prev = scenes[current];
      if (prev !== scenes[i]) {
        prev.node.classList.remove("is-active");
        prev.node.classList.add(i > current ? "is-left" : "is-right");
        setTimeout(function () { prev.node.classList.remove("is-left", "is-right"); }, 700);
      }
      started = true;
      current = i;
      var s = scenes[i];
      s.node.classList.add("is-active");
      var sc = s.node.querySelector(".dl-scroll");
      if (sc) sc.scrollTop = 0;
      stage.dataset.scene = s.key;
      D.$$(".dl-dot", dots).forEach(function (d, k) { d.classList.toggle("is-current", k + 1 === i); });
      prevBtn.disabled = i <= 1;
      nextBtn.textContent = i >= scenes.length - 1 ? "Close" : "Next: " + scenes[i + 1].label + " ›";
      nextBtn.dataset.last = i >= scenes.length - 1 ? "1" : "";
      if (s.key === "final") setTimeout(function () { petals(18); }, 500);
    }

    function openEnvelope() {
      if (stage.classList.contains("is-opening")) return;
      playMusic(); // inside the tap = allowed by mobile browsers
      stage.classList.add("is-opening");
      setTimeout(function () { stage.classList.add("is-opened"); }, 650);
      setTimeout(function () { go(1); }, 1900);
    }
    function resetEnvelope() { stage.classList.remove("is-opening", "is-opened"); }
    openBtn.addEventListener("click", openEnvelope);
    seal.addEventListener("click", openEnvelope);

    /* ---------------- hidden note popup ---------------- */
    var noteLayer = el("div", { class: "dl-notepop", role: "dialog", "aria-modal": "true", "aria-label": "Hidden note" });
    var noteText = el("div", { class: "dl-notepop-text" });
    var noteClose = el("button", { class: "dl-btn dl-btn--ghost", type: "button", text: "Fold it back" });
    noteLayer.appendChild(el("div", { class: "dl-notepop-card" }, [el("p", { class: "dl-kicker", text: "A hidden note" }), noteText, noteClose]));
    noteLayer.addEventListener("click", function (e) { if (e.target === noteLayer) noteLayer.classList.remove("is-open"); });
    noteClose.addEventListener("click", function () { noteLayer.classList.remove("is-open"); });
    stage.appendChild(noteLayer);
    function showNote(t) {
      noteText.innerHTML = "";
      noteText.appendChild(textBlock("", t));
      noteLayer.classList.add("is-open");
      noteClose.focus();
    }

    /* ---------------- lightbox ---------------- */
    var lb = null, lbIndex = 0, lbImg, lbCap;
    function openLightbox(i) {
      if (!lb) {
        lbImg = el("img", { alt: "" });
        lbCap = el("p", { class: "dl-lb-cap" });
        var lbPrev = el("button", { class: "dl-lb-btn dl-lb-prev", type: "button", "aria-label": "Previous photo", text: "‹" });
        var lbNext = el("button", { class: "dl-lb-btn dl-lb-next", type: "button", "aria-label": "Next photo", text: "›" });
        var lbClose = el("button", { class: "dl-lb-close", type: "button", "aria-label": "Close", text: "×" });
        lb = el("div", { class: "dl-lightbox", role: "dialog", "aria-modal": "true", "aria-label": "Photo" }, [
          el("figure", { class: "dl-lb-frame" }, [lbImg, lbCap]), lbPrev, lbNext, lbClose
        ]);
        lbPrev.addEventListener("click", function () { showLb(lbIndex - 1); });
        lbNext.addEventListener("click", function () { showLb(lbIndex + 1); });
        lbClose.addEventListener("click", function () { lb.classList.remove("is-open"); });
        lb.addEventListener("click", function (e) { if (e.target === lb) lb.classList.remove("is-open"); });
        var sx = null;
        lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
        lb.addEventListener("touchend", function (e) {
          if (sx === null) return;
          var dx = e.changedTouches[0].clientX - sx; sx = null;
          if (Math.abs(dx) > 45) showLb(lbIndex + (dx < 0 ? 1 : -1));
        });
        stage.appendChild(lb);
      }
      showLb(i);
      lb.classList.add("is-open");
    }
    function showLb(i) {
      lbIndex = (i + photos.length) % photos.length;
      var p = photos[lbIndex];
      lbImg.src = p.src;
      lbImg.alt = p.caption || "Memory " + (lbIndex + 1);
      lbCap.textContent = (p.caption || "") ;
      lb.querySelector(".dl-lb-frame").style.setProperty("--r", ((seeded(lbIndex) - 0.5) * 4).toFixed(1) + "deg");
    }

    /* ---------------- petals ending animation ---------------- */
    function petals(n) {
      var layer = el("div", { class: "dl-petals", "aria-hidden": "true" });
      for (var i = 0; i < n; i++) {
        layer.appendChild(el("span", { class: "dl-petal", style: {
          left: (Math.random() * 100).toFixed(1) + "%",
          animationDelay: (Math.random() * 2.5).toFixed(2) + "s",
          animationDuration: (4 + Math.random() * 3).toFixed(2) + "s",
          "--drift": ((Math.random() - 0.5) * 120).toFixed(0) + "px",
          "--s": (0.6 + Math.random() * 0.8).toFixed(2)
        } }));
      }
      stage.appendChild(layer);
      setTimeout(function () { layer.remove(); }, 8000);
    }

    /* ---------------- keyboard (recipient page only) ---------------- */
    function onKey(e) {
      if (current === 0) { if (e.key === "Enter") openEnvelope(); return; }
      if (lb && lb.classList.contains("is-open")) {
        if (e.key === "ArrowRight") showLb(lbIndex + 1);
        else if (e.key === "ArrowLeft") showLb(lbIndex - 1);
        else if (e.key === "Escape") lb.classList.remove("is-open");
        return;
      }
      if (e.key === "ArrowRight") go(current + 1);
      else if (e.key === "ArrowLeft") go(Math.max(1, current - 1));
    }
    if (opts.mode === "recipient") document.addEventListener("keydown", onKey);

    // start
    go(0);
    if (opts.startAt) { stage.classList.add("is-opening", "is-opened"); go(Math.min(opts.startAt, scenes.length - 1)); }

    return {
      stage: stage,
      go: go,
      destroy: function () {
        if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
        document.removeEventListener("keydown", onKey);
        container.innerHTML = "";
      }
    };
  }

  window.DearLetter = { render: render, paragraphs: paragraphs, cassetteSVG: cassetteSVG };
})();
