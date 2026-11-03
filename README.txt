==============================================================
  DEAR, 1995  —  Letters made personal.
  A digital letter maker. No login. No registration. No accounts.
==============================================================

Visit -> create -> customize -> publish -> share one link.

This folder is a complete website made only with HTML, CSS and
plain JavaScript. There is no React, no Node, no npm and no build
step, so it works in SPCK Editor on your phone.

--------------------------------------------------------------
WHAT'S INSIDE
--------------------------------------------------------------
dear-1995/
  index.html          Homepage (envelope animation, how it works,
                      themes, sample letter, "My letters" shelf)
  create.html         The 7-step letter maker
  letter.html         The page your recipient opens
  README.txt          This guide
  css/style.css       Shared look (colors, buttons, homepage)
  css/creator.css     Letter maker styles
  css/letter.css      Recipient page styles (envelope, Polaroids,
                      cassette, final message)
  js/app.js           SETTINGS + shared helpers + local drafts
  js/creator.js       The 7-step editor
  js/uploader.js      Checks and resizes photos, checks MP3s
  js/preview.js       Draws the letter (used by the live preview
                      AND by the recipient page, so they match)
  js/publisher.js     Sends the letter to your Supabase function
  js/recipient.js     Loads a published letter by its ID
  js/vendor/qrcode.js QR code generator (MIT license)
  assets/images/      Sample photos (used by the sample letter)
  assets/decorations/ Paper textures, film grain, wax seal,
                      stamps, pressed flowers, washi tape, cassette
  assets/fonts/       Handwriting and typewriter fonts (offline)
  assets/music/       sunday-morning-waltz.mp3 (original sample song)
  database/schema.sql Database + storage setup for Supabase
  backend/supabase/functions/publish-letter/index.ts
                      The secure publishing function (Edge Function)
  backend/supabase/config.toml   Function settings
  _redirects, vercel.json        Optional "pretty link" rules
                                 (/letter/abc123) for Netlify/Vercel

--------------------------------------------------------------
STATUS: THE BACKEND IS ALREADY SET UP AND LIVE
--------------------------------------------------------------
This copy is the FINAL version (not demo). It is already connected
to your Supabase project:
   Project name : dear-1995  (region: Singapore, free plan)
   Project URL  : https://jhtxgyddiomkvjhwwknx.supabase.co
 - database/schema.sql has been run (tables, get_letter, storage).
 - The publish-letter Edge Function is deployed and active.
 - js/app.js already contains the Project URL + public anon key.
 - Tested: a real letter with photos + MP3 was published and
   opened in a separate fresh browser. Direct table reads/writes
   and direct storage uploads were confirmed BLOCKED.

So you can SKIP steps 4 and 5 below (they're kept for reference
or if you ever move to another Supabase project).
The ONLY thing left: step 9 — put the website online, so your
links point to a real web address that works on every phone.

Note: the Supabase "Security Advisor" may show notes such as
"RLS enabled, no policy" and "anon can execute get_letter". Both
are intentional: no policy = nobody can touch the tables directly,
and get_letter is the one safe door that returns a single
published letter by its secret ID.

Free-plan note: Supabase pauses free projects after about a week
with no activity. If letters stop loading, open
https://supabase.com/dashboard, select dear-1995 and click
"Restore project".

--------------------------------------------------------------
1. EXTRACT THE ZIP
--------------------------------------------------------------
On Android: open your Files app, tap dear-1995.zip, tap
"Extract". You'll get a folder named "dear-1995".
On a computer: right-click the ZIP -> "Extract All".

Keep every file and folder exactly where it is. The pages use
relative paths (like css/style.css), so moving files breaks them.

--------------------------------------------------------------
2. OPEN IN SPCK EDITOR
--------------------------------------------------------------
1. Install "Spck Editor" from the Play Store / App Store.
2. Open Spck -> Projects -> "+" -> "Import / Open folder"
   (or "Import ZIP" and pick dear-1995.zip directly).
3. Pick the dear-1995 folder. You'll see index.html, css, js...

--------------------------------------------------------------
3. PREVIEW THE WEBSITE
--------------------------------------------------------------
In Spck, open index.html and tap the Play / Preview button.
Everything works right away, connected to the live backend:
  - Create a letter, add photos and music, pick a theme.
  - Save drafts (on this device).
  - "Publish" uploads the letter to Supabase for real.
  - Try the built-in sample: letter.html?id=sample

Important: if you publish from a preview inside SPCK, the copied
link starts with the preview address (like localhost), which other
phones can't open. Publish from your HOSTED site (step 9), or set
SITE_URL in js/app.js so links always use your real address.
(The letter itself is saved online either way — you can just
swap the start of the link to your hosted address.)

