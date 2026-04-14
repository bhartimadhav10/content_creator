# Content Agents

BYO-API research + script generator for YouTube Shorts, Instagram Reels, Facebook.
Free to host. Multi-user (Supabase auth). Personal API keys stay in the user's browser.

## Quick start (dev)

```bash
# 1. Install deps
npm install

# 2. Set up Supabase (free) — see supabase/README.md
cp .env.example .env.local
# paste VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. (Optional) Deploy the Cloudflare Worker for IG/FB/News
cd worker && wrangler deploy worker.js --name content-agents-proxy

# 4. Run
npm run dev
```

## Deploy to Vercel (free)

1. Push to a GitHub repo.
2. Import into Vercel.
3. Add env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WORKER_URL` (your deployed Cloudflare Worker URL — shared across all users)
4. Deploy. `vercel.json` rewrites all routes → SPA.

## Architecture

- **Frontend:** Vite + React + Tailwind. Deployed on Vercel (free hobby).
- **Auth + DB:** Supabase (free tier — 50k MAU, 500MB).
- **LLM:** Groq (user's key, free tier).
- **YouTube:** Data API v3 (user's key, free quota). Direct browser call.
- **IG / FB scrape:** Apify actors (user's token) via Cloudflare Worker proxy (free 100k req/day).
- **News:** Google News RSS via same Worker (free, unlimited).
- **API keys:** stored in browser localStorage only. Never touch our servers.

## See also

- [`PROJECT_MAP.md`](PROJECT_MAP.md) — full file + function graph
- [`supabase/README.md`](supabase/README.md) — DB setup
- [`worker/README.md`](worker/README.md) — proxy deploy
