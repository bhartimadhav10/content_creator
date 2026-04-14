# Supabase setup (free tier, 5 min)

1. Sign up at https://supabase.com and create a new project (free tier).
2. Open the project → **SQL Editor** → paste contents of `schema.sql` → **Run**.
3. **Authentication → Providers**: enable **Email** (magic-link + password). Optionally enable **Google** OAuth.
4. **Authentication → URL Configuration**:
   - Site URL: your Vercel URL (or `http://localhost:5173` in dev)
   - Redirect URLs: add `http://localhost:5173/**` and your prod URL
5. Project Settings → **API** → copy **Project URL** and **anon public** key.
6. In the app root: `cp .env.example .env.local` and paste those values.
7. `npm install && npm run dev`.

## Free-tier limits you won't hit
- 50,000 monthly active users
- 500 MB database
- Unlimited API requests

## Tables created
- `profiles` — 1:1 with auth.users, autofilled on signup
- `competitors`, `voice_samples`, `research_runs`, `generations` — all per-user with RLS

Every table has Row Level Security on, so `auth.uid() = user_id` enforced by the DB. You can't leak other users' data even if the client misbehaves.
