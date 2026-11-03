// =========================================================
// DEAR, 1995 — Supabase Edge Function: publish-letter
// ---------------------------------------------------------
// The ONLY way a letter gets saved online.
// Runs on Supabase's servers, so the secret service-role key
// stays here and is never sent to anyone's browser.
//
// It:
//   1. Allows only POST requests from your website (CORS)
//   2. Rate-limits each visitor (hashed IP, nothing personal stored)
//   3. Validates and trims every text field
//   4. Checks every file's real type (magic bytes) and size
//   5. Uploads photos + music to Supabase Storage
//   6. Saves the letter with a long, unpredictable random ID
//   7. Returns { id } to the browser
//
// Deploy:  supabase functions deploy publish-letter --no-verify-jwt
// (see README.txt, section 5)
// =========================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------- settings (can be overridden with `supabase secrets set NAME=value`) ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = Deno.env.get("LETTER_BUCKET") ?? "letter-media";
const RATE_LIMIT_PER_HOUR = Number(Deno.env.get("RATE_LIMIT_PER_HOUR") ?? "10");
// If no IP_HASH_SALT secret is set, fall back to the (secret) service key so the salt is never public.
const IP_SALT = Deno.env.get("IP_HASH_SALT") ?? ("dear1995:" + SERVICE_KEY.slice(-24));
// Comma-separated list of sites allowed to publish, e.g. "https://dear1995.netlify.app,http://localhost:8080"
// Leave empty ("") or "*" while testing to allow any site.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim()).filter(Boolean);

const MAX_PHOTOS = 12;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;   // photos are resized in the browser first
const MAX_MUSIC_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

