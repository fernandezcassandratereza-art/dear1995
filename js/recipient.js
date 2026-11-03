/* =========================================================
   DEAR, 1995 — recipient.js
   Opens a published letter from its link:
     letter.html?id=abc123      or      /letter/abc123
   Shows ONLY the finished letter — never the editor.
   Reads go through the safe database function get_letter(),
   which returns one published letter by its exact random ID.
   ========================================================= */
(function () {
  "use strict";
  var D = window.Dear, el = D.el, CFG = D.CFG;

  function letterId() {
    var q = new URLSearchParams(location.search).get("id");
    if (q) return q;
    var m = /\/letter\/([A-Za-z0-9_-]+)\/?$/.exec(location.pathname);
    return m ? m[1] : null;
  }

  /* A complete sample letter that works with no backend at all */
  function sampleLetter() {
    return {
      recipient: "Mika", sender: "Jun", title: "For the girl who collects sunsets",
      date: "November 3, 2026", greeting: "Dearest Mika,",
      body: "I found the old disposable camera from our trip to Camiguin while cleaning my room today. I haven't developed it yet, but I already know what's inside — your hair in the wind, the half-eaten lanzones, the blurry photo of the sunset you said was \"art.\"\n\nI wanted to give you something that wasn't another chat bubble. Something slower. Something you can open like a real envelope, the way people did back in 1995.\n\nSalamat for every ordinary day that felt like magic. For laughing at my jokes even when they weren't funny. For staying.\n\nWherever we end up, I hope we always find our way back to the seawall at golden hour.",
      closing: "Always yours,",
      finalMessage: "If you ever forget how much you are loved, read this letter again.\n\nI'll keep writing them for as long as you'll keep reading.",
      style: { theme: "dear1995", font: "homemade", size: 20, align: "left", paper: "cream", ink: "#3b2a24", accent: "#7a2632", layout: "scatter",
        deco: { flowers: true, stamps: true, tape: true, grain: true, airmail: false } },
      photos: [
        { caption: "Golden hour, our seawall", src: "assets/images/photo-seaside.jpg" },
        { caption: "The roses you pretended not to love", src: "assets/images/photo-flowers.jpg" },
        { caption: "Our corner table", src: "assets/images/photo-cafe.jpg" },
        { caption: "Road trip, windows down", src: "assets/images/photo-roadtrip.jpg" }
      ],
      music: { title: "Sunday Morning Waltz", src: "assets/music/sunday-morning-waltz.mp3" },
      surprise: {
        secret: "I still keep the ticket from our first movie. It's in my wallet, right behind your photo.",
        notes: ["Look up. I'm probably smiling at you.", "You're my favorite notification."],
        stamps: [{ type: "rose", message: "This one's from the post office near your house." }, { type: "dove", message: "Par avion — straight to your heart." }],
        surpriseClosing: "P.S. Check your bag. There's something small in the front pocket for you."
      }
    };
  }

  function fetchOnline(id) {
    var url = CFG.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/get_letter";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ p_id: id })
    }).then(function (r) {
      if (!r.ok) throw new Error("server");
      return r.json();
    }).then(function (data) {
      if (!data) throw new Error("notfound");
      return data;
    });
  }

  function fetchDemo(id) {
    return D.DemoStore.get(id).then(function (rec) {
      if (!rec) throw new Error("demo-missing");
      var l = rec.letter;
      l.photos = (l.photos || []).map(function (p) { return { caption: p.caption, src: URL.createObjectURL(p.blob) }; });
      if (l.music && l.music.blob) l.music = { title: l.music.title, src: URL.createObjectURL(l.music.blob) };
      return l;
    });
  }

  function showMessage(title, text, withCreate) {
    var root = D.$("#letter-root");
    root.innerHTML = "";
    root.appendChild(el("div", { class: "lt-message" }, [
      el("img", { src: "assets/decorations/stamp-moon.svg", alt: "", class: "lt-message__stamp" }),
      el("h1", { text: title }),
      el("p", { text: text }),
      withCreate ? el("a", { class: "dl-btn", href: "index.html", text: "Write a letter of your own" }) : null
    ]));
  }

  document.addEventListener("DOMContentLoaded", function () {
    var id = letterId();
    var root = D.$("#letter-root");
    var job;
    if (!id) {
      return showMessage("No letter here yet", "This page opens letters from a special link. Ask the sender to share their link again.", true);
    }
    if (id === "sample") job = Promise.resolve(sampleLetter());
    else if (id.indexOf("demo-") === 0) job = fetchDemo(id);
    else if (!/^[A-Za-z0-9]{8,32}$/.test(id)) job = Promise.reject(new Error("notfound"));
    else if (!D.isConfigured()) job = Promise.reject(new Error("config"));
    else job = fetchOnline(id);

    job.then(function (letter) {
      document.title = (letter.title ? letter.title + " — " : "") + "A letter for " + (letter.recipient || "you") + " · DEAR, 1995";
      root.innerHTML = "";
      window.DearLetter.render(root, letter, { mode: "recipient" });
    }).catch(function (err) {
      var m = err && err.message;
      if (m === "demo-missing") showMessage("This letter lives on another phone", "It was saved in demo mode, so it only opens on the device where it was written. The sender needs to connect Supabase to share it everywhere.", true);
      else if (m === "config") showMessage("Almost ready", "This website isn't connected to its database yet. If you made this site, add your Supabase details in js/app.js (README section 4).", false);
      else if (m === "notfound") showMessage("We couldn't find this letter", "The link may be incomplete. Check that you copied the whole link, then try again.", true);
      else showMessage("The mail is running late", "We couldn't load this letter right now. Check your internet connection and refresh the page.", false);
    });
  });
})();
