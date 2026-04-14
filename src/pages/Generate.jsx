import { useState, useEffect } from 'react'
import { Copy, Check, Wand2 } from 'lucide-react'
import { Button, Input, Card, PageHeader, Empty, Spinner, Kicker } from '../lib/ui.jsx'
import { storage, KEYS } from '../lib/storage.js'
import { generateScriptAndHooks, fetchYouTubeTranscript } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { listVoiceSamples, saveGeneration } from '../lib/db.js'

function ConfidenceBar({ score }) {
  const color = score >= 8 ? 'bg-acid' : score >= 5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 h-1.5 bg-ink/10 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${score * 10}%` }} /></div>
      <span className="text-[11px] font-mono text-mute">{score}/10</span>
    </div>
  )
}

function Copyable({ text, label = 'copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-mute hover:text-ink flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest">
      {copied ? <><Check size={12}/>copied</> : <><Copy size={12}/>{label}</>}
    </button>
  )
}

export default function Generate() {
  const { user, profile } = useAuth()
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [sourcePlatform, setSourcePlatform] = useState(null)
  const [source, setSource] = useState(null) // full `from` object
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const s = storage.get(KEYS.SELECTED_TOPIC)
    if (s?.topic) { setTopic(s.topic); setSourcePlatform(s.from?.platform || null); setSource(s.from || null) }
  }, [])

  const run = async () => {
    if (!topic.trim()) return
    setLoading(true); setErr(''); setResult(null); setStatus('')
    try {
      const rows = await listVoiceSamples(user.id)
      if (!rows.length) throw new Error('Add at least 1 voice sample first.')

      // Pull richer source context when available
      let sourceContext = ''
      if (sourcePlatform === 'youtube' && source?.id) {
        setStatus('Reading the source video transcript…')
        sourceContext = await fetchYouTubeTranscript(source.id)
      } else if ((sourcePlatform === 'instagram' || sourcePlatform === 'facebook') && source?.title) {
        sourceContext = source.title
      }

      setStatus('Writing in your voice…')
      const r = await generateScriptAndHooks({
        topic,
        voiceSamples: rows.map(r => r.content),
        niche: profile?.niche || '',
        creator: profile?.creator_name || '',
        sourceContext
      })
      setResult(r)
      await saveGeneration(user.id, { topic, script: r.script, hooks: r.hooks, source_platform: sourcePlatform })
    } catch (e) { setErr(e.message) }
    setLoading(false); setStatus('')
  }

  const full = result?.script ? `[HOOK] ${result.script.hook}\n\n[SETUP] ${result.script.setup}\n\n[VALUE] ${result.script.value}\n\n[CTA] ${result.script.cta}` : ''

  return (
    <div>
      <PageHeader kicker="generate · script + hooks" title={<>Write like <em className="italic">you.</em></>} subtitle="Groq LLM, your voice, zero filler."/>
      <div className="p-10 max-w-4xl space-y-8">
        <div className="flex gap-2">
          <Input placeholder="Topic (auto-filled from research)" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
          <Button variant="accent" onClick={run} disabled={loading || !topic.trim()}>
            {loading ? <Spinner/> : <Wand2 size={16}/>}{loading ? (status || 'Generating…') : 'Generate'}
          </Button>
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{err}</div>}
        {!result && !loading && !err && <Empty title="Your script appears here." hint="Pick a topic from research or type one above." />}

        {result?.script && (
          <Card className="p-8 space-y-5 rise">
            <div className="flex items-center justify-between">
              <Kicker>full script</Kicker>
              <Copyable text={full} label="copy full"/>
            </div>
            {[['hook','0–3s'],['setup','3–10s'],['value','10–40s'],['cta','last 5s']].map(([k, t]) => (
              <div key={k} className="grid grid-cols-[90px_1fr] gap-4 pb-4 border-b hairline last:border-0 last:pb-0">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink">{k}</div>
                  <div className="font-mono text-[10px] text-mute mt-1">{t}</div>
                </div>
                <div className="font-display text-xl leading-snug">{result.script[k]}</div>
              </div>
            ))}
          </Card>
        )}

        {result?.hooks?.length > 0 && (
          <Card className="p-8 space-y-4 rise rise-2">
            <div className="flex items-center justify-between"><Kicker>5 hook variations</Kicker></div>
            <div className="divide-y divide-ink/5">
              {result.hooks.map((h, i) => (
                <div key={i} className="flex items-start gap-4 py-4 group">
                  <div className="font-display text-3xl text-ink/30 w-10">{String(i + 1).padStart(2, '0')}</div>
                  <div className="flex-1 space-y-2">
                    <div className="font-display text-xl leading-snug">{h.text}</div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-mute">{h.pattern}</span>
                      <ConfidenceBar score={h.match || 5} />
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition"><Copyable text={h.text} /></div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
