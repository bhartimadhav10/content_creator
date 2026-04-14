import { storage, KEYS } from './storage.js'

// ---------- YouTube Data API v3 ----------
// Tries shared host key (via Worker) first; on 429/5xx or missing, falls back to user's own key (direct).
const WORKER = () => (import.meta.env.VITE_WORKER_URL || storage.get(KEYS.WORKER_URL) || '').replace(/\/$/, '')

async function ytFetch(path, params) {
  const worker = WORKER()
  const userKey = storage.get(KEYS.YOUTUBE)
  const qs = new URLSearchParams(params).toString()
  if (worker) {
    const r = await fetch(`${worker}${path}?${qs}`)
    if (r.ok) return r.json()
    if (r.status !== 429 && r.status < 500 && !userKey) throw new Error(`YouTube error ${r.status}`)
  }
  if (!userKey) throw new Error('Shared YouTube quota hit. Add your own YouTube API key in Settings.')
  const r2 = await fetch(`https://www.googleapis.com/youtube/v3${path.replace('/youtube', '')}?${qs}&key=${userKey}`)
  if (!r2.ok) throw new Error(`YouTube error ${r2.status}`)
  return r2.json()
}

export async function youtubeSearch({ query, maxResults = 25, order = 'viewCount', publishedAfterDays = 90 }) {
  const publishedAfter = new Date(Date.now() - publishedAfterDays * 864e5).toISOString()
  const sJson = await ytFetch('/youtube/search', {
    q: query, part: 'snippet', type: 'video', videoDuration: 'short',
    maxResults: String(maxResults), order, publishedAfter
  })
  const ids = (sJson.items || []).map(i => i.id.videoId).filter(Boolean)
  if (ids.length === 0) return []
  const vJson = await ytFetch('/youtube/videos', { id: ids.join(','), part: 'snippet,statistics,contentDetails' })

  return (vJson.items || []).map(v => {
    const views = Number(v.statistics?.viewCount || 0)
    const likes = Number(v.statistics?.likeCount || 0)
    const comments = Number(v.statistics?.commentCount || 0)
    const er = views > 0 ? ((likes + comments) / views) * 100 : 0
    return {
      id: v.id,
      platform: 'youtube',
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      url: `https://youtube.com/shorts/${v.id}`,
      views, likes, comments,
      engagementRate: Number(er.toFixed(2)),
      publishedAt: v.snippet.publishedAt,
      hook: v.snippet.title,
      viral: views > 100000 && er > 5
    }
  }).sort((a, b) => b.views - a.views)
}

export async function testYouTubeKey() {
  const key = storage.get(KEYS.YOUTUBE)
  if (!key) throw new Error('No key set')
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${key}`)
  if (!r.ok) throw new Error('Invalid key or quota exceeded')
  return true
}

// ---------- Apify via Cloudflare Worker proxy ----------
async function apifyRun({ actor, input }) {
  const token = storage.get(KEYS.APIFY)
  const worker = import.meta.env.VITE_WORKER_URL || storage.get(KEYS.WORKER_URL)
  if (!token) throw new Error('Missing Apify token. Add it in Settings.')
  if (!worker) throw new Error('Worker URL not configured.')
  const r = await fetch(`${worker.replace(/\/$/, '')}/run-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, actor, input })
  })
  if (!r.ok) throw new Error(`Proxy error: ${r.status} ${await r.text()}`)
  return r.json()
}