const T = {
  recipient: 60, sender: 60, title: 120, date: 60, greeting: 120,
  body: 12000, closing: 160, finalMessage: 2000, caption: 140, musicTitle: 90,
  secret: 1000, note: 300, stampMessage: 200, surpriseClosing: 1000,
};
const THEMES = ["dear1995", "oldmemories", "filmromance", "antiquejournal", "retropostcard", "midnight"];
const FONTS = ["homemade", "caveat", "aurore", "reenie", "garamond", "typewriter", "system"];
const PAPERS = ["cream", "aged", "rose", "lined", "grid", "midnight"];
const LAYOUTS = ["scatter", "grid", "film"];
const ALIGNS = ["left", "center", "right", "justify"];
const STAMPS = ["rose", "moon", "dove", "sun"];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------- helpers ----------
function corsHeaders(origin: string | null): Record<string, string> {
  const allowAll = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes("*");
  const allowed = allowAll ? "*" : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // remove control characters except newlines/tabs, then trim to the limit
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}
function pick<Tv extends string>(v: unknown, list: Tv[], fallback: Tv): Tv {
  return (typeof v === "string" && (list as string[]).includes(v)) ? (v as Tv) : fallback;
}
function color(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

function randomId(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no look-alike characters
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  return null;
}
function isMp3(b: Uint8Array): boolean {
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true;       // ID3
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true;               // frame sync
  return false;
}

class UserError extends Error {
  status: number;
  constructor(msg: string, status = 400) { super(msg); this.status = status; }
}

// ---------- main ----------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  // Block other websites from using your publishing endpoint (when ALLOWED_ORIGINS is set)
  if (!ALLOWED_ORIGINS.includes("*") && ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "This website is not allowed to publish letters here." }, 403, origin);
  }

  const uploaded: string[] = [];
  try {
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > MAX_TOTAL_BYTES) throw new UserError("This letter is too large. Use fewer photos or a shorter song.", 413);

    // ----- 1. rate limit -----
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
    const ipHash = await sha256(IP_SALT + "|" + ip);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from("publish_log").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", since);
    if (countErr) throw new Error("rate-limit check failed: " + countErr.message);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      throw new UserError("You've published a lot of letters in the last hour. Please try again a little later.", 429);
    }

    // ----- 2. read the form -----
    const ctype = req.headers.get("content-type") ?? "";
    if (!ctype.includes("multipart/form-data")) throw new UserError("Expected a multipart form upload.");
    const form = await req.formData();
    let raw: any;
    try { raw = JSON.parse(String(form.get("letter") ?? "")); } catch { throw new UserError("Letter data is missing or broken."); }
    if (!raw || typeof raw !== "object") throw new UserError("Letter data is missing.");

    // ----- 3. validate text -----
    const st = raw.style ?? {};
    const theme = pick(st.theme, THEMES, "dear1995");
    const letter: any = {
      version: 1,
      recipient: str(raw.recipient, T.recipient).trim(),
      sender: str(raw.sender, T.sender).trim(),
      title: str(raw.title, T.title).trim(),
      date: str(raw.date, T.date).trim(),
      greeting: str(raw.greeting, T.greeting).trim(),
      body: str(raw.body, T.body),
      closing: str(raw.closing, T.closing).trim(),
      finalMessage: str(raw.finalMessage, T.finalMessage),
      style: {
        theme,
        font: pick(st.font, FONTS, "homemade"),
        size: Math.min(32, Math.max(14, Math.round(Number(st.size) || 20))),
        align: pick(st.align, ALIGNS, "left"),
        paper: pick(st.paper, PAPERS, "cream"),
        ink: color(st.ink, "#3b2a24"),
        accent: color(st.accent, "#7a2632"),
        layout: pick(st.layout, LAYOUTS, "scatter"),
        deco: {
          flowers: !!st.deco?.flowers, stamps: !!st.deco?.stamps, tape: !!st.deco?.tape,
          grain: !!st.deco?.grain, airmail: !!st.deco?.airmail,
        },
      },
      photos: [] as { caption: string; src: string }[],
      music: null as null | { title: string; src: string },
      surprise: {
        secret: str(raw.surprise?.secret, T.secret),
        notes: (Array.isArray(raw.surprise?.notes) ? raw.surprise.notes : [])
          .map((n: unknown) => str(n, T.note).trim()).filter(Boolean).slice(0, 3),
        stamps: (Array.isArray(raw.surprise?.stamps) ? raw.surprise.stamps : [])
          .filter((s: any) => s && STAMPS.includes(s.type)).slice(0, 4)
          .map((s: any) => ({ type: s.type, message: str(s.message, T.stampMessage).trim() })),
        surpriseClosing: str(raw.surprise?.surpriseClosing, T.surpriseClosing),
      },
    };
    if (!letter.recipient) throw new UserError("Please add the recipient's name.");
    if (!letter.body.trim()) throw new UserError("The letter is empty.");

    // ----- 4. unique id -----
    let id = randomId(14);
    for (let i = 0; i < 3; i++) {
      const { data } = await supabase.from("letters").select("id").eq("id", id).maybeSingle();
      if (!data) break;
      id = randomId(16);
    }

    // ----- 5. files -----
    const photoMeta: any[] = Array.isArray(raw.photos) ? raw.photos.slice(0, MAX_PHOTOS) : [];
    for (let i = 0; i < photoMeta.length; i++) {
      const file = form.get("photo_" + i);
      if (!(file instanceof File)) continue;
      if (file.size > MAX_PHOTO_BYTES) throw new UserError(`Photo ${i + 1} is too large (max 5 MB).`, 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniffImage(bytes);
      if (!kind) throw new UserError(`Photo ${i + 1} is not a JPG, PNG or WebP image.`, 415);
      const path = `${id}/photo-${i + 1}-${randomId(6)}.${kind.ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false, cacheControl: "31536000" });
      if (error) throw new Error("photo upload failed: " + error.message);
      uploaded.push(path);
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      letter.photos.push({ caption: str(photoMeta[i]?.caption, T.caption).trim(), src: pub.publicUrl });
    }

    const music = form.get("music");
    if (music instanceof File && raw.music) {
      if (music.size > MAX_MUSIC_BYTES) throw new UserError("The song is too large (max 15 MB).", 413);
      const bytes = new Uint8Array(await music.arrayBuffer());
      if (!isMp3(bytes)) throw new UserError("The song must be an MP3 file.", 415);
      const path = `${id}/music-${randomId(6)}.mp3`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: false, cacheControl: "31536000" });
      if (error) throw new Error("music upload failed: " + error.message);
      uploaded.push(path);
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      letter.music = { title: str(raw.music?.title, T.musicTitle).trim() || "Our song", src: pub.publicUrl };
    }

    // ----- 6. save -----
    const { error: insErr } = await supabase.from("letters").insert({ id, content: letter, theme, is_published: true });
    if (insErr) throw new Error("database insert failed: " + insErr.message);
    await supabase.from("publish_log").insert({ ip_hash: ipHash, letter_id: id });

    return json({ id }, 200, origin);
  } catch (err) {
    // clean up any files uploaded before the error
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded).catch(() => {});
    if (err instanceof UserError) return json({ error: err.message }, err.status, origin);
    console.error("publish-letter error:", err);
    return json({ error: "Something went wrong while saving your letter. Please try again." }, 500, origin);
  }
});
