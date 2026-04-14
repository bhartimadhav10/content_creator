/**
 * Cloudflare Worker — Content Agents proxy (stateless).
 *
 * Endpoints:
 *   GET  /                — health
 *   GET  /news?q=...      — Google News RSS → JSON (free, public)
 *   POST /run-sync        — forwards {token, actor, input} → Apify (user's token)
 *   POST /groq            — forwards to Groq using secret GROQ_KEY (shared host key)
 *   GET  /youtube/search  — YouTube Data API via secret YOUTUBE_KEY (shared host key)
 *   GET  /youtube/videos  — ditto
 *
 * Secrets (set via `wrangler secret put <NAME>`):
 *   GROQ_KEY
 *   YOUTUBE_KEY
 *
 * Simple per-IP rate limit (in-memory, isolate-local — good enough for small beta).
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
}

// --- rate limit (per IP, per minute) ---
const BUCKET = new Map() // ip -> { count, windowStart }
const LIMIT = 30         // 30 shared-key requests / minute / IP
function rateLimited(ip) {
  const now = Date.now()
  const b = BUCKET.get(ip)
  if (!b || now - b.windowStart > 60_000) {
    BUCKET.set(ip, { count: 1, windowStart: now })
    return false
  }
  b.count += 1
  return b.count > LIMIT
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(req.url)
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown'

    if (url.pathname === '/') return json({ ok: true, service: 'content-agents-proxy' })

    if (url.pathname === '/news' && req.method === 'GET') {
      const q = url.searchParams.get('q')
      if (!q) return json({ error: 'q required' }, 400)
      // Try the raw query first, then progressively broader variants
      const variants = [q, `${q} news`, `${q} trends`, `${q} industry`]
      for (const v of variants) {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(v)}&hl=en&gl=US&ceid=US:en`
        const r = await fetch(rssUrl, { cf: { cacheTtl: 600, cacheEverything: true } })
        const items = parseRss(await r.text()).slice(0, 20)
        if (items.length > 0) return json({ items, matched: v })
      }
      return json({ items: [] })
    }

    if (url.pathname === '/run-sync' && req.method === 'POST') {
      let body; try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
      const { token, actor, input } = body
      if (!token || !actor) return json({ error: 'token and actor required' }, 400)
      const r = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input || {}) })
      return passthrough(r)
    }

    if (url.pathname === '/groq' && req.method === 'POST') {
      if (!env.GROQ_KEY) return json({ error: 'Shared Groq key not configured on host' }, 503)
      if (rateLimited(ip)) return json({ error: 'Rate limit hit on shared key. Use your own key in Settings.' }, 429)
      const body = await req.text()
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.GROQ_KEY}`, 'Content-Type': 'application/json' },
        body
      })
      return passthrough(r)
    }

    if (url.pathname === '/youtube/search' && req.method === 'GET') {
      if (!env.YOUTUBE_KEY) return json({ error: 'Shared YouTube key not configured on host' }, 503)
      if (rateLimited(ip)) return json({ error: 'Rate limit hit on shared key. Use your own key in Settings.' }, 429)
      const p = new URLSearchParams(url.search)
      p.set('key', env.YOUTUBE_KEY)
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`)
      return passthrough(r)
    }

    if (url.pathname === '/youtube/transcript' && req.method === 'GET') {
      const videoId = url.searchParams.get('videoId')
      if (!videoId) return json({ error: 'videoId required' }, 400)
      try {
        const page = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          cf: { cacheTtl: 3600, cacheEverything: true }
        })
        const html = await page.text()
        const m = html.match(/"captionTracks":(\[.*?\])/)
        if (!m) return json({ transcript: '', reason: 'no captions' })
        const tracks = JSON.parse(m[1])
        const track = tracks.find(t => t.languageCode === 'en') || tracks.find(t => t.kind !== 'asr') || tracks[0]
        if (!track?.baseUrl) return json({ transcript: '', reason: 'no track' })
        const tr = await fetch(track.baseUrl)
        const xml = await tr.text()
        const text = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
          .map(x => x[1]).join(' ')
          .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
        return json({ transcript: text.slice(0, 8000), length: text.length })
      } catch (e) {
        return json({ transcript: '', reason: 'error', error: String(e) })
      }
    }

    if (url.pathname === '/youtube/videos' && req.method === 'GET') {
      if (!env.YOUTUBE_KEY) return json({ error: 'Shared YouTube key not configured on host' }, 503)
      if (rateLimited(ip)) return json({ error: 'Rate limit hit on shared key. Use your own key in Settings.' }, 429)
      const p = new URLSearchParams(url.search)
      p.set('key', env.YOUTUBE_KEY)
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?${p}`)
      return passthrough(r)
    }

    return new Response('Not found', { status: 404, headers: CORS })
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}
async function passthrough(r) {
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS } })
}
function parseRss(xml) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  const tag = (src, name) => {
    const m = src.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))
    if (!m) return ''
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
  }
  let m
  while ((m = itemRe.exec(xml))) {
    const src = m[1]
    items.push({
      title: tag(src, 'title'),
      link: tag(src, 'link'),
      pubDate: tag(src, 'pubDate'),
      source: tag(src, 'source'),
      desc: tag(src, 'description').replace(/<[^>]+>/g, '').slice(0, 240)
    })
  }
  return items
}
