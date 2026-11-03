/* =========================================================
   DEAR, 1995 — publisher.js
   Sends a finished letter to the secure Supabase Edge
   Function ("publish-letter"), which checks everything,
   stores the photos + music in Supabase Storage, saves the
   letter in the database and returns a unique random ID.

   If Supabase is not configured yet, the letter is saved in
   DEMO MODE on this device only, so you can still try the
   whole flow. Demo links do not work on other phones.
   ========================================================= */
(function () {
  "use strict";
  var D = window.Dear, el = D.el, CFG = D.CFG, L = D.LIMITS;

  function cut(s, n) { return String(s || "").slice(0, n); }

  /* The public part of a letter (no blobs, trimmed to limits) */
  function toPayload(letter) {
    var T = L.text, st = letter.style || {};
    var sp = letter.surprise || {};
    return {
      version: 1,
      recipient: cut(letter.recipient, T.recipient),
      sender: cut(letter.sender, T.sender),
      title: cut(letter.title, T.title),
      date: cut(letter.date, T.date),
      greeting: cut(letter.greeting, T.greeting),
      body: cut(letter.body, T.body),
      closing: cut(letter.closing, T.closing),
      finalMessage: cut(letter.finalMessage, T.finalMessage),
      style: {
        theme: st.theme, font: st.font, size: Number(st.size) || 20, align: st.align,
        paper: st.paper, ink: st.ink, accent: st.accent, layout: st.layout,
        deco: {
          flowers: !!(st.deco && st.deco.flowers), stamps: !!(st.deco && st.deco.stamps),
          tape: !!(st.deco && st.deco.tape), grain: !!(st.deco && st.deco.grain), airmail: !!(st.deco && st.deco.airmail)
        }
      },
      photos: (letter.photos || []).slice(0, L.maxPhotos).map(function (p, i) { return { caption: cut(p.caption, T.caption), field: "photo_" + i }; }),
      music: letter.music ? { title: cut(letter.music.title, T.musicTitle), field: "music" } : null,
      surprise: {
        secret: cut(sp.secret, T.secret),
        notes: (sp.notes || []).map(function (n) { return cut(n, T.note); }).filter(function (n) { return n.trim(); }).slice(0, 3),
        stamps: (sp.stamps || []).filter(function (s) { return s && D.STAMPS[s.type]; }).slice(0, 4).map(function (s) { return { type: s.type, message: cut(s.message, T.stampMessage) }; }),
        surpriseClosing: cut(sp.surpriseClosing, T.surpriseClosing)
      }
    };
  }

  function check(letter) {
    if (!String(letter.recipient || "").trim()) return "Please add the recipient's name (Step 1).";
    if (!String(letter.body || "").trim()) return "Your letter is still empty (Step 2).";
    return null;
  }

  /* ---------- online publish through the Edge Function ---------- */
  function publishOnline(letter, onProgress) {
    var payload = toPayload(letter);
    var fd = new FormData();
    fd.append("letter", JSON.stringify(payload));
    (letter.photos || []).slice(0, L.maxPhotos).forEach(function (p, i) { fd.append("photo_" + i, p.blob, "photo-" + i + ".jpg"); });
    if (letter.music && letter.music.blob) fd.append("music", letter.music.blob, "music.mp3");

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var url = CFG.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/" + CFG.PUBLISH_FUNCTION;
      xhr.open("POST", url);
      xhr.setRequestHeader("apikey", CFG.SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Authorization", "Bearer " + CFG.SUPABASE_ANON_KEY);
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = function () {
        var data = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300 && data.id) resolve({ id: data.id, url: D.letterUrl(data.id), demo: false });
        else if (xhr.status === 429) reject(new Error(data.error || "You've published a lot of letters just now. Please wait a little and try again."));
        else reject(new Error(data.error || ("Publishing failed (error " + xhr.status + "). Check README section 5.")));
      };
      xhr.onerror = function () { reject(new Error("Could not reach the publishing server. Check your internet connection and your Supabase settings in js/app.js.")); };
      xhr.timeout = 180000;
      xhr.ontimeout = function () { reject(new Error("Upload took too long. Try fewer or smaller photos, or a shorter song.")); };
      xhr.send(fd);
    });
  }

  /* ---------- demo publish (this device only) ---------- */
  function publishDemo(letter, onProgress) {
    var id = "demo-" + D.uid(10);
    var payload = toPayload(letter);
    payload.photos = payload.photos.map(function (p, i) { return { caption: p.caption, blob: letter.photos[i].blob }; });
    if (payload.music) payload.music.blob = letter.music.blob;
    var t = 0;
    return new Promise(function (resolve, reject) {
      var iv = setInterval(function () { t += 0.2; onProgress(Math.min(t, 1)); if (t >= 1) clearInterval(iv); }, 120);
      D.DemoStore.save({ id: id, createdAt: Date.now(), letter: payload }).then(function () {
        setTimeout(function () { resolve({ id: id, url: D.letterUrl(id), demo: true }); }, 700);
      }, reject);
    });
  }

  /* ---------- dialog UI ---------- */
  var modal;
  function getModal() {
    if (modal) return modal;
    modal = el("div", { class: "modal", id: "publish-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "pub-title" });
    modal.appendChild(el("div", { class: "modal__backdrop" }));
    modal.appendChild(el("div", { class: "modal__card", id: "pub-card" }));
    document.body.appendChild(modal);
    return modal;
  }
  function close() { if (modal) modal.classList.remove("is-open"); }

  function showProgress() {
    var m = getModal(), card = D.$("#pub-card", m);
    card.innerHTML = "";
    var bar = el("span", { class: "progress__bar" });
    var label = el("p", { class: "pub-step", text: "Sealing your envelope…" });
    card.appendChild(el("div", { class: "pub-sealing" }, [el("img", { src: "assets/decorations/wax-seal.svg", alt: "", class: "pub-seal-spin" })]));
    card.appendChild(el("h3", { id: "pub-title", class: "modal__title", text: "Posting your letter" }));
    card.appendChild(label);
    card.appendChild(el("div", { class: "progress" }, [bar]));
    m.classList.add("is-open");
    return function (p, text) {
      bar.style.width = Math.round(p * 100) + "%";
      if (text) label.textContent = text;
    };
  }

  function showError(msg, retry) {
    var m = getModal(), card = D.$("#pub-card", m);
    card.innerHTML = "";
    card.appendChild(el("h3", { id: "pub-title", class: "modal__title", text: "The letter wasn't sent" }));
    card.appendChild(el("p", { class: "modal__text", text: msg }));
    card.appendChild(el("div", { class: "modal__actions" }, [
      el("button", { class: "btn btn--ghost", type: "button", text: "Close", onclick: close }),
      retry ? el("button", { class: "btn btn--primary", type: "button", text: "Try again", onclick: retry }) : null
    ]));
    m.classList.add("is-open");
  }

  function showResult(res, letter) {
    var m = getModal(), card = D.$("#pub-card", m);
    card.innerHTML = "";
    var input = el("input", { class: "pub-link", type: "text", readonly: true, value: res.url, "aria-label": "Your letter link" });
    input.addEventListener("focus", function () { input.select(); });
    var qrBox = el("div", { class: "pub-qr", hidden: true });

    card.appendChild(el("img", { src: "assets/decorations/stamp-dove.svg", alt: "", class: "pub-stamp" }));
    card.appendChild(el("h3", { id: "pub-title", class: "modal__title", text: res.demo ? "Saved in demo mode" : "Your letter is ready to send" }));
    card.appendChild(el("p", { class: "modal__text", text: res.demo
      ? "Supabase isn't connected yet, so this link only opens on THIS device. Follow README section 4–5 to make links work on every phone."
      : "Anyone with this link can open the letter for " + (letter.recipient || "them") + " — no account needed." }));
    card.appendChild(input);
    card.appendChild(el("div", { class: "pub-actions" }, [
      el("button", { class: "btn btn--primary", type: "button", text: "Copy link", onclick: function () {
        D.copyText(res.url).then(function () { D.toast("Link copied — paste it in a message"); }, function () { input.select(); D.toast("Press and hold the link to copy it", "error"); });
      } }),
      el("button", { class: "btn btn--ghost", type: "button", text: "Share", onclick: function () {
        var data = { title: letter.title || "A letter for you", text: "I wrote you a little letter, " + (letter.recipient || "") + ".", url: res.url };
        if (navigator.share) navigator.share(data).catch(function () {});
        else D.copyText(res.url).then(function () { D.toast("Sharing isn't available here — link copied instead"); });
      } }),
      el("a", { class: "btn btn--ghost", href: res.url, target: "_blank", rel: "noopener", text: "Open letter" }),
      el("button", { class: "btn btn--ghost", type: "button", text: "QR code", onclick: function () {
        if (!qrBox.hidden) { qrBox.hidden = true; return; }
        qrBox.innerHTML = "";
        try {
          var qr = window.qrcode(0, "M");
          qr.addData(res.url); qr.make();
          var src = qr.createDataURL(6, 2);
          qrBox.appendChild(el("img", { src: src, alt: "QR code for your letter link", width: 200, height: 200 }));
          qrBox.appendChild(el("a", { class: "btn btn--small btn--ghost", href: src, download: "dear-1995-letter-qr.gif", text: "Download QR" }));
        } catch (e) { qrBox.appendChild(el("p", { text: "QR code could not be made for this link." })); }
        qrBox.hidden = false;
      } })
    ]));
    card.appendChild(qrBox);
    card.appendChild(el("div", { class: "modal__actions" }, [
      el("a", { class: "btn btn--small btn--ghost", href: "index.html#my-letters", text: "My letters" }),
      el("button", { class: "btn btn--small btn--ghost", type: "button", text: "Keep editing", onclick: close })
    ]));
    m.classList.add("is-open");
  }

  function publish(letter) {
    var problem = check(letter);
    if (problem) { D.toast(problem, "error"); return Promise.resolve(null); }
    var set = showProgress();
    var demo = !D.isConfigured();
    var steps = [
      [0.0, "Sealing your envelope…"],
      [0.08, (letter.photos || []).length ? "Uploading your photos…" : "Packing your letter…"],
      [0.7, letter.music ? "Uploading your song…" : "Almost there…"],
      [0.98, "Generating your unique link…"]
    ];
    function onProgress(p) {
      var label = steps[0][1];
      steps.forEach(function (s) { if (p >= s[0]) label = s[1]; });
      set(0.05 + p * 0.9, label);
    }
    var run = demo ? publishDemo : publishOnline;
    return run(letter, onProgress).then(function (res) {
      set(1, "Done");
      D.Sent.add({ id: res.id, url: res.url, title: letter.title, recipient: letter.recipient, at: Date.now(), demo: res.demo });
      showResult(res, letter);
      return res;
    }, function (err) {
      showError(err.message || String(err), function () { publish(letter); });
      return null;
    });
  }

  window.DearPublisher = { publish: publish, toPayload: toPayload, close: close };
})();
