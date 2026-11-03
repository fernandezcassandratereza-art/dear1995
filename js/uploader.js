/* =========================================================
   DEAR, 1995 — uploader.js
   Checks and prepares photos and music picked from the phone.
   - Photos: JPG / JPEG / PNG / WebP, resized in the browser
     (max 1600px) so they upload quickly on mobile data.
   - Music: MP3 only, up to 15 MB.
   Files are also re-checked on the server (Edge Function).
   ========================================================= */
(function () {
  "use strict";
  var D = window.Dear, L = D.LIMITS;

  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toLowerCase() : ""; }

  function readHead(file, n) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(file.slice(0, n || 16));
    });
  }

  function sniffImage(b) {
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "image/png";
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
    return null;
  }
  function sniffMp3(b) {
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true;           // "ID3" tag
    if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return true;                    // MPEG frame sync
    return false;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("This image could not be opened.")); };
      img.src = url;
    });
  }

  function toBlob(canvas, type, q) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) canvas.toBlob(resolve, type, q);
      else {
        var data = canvas.toDataURL(type, q), bin = atob(data.split(",")[1]), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: type }));
      }
    });
  }

  /* Validate + resize one photo. Resolves to {blob, type, w, h} */
  function processPhoto(file) {
    var e = ext(file.name);
    var typeOk = L.photoTypes.indexOf((file.type || "").toLowerCase()) !== -1 || L.photoExt.indexOf(e) !== -1;
    if (!typeOk) return Promise.reject(new Error(file.name + ": only JPG, JPEG, PNG or WebP photos are allowed."));
    if (file.size > L.maxPhotoInputBytes) return Promise.reject(new Error(file.name + " is too large (max " + D.formatBytes(L.maxPhotoInputBytes) + ")."));
    return readHead(file, 16).then(function (head) {
      if (!sniffImage(head)) throw new Error(file.name + " does not look like a real JPG, PNG or WebP image.");
      return loadImage(file);
    }).then(function (res) {
      var img = res.img, max = 1600;
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, max / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#f1e8d6"; // cream behind transparent PNGs
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(res.url);
      return toBlob(c, "image/jpeg", 0.85).then(function (blob) {
        if (blob && blob.size > L.maxPhotoUploadBytes) return toBlob(c, "image/jpeg", 0.65);
        return blob;
      }).then(function (blob) {
        if (!blob) throw new Error("Could not prepare " + file.name + ".");
        return { blob: blob, type: "image/jpeg", w: cw, h: ch };
      });
    });
  }

  /* Validate one MP3. Resolves to the file itself. */
  function checkMusic(file) {
    var e = ext(file.name), t = (file.type || "").toLowerCase();
    if (!(e === "mp3" || t === "audio/mpeg" || t === "audio/mp3")) return Promise.reject(new Error("Please choose an MP3 file."));
    if (file.size > L.maxMusicBytes) return Promise.reject(new Error("This song is " + D.formatBytes(file.size) + ". The limit is " + D.formatBytes(L.maxMusicBytes) + "."));
    return readHead(file, 4).then(function (b) {
      if (!sniffMp3(b)) throw new Error("This file does not look like a real MP3.");
      return file;
    });
  }

  function songTitleFromName(name) {
    return (name || "").replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, L.text.musicTitle);
  }

  window.DearUploader = { processPhoto: processPhoto, checkMusic: checkMusic, songTitleFromName: songTitleFromName, sniffImage: sniffImage, sniffMp3: sniffMp3 };
})();
