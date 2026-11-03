/* =========================================================
   DEAR, 1995 — app.js
   Shared settings, themes, helpers and on-device storage.
   ---------------------------------------------------------
   STEP 1 OF SETUP: paste your Supabase details below.
   (See README.txt, section 4.)
   ========================================================= */

window.DEAR_CONFIG = {
  // Your Supabase project URL, e.g. "https://abcdefgh.supabase.co"
  SUPABASE_URL: "https://jhtxgyddiomkvjhwwknx.supabase.co",

  // Your Supabase "anon" / "publishable" key (safe to use in the browser).
  // NEVER paste the service_role / secret key here.
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpodHhneWRkaW9ta3ZqaHd3a254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTQzNDgsImV4cCI6MjEwOTIzMDM0OH0.-uP4FJqcAHAEe8H4S4NGAcS658m8CnZvsc9-YvHu5IA",

  // Name of the Edge Function you deployed (backend/supabase/functions/publish-letter)
  PUBLISH_FUNCTION: "publish-letter",

  // Optional: your public website address, e.g. "https://dear1995.netlify.app"
  // Leave empty to detect it automatically from the browser address bar.
  SITE_URL: "",

  // true  = links look like  https://yoursite.com/letter/abc123  (needs Netlify/Vercel rewrites, included)
  // false = links look like  https://yoursite.com/letter.html?id=abc123  (works on ANY host)
  PRETTY_LINKS: false
};

