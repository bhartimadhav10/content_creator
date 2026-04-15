import { useState } from 'react'
import { Scissors, Share2, Hash, Copy, Check, Clapperboard } from 'lucide-react'
import { PageHeader, Button, Input, Textarea, Card, Spinner, Empty, Kicker, Tag } from '../lib/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import {
  extractYouTubeId, fetchYouTubeTranscript, fetchYouTubeVideoMeta,
  generateShortsFromVideo, generateSocialPack, generateVideoMetadata
} from '../lib/api.js'
import { listVoiceSamples, saveCreatorTool } from '../lib/db.js'

const TABS = [
  { id: 'shorts',   label: 'Long → 5 Shorts',   Icon: Scissors },
  { id: 'social',   label: 'Social Pack',       Icon: Share2 },
  { id: 'metadata', label: 'Title · Desc · Chapters · Tags', Icon: Hash }
]

function CopyBtn({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text || ''); setDone(true); setTimeout(() => setDone(false), 1200) }}
      className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-mute hover:text-ink transition"
    >
      {done ? <Check size={12}/> : <Copy size={12}/>}{done ? 'copied' : 'copy'}
    </button>
  )
}

export default function CreatorTools() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('shorts')
  const [url, setUrl] = useState('')
  const [manualTranscript, setManualTranscript] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)
  const [result, setResult] = useState(null)

  async function run() {
    setError(''); setResult(null); setMeta(null); setLoading(true)
    try {
      const videoId = extractYouTubeId(url)
      if (!videoId) throw new Error('Enter a valid YouTube URL or 11-char video ID.')
      setStatus('Fetching video metadata…')
      const vmeta = await fetchYouTubeVideoMeta(videoId)
      setMeta(vmeta)
      let transcript = manualTranscript.trim()
      if (!transcript) {
        setStatus('Fetching transcript…')
        transcript = await fetchYouTubeTranscript(videoId)
      }
      if (tab !== 'social' && !transcript) {
        setShowManual(true)
        throw new Error('Auto-fetch failed. Paste the transcript manually below (open the video → "..." → Show transcript → copy all → paste here), then click Run again.')
      }
      setStatus('Loading voice samples…')
      const samples = (await listVoiceSamples(user.id)).map(s => s.content)
      const common = { transcript, meta: vmeta, voiceSamples: samples, niche: profile?.niche || '', creator: profile?.creator_name || '' }

      setStatus('Generating with Groq…')
      let payload
      if (tab === 'shorts')   payload = await generateShortsFromVideo(common)
      if (tab === 'social')   payload = await generateSocialPack(common)
      if (tab === 'metadata') payload = await generateVideoMetadata({ transcript, meta: vmeta, niche: profile?.niche || '' })

      setResult(payload)
      setStatus('Saving…')
      await saveCreatorTool(user.id, { kind: tab, source: { videoId, title: vmeta?.title, url }, payload })
      setStatus('')
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false); setStatus('')
    }
  }

  return (
    <>
      <PageHeader
        kicker="creator tools"
        title={<>Repurpose. <em className="italic">Fast.</em></>}
        subtitle="Turn any YouTube video into Shorts, a full social pack, or SEO-ready metadata. Doesn't touch your existing Generate flow."
      />
      <div className="px-10 py-8 space-y-6 max-w-5xl">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError('') }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition border ${tab === t.id ? 'bg-ink text-ivory border-ink' : 'bg-transparent text-ink border-ink/15 hover:bg-ink/5'}`}>
              <t.Icon size={14}/>{t.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <Card className="p-5 space-y-3">
          <Kicker>YouTube video URL or ID</Kicker>
          <div className="flex gap-2">
            <Input placeholder="https://youtube.com/watch?v=…  or  dQw4w9WgXcQ" value={url} onChange={e => setUrl(e.target.value)} />
            <Button variant="accent" onClick={run} disabled={loading || !url.trim()}>
              {loading ? <Spinner/> : <Clapperboard size={14}/>}
              {loading ? 'Working…' : 'Run'}
            </Button>
          </div>
          {status && <div className="text-xs font-mono text-mute">{status}</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="pt-2">
            <button type="button" onClick={() => setShowManual(v => !v)}
              className="text-[11px] font-mono uppercase tracking-widest text-mute hover:text-ink transition">
              {showManual ? '− hide manual transcript' : '+ paste transcript manually (optional)'}
            </button>
            {showManual && (
              <div className="mt-2 space-y-2">
                <Textarea rows={6} placeholder="Open YouTube video → ⋯ menu → Show transcript → select all → paste here. This overrides auto-fetch."
                  value={manualTranscript} onChange={e => setManualTranscript(e.target.value)} />
                <div className="text-[11px] text-mute">{manualTranscript.trim().split(/\s+/).filter(Boolean).length} words pasted</div>
              </div>
            )}
          </div>

          {meta && (
            <div className="flex items-center gap-3 pt-2 border-t hairline">
              <Tag tone="outline">{meta.channel}</Tag>
              <div className="text-sm font-medium truncate">{meta.title}</div>
            </div>
          )}
        </Card>

        {/* Results */}
        {!result && !loading && <Empty title="Drop a YouTube link above" hint="Same creator voice. New formats." />}

        {result && tab === 'shorts' && <ShortsView data={result} />}
        {result && tab === 'social' && <SocialView data={result} />}
        {result && tab === 'metadata' && <MetadataView data={result} />}
      </div>
    </>
  )
}

function ShortsView({ data }) {
  const shorts = data?.shorts || []
  return (
    <div className="space-y-4">
      {shorts.map((s, i) => (
        <Card key={i} className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Tag tone="acid">#{i + 1}</Tag>
              <div className="font-display text-xl">{s.title}</div>
            </div>
            <div className="font-mono text-xs text-mute">{s.start} → {s.end}</div>
          </div>
          {s.why && <div className="text-sm text-mute italic">{s.why}</div>}
          <div className="space-y-2 text-sm">
            <Block label="Hook" text={s.script?.hook}/>
            <Block label="Body" text={s.script?.body}/>
            <Block label="CTA"  text={s.script?.cta}/>
          </div>
          {s.on_screen_text?.length > 0 && (
            <div className="pt-2 border-t hairline">
              <Kicker className="mb-1">On-screen text</Kicker>
              <ul className="text-sm list-disc pl-5 space-y-1">{s.on_screen_text.map((t, j) => <li key={j}>{t}</li>)}</ul>
            </div>
          )}
          {s.hashtags?.length > 0 && <div className="text-xs font-mono text-mute">{s.hashtags.join(' ')}</div>}
        </Card>
      ))}
    </div>
  )
}

function SocialView({ data }) {
  return (
    <div className="space-y-4">
      {data.twitter_thread && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between"><div className="font-display text-xl">Twitter / X thread</div>
            <CopyBtn text={data.twitter_thread.map(t => `${t.n}. ${t.text}`).join('\n\n')}/></div>
          <ol className="space-y-2 text-sm">
            {data.twitter_thread.map(t => <li key={t.n} className="p-3 bg-white rounded-lg border hairline"><b className="font-mono text-xs text-mute mr-2">{t.n}/</b>{t.text}</li>)}
          </ol>
        </Card>
      )}
      {data.linkedin_post && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between"><div className="font-display text-xl">LinkedIn</div>
            <CopyBtn text={`${data.linkedin_post.hook}\n\n${data.linkedin_post.body}\n\n${data.linkedin_post.cta}\n\n${(data.linkedin_post.hashtags||[]).join(' ')}`}/></div>
          <Block label="Hook" text={data.linkedin_post.hook}/>
          <Block label="Body" text={data.linkedin_post.body} mono/>
          <Block label="CTA"  text={data.linkedin_post.cta}/>
          <div className="text-xs font-mono text-mute">{(data.linkedin_post.hashtags || []).join(' ')}</div>
        </Card>
      )}
      {data.instagram_caption && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between"><div className="font-display text-xl">Instagram caption</div>
            <CopyBtn text={`${data.instagram_caption.hook}\n\n${data.instagram_caption.body}\n\n${data.instagram_caption.cta}\n\n${(data.instagram_caption.hashtags||[]).join(' ')}`}/></div>
          <Block label="Hook" text={data.instagram_caption.hook}/>
          <Block label="Body" text={data.instagram_caption.body} mono/>
          <Block label="CTA"  text={data.instagram_caption.cta}/>
          <div className="text-xs font-mono text-mute break-words">{(data.instagram_caption.hashtags || []).join(' ')}</div>
        </Card>
      )}
      {data.blog_post && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between"><div className="font-display text-xl">Blog post</div>
            <CopyBtn text={data.blog_post.markdown}/></div>
          <Block label="Title" text={data.blog_post.title}/>
          <Block label="Meta description" text={data.blog_post.meta_description}/>
          {data.blog_post.outline?.length > 0 && (
            <div><Kicker className="mb-1">Outline</Kicker>
              <ul className="text-sm list-disc pl-5">{data.blog_post.outline.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
          )}
          <details className="pt-2"><summary className="cursor-pointer text-sm font-semibold">View markdown</summary>
            <pre className="mt-2 text-xs font-mono bg-white border hairline rounded-lg p-3 whitespace-pre-wrap">{data.blog_post.markdown}</pre>
          </details>
        </Card>
      )}
    </div>
  )
}

function MetadataView({ data }) {
  return (
    <div className="space-y-4">
      {data.titles?.length > 0 && (
        <Card className="p-5 space-y-2">
          <div className="font-display text-xl mb-2">Title options</div>
          <ol className="space-y-2 text-sm">
            {data.titles.map((t, i) => (
              <li key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border hairline">
                <Tag tone="outline">{t.style}</Tag>
                <div className="flex-1">{t.text}</div>
                <div className="font-mono text-xs text-mute">CTR {t.ctr_score}/10</div>
                <CopyBtn text={t.text}/>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {data.description && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between"><div className="font-display text-xl">Description</div><CopyBtn text={data.description}/></div>
          <pre className="text-sm font-mono bg-white border hairline rounded-lg p-3 whitespace-pre-wrap">{data.description}</pre>
        </Card>
      )}
      {data.chapters?.length > 0 && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between"><div className="font-display text-xl">Chapters</div>
            <CopyBtn text={data.chapters.map(c => `${c.time} ${c.title}`).join('\n')}/></div>
          <ul className="text-sm font-mono">
            {data.chapters.map((c, i) => <li key={i} className="py-1 border-b hairline last:border-0"><span className="text-mute mr-3">{c.time}</span>{c.title}</li>)}
          </ul>
        </Card>
      )}
      {(data.tags?.length > 0 || data.hashtags?.length > 0) && (
        <Card className="p-5 space-y-3">
          {data.tags?.length > 0 && <div>
            <div className="flex items-center justify-between"><Kicker>Tags</Kicker><CopyBtn text={data.tags.join(', ')}/></div>
            <div className="text-sm mt-2">{data.tags.join(', ')}</div>
          </div>}
          {data.hashtags?.length > 0 && <div>
            <div className="flex items-center justify-between"><Kicker>Hashtags</Kicker><CopyBtn text={data.hashtags.join(' ')}/></div>
            <div className="text-sm mt-2 font-mono">{data.hashtags.join(' ')}</div>
          </div>}
        </Card>
      )}
    </div>
  )
}

function Block({ label, text, mono = false }) {
  if (!text) return null
  return (
    <div>
      <div className="flex items-center justify-between"><Kicker>{label}</Kicker><CopyBtn text={text}/></div>
      <div className={`mt-1 ${mono ? 'font-mono text-xs whitespace-pre-wrap' : 'text-sm'} leading-relaxed`}>{text}</div>
    </div>
  )
}
