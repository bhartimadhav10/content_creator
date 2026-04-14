# PROJECT_MAP — content-agents

**Single source of truth.** Future sessions should read this first and avoid re-scanning the codebase.
Last update: Phase 2 + fixes (mobile responsive, editable onboarding, Enter key, faster save).

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Bundler | Vite 5 | fast dev, native ESM |
| UI | React 18 + Tailwind 3 | declarative, utility-first |
| Routing | react-router-dom v6 | nested layouts, guards |
| Icons | lucide-react | consistent, tree-shakable |
| Auth + DB | Supabase (free tier) | 50k MAU, RLS out of box |
| LLM | Groq (OpenAI-compat) | free, fast, Llama 3.3-70B |
| Scrape proxy | Cloudflare Worker | free 100k/day, CORS |
| Hosting | Vercel (free hobby) | SPA rewrites via `vercel.json` |

## Design system

- Fonts: **Fraunces** (display serif, italic accents), **Instrument Sans** (body), **JetBrains Mono** (data/kickers).
- Palette: `ink #0A0A0B`, `ivory #F4F1EB`, signature accent `acid #D4FF3A`. Platform brand colors used as punctuation only.
- Motion: `.rise` keyframe (opacity + translateY), `.marquee-underline` on links, grain overlay via SVG noise.
- Components live in `src/lib/ui.jsx` — `Button`, `Input`, `Textarea`, `Card`, `PageHeader`, `Empty`, `Spinner`, `Kicker`, `Tag`.

---

## File tree

```
content-agents/
├── README.md
├── PROJECT_MAP.md              ← this file
├── package.json                — deps incl. @supabase/supabase-js
├── vite.config.js
├── tailwind.config.js          — ink/ivory/acid + yt/ig/fb tokens
├── postcss.config.js
├── vercel.json                 — SPA rewrite
├── .env.example                — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
├── index.html                  — Fraunces + Instrument Sans + JetBrains Mono
├── src/
│   ├── main.jsx                — entry: BrowserRouter wraps App
│   ├── index.css               — Tailwind + grain, rise anim, ig-gradient, dot-grid, marquee-underline
│   ├── App.jsx                 — AuthProvider + routes + Shell sidebar
│   ├── lib/
│   │   ├── storage.js          — localStorage wrapper + KEYS enum (API keys only)
│   │   ├── supabase.js         — createClient from env vars
│   │   ├── auth.jsx            — AuthProvider, useAuth, RequireAuth, signOut
│   │   ├── db.js               — all Supabase CRUD helpers
│   │   ├── api.js              — external API calls (YouTube, Groq, Apify, News)
│   │   └── ui.jsx              — shared UI primitives
│   ├── components/
│   │   ├── PostGrid.jsx        — card grid for research results
│   │   └── NewsWidget.jsx      — free news feed (Google News RSS)
│   └── pages/
│       ├── Login.jsx           — sign in / up / Google OAuth
│       ├── Onboarding.jsx      — 5-step wizard
│       ├── Dashboard.jsx       — personalized home
│       ├── YouTubeTab.jsx
│       ├── InstagramTab.jsx
│       ├── FacebookTab.jsx
│       ├── VoiceSamples.jsx    — reads/writes voice_samples table
│       ├── Generate.jsx        — saves to generations table
│       ├── Competitors.jsx     — CRUD competitors table
│       ├── History.jsx         — lists past generations
│       └── Settings.jsx        — API keys (localStorage) + account
├── supabase/
│   ├── schema.sql              — tables + RLS + triggers
│   └── README.md               — setup steps
└── worker/
    ├── worker.js               — /run-sync (Apify) + /news (Google News RSS)
    └── README.md               — wrangler deploy steps
```

---

## Data model (Supabase)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | 1:1 with `auth.users`, onboarding data | `id(uuid)=auth.users.id, email, creator_name, niche, platforms[], tone, goals, onboarded(bool)` |
| `competitors` | creators user tracks | `id, user_id, platform('youtube'\|'instagram'\|'facebook'), handle, url, notes` |
| `voice_samples` | past scripts to mimic | `id, user_id, label, content` |
| `research_runs` | cached research results | `id, user_id, platform, query, results(jsonb)` |
| `generations` | past scripts + hooks | `id, user_id, topic, script(jsonb), hooks(jsonb), source_platform` |

