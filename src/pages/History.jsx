import { useEffect, useState, useMemo } from 'react'
import { Copy, Check, Sparkles, Scissors, Share2, Hash } from 'lucide-react'
import { Card, PageHeader, Kicker, Empty, Spinner, Tag } from '../lib/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { listGenerations, listCreatorTools } from '../lib/db.js'

const FILTERS = [
  { id: 'all',      label: 'All',       Icon: null },
  { id: 'script',   label: 'Scripts',   Icon: Sparkles },
  { id: 'shorts',   label: 'Shorts',    Icon: Scissors },
  { id: 'social',   label: 'Social',    Icon: Share2 },
  { id: 'metadata', label: 'Metadata',  Icon: Hash }
]

function kindLabel(kind) {
  return ({ script: 'script', shorts: '5 shorts', social: 'social pack', metadata: 'title+desc+chapters' })[kind] || kind
}

export default function History() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [copied, setCopied] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [gens, tools] = await Promise.all([
        listGenerations(user.id, 200),
        listCreatorTools(user.id, null, 200)
      ])
      const items = [
        ...gens.map(g => ({
          id: 'g_' + g.id,
          kind: 'script',
          title: g.topic,
          subtitle: g.script?.hook || '',
          created_at: g.created_at,
          source_platform: g.source_platform,
          data: { script: g.script, hooks: g.hooks }
        })),
        ...tools.map(t => ({
          id: 't_' + t.id,
          kind: t.kind,
          title: t.source?.title || '(no title)',
          subtitle: t.source?.url || '',
          created_at: t.created_at,
          source_platform: 'youtube',
          data: t.payload,
          source: t.source
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setRows(items); setLoading(false)
    })()
  }, [user])

  const visible = useMemo(() => filter === 'all' ? rows : rows.filter(r => r.kind === filter), [rows, filter])
  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {}), [rows])

  const copy = (id, text) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500) }

  return (
    <div>
      <PageHeader kicker="history" title={<>Every <em className="italic">output</em>, kept.</>} subtitle="Scripts, Shorts, social packs, and video metadata — all persistent." />
      <div className="p-10 max-w-5xl space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => {
            const n = f.id === 'all' ? rows.length : (counts[f.id] || 0)
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${filter === f.id ? 'bg-ink text-ivory border-ink' : 'bg-transparent text-ink border-ink/15 hover:bg-ink/5'}`}>
                {f.Icon && <f.Icon size={12}/>}{f.label}<span className="font-mono text-[10px] opacity-70">{n}</span>
              </button>
            )
          })}
        </div>

        {loading && <Spinner/>}
        {!loading && visible.length === 0 && <Empty title="Nothing saved yet." hint="Use Generate or Creator Tools to create something." />}

        {visible.map(item => {
          const isOpen = open === item.id
          const copyText = buildCopyText(item)
          return (
            <Card key={item.id} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 cursor-pointer min-w-0" onClick={() => setOpen(isOpen ? null : item.id)}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Tag tone={item.kind === 'script' ? 'default' : 'acid'}>{kindLabel(item.kind)}</Tag>
                    {item.source_platform && <Kicker>{item.source_platform}</Kicker>}
                    <span className="text-[11px] font-mono text-mute">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="font-display text-2xl mt-1 leading-tight truncate">{item.title}</div>
                  {item.subtitle && <div className="text-sm text-mute mt-2 line-clamp-1">{item.subtitle}</div>}
                </div>
                <button onClick={() => copy(item.id, copyText)} className="text-mute hover:text-ink text-[11px] font-mono uppercase tracking-widest flex items-center gap-1 flex-shrink-0">
                  {copied === item.id ? <><Check size={12}/>copied</> : <><Copy size={12}/>copy</>}
                </button>
              </div>
              {isOpen && (
                <div className="mt-5 pt-5 border-t hairline">
                  <Detail item={item}/>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function buildCopyText(item) {
  if (item.kind === 'script') {
    const s = item.data?.script
    return s ? `[HOOK] ${s.hook}\n\n[SETUP] ${s.setup}\n\n[VALUE] ${s.value}\n\n[CTA] ${s.cta}` : ''
  }
  if (item.kind === 'shorts') {
    return (item.data?.shorts || []).map((s, i) => `#${i + 1} ${s.title} (${s.start}-${s.end})\nHOOK: ${s.script?.hook}\nBODY: ${s.script?.body}\nCTA: ${s.script?.cta}`).join('\n\n---\n\n')
  }
  if (item.kind === 'social') {
    const d = item.data || {}
    const parts = []
    if (d.twitter_thread) parts.push('TWITTER:\n' + d.twitter_thread.map(t => `${t.n}. ${t.text}`).join('\n'))
    if (d.linkedin_post) parts.push('LINKEDIN:\n' + [d.linkedin_post.hook, d.linkedin_post.body, d.linkedin_post.cta].filter(Boolean).join('\n\n'))
    if (d.instagram_caption) parts.push('INSTAGRAM:\n' + [d.instagram_caption.hook, d.instagram_caption.body, d.instagram_caption.cta].filter(Boolean).join('\n\n'))
    if (d.blog_post?.markdown) parts.push('BLOG:\n' + d.blog_post.markdown)
    return parts.join('\n\n===\n\n')
  }
  if (item.kind === 'metadata') {
    const d = item.data || {}
    return [
      'TITLES:\n' + (d.titles || []).map(t => `- ${t.text}`).join('\n'),
      'DESCRIPTION:\n' + (d.description || ''),
      'CHAPTERS:\n' + (d.chapters || []).map(c => `${c.time} ${c.title}`).join('\n'),
      'TAGS:\n' + (d.tags || []).join(', ')
    ].join('\n\n')
  }
  return JSON.stringify(item.data, null, 2)
}