DEMO MODE only happens if SUPABASE_URL / SUPABASE_ANON_KEY in
js/app.js are emptied or set back to placeholders.

On a computer you can also preview with any small local server,
for example:  python3 -m http.server 8000   (inside dear-1995)
then visit http://localhost:8000

For real sharing on other phones, do step 9.

--------------------------------------------------------------
4. CONFIGURE SUPABASE (free account)
--------------------------------------------------------------
Supabase stores published letters, photos and music.
(You make one Supabase account for YOURSELF as the site owner.
Your visitors and recipients never log in.)

1. Go to https://supabase.com -> Start your project -> New project.
   Choose a name and region (Singapore is closest to the PH).
2. When it's ready, open "SQL Editor" -> "New query".
3. Open database/schema.sql in Spck, copy EVERYTHING, paste it
   into the SQL Editor, and press "Run". It creates:
     - the "letters" table (locked: nobody can read or write it
       directly from the browser)
     - "publish_log" (used for rate limiting)
     - get_letter(id): the only public way to read a letter, and
       it only returns PUBLISHED letters
     - the "letter-media" storage bucket (public read, no public
       uploads; photos/MP3 only, 15 MB max)
4. Go to Project Settings -> API (or "Data API" / "API Keys").
   Copy:
     - Project URL        e.g. https://abcdefgh.supabase.co
     - anon / publishable key  (a long text; it's SAFE to put in
       the website — it can only call get_letter)
5. Open js/app.js and fill in the top:

     SUPABASE_URL: "https://abcdefgh.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...your anon key...",

   NEVER paste the "service_role" / "secret" key into any website
   file. It stays inside Supabase only (the function reads it
   automatically).

--------------------------------------------------------------
5. DEPLOY THE PUBLISHING FUNCTION
--------------------------------------------------------------
Browsers never write to the database directly. They send the
letter to the "publish-letter" Edge Function, which checks file
types and sizes, applies a rate limit, creates an unguessable ID,
uploads the files and saves the letter using the secret key that
only Supabase knows.

OPTION A — Supabase Dashboard (easiest, works from a phone):
1. In your project open "Edge Functions" -> "Deploy a new
   function" -> "Via Editor".
2. Name it exactly:  publish-letter
3. Delete the example code. Paste the whole contents of
   backend/supabase/functions/publish-letter/index.ts
4. Click Deploy.
5. Open the function's settings/details and turn OFF
   "Verify JWT" (Enforce JWT verification). The website sends the
   anon key, and the function does its own checks.

OPTION B — Supabase CLI (on a computer):
   npm install -g supabase   (or see supabase.com/docs/guides/cli)
   cd dear-1995/backend
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy publish-letter --no-verify-jwt

OPTIONAL SECRETS (Edge Functions -> Secrets, or CLI):
   supabase secrets set ALLOWED_ORIGINS=https://your-site.netlify.app
   supabase secrets set IP_HASH_SALT=any-long-random-words
   supabase secrets set RATE_LIMIT_PER_HOUR=10
 - ALLOWED_ORIGINS: only your website may publish (comma-separate
   several). Default "*" = any site (fine while testing).
 - IP_HASH_SALT: IPs are stored only as salted hashes.
 - RATE_LIMIT_PER_HOUR: publishes allowed per visitor per hour.
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to the
function automatically — you don't set them.

When js/app.js has your URL + key, the yellow "Demo mode" notice
in the letter maker disappears.

--------------------------------------------------------------
6. UPLOAD IMAGES AND MUSIC
--------------------------------------------------------------
Inside the letter maker:
 - Step 3 Photos: tap "Choose photos". JPG, JPEG, PNG or WebP,
   up to 12 photos. Big photos are resized on the phone (max
   1600 px) before uploading. Add captions, move up/down,
   replace or remove. Pick Polaroid / scrapbook / film-strip
   layout in Step 5.
 - Step 4 Music: tap "Select an MP3" (up to 15 MB), or use the
   sample song. Preview, pause, change volume, rename the song
   for the cassette label, change or remove it.
   The music starts when the recipient taps "Open your letter"
   (mobile browsers only allow sound after a tap).
You don't upload anything to Supabase by hand — publishing does
it for you, into storage folder letter-media/<letter-id>/.

To change the sample photos on the homepage, replace the files in
assets/images/ keeping the same names.

--------------------------------------------------------------
7. PUBLISH LETTERS
--------------------------------------------------------------
1. Fill the 7 steps: Details, Write, Photos, Music, Theme,
   Surprise, Preview.
