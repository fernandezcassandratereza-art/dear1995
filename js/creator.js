/* =========================================================
   DEAR, 1995 — creator.js
   The 7-step letter editor. No login needed: everything is
   kept in this browser (IndexedDB) until you publish.
   ========================================================= */
(function () {
  "use strict";
  var D = window.Dear, el = D.el, $ = D.$, $$ = D.$$, U = window.DearUploader;
  var TOTAL = 7;
  var state = null;           // the letter being edited
  var step = 1;
  var urls = {};              // photo id -> object URL (for thumbnails/preview)
  var musicUrl = null;
  var previewCtl = null;
  var dirty = false;

  /* ---------------- path helpers for data-bind="a.b.c" ---------------- */
  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var keys = path.split("."), o = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }

  /* ---------------- saving ---------------- */
  var saveState = $("#save-state");
  function markDirty() {
    dirty = true;
    saveState.textContent = "Saving…";
    autosave();
  }
  var autosave = D.debounce(function () { saveDraft(true); }, 900);
  function saveDraft(silent) {
    return D.Drafts.save(state).then(function () {
      dirty = false;
      saveState.textContent = "Saved on this device";
      if (!silent) D.toast("Draft saved on this device. It stays in this browser only.");
      if (history.replaceState && location.search.indexOf(state.draftId) === -1) {
        try { history.replaceState(null, "", "create.html?draft=" + encodeURIComponent(state.draftId)); } catch (e) {}
      }
    }, function (err) {
      saveState.textContent = "Not saved";
      if (!silent) D.toast("Could not save the draft: " + (err && err.message ? err.message : "storage is full or blocked."), "error");
    });
  }

  /* ---------------- generic fields ---------------- */
  function syncFields() {
    $$("[data-bind]").forEach(function (f) {
      var v = getPath(state, f.dataset.bind);
      if (f.type === "checkbox") f.checked = !!v;
      else if (document.activeElement !== f) f.value = v == null ? "" : v;
    });
    $$("[data-align]").forEach(function (b) { b.classList.toggle("is-on", b.dataset.align === state.style.align); b.setAttribute("aria-pressed", b.dataset.align === state.style.align); });
    paintWritePaper();
  }

  function bindFields() {
    // fill font selects
    $$(".font-select").forEach(function (sel) {
      Object.keys(D.FONTS).forEach(function (k) { sel.appendChild(el("option", { value: k, text: D.FONTS[k].label })); });
    });
    $$("[data-bind]").forEach(function (f) {
      var evt = (f.type === "checkbox" || f.tagName === "SELECT") ? "change" : "input";
      f.addEventListener(evt, function () {
        var path = f.dataset.bind;
        var v = f.type === "checkbox" ? f.checked : (f.type === "range" ? Number(f.value) : f.value);
        if (path.indexOf("music.") === 0 && !state.music) return;
        setPath(state, path, v);
        if (path === "style.font") $$(".font-select").forEach(function (s) { if (s !== f) s.value = v; });
        paintWritePaper();
        if (path === "body") countBody();
        if (path === "music.title") renderMusicDeck();
        markDirty();
      });
    });
    $$("[data-align]").forEach(function (b) {
      b.addEventListener("click", function () { state.style.align = b.dataset.align; syncFields(); markDirty(); });
    });
  }

  function paintWritePaper() {
    var wp = $("#write-paper");
    if (!wp) return;
    var f = D.FONTS[state.style.font] || D.FONTS.homemade;
    var paper = D.PAPERS[state.style.paper] || D.PAPERS.cream;
    wp.style.setProperty("--font", f.css);
    wp.style.setProperty("--fs", (state.style.size * f.scale).toFixed(1) + "px");
    wp.style.setProperty("--line", f.line);
    wp.style.setProperty("--align", state.style.align);
    wp.style.setProperty("--ink", state.style.ink);
    wp.style.setProperty("--paper-img", "url('" + new URL("assets/decorations/" + paper.img, document.baseURI).href + "')");
    wp.classList.toggle("is-dark", !!paper.dark);
    $("#write-greeting").textContent = state.greeting || ("Dear " + (state.recipient || "you") + ",");
  }

  function countBody() {
    var paras = window.DearLetter.paragraphs(state.body).length;
    $("#body-count").textContent = paras + (paras === 1 ? " paragraph" : " paragraphs") + " · " + (state.body || "").length + " / 12000";
  }

  /* ---------------- steps ---------------- */
  function goStep(n) {
    n = D.clamp(n, 1, TOTAL);
    if (step === 7 && n !== 7 && previewCtl) { previewCtl.destroy(); previewCtl = null; }
    step = n;
    $$(".step").forEach(function (s) { s.classList.toggle("is-active", Number(s.dataset.step) === n); });
    $$("#steps-list button").forEach(function (b) {
      var k = Number(b.dataset.goto);
      b.classList.toggle("is-current", k === n);
      b.classList.toggle("is-done", k < n);
      if (k === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $("#steps-bar").style.width = ((n - 1) / (TOTAL - 1) * 100) + "%";
    $("#step-count").textContent = n + " / " + TOTAL;
    $("#btn-back").disabled = n === 1;
    $("#btn-next").textContent = n === 6 ? "Preview" : n === 7 ? "Publish letter" : "Next";
    document.body.classList.toggle("on-preview", n === 7);
    var cur = $('#steps-list button[data-goto="' + n + '"]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "center" });
    window.scrollTo(0, 0);
    if (n === 7) buildPreview();
    if (n === 2) { paintWritePaper(); countBody(); }
  }

  /* ---------------- photos ---------------- */
  function photoUrl(p) {
    if (!urls[p.id]) urls[p.id] = URL.createObjectURL(p.blob);
    return urls[p.id];
  }
  function dropUrl(id) { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } }

  function addFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    var room = D.LIMITS.maxPhotos - state.photos.length;
    if (room <= 0) { D.toast("You can add up to " + D.LIMITS.maxPhotos + " photos.", "error"); return; }
    if (files.length > room) D.toast("Only the first " + room + " photo(s) were added (limit " + D.LIMITS.maxPhotos + ").", "error");
    files = files.slice(0, room);
    $("#photo-count").textContent = "Preparing " + files.length + " photo(s)…";
    var chain = Promise.resolve(), errors = [];
    files.forEach(function (file) {
      chain = chain.then(function () {
        return U.processPhoto(file).then(function (r) {
          state.photos.push({ id: "p" + D.uid(8), caption: "", blob: r.blob, type: r.type, w: r.w, h: r.h });
          renderPhotos();
        }, function (err) { errors.push(err.message); });
      });
    });
    chain.then(function () {
      renderPhotos();
      markDirty();
      if (errors.length) D.toast(errors[0], "error");
    });
  }

  var replaceTarget = null;
  function renderPhotos() {
    var list = $("#photo-list");
    list.innerHTML = "";
    $("#photo-count").textContent = state.photos.length + " / " + D.LIMITS.maxPhotos + " photos";
    $("#dropzone").classList.toggle("is-full", state.photos.length >= D.LIMITS.maxPhotos);
    state.photos.forEach(function (p, i) {
      var cap = el("input", { type: "text", maxlength: 140, placeholder: "Add a caption…", value: p.caption || "", "aria-label": "Caption for photo " + (i + 1) });
      cap.addEventListener("input", function () { p.caption = cap.value; markDirty(); });
      function move(d) {
        var j = i + d;
        if (j < 0 || j >= state.photos.length) return;
        var t = state.photos[i]; state.photos[i] = state.photos[j]; state.photos[j] = t;
        renderPhotos(); markDirty();
        var btn = $$("#photo-list li")[j];
        if (btn) btn.classList.add("flash");
      }
      list.appendChild(el("li", { class: "photo-item", style: { "--r": ((i % 2 ? 1 : -1) * 1.5) + "deg" } }, [
        el("div", { class: "photo-item__polaroid" }, [
          el("img", { src: photoUrl(p), alt: "Photo " + (i + 1) }),
          el("span", { class: "photo-item__num", text: String(i + 1) })
        ]),
        el("div", { class: "photo-item__body" }, [
          cap,
          el("div", { class: "photo-item__tools" }, [
            el("button", { type: "button", class: "icon-btn", "aria-label": "Move photo " + (i + 1) + " earlier", disabled: i === 0, onclick: function () { move(-1); }, text: "↑" }),
            el("button", { type: "button", class: "icon-btn", "aria-label": "Move photo " + (i + 1) + " later", disabled: i === state.photos.length - 1, onclick: function () { move(1); }, text: "↓" }),
            el("button", { type: "button", class: "btn btn--small btn--ghost", text: "Replace", onclick: function () { replaceTarget = p; $("#photo-replace").click(); } }),
            el("button", { type: "button", class: "btn btn--small btn--ghost btn--danger", text: "Remove", onclick: function () {
              dropUrl(p.id);
              state.photos.splice(state.photos.indexOf(p), 1);
              renderPhotos(); markDirty();
            } })
          ])
        ])
      ]));
    });
  }

  function bindPhotos() {
    var input = $("#photo-input");
    input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
    var dz = $("#dropzone");
    ["dragenter", "dragover"].forEach(function (e) { dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (e) { dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.remove("is-over"); }); });
    dz.addEventListener("drop", function (ev) { addFiles(ev.dataTransfer && ev.dataTransfer.files); });
    var rep = $("#photo-replace");
    rep.addEventListener("change", function () {
      var f = rep.files && rep.files[0]; rep.value = "";
      if (!f || !replaceTarget) return;
      var target = replaceTarget; replaceTarget = null;
      U.processPhoto(f).then(function (r) {
        dropUrl(target.id);
        target.id = "p" + D.uid(8); target.blob = r.blob; target.w = r.w; target.h = r.h;
        renderPhotos(); markDirty(); D.toast("Photo replaced");
      }, function (err) { D.toast(err.message, "error"); });
    });
  }

  /* ---------------- music ---------------- */
  var audio = new Audio();
  audio.preload = "metadata";
  function fmt(s) { if (!isFinite(s)) s = 0; var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ":" + (r < 10 ? "0" : "") + r; }

  function setMusic(blob, name, title) {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    state.music = { blob: blob, name: name, size: blob.size, title: title || U.songTitleFromName(name) };
    renderMusic(); markDirty();
  }
  function renderMusicDeck() {
    var deck = $("#music-deck");
    deck.innerHTML = "";
    if (state.music) deck.appendChild(window.DearLetter.cassetteSVG(state.music.title));
  }
  function renderMusic() {
    var has = !!(state.music && state.music.blob);
    $("#music-empty").hidden = has;
    $("#music-card").hidden = !has;
    audio.pause();
    if (!has) { if (musicUrl) URL.revokeObjectURL(musicUrl); musicUrl = null; audio.removeAttribute("src"); return; }
    musicUrl = URL.createObjectURL(state.music.blob);
    audio.src = musicUrl;
    $("#music-file").textContent = (state.music.name || "song.mp3") + " · " + D.formatBytes(state.music.size || state.music.blob.size);
    $("#music-seek").value = 0; $("#music-cur").textContent = "0:00";
    renderMusicDeck();
    syncFields();
  }
  function pickMusic(file) {
    if (!file) return;
    U.checkMusic(file).then(function (f) { setMusic(f, f.name); D.toast("Song added"); }, function (err) { D.toast(err.message, "error"); });
  }
  function bindMusic() {
    var inp = $("#music-input"), chg = $("#music-change");
    inp.addEventListener("change", function () { pickMusic(inp.files[0]); inp.value = ""; });
    chg.addEventListener("change", function () { pickMusic(chg.files[0]); chg.value = ""; });
    $("#music-sample").addEventListener("click", function () {
      var b = this; b.disabled = true; b.textContent = "Loading…";
      fetch("assets/music/sunday-morning-waltz.mp3").then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
        .then(function (blob) { setMusic(new Blob([blob], { type: "audio/mpeg" }), "sunday-morning-waltz.mp3", "Sunday Morning Waltz"); })
        .catch(function () { D.toast("Could not load the sample song. Open the site through a web server (see README).", "error"); })
        .then(function () { b.disabled = false; b.textContent = "Use the sample song"; });
    });
    $("#music-remove").addEventListener("click", function () { state.music = null; renderMusic(); markDirty(); });
    $("#music-play").addEventListener("click", function () {
      if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () { D.toast("Tap play again to start the music", "error"); }); }
      else audio.pause();
    });
    audio.addEventListener("play", function () { $("#music-card").classList.add("is-playing"); $("#music-play").setAttribute("aria-label", "Pause preview"); });
    audio.addEventListener("pause", function () { $("#music-card").classList.remove("is-playing"); $("#music-play").setAttribute("aria-label", "Play preview"); });
    audio.addEventListener("loadedmetadata", function () { $("#music-dur").textContent = fmt(audio.duration); });
    audio.addEventListener("timeupdate", function () {
      if (!audio.duration) return;
      $("#music-seek").value = Math.round(audio.currentTime / audio.duration * 1000);
      $("#music-cur").textContent = fmt(audio.currentTime);
    });
    $("#music-seek").addEventListener("change", function () { if (audio.duration) audio.currentTime = audio.duration * this.value / 1000; });
    $("#music-vol").addEventListener("input", function () { audio.volume = this.value / 100; });
  }

  /* ---------------- themes & customization ---------------- */
  var ACCENTS = ["#7a2632", "#b5727a", "#a8874a", "#6b5a3a", "#8a3a3a", "#c9a96e", "#5b4636", "#7d7f52"];
  var INKS = ["#3b2a24", "#2f2a3a", "#4a3428", "#5b2430", "#1f2a44", "#efe2c8"];

  function applyTheme(key) {
    var t = D.THEMES[key];
    state.style.theme = key;
    state.style.font = t.font; state.style.paper = t.paper; state.style.ink = t.ink;
    state.style.accent = t.accent; state.style.layout = t.layout;
    state.style.deco = Object.assign({ flowers: false, stamps: false, tape: false, grain: false, airmail: false }, t.deco);
    renderThemeUI(); syncFields(); markDirty();
  }

  function renderThemeUI() {
    var list = $("#theme-list");
    list.innerHTML = "";
    Object.keys(D.THEMES).forEach(function (k) {
      var t = D.THEMES[k], on = state.style.theme === k;
      var card = el("button", { type: "button", class: "theme-card theme-card--" + k + (on ? " is-on" : ""), role: "radio", "aria-checked": on ? "true" : "false",
        style: { "--t-bg": t.bg, "--t-accent": t.accent, "--t-ink": t.ink, "--t-paper": "url('" + new URL("assets/decorations/" + D.PAPERS[t.paper].img, document.baseURI).href + "')", "--t-font": D.FONTS[t.font].css } }, [
        el("span", { class: "theme-card__swatch" }, [
          el("span", { class: "theme-card__paper" }, [el("span", { class: "theme-card__script", text: "Dear you," }), el("span", { class: "theme-card__lines" })]),
          el("span", { class: "theme-card__seal" })
        ]),
        el("span", { class: "theme-card__name", text: t.name }),
        el("span", { class: "theme-card__blurb", text: t.blurb })
      ]);
      card.addEventListener("click", function () { applyTheme(k); });
      list.appendChild(card);
    });

    function swatches(boxId, colors, path) {
      var box = $(boxId); box.innerHTML = "";
      var cur = getPath(state, path);
      colors.forEach(function (c) {
        box.appendChild(el("button", { type: "button", class: "swatch" + (cur.toLowerCase() === c ? " is-on" : ""), style: { background: c }, "aria-label": "Color " + c, "aria-pressed": cur.toLowerCase() === c ? "true" : "false",
          onclick: function () { setPath(state, path, c); renderThemeUI(); markDirty(); } }));
      });
      var picker = el("input", { type: "color", value: cur, class: "swatch swatch--picker", "aria-label": "Custom color" });
      picker.addEventListener("input", function () { setPath(state, path, picker.value); markDirty(); });
      picker.addEventListener("change", function () { renderThemeUI(); });
      box.appendChild(picker);
    }
    swatches("#accent-swatches", ACCENTS, "style.accent");
    swatches("#ink-swatches", INKS, "style.ink");

    function chips(boxId, map, path) {
      var box = $(boxId); box.innerHTML = "";
      Object.keys(map).forEach(function (k) {
        var label = typeof map[k] === "string" ? map[k] : map[k].label;
        var on = getPath(state, path) === k;
        box.appendChild(el("button", { type: "button", class: "chip" + (on ? " is-on" : ""), "aria-pressed": on ? "true" : "false", text: label,
          onclick: function () { setPath(state, path, k); renderThemeUI(); paintWritePaper(); markDirty(); } }));
      });
    }
    chips("#paper-chips", D.PAPERS, "style.paper");
    chips("#layout-chips", D.LAYOUTS, "style.layout");
  }

  /* ---------------- surprise stamps ---------------- */
  function renderStampPick() {
    var box = $("#stamp-pick");
    box.innerHTML = "";
    Object.keys(D.STAMPS).forEach(function (k) {
      var entry = state.surprise.stamps.filter(function (s) { return s.type === k; })[0];
      var msg = el("input", { type: "text", maxlength: 200, placeholder: "Message when tapped (optional)", value: entry ? entry.message : "", disabled: !entry, "aria-label": D.STAMPS[k] + " message" });
      msg.addEventListener("input", function () { var e = state.surprise.stamps.filter(function (s) { return s.type === k; })[0]; if (e) { e.message = msg.value; markDirty(); } });
      var toggle = el("button", { type: "button", class: "stamp-toggle" + (entry ? " is-on" : ""), "aria-pressed": entry ? "true" : "false", "aria-label": "Use the " + D.STAMPS[k] + " stamp" }, [
        el("img", { src: "assets/decorations/stamp-" + k + ".svg", alt: "" })
      ]);
      toggle.addEventListener("click", function () {
        var idx = -1;
        state.surprise.stamps.forEach(function (s, i) { if (s.type === k) idx = i; });
        if (idx >= 0) state.surprise.stamps.splice(idx, 1);
        else state.surprise.stamps.push({ type: k, message: msg.value || "" });
        renderStampPick(); markDirty();
      });
      box.appendChild(el("div", { class: "stamp-row" }, [toggle, el("div", { class: "stamp-row__body" }, [el("span", { class: "stamp-row__name", text: D.STAMPS[k] }), msg])]));
    });
  }

  /* ---------------- preview ---------------- */
  function previewData() {
    var d = JSON.parse(JSON.stringify(Object.assign({}, state, { photos: [], music: null })));
    d.photos = state.photos.map(function (p) { return { caption: p.caption, src: photoUrl(p) }; });
    if (state.music && state.music.blob) d.music = { title: state.music.title, src: musicUrl || URL.createObjectURL(state.music.blob) };
    return d;
  }
  function buildPreview() {
    audio.pause();
    if (previewCtl) previewCtl.destroy();
    previewCtl = window.DearLetter.render($("#preview-frame"), previewData(), { mode: "preview" });
    $("#demo-notice").hidden = D.isConfigured();
  }

  /* ---------------- buttons ---------------- */
  function bindButtons() {
    $$("#steps-list button").forEach(function (b) { b.addEventListener("click", function () { goStep(Number(b.dataset.goto)); }); });
    $("#btn-back").addEventListener("click", function () { goStep(step - 1); });
    $("#btn-next").addEventListener("click", function () {
      if (step === 1 && !String(state.recipient || "").trim()) { D.toast("Add the recipient's name first", "error"); $('[data-bind="recipient"]').focus(); return; }
      if (step === 7) return publishNow();
      goStep(step + 1);
    });
    $("#btn-edit").addEventListener("click", function () { goStep(2); });
    $("#btn-save").addEventListener("click", function () { saveDraft(false); });
    $("#btn-save-top").addEventListener("click", function () { saveDraft(false); });
    $("#btn-publish").addEventListener("click", publishNow);
    $("#theme-reset").addEventListener("click", function () { applyTheme(state.style.theme); D.toast("Theme defaults restored"); });
    window.addEventListener("beforeunload", function (e) { if (dirty) { saveDraft(true); } });
  }

  function publishNow() {
    if (previewCtl) { previewCtl.destroy(); previewCtl = null; }
    saveDraft(true);
    var btn = $("#btn-publish");
    btn.disabled = true;
    window.DearPublisher.publish(state).then(function () {
      btn.disabled = false;
      if (step === 7) buildPreview();
    });
  }

  /* ---------------- start ---------------- */
  function normalize(l) {
    var base = D.newLetter((l.style && l.style.theme) || "dear1995");
    l.style = Object.assign(base.style, l.style || {});
    l.style.deco = Object.assign({ flowers: false, stamps: false, tape: false, grain: false, airmail: false }, l.style.deco || {});
    l.surprise = Object.assign(base.surprise, l.surprise || {});
    while (l.surprise.notes.length < 3) l.surprise.notes.push("");
    l.photos = (l.photos || []).filter(function (p) { return p && p.blob; });
    if (l.music && !l.music.blob) l.music = null;
    return l;
  }

  function start(letter) {
    state = normalize(letter);
    bindFields(); bindPhotos(); bindMusic(); bindButtons();
    syncFields(); renderPhotos(); renderMusic(); renderThemeUI(); renderStampPick(); countBody();
    var m = /[?&]step=(\d)/.exec(location.search);
    goStep(m ? Number(m[1]) : 1);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var params = new URLSearchParams(location.search);
    var draftId = params.get("draft");
    var theme = params.get("theme");
    if (draftId) {
      D.Drafts.get(draftId).then(function (d) {
        if (d) { start(d); saveState.textContent = "Saved on this device"; }
        else { D.toast("That draft isn't on this device anymore — starting fresh."); start(D.newLetter()); }
      }, function () { start(D.newLetter()); });
    } else {
      start(D.newLetter(D.THEMES[theme] ? theme : "dear1995"));
    }
  });
})();