export async function instagramSearch({ hashtags, resultsLimit = 30 }) {
  const data = await apifyRun({
    actor: 'apify~instagram-hashtag-scraper',
    input: { hashtags: hashtags.map(h => h.replace(/^#/, '')), resultsLimit }
  })
  return (data || []).map(p => ({
    id: p.id || p.shortCode,
    platform: 'instagram',
    title: (p.caption || '').slice(0, 120),
    author: p.ownerUsername,
    thumbnail: p.displayUrl,
    url: p.url,
    views: Number(p.videoViewCount || p.videoPlayCount || 0),
    likes: Number(p.likesCount || 0),
    comments: Number(p.commentsCount || 0),
    engagementRate: p.videoViewCount ? Number((((p.likesCount || 0) + (p.commentsCount || 0)) / p.videoViewCount * 100).toFixed(2)) : 0,
    publishedAt: p.timestamp,
    hook: (p.caption || '').slice(0, 80),
    viral: (p.likesCount || 0) > 10000
  })).sort((a, b) => b.likes - a.likes)
}

export async function facebookSearch({ pageUrls, resultsLimit = 30 }) {
  const data = await apifyRun({
    actor: 'apify~facebook-posts-scraper',
    input: { startUrls: pageUrls.map(u => ({ url: u })), resultsLimit }
  })
  return (data || []).map(p => ({
    id: p.postId || p.url,
    platform: 'facebook',
    title: (p.text || '').slice(0, 120),
    author: p.user?.name || p.pageName,
    thumbnail: p.media?.[0]?.thumbnail,
    url: p.url,
    views: Number(p.viewsCount || 0),
    likes: Number(p.likesCount || 0),
    comments: Number(p.commentsCount || 0),
    shares: Number(p.sharesCount || 0),
    engagementRate: 0,
    publishedAt: p.time,
    hook: (p.text || '').slice(0, 80),
    viral: (p.likesCount || 0) > 5000
  })).sort((a, b) => b.likes - a.likes)
}

// ---------- YouTube transcript (via Worker) ----------
export async function fetchYouTubeTranscript(videoId) {
  const worker = WORKER()
  if (!worker || !videoId) return ''
  try {
    const r = await fetch(`${worker}/youtube/transcript?videoId=${encodeURIComponent(videoId)}`)
    if (!r.ok) return ''
    const j = await r.json()
    return j.transcript || ''
  } catch { return '' }
}

// ---------- Free news (Google News RSS via Worker) ----------
export async function fetchNews(query) {
  const worker = import.meta.env.VITE_WORKER_URL || storage.get(KEYS.WORKER_URL)
  if (!worker) throw new Error('Worker URL not configured.')
  const r = await fetch(`${worker.replace(/\/$/, '')}/news?q=${encodeURIComponent(query)}`)
  if (!r.ok) throw new Error(`News fetch failed: ${r.status}`)
  const j = await r.json()
  return j.items || []
}

// ---------- Groq LLM (direct browser call, CORS OK) ----------
export async function groqChat({ system, user, model = 'llama-3.3-70b-versatile', temperature = 0.7, json = false }) {
  const body = { model, temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
  if (json) body.response_format = { type: 'json_object' }
  const payload = JSON.stringify(body)
  const worker = WORKER()
  const userKey = storage.get(KEYS.GROQ)

  // try shared host key first
  if (worker) {
    const r = await fetch(`${worker}/groq`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    if (r.ok) { const j = await r.json(); return j.choices?.[0]?.message?.content || '' }
    if (r.status !== 429 && r.status < 500 && !userKey) throw new Error(`Groq error: ${r.status} ${await r.text()}`)
  }
  // fallback to user's own key
  if (!userKey) throw new Error('Shared Groq quota hit. Add your own Groq API key in Settings.')
  const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${userKey}`, 'Content-Type': 'application/json' }, body: payload
  })
  if (!r2.ok) throw new Error(`Groq error: ${r2.status} ${await r2.text()}`)
  const j = await r2.json()
  return j.choices?.[0]?.message?.content || ''
}

export async function testGroqKey() {
  const out = await groqChat({ system: 'reply with only: ok', user: 'ping', temperature: 0 })
  if (!out.toLowerCase().includes('ok')) throw new Error('Unexpected response')
  return true
}

export async function generateScriptAndHooks({ topic, voiceSamples, niche, creator, sourceContext = '' }) {
  const samplesBlock = voiceSamples.map((s, i) => `SAMPLE ${i + 1}:\n${s}`).join('\n\n')
  const system = `You write short-form social media scripts (Reels/Shorts) in the creator's exact voice. Match tone, pacing, slang, sentence length, and code-switching (Hinglish if present). Return valid JSON only.`
  const contextBlock = sourceContext
    ? `\nSOURCE CONTENT (this is the transcript/caption of a viral post on the topic — use it to understand the actual angle, examples, and structure, then rewrite completely in the creator's voice; don't copy phrases):\n${sourceContext.slice(0, 6000)}\n`
    : ''
  const user = `CREATOR: ${creator || 'Creator'}
NICHE: ${niche || 'general'}
TOPIC: ${topic}
${contextBlock}
VOICE SAMPLES (mimic this voice precisely):
${samplesBlock}

Return JSON with this exact shape:
{
  "script": {
    "hook": "0-3s attention grabber",
    "setup": "3-10s context",
    "value": "10-40s main content, 3-5 points",
    "cta": "final 5s call to action"
  },
  "hooks": [
    { "text": "...", "pattern": "curiosity|contrarian|numbered|question|story", "match": 8 },
    ... 5 total
  ]
}
"match" is 1-10 stylistic match to the voice samples.`
  const raw = await groqChat({ system, user, json: true, temperature: 0.8 })
  return JSON.parse(raw)
}