- All tables have **RLS** with `auth.uid() = user_id` (or `id` for profiles). Enforced by DB.
- `handle_new_user()` trigger auto-inserts a `profiles` row on signup.

---

## Module-by-module map

### `src/lib/storage.js`
- `PREFIX = 'ca.'`, `storage.{get,set,remove}(key, fallback?)`
- `KEYS`: `GROQ, YOUTUBE, APIFY, WORKER_URL, SELECTED_TOPIC` (+ legacy `NICHE, CREATOR, VOICE_SAMPLES, LAST_RESEARCH` — superseded by DB, no longer written).

### `src/lib/supabase.js`
- `supabase` — client with `persistSession: true, autoRefreshToken: true, detectSessionInUrl: true`. Reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### `src/lib/auth.jsx`
- `AuthCtx = createContext({user, profile, loading, refreshProfile, setProfile})`.
- `setProfile` is exposed so callers (Onboarding) can optimistically update without re-fetching.
- `AuthProvider` — on mount: `getSession()` → `loadProfile(uid)`; subscribes to `onAuthStateChange`.
  - `loadProfile(uid)` → selects from `profiles` by `id`.
- `useAuth()` — hook.
- `RequireAuth({children})` — redirects to `/login` if no user; to `/onboarding` if `!profile.onboarded`.
- `signOut()`.

### `src/lib/db.js` — all return Promises, throw on error
- **Voice**: `listVoiceSamples(userId)` · `replaceVoiceSamples(userId, samples[])` (delete+insert)
- **Competitors**: `listCompetitors(userId, platform?)` · `addCompetitor(userId, {platform, handle, url?, notes?})` · `removeCompetitor(id)`
- **Research**: `saveResearch(userId, {platform, query, results})` · `latestResearch(userId, platform)`
- **Generations**: `saveGeneration(userId, {topic, script, hooks, source_platform?})` · `listGenerations(userId, limit=50)`

### `src/lib/api.js`
- `youtubeSearch({query, maxResults=25, order='viewCount', publishedAfterDays=90})` — 2 calls (`/search` + `/videos`); returns normalized post objects with computed `engagementRate` and `viral`.
- `testYouTubeKey()`.
- `apifyRun({actor, input})` private — POSTs to `${WORKER_URL}/run-sync`.
- `instagramSearch({hashtags, resultsLimit=30})` — actor `apify~instagram-hashtag-scraper`.
- `facebookSearch({pageUrls, resultsLimit=30})` — actor `apify~facebook-posts-scraper`.
- `fetchNews(query)` — GET `${WORKER_URL}/news?q=...`.
- `groqChat({system, user, model='llama-3.3-70b-versatile', temperature=0.7, json=false})`.
- `testGroqKey()`.
- `generateScriptAndHooks({topic, voiceSamples, niche, creator})` — builds system+user prompt enforcing JSON shape `{script:{hook,setup,value,cta}, hooks:[{text,pattern,match}]*5}`.

Normalized post shape: `{id, platform, title, author|channel, thumbnail, url, views, likes, comments, engagementRate, publishedAt, hook, viral}`.

### `src/lib/ui.jsx`
- `Button` variants: `primary|accent|ghost|outline|danger|ig|fb|yt`.
- `Input`, `Textarea` (mono), `Card`, `Spinner`.
- `PageHeader({kicker, title, subtitle, right})` — large serif title + mono kicker.
- `Empty({title, hint})`, `Kicker({children})`, `Tag({children, tone})`.

### `src/components/PostGrid.jsx`
- `fmt(n)` — K/M abbreviator.
- `PostGrid({posts})` — 1→4 col grid, hover lift, viral tag, "Use as topic" writes `KEYS.SELECTED_TOPIC` and navigates to `/generate`.

### `src/components/NewsWidget.jsx`
- `timeAgo(pubDate)`.
- `NewsWidget({niche})` — auto-loads `fetchNews(niche)`. Refresh button. Click "Use" → sets `SELECTED_TOPIC` with `from.platform='news'` and navigates.