(function () {
  "use strict";

  var CFG = window.DEAR_CONFIG;

  /* ---------- Limits (keep in sync with the Edge Function) ---------- */
  var LIMITS = {
    maxPhotos: 12,
    maxPhotoInputBytes: 25 * 1024 * 1024, // raw file picked from gallery
    maxPhotoUploadBytes: 5 * 1024 * 1024, // after in-browser resizing
    maxMusicBytes: 15 * 1024 * 1024,
    photoTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    photoExt: ["jpg", "jpeg", "png", "webp"],
    text: {
      recipient: 60, sender: 60, title: 120, date: 60, greeting: 120,
      body: 12000, closing: 160, finalMessage: 2000, caption: 140, musicTitle: 90,
      secret: 1000, note: 300, stampMessage: 200, surpriseClosing: 1000
    }
  };

  /* ---------- Fonts the letter can use ---------- */
  var FONTS = {
    homemade: { label: "Homemade Apple — cursive", css: "'Homemade Apple', 'Caveat', cursive", scale: 0.82, line: 2.1 },
    caveat:   { label: "Caveat — casual handwriting", css: "'Caveat', cursive", scale: 1.25, line: 1.55 },
    aurore:   { label: "La Belle Aurore — romantic script", css: "'La Belle Aurore', 'Caveat', cursive", scale: 1.15, line: 1.75 },
    reenie:   { label: "Reenie Beanie — pencil notes", css: "'Reenie Beanie', 'Caveat', cursive", scale: 1.35, line: 1.45 },
    garamond: { label: "Cormorant — elegant serif", css: "'Cormorant Garamond', Georgia, serif", scale: 1.05, line: 1.65 },
    typewriter: { label: "Special Elite — typewriter", css: "'Special Elite', 'Courier New', monospace", scale: 0.9, line: 1.7 },
    system:   { label: "Any language (system font)", css: "system-ui, -apple-system, 'Segoe UI', 'Noto Sans', sans-serif", scale: 0.95, line: 1.7 }
  };

  var PAPERS = {
    cream:    { label: "Antique cream", img: "paper-cream.png", lines: false },
    aged:     { label: "Aged & stained", img: "paper-aged.png", lines: false },
    rose:     { label: "Dusty rose", img: "paper-rose.png", lines: false },
    lined:    { label: "Lined journal", img: "paper-aged.png", lines: "lined" },
    grid:     { label: "Graph notebook", img: "paper-cream.png", lines: "grid" },
    midnight: { label: "Midnight brown", img: "paper-midnight.png", lines: false, dark: true }
  };

  var LAYOUTS = {
    scatter: "Scattered Polaroids",
    grid: "Scrapbook grid",
    film: "Film strip"
  };

  var STAMPS = {
    rose: "Pilipinas rose",
    moon: "Goodnight moon",
    dove: "Par avion dove",
    sun: "Since 1995 sun"
  };

  /* ---------- The six themes ---------- */
  var THEMES = {
    dear1995: {
      name: "Dear, 1995", blurb: "Classic vintage handwritten letter.",
      font: "homemade", paper: "cream", ink: "#3b2a24", accent: "#7a2632",
      bg: "#d9c3a5", envelope: "#ead9bb", layout: "scatter",
      deco: { flowers: true, stamps: true, tape: false, grain: true }
    },
    oldmemories: {
      name: "Old Memories", blurb: "Scrapbook pages and Polaroids.",
      font: "caveat", paper: "aged", ink: "#4a3428", accent: "#b5727a",
      bg: "#cdb59a", envelope: "#e6cfae", layout: "scatter",
      deco: { flowers: true, stamps: true, tape: true, grain: true }
    },
    filmromance: {
      name: "Film Romance", blurb: "Nostalgic film photography.",
      font: "garamond", paper: "cream", ink: "#3a2a22", accent: "#a8874a",
      bg: "#4a3a30", envelope: "#e8d6b6", layout: "film",
      deco: { flowers: false, stamps: true, tape: false, grain: true }
    },
    antiquejournal: {
      name: "Antique Journal", blurb: "Old diary with pressed flowers.",
      font: "aurore", paper: "lined", ink: "#3f3322", accent: "#6b5a3a",
      bg: "#b9a283", envelope: "#dcc7a2", layout: "grid",
      deco: { flowers: true, stamps: false, tape: true, grain: true }
    },
    retropostcard: {
      name: "Retro Postcard", blurb: "Vintage postal aesthetic.",
      font: "typewriter", paper: "cream", ink: "#2f2a3a", accent: "#8a3a3a",
      bg: "#c9b79b", envelope: "#efe2c8", layout: "grid",
      deco: { flowers: false, stamps: true, tape: false, grain: true, airmail: true }
    },
    midnight: {
      name: "Midnight Letter", blurb: "Dark brown and burgundy, by candlelight.",
      font: "homemade", paper: "midnight", ink: "#efe2c8", accent: "#c9a96e",
      bg: "#22150f", envelope: "#5a2a2e", layout: "scatter",
      deco: { flowers: true, stamps: true, tape: false, grain: true }
    }
  };

  /* ---------- Small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v; // only used with static, trusted strings
        else if (k === "style" && typeof v === "object") {
          Object.keys(v).forEach(function (p) {
            if (p.indexOf("--") === 0) node.style.setProperty(p, v[p]);
            else node.style[p] = v[p];
          });
        }
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function uid(len) {
    var chars = "abcdefghijkmnopqrstuvwxyz23456789";
    var arr = new Uint32Array(len || 10);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    var out = "";
    for (var i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function formatBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  }

  function todayString() {
    try {
      return new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return new Date().toDateString(); }
  }

  var toastTimer;
  function toast(msg, kind) {
    var t = $("#toast");
    if (!t) {
      t = el("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "toast is-show" + (kind ? " toast--" + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 3200);
  }

  function isConfigured() {
    return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
      CFG.SUPABASE_URL.indexOf("YOUR_") !== 0 && CFG.SUPABASE_ANON_KEY.indexOf("YOUR_") !== 0 &&
      /^https:\/\//.test(CFG.SUPABASE_URL));
  }

  function siteBase() {
    if (CFG.SITE_URL) return CFG.SITE_URL.replace(/\/+$/, "") + "/";
    var href = location.href.split("#")[0].split("?")[0];
    return href.replace(/[^\/]*$/, "");
  }

  function letterUrl(id) {
    if (CFG.PRETTY_LINKS && id.indexOf("demo-") !== 0) return siteBase() + "letter/" + encodeURIComponent(id);
    return siteBase() + "letter.html?id=" + encodeURIComponent(id);
  }

  /* ---------- A blank letter ---------- */
  function newLetter(themeKey) {
    var th = THEMES[themeKey || "dear1995"];
    return {
      version: 1,
      draftId: "d" + uid(10),
      updatedAt: Date.now(),
      recipient: "", sender: "", title: "", date: todayString(), greeting: "",
      body: "", closing: "With all my love,", finalMessage: "",
      style: {
        theme: themeKey || "dear1995",
        font: th.font, size: 20, align: "left",
        paper: th.paper, ink: th.ink, accent: th.accent, layout: th.layout,
        deco: Object.assign({}, th.deco)
      },
      photos: [],      // {id, caption, blob, type, w, h}  (blob only on device)
      music: null,     // {title, blob, name, size}
      surprise: { secret: "", notes: ["", "", ""], stamps: [], surpriseClosing: "" }
    };
  }

  /* ---------- IndexedDB (drafts keep photos & music on THIS device) ---------- */
  var DB_NAME = "dear1995", DB_VER = 1, dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("This browser cannot save drafts."));
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains("drafts")) d.createObjectStore("drafts", { keyPath: "draftId" });
        if (!d.objectStoreNames.contains("demo")) d.createObjectStore("demo", { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }
  function idb(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(store, mode);
        var s = tx.objectStore(store);
        var r = fn(s);
        tx.oncomplete = function () { resolve(r && r.result !== undefined ? r.result : undefined); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("Storage is full or blocked.")); };
      });
    });
  }

  var Drafts = {
    save: function (letter) { letter.updatedAt = Date.now(); return idb("drafts", "readwrite", function (s) { return s.put(letter); }); },
    get: function (id) { return idb("drafts", "readonly", function (s) { return s.get(id); }); },
    remove: function (id) { return idb("drafts", "readwrite", function (s) { return s.delete(id); }); },
    list: function () {
      return idb("drafts", "readonly", function (s) { return s.getAll(); }).then(function (all) {
        return (all || []).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      });
    }
  };

  // Demo letters = "published" on this device only (used before Supabase is configured)
  var DemoStore = {
    save: function (rec) { return idb("demo", "readwrite", function (s) { return s.put(rec); }); },
    get: function (id) { return idb("demo", "readonly", function (s) { return s.get(id); }); }
  };

  // Published links list (just the links — the letters themselves live online)
  var Sent = {
    key: "dear1995.sent",
    list: function () { try { return JSON.parse(localStorage.getItem(this.key) || "[]"); } catch (e) { return []; } },
    add: function (item) {
      var l = this.list().filter(function (x) { return x.id !== item.id; });
      l.unshift(item);
      try { localStorage.setItem(this.key, JSON.stringify(l.slice(0, 50))); } catch (e) {}
    },
    remove: function (id) {
      var l = this.list().filter(function (x) { return x.id !== id; });
      try { localStorage.setItem(this.key, JSON.stringify(l)); } catch (e) {}
    }
  };

  /* ---------- Copy to clipboard (with old-phone fallback) ---------- */
  function copyText(str) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(str).catch(function () { return legacyCopy(str); });
    }
    return legacyCopy(str);
  }
  function legacyCopy(str) {
    return new Promise(function (resolve, reject) {
      var ta = el("textarea", { style: { position: "fixed", top: "-1000px", opacity: "0" } });
      ta.value = str;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  /* ---------- In-page confirm dialog (native dialogs can be blocked) ---------- */
  function ask(message, okLabel) {
    return new Promise(function (resolve) {
      var wrap = el("div", { class: "modal is-open", role: "dialog", "aria-modal": "true" });
      function done(v) { wrap.remove(); resolve(v); }
      wrap.appendChild(el("div", { class: "modal__backdrop", onclick: function () { done(false); } }));
      wrap.appendChild(el("div", { class: "modal__card modal__card--small" }, [
        el("p", { class: "modal__text", text: message }),
        el("div", { class: "modal__actions" }, [
          el("button", { class: "btn btn--ghost", type: "button", text: "Cancel", onclick: function () { done(false); } }),
          el("button", { class: "btn btn--primary", type: "button", text: okLabel || "OK", onclick: function () { done(true); } })
        ])
      ]));
      document.body.appendChild(wrap);
    });
  }

  window.Dear = {
    ask: ask,
    CFG: CFG, LIMITS: LIMITS, FONTS: FONTS, PAPERS: PAPERS, LAYOUTS: LAYOUTS, STAMPS: STAMPS, THEMES: THEMES,
    $: $, $$: $$, el: el, uid: uid, clamp: clamp, debounce: debounce, formatBytes: formatBytes,
    todayString: todayString, toast: toast, isConfigured: isConfigured, siteBase: siteBase, letterUrl: letterUrl,
    newLetter: newLetter, Drafts: Drafts, DemoStore: DemoStore, Sent: Sent, copyText: copyText
  };

  /* ---------- Homepage: "My Letters" shelf + small niceties ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();

    var shelf = $("#my-letters-list");
    if (!shelf) return;
    renderShelf(shelf);
  });

  function renderShelf(shelf) {
    shelf.innerHTML = "";
    var sent = Sent.list();
    Drafts.list().catch(function () { return []; }).then(function (drafts) {
      if (!drafts.length && !sent.length) {
        shelf.appendChild(el("div", { class: "shelf-empty" }, [
          el("p", { class: "hand", text: "Nothing here yet." }),
          el("p", { text: "Drafts you save and letters you publish from this phone will appear here." }),
          el("a", { class: "btn btn--primary", href: "create.html", text: "Write your first letter" })
        ]));
        return;
      }
      drafts.forEach(function (d) {
        shelf.appendChild(el("article", { class: "shelf-card" }, [
          el("span", { class: "shelf-tag", text: "Draft" }),
          el("h4", { text: d.title || ("Letter for " + (d.recipient || "someone special")) }),
          el("p", { class: "shelf-meta", text: "Edited " + new Date(d.updatedAt).toLocaleString() + " · " + (d.photos || []).length + " photo(s)" + (d.music ? " · music" : "") }),
          el("div", { class: "shelf-actions" }, [
            el("a", { class: "btn btn--small btn--primary", href: "create.html?draft=" + encodeURIComponent(d.draftId), text: "Continue" }),
            el("button", { class: "btn btn--small btn--ghost", type: "button", text: "Delete", onclick: function () {
              ask("Delete this draft from this device? This cannot be undone.", "Delete").then(function (ok) {
                if (ok) Drafts.remove(d.draftId).then(function () { renderShelf(shelf); toast("Draft deleted"); });
              });
            } })
          ])
        ]));
      });
      sent.forEach(function (s) {
        shelf.appendChild(el("article", { class: "shelf-card shelf-card--sent" }, [
          el("span", { class: "shelf-tag", text: s.demo ? "Demo (this device)" : "Published" }),
          el("h4", { text: s.title || ("Letter for " + (s.recipient || "someone")) }),
          el("p", { class: "shelf-meta", text: "Sent " + new Date(s.at).toLocaleDateString() }),
          el("div", { class: "shelf-actions" }, [
            el("a", { class: "btn btn--small btn--primary", href: s.url, target: "_blank", rel: "noopener", text: "Open" }),
            el("button", { class: "btn btn--small btn--ghost", type: "button", text: "Copy link", onclick: function () {
              copyText(s.url).then(function () { toast("Link copied"); }, function () { toast("Could not copy — long-press the link instead.", "error"); });
            } }),
            el("button", { class: "btn btn--small btn--ghost", type: "button", text: "Forget", onclick: function () { Sent.remove(s.id); renderShelf(shelf); } })
          ])
        ]));
      });
    });
  }
})();
