import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Newspaper, RefreshCw, Search } from 'lucide-react'
import { fetchNews } from '../lib/api.js'
import { Kicker, Spinner, Card, Button, Input } from '../lib/ui.jsx'
import { useNavigate } from 'react-router-dom'
import { storage, KEYS } from '../lib/storage.js'

function timeAgo(pubDate) {
  if (!pubDate) return ''
  const d = new Date(pubDate).getTime()
  if (!d) return ''
  const mins = Math.floor((Date.now() - d) / 60000)
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

const SUGGESTED = ['AI tools', 'Tech', 'Marketing', 'Fitness', 'Finance', 'Food', 'Travel tips', 'Fashion', 'Gaming', 'Startup']

export default function NewsWidget({ niche }) {
  const [query, setQuery] = useState(niche || '')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const touched = useRef(false) // true once the user searches manually
  const bootedFor = useRef(null) // niche value we already auto-loaded for
  const nav = useNavigate()

  const load = async (q, { manual = false } = {}) => {
    const target = (q ?? query).trim()
    if (!target) return
    if (manual) touched.current = true
    setLoading(true); setErr(''); setItems([])
    try { setItems(await fetchNews(target)) } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  useEffect(() => {
    // auto-load once per distinct niche, and never if the user has already searched manually
    if (!niche || touched.current || bootedFor.current === niche) return
    bootedFor.current = niche
    setQuery(niche)
    load(niche)
    // eslint-disable-next-line
  }, [niche])

  const useAsTopic = (item) => {
    storage.set(KEYS.SELECTED_TOPIC, { topic: item.title, from: { platform: 'news', url: item.link } })
    nav('/generate')
  }

  const pickSuggested = (s) => { setQuery(s); load(s, { manual: true }) }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b hairline space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Newspaper size={16}/><Kicker>trending news</Kicker></div>
          <button onClick={() => load(query, { manual: true })} className="text-mute hover:text-ink" disabled={loading || !query.trim()}>{loading ? <Spinner/> : <RefreshCw size={14}/>}</button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"/>
            <Input className="pl-9 !py-2" placeholder="Search any topic..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(query, { manual: true })} />
          </div>
          <Button variant="primary" className="!py-2" onClick={() => load(query, { manual: true })} disabled={loading || !query.trim()}>Go</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-widest text-mute">try:</span>
          {SUGGESTED.map(s => (
            <button key={s} onClick={() => pickSuggested(s)} className="text-[11px] font-medium px-2.5 py-1 bg-ivory-soft border border-ink/10 rounded-full hover:border-ink/40 hover:bg-white transition">{s}</button>
          ))}
        </div>
      </div>

      {err && <div className="p-5 text-sm text-red-600">{err}</div>}
      {!err && items.length === 0 && !loading && <div className="p-10 text-center text-mute font-display italic">No news for "{query}". Try a different topic.</div>}

      <div className="divide-y divide-ink/5">
        {items.slice(0, 8).map((n, i) => (
          <div key={i} className="px-5 py-4 hover:bg-ivory-soft transition group">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] text-mute w-6">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1 min-w-0">
                <a href={n.link} target="_blank" rel="noreferrer" className="font-display text-lg leading-snug hover:underline">{n.title}</a>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono uppercase tracking-widest text-mute">
                  <span className="truncate">{n.source}</span>{n.pubDate && <><span>·</span><span>{timeAgo(n.pubDate)}</span></>}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition flex gap-2 flex-shrink-0">
                <Button variant="ghost" className="!py-1 !px-2 text-xs" onClick={() => useAsTopic(n)}>Use</Button>
                <a href={n.link} target="_blank" rel="noreferrer" className="p-1 text-mute hover:text-ink"><ExternalLink size={14}/></a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