### `src/pages/Login.jsx`
- State: `mode('signin'|'signup'), email, password, loading, msg, err`.
- Two-column hero. Google OAuth via `supabase.auth.signInWithOAuth({provider:'google'})`. Email/password.

### `src/pages/Onboarding.jsx`
- Constants: `NICHES[], TONES[], GOALS[]`.
- State per step: `creator, niches[], customNiche, platforms[], competitors[{platform,handle}], compDraft, tone[], goals[]`.
- `steps` = 5 step definitions, each with `kicker, title, valid, body`.
- **Editable anytime**: `useEffect` pre-fills all state from current `profile` + `listCompetitors(user.id)` — so visiting `/onboarding` after it's done lets the user change everything. The Shell sidebar has an "Edit profile" link for this.
- `finish()` — `upsert`s `profiles` (onConflict id) + **replaces** competitors (delete-all then insert), both in `Promise.all` for speed. Calls `setProfile(pData)` optimistically → no re-fetch → instant navigation.
- `onKey(e)` — Enter anywhere advances the step (or finishes on last step) if `s.valid`. Ignored in textarea and the competitor handle input (that field already has its own Enter handler to add a competitor).

### `src/pages/Dashboard.jsx`
- `greeting()` — time-of-day string.
- Loads: `listGenerations(user.id, 6)`, `listCompetitors(user.id)`, `listVoiceSamples(user.id).length`.
- Sections: Hero (personal greeting, acid-accented name), Platform quick-jump (3 cards, filtered by `profile.platforms`), Stats strip (gens/comps/samples counts), **News widget** (profile.niche[0]), Recent work (4 latest generations).

### `src/pages/YouTubeTab.jsx`, `InstagramTab.jsx`, `FacebookTab.jsx`
- Symmetric pattern. State: `query/tags/urls, loading, posts, err, comps`.
- On mount: `latestResearch(userId, platform)` → restore; `listCompetitors(userId, platform)` → display chips.
- `run()` → `youtubeSearch|instagramSearch|facebookSearch` → `saveResearch(...)` → set `posts`.
- Instagram uses gradient hero; Facebook uses blue hero + dot-grid; YouTube uses standard `PageHeader` with red title accent.

### `src/pages/VoiceSamples.jsx`
- Loads `listVoiceSamples(user.id)` into `samples[]` (defaults to 3 empty strings).
- `save()` → `replaceVoiceSamples(user.id, samples)`. Word count per sample.

### `src/pages/Generate.jsx`
- Reads `KEYS.SELECTED_TOPIC` on mount → prefill topic + `sourcePlatform`.
- `run()`: fetches voice samples from DB, calls `generateScriptAndHooks({topic, voiceSamples, niche:profile.niche, creator:profile.creator_name})`, saves via `saveGeneration(...)`.
- `ConfidenceBar({score})` — acid/amber/red by score.
- `Copyable({text, label})` — clipboard helper.

### `src/pages/Competitors.jsx`
- CRUD UI for `competitors` table. Grouped by platform with platform icon + color.
- `add()` trims/strips leading `@`.

### `src/pages/History.jsx`
- `listGenerations(user.id, 100)`. Expandable rows; copy full script; shows script beats + hooks on expand.

### `src/pages/Settings.jsx`
- `KeyRow({label, storageKey, placeholder, helper, onTest})` — reusable row. Auto-save on blur. Test button calls `onTest` and shows ✓ / ✗.
- Account card with sign-out.
- 4 keys: `GROQ`, `YOUTUBE`, `APIFY`, `WORKER_URL`.
- **Niche / creator name are NOT here** — they live on `profiles` (set via onboarding).

### `src/App.jsx`
- `nav[]` array: sections (`research`, `create`, `context`) and links with icon + brand dot. Includes `/onboarding` as "Edit profile" in context section.
- `Sidebar({onNavigate})` — extracted so it renders both in desktop aside and mobile drawer. `onNavigate` is fired on link click to auto-close the drawer.
- `Shell` — **responsive**: desktop gets fixed 60-wide `<aside>`; below `md:` it collapses into a sticky top bar with a hamburger that toggles a full-height slide-in drawer (backdrop click or X closes it). Uses `useState(open)`.
- Routes:
  - `/login` → `<Login/>`
  - `/onboarding` → guarded
  - everything else guarded by `RequireAuth` + wrapped in `Shell`