function Detail({ item }) {
  if (item.kind === 'script') {
    const s = item.data?.script
    return (
      <div className="space-y-3">
        {s && ['hook','setup','value','cta'].map(k => (
          <div key={k} className="grid grid-cols-[80px_1fr] gap-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-mute">{k}</div>
            <div className="text-sm">{s[k]}</div>
          </div>
        ))}
        {item.data?.hooks?.length > 0 && (
          <div className="pt-3 border-t hairline space-y-2">
            <Kicker>hooks</Kicker>
            {item.data.hooks.map((h, i) => <div key={i} className="text-sm"><span className="font-mono text-mute text-xs mr-2">{String(i + 1).padStart(2, '0')}</span>{h.text}</div>)}
          </div>
        )}
      </div>
    )
  }
  if (item.kind === 'shorts') {
    return (
      <div className="space-y-4">
        {(item.data?.shorts || []).map((s, i) => (
          <div key={i} className="p-3 bg-white rounded-lg border hairline space-y-2">
            <div className="flex items-center justify-between"><div className="font-display text-lg">#{i + 1} {s.title}</div><div className="font-mono text-xs text-mute">{s.start} → {s.end}</div></div>
            {s.why && <div className="text-xs italic text-mute">{s.why}</div>}
            {['hook','body','cta'].map(k => s.script?.[k] && (
              <div key={k} className="text-sm"><b className="font-mono text-[10px] uppercase tracking-widest text-mute mr-2">{k}</b>{s.script[k]}</div>
            ))}
            {s.hashtags?.length > 0 && <div className="text-xs font-mono text-mute">{s.hashtags.join(' ')}</div>}
          </div>
        ))}
      </div>
    )
  }
  if (item.kind === 'social') {
    const d = item.data || {}
    return (
      <div className="space-y-4 text-sm">
        {d.twitter_thread && <div><Kicker>twitter</Kicker><ol className="mt-1 space-y-1">{d.twitter_thread.map(t => <li key={t.n}><b className="font-mono text-xs text-mute mr-1">{t.n}/</b>{t.text}</li>)}</ol></div>}
        {d.linkedin_post && <div><Kicker>linkedin</Kicker><div className="mt-1 whitespace-pre-wrap">{[d.linkedin_post.hook, d.linkedin_post.body, d.linkedin_post.cta].filter(Boolean).join('\n\n')}</div></div>}
        {d.instagram_caption && <div><Kicker>instagram</Kicker><div className="mt-1 whitespace-pre-wrap">{[d.instagram_caption.hook, d.instagram_caption.body, d.instagram_caption.cta].filter(Boolean).join('\n\n')}</div></div>}
        {d.blog_post && <div><Kicker>blog</Kicker><div className="mt-1 font-display text-lg">{d.blog_post.title}</div><details className="mt-1"><summary className="cursor-pointer text-xs font-mono text-mute">view markdown</summary><pre className="mt-2 text-xs font-mono bg-white border hairline rounded-lg p-3 whitespace-pre-wrap">{d.blog_post.markdown}</pre></details></div>}
      </div>
    )
  }
  if (item.kind === 'metadata') {
    const d = item.data || {}
    return (
      <div className="space-y-3 text-sm">
        {d.titles?.length > 0 && <div><Kicker>titles</Kicker><ul className="mt-1 space-y-1">{d.titles.map((t, i) => <li key={i}><Tag tone="outline">{t.style}</Tag><span className="ml-2">{t.text}</span><span className="font-mono text-xs text-mute ml-2">CTR {t.ctr_score}/10</span></li>)}</ul></div>}
        {d.description && <div><Kicker>description</Kicker><pre className="mt-1 text-xs font-mono bg-white border hairline rounded-lg p-3 whitespace-pre-wrap">{d.description}</pre></div>}
        {d.chapters?.length > 0 && <div><Kicker>chapters</Kicker><ul className="mt-1 font-mono text-xs">{d.chapters.map((c, i) => <li key={i}><span className="text-mute mr-3">{c.time}</span>{c.title}</li>)}</ul></div>}
        {d.tags?.length > 0 && <div><Kicker>tags</Kicker><div className="mt-1">{d.tags.join(', ')}</div></div>}
        {d.hashtags?.length > 0 && <div><Kicker>hashtags</Kicker><div className="mt-1 font-mono">{d.hashtags.join(' ')}</div></div>}
      </div>
    )
  }
  return <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(item.data, null, 2)}</pre>
}