2. In Preview, tap through it exactly like your recipient will.
   EDIT LETTER goes back, SAVE DRAFT keeps it on this device.
3. Tap PUBLISH LETTER. You'll get:
     COPY LINK  ·  SHARE  ·  OPEN LETTER  ·  QR CODE
   The link looks like
     https://your-site.com/letter.html?id=Xk3pQ9vT2mLa7R
4. Send it on Messenger, Viber, SMS, anywhere. The recipient
   needs no account — they just open it.

Note: a published letter is a copy. Editing the draft later and
publishing again creates a NEW link.

--------------------------------------------------------------
8. TEST LINKS ON ANOTHER DEVICE
--------------------------------------------------------------
1. Publish a test letter from your hosted site (step 9).
2. Copy the link and open it on a different phone (or a private
   / incognito window, or mobile data instead of Wi-Fi).
3. Check: envelope -> letter -> memories -> music -> final page.
If it says "letter not found": check SUPABASE_URL / anon key in
js/app.js, that schema.sql ran without errors, and that the
link is complete.
If publishing fails: check the function is named publish-letter,
"Verify JWT" is OFF, and ALLOWED_ORIGINS matches your site
address exactly (https://..., no trailing slash).

--------------------------------------------------------------
9. DEPLOY THE WEBSITE ONLINE
--------------------------------------------------------------
The website must be hosted online before public sharing links
can work. (A link pointing to "localhost" or a file on your phone
can't open on someone else's phone.)

Any free static host works. Upload the CONTENTS of dear-1995
(index.html must be at the top level):
 - Netlify Drop: https://app.netlify.com/drop — drag the
   dear-1995 folder in. Done. (Can be done from a computer.)
 - Vercel, Cloudflare Pages, or GitHub Pages: create a project
   and upload/push the folder.
Then:
 - Optional: set SITE_URL in js/app.js to your address, e.g.
   SITE_URL: "https://dear1995.netlify.app"
   (links will always use it, even if you preview elsewhere)
 - Optional pretty links (/letter/abc123): set PRETTY_LINKS: true.
   Works on Netlify (_redirects) and Vercel (vercel.json), both
   included. Leave it false on GitHub Pages / other hosts.
 - Set ALLOWED_ORIGINS (step 5) to your live address.

--------------------------------------------------------------
MY LETTERS / SAVED DRAFTS (no account needed)
--------------------------------------------------------------
Drafts and the list of letters you've sent are stored in YOUR
BROWSER on THIS DEVICE (IndexedDB + localStorage).
 - They don't appear on your other phones or computers.
 - They may disappear if you clear browser data/cache, use
   private/incognito mode, or uninstall the browser.
 - Published letters stay online; keep your links somewhere safe.
Find them on the homepage under "My letters".

--------------------------------------------------------------
SECURITY & LIMITS (already built in)
--------------------------------------------------------------
 - No login, passwords, or user accounts anywhere.
 - The service-role key is only used inside the Edge Function.
 - Database tables have Row Level Security ON with no public
   policies: the browser can't read, write, or list them.
 - Recipients can only fetch ONE published letter by its ID via
   get_letter(); drafts are never uploaded.
 - IDs are 14 random characters (impossible to guess).
 - Files are checked by their real content (not just the name):
   JPG/PNG/WebP photos up to 5 MB each (after resizing), max 12;
   MP3 up to 15 MB; whole letter max 80 MB.
 - Text is length-limited and shown as plain text (no HTML).
 - Rate limit: 10 publishes per hour per visitor (changeable).

To take a letter offline: Supabase -> Table Editor -> letters ->
find the ID -> set is_published to false (or delete the row), and
delete its folder in Storage -> letter-media.
Optional cleanup of old rate-limit rows (SQL Editor):
   select cleanup_publish_log();

--------------------------------------------------------------
CREDITS
--------------------------------------------------------------
 - Fonts: Homemade Apple, Caveat, La Belle Aurore, Reenie Beanie,
   Cormorant Garamond, Special Elite — SIL Open Font License,
   via Google Fonts, bundled in assets/fonts.
 - QR codes: qrcode-generator by Kazuhiko Arase — MIT License.
 - "Sunday Morning Waltz" (assets/music): original music-box
   piece composed for this project. Free to use.
 - Sample photos: original AI-generated images made for this
   project. Paper textures, stamps, seals and decorations are
   original artwork made for this project.

NO LOGIN. NO REGISTRATION. JUST CREATE, PERSONALIZE, AND SHARE.
