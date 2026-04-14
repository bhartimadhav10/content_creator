# Apify Proxy — Cloudflare Worker

Stateless CORS proxy so the browser app can call Apify. **No logging, no storage.** Your Apify token passes through in each request body and is used once.

## Deploy (free, 5 minutes)

1. `npm i -g wrangler`
2. `wrangler login` (opens browser, free Cloudflare account)
3. `wrangler deploy worker.js --name content-agents-proxy`
4. Copy the URL it prints (e.g. `https://content-agents-proxy.yourname.workers.dev`)
5. Paste that URL into the app's Settings → "Cloudflare Worker URL"

## Free tier limits
- 100,000 requests/day (you'll never hit this)
- Free `*.workers.dev` subdomain forever
- No credit card required
