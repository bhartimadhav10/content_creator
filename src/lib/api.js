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

// ---------- YouTube transcript (Worker + browser-side fallbacks) ----------
// Tries in order: (1) Cloudflare Worker, (2) youtubetranscript.com public API,
// (3) allorigins CORS proxy → scrape ytInitialPlayerResponse → fetch timedtext.
// Returns '' only when every path fails.

function decodeHtml(s = '') {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

// Apify free actor — uses existing $5/mo free credit on your token.
// Actor ID is configurable in Settings (KEYS.APIFY_TRANSCRIPT_ACTOR); defaults below.
async function viaApify(videoId) {
  const token = storage.get(KEYS.APIFY)
  const worker = WORKER()
  if (!token || !worker) return ''
  const actor = storage.get(KEYS.APIFY_TRANSCRIPT_ACTOR) || 'topaz_sharingan~Youtube-Transcript-Scraper-1'
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const inputs = [
    { startUrls: [{ url: videoUrl }] },
    { videoUrls: [videoUrl] },
    { urls: [videoUrl] },
    { youtubeVideoUrl: videoUrl }
  ]
  for (const input of inputs) {
    try {
      const r = await fetch(`${worker}/run-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, actor, input })
      })
      if (!r.ok) continue
      const data = await r.json()
      const items = Array.isArray(data) ? data : (data?.items || [])
      if (!items.length) continue
      const parts = []
      for (const it of items) {
        if (typeof it?.transcript === 'string') parts.push(it.transcript)
        else if (Array.isArray(it?.transcript)) parts.push(it.transcript.map(x => x.text || x.snippet || '').join(' '))
        else if (typeof it?.text === 'string') parts.push(it.text)
        else if (Array.isArray(it?.captions)) parts.push(it.captions.map(x => x.text || '').join(' '))
        else if (Array.isArray(it?.data)) parts.push(it.data.map(x => x.text || x.snippet || '').join(' '))
      }
      const out = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      if (out.length > 50) return out
    } catch (e) { /* try next input shape */ }
  }
  return ''
}

async function viaWorker(videoId) {
  const worker = WORKER()
  if (!worker) return ''
  try {
    const r = await fetch(`${worker}/youtube/transcript?videoId=${encodeURIComponent(videoId)}`)
    if (!r.ok) return ''
    const j = await r.json()
    return j.transcript || ''
  } catch { return '' }
}

async function viaYoutubeTranscriptDotCom(videoId) {
  try {
    const r = await fetch(`https://youtubetranscript.com/?server_vid2=${encodeURIComponent(videoId)}`)
    if (!r.ok) return ''
    const xml = await r.text()
    if (!xml.includes('<text')) return ''
    const parts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(m => decodeHtml(m[1]).replace(/\s+/g, ' ').trim())
    return parts.filter(Boolean).join(' ')
  } catch { return '' }
}

const CORS_PROXIES = [
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://proxy.cors.sh/${u}`
]

async function proxyFetch(url) {
  for (const mk of CORS_PROXIES) {
    try {
      const r = await fetch(mk(url))
      if (r.ok) {
        const t = await r.text()
        if (t && t.length > 100) return t
      }
    } catch {}
  }
  return ''
}

async function viaScrape(videoId) {
  try {
    const html = await proxyFetch(`https://www.youtube.com/watch?v=${videoId}`)
    if (!html) { console.warn('[transcript] scrape: all CORS proxies failed'); return '' }
    const m = html.match(/"captionTracks":(\[.*?\])/)
    if (!m) { console.warn('[transcript] scrape: no captionTracks in page (captions disabled?)'); return '' }
    const tracks = JSON.parse(m[1].replace(/\\u0026/g, '&'))
    const track = tracks.find(t => (t.languageCode || '').startsWith('en')) || tracks[0]
    if (!track?.baseUrl) { console.warn('[transcript] scrape: no track baseUrl'); return '' }
    const xml = await proxyFetch(track.baseUrl)
    if (!xml) { console.warn('[transcript] scrape: timedtext fetch failed'); return '' }
    const parts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(s => decodeHtml(s[1]).replace(/\s+/g, ' ').trim())
    return parts.filter(Boolean).join(' ')
  } catch (e) { console.warn('[transcript] scrape error', e); return '' }
}

export async function fetchYouTubeTranscript(videoId) {
  if (!videoId) return ''
  const providers = [
    ['apify', viaApify],
    ['worker', viaWorker],
    ['youtubetranscript.com', viaYoutubeTranscriptDotCom],
    ['scrape+proxy', viaScrape]
  ]
  for (const [name, fn] of providers) {
    const out = await fn(videoId)
    if (out && out.length > 50) { console.log(`[transcript] got ${out.length} chars via ${name}`); return out }
    console.log(`[transcript] ${name} returned empty`)
  }
  return ''
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

// ---------- Creator Tools (additive, isolated from generateScriptAndHooks) ----------
export function extractYouTubeId(input) {
  if (!input) return ''
  const s = String(input).trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/v\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
}

export async function fetchYouTubeVideoMeta(videoId) {
  try {
    const j = await ytFetch('/youtube/videos', { id: videoId, part: 'snippet,contentDetails,statistics' })
    const v = j.items?.[0]
    if (!v) return null
    return {
      id: v.id,
      title: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      description: v.snippet?.description || '',
      publishedAt: v.snippet?.publishedAt,
      tags: v.snippet?.tags || [],
      duration: v.contentDetails?.duration || ''
    }
  } catch { return null }
}

// 1) Long video -> 5 Shorts scripts with timestamps
export async function generateShortsFromVideo({ transcript, meta, voiceSamples = [], niche = '', creator = '' }) {
  if (!transcript || !transcript.trim()) throw new Error('No transcript available for this video.')
  const samplesBlock = voiceSamples.length
    ? `\nVOICE SAMPLES (mimic this voice precisely):\n${voiceSamples.map((s, i) => `SAMPLE ${i + 1}:\n${s}`).join('\n\n')}\n`
    : ''
  const system = `You are an expert short-form editor. Given a long-video transcript, identify the 5 most viral 30-60 second moments and rewrite each as a standalone Shorts/Reels script. Return valid JSON only.`
  const user = `CREATOR: ${creator || 'Creator'}
NICHE: ${niche || 'general'}
VIDEO TITLE: ${meta?.title || 'Untitled'}
${samplesBlock}
TRANSCRIPT (may be truncated):
${transcript.slice(0, 12000)}

Pick 5 distinct standout moments. For each, identify the approximate timestamp in the source and write a fresh <60s Shorts script.
Return JSON with this exact shape:
{
  "shorts": [
    {
      "title": "short 3-6 word title",
      "start": "MM:SS",
      "end": "MM:SS",
      "why": "why this moment will pop on Shorts",
      "script": {
        "hook": "0-3s attention grabber",
        "body": "10-45s core value, punchy sentences",
        "cta": "final 3-5s CTA"
      },
      "on_screen_text": ["3-5 bold caption lines for the cut"],
      "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"]
    }
  ]
}
Exactly 5 shorts. Timestamps must map to the transcript, not invented.`
  const raw = await groqChat({ system, user, json: true, temperature: 0.7 })
  return JSON.parse(raw)
}

// 2) One video -> full social pack (Twitter thread, LinkedIn, IG caption, Blog)
export async function generateSocialPack({ transcript, meta, voiceSamples = [], niche = '', creator = '' }) {
  const samplesBlock = voiceSamples.length
    ? `\nVOICE SAMPLES (mimic tone):\n${voiceSamples.map((s, i) => `SAMPLE ${i + 1}:\n${s}`).join('\n\n')}\n`
    : ''
  const system = `You are a multi-platform content strategist. Given one video, produce a full repurposing pack for Twitter/X, LinkedIn, Instagram, and Blog. Each platform has its own tone and constraints. Return valid JSON only.`
  const user = `CREATOR: ${creator || 'Creator'}
NICHE: ${niche || 'general'}
VIDEO TITLE: ${meta?.title || 'Untitled'}
${samplesBlock}
SOURCE CONTENT (transcript or description):
${(transcript || meta?.description || '').slice(0, 10000)}

Return JSON with this exact shape:
{
  "twitter_thread": [
    { "n": 1, "text": "hook tweet, <270 chars" },
    { "n": 2, "text": "..." }
  ],
  "linkedin_post": {
    "hook": "first 2 lines (above the fold)",
    "body": "professional, insight-driven, 900-1500 chars, uses line breaks",
    "cta": "single closing line",
    "hashtags": ["#tag1","#tag2","#tag3"]
  },
  "instagram_caption": {
    "hook": "scroll-stopping first line",
    "body": "story-driven caption, 600-1000 chars",
    "cta": "engagement prompt",
    "hashtags": ["10-15 relevant hashtags, mixed sizes"]
  },
  "blog_post": {
    "title": "SEO-friendly title, <70 chars",
    "meta_description": "<155 chars",
    "outline": ["H2 section 1","H2 section 2","..."],
    "markdown": "full blog post in markdown, 600-900 words"
  }
}
Twitter thread: 6-9 tweets, each self-contained, no "1/9" prefix (use n field).`
  const raw = await groqChat({ system, user, json: true, temperature: 0.7 })
  return JSON.parse(raw)
}

// 3) Smart title + description + chapters + tags
export async function generateVideoMetadata({ transcript, meta, niche = '' }) {
  const system = `You are a YouTube SEO expert. Given a transcript (and optional current metadata), produce high-CTR title variations, a rich description, chapter markers, and tag keywords. Return valid JSON only.`
  const user = `NICHE: ${niche || 'general'}
CURRENT TITLE: ${meta?.title || '(none)'}
CURRENT DESCRIPTION: ${(meta?.description || '').slice(0, 500)}

TRANSCRIPT (may be truncated):
${(transcript || '').slice(0, 12000)}

Return JSON with this exact shape:
{
  "titles": [
    { "text": "title option", "style": "curiosity|listicle|contrarian|how_to|question|result", "ctr_score": 8 }
  ],
  "description": "full YouTube description (800-1500 chars): 2-line hook, value summary, chapters placeholder 'CHAPTERS:' line, CTA, socials placeholder",
  "chapters": [
    { "time": "00:00", "title": "Intro" },
    { "time": "MM:SS", "title": "..." }
  ],
  "tags": ["15-25 tags, lowercase, comma-free, mix broad+niche"],
  "hashtags": ["#3-5 YouTube-style hashtags"]
}
Provide exactly 10 title options. Chapter timestamps must map to the transcript.`
  const raw = await groqChat({ system, user, json: true, temperature: 0.6 })
  return JSON.parse(raw)
}