- `RequireAuth` handles auth → login, and `!onboarded` → onboarding.

### `worker/worker.js`
- `CORS` headers + `json()` helper.
- `GET /` health.
- `POST /run-sync` — forwards `{token, actor, input}` to `https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token=...`. Returns raw Apify response.
- `GET /news?q=...` — fetches `https://news.google.com/rss/search?q=...` (cached 600s on CF edge), `parseRss(xml)` tiny regex parser → JSON items `{title, link, pubDate, source, desc}` (top 20).
- **Stateless. No logging. No storage.**

---

## Data flow

1. **Signup** → Supabase creates `auth.users` → trigger inserts `profiles(id, email, onboarded=false)`.
2. **`/` hit** → `RequireAuth` sees `!profile.onboarded` → redirects to `/onboarding`.
3. **Onboarding finish** → updates `profiles` + inserts `competitors` → `refreshProfile()` → `/`.
4. **Dashboard** → loads generations/competitors/samples counts + news for `profile.niche`.
5. **Research tab** → `latestResearch` restores; user searches → `saveResearch` (or competitor chip prefills query).
6. **Post card → "Use as topic"** → `KEYS.SELECTED_TOPIC` in localStorage → nav to Generate.
7. **Generate** → pulls voice from DB + niche/creator from profile → Groq → `saveGeneration`.
8. **History** → browses all `generations` rows.
9. **News widget** → `WORKER_URL/news?q={niche}` → Google News RSS → "Use" → Generate.

API keys are only read from localStorage inside `api.js`. They never touch Supabase or the Worker persistently (Apify token only transits the Worker for one request, not logged).

---

## Env vars

```
VITE_SUPABASE_URL       # Supabase project URL
VITE_SUPABASE_ANON_KEY  # Supabase anon public key (publishable)
VITE_WORKER_URL         # Host's Cloudflare Worker — shared by all users
```

**Shared host keys (recommended for small user counts):** set these as Worker secrets via `wrangler secret put GROQ_KEY` and `wrangler secret put YOUTUBE_KEY`. The Worker adds them server-side so they're never exposed to the browser. The client calls `/groq`, `/youtube/search`, `/youtube/videos` on the Worker instead of the providers directly. Simple per-IP rate limit (30 req/min) protects the shared quota.

**Fallback flow:** if the Worker returns 429 or 5xx, `api.js` retries using the user's own key from Settings (Groq/YouTube fields are marked optional). Apify always uses the user's token.

So onboarding for end users: sign up → fill profile → **done**. They only need their own keys if our shared quota is exhausted, or for Apify (IG/FB).

---

## Deploy checklist

- [ ] Supabase project created + `schema.sql` run
- [ ] Supabase Auth → Providers: Email enabled (+ Google optional)
- [ ] Supabase Auth → URL Config: site URL + redirect URLs
- [ ] `wrangler deploy` for Worker → copy URL
- [ ] Vercel env vars set
- [ ] Push → Vercel auto-deploy
- [ ] First user: signup → onboarding → Settings (paste keys + Worker URL)

---

## Responsive design

- All pages share a responsive Shell: sidebar on ≥`md`, slide-in drawer on mobile.
- Global CSS rules in `src/index.css` scale oversized display headings down on `<640px` and tighten `.p-10 / .p-8 / .px-10 / .py-14` paddings so no per-page edits were needed.
- Instagram/Facebook hero sections use fluid `font-display text-6xl md:text-7xl` — auto-shrinks via the mobile heading cap.
- Post grids already use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

## What's deliberately NOT included

- Key encryption in Supabase (keys live in browser only — by design).
- Server-side API calls (all direct-from-browser or via stateless Worker).
- Analytics / telemetry.
- TikTok / X (removed per user request).
- Payment / subscriptions (free tool, user pays their own API costs).
