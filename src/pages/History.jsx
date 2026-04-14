import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Card, PageHeader, Kicker, Empty, Spinner } from '../lib/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { listGenerations } from '../lib/db.js'

export default function History() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => { if (user) listGenerations(user.id, 100).then(r => { setRows(r); setLoading(false) }) }, [user])

  const copy = (id, text) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500) }

  return (
    <div>
      <PageHeader kicker="history" title={<>Every <em className="italic">script</em>, kept.</>} subtitle="All your past generations, safely stored." />
      <div className="p-10 max-w-5xl space-y-3">
        {loading && <Spinner/>}
        {!loading && rows.length === 0 && <Empty title="No scripts yet." hint="Generate your first one from the Generate tab." />}
        {rows.map(g => {
          const full = g.script ? `[HOOK] ${g.script.hook}\n\n[SETUP] ${g.script.setup}\n\n[VALUE] ${g.script.value}\n\n[CTA] ${g.script.cta}` : ''
          const isOpen = open === g.id
          return (
            <Card key={g.id} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 cursor-pointer" onClick={() => setOpen(isOpen ? null : g.id)}>
                  <div className="flex items-center gap-3"><Kicker>{g.source_platform || 'script'}</Kicker><span className="text-[11px] font-mono text-mute">{new Date(g.created_at).toLocaleString()}</span></div>
                  <div className="font-display text-2xl mt-1 leading-tight">{g.topic}</div>
                  {g.script?.hook && <div className="text-sm text-mute mt-2 line-clamp-1">{g.script.hook}</div>}
                </div>
                <button onClick={() => copy(g.id, full)} className="text-mute hover:text-ink text-[11px] font-mono uppercase tracking-widest flex items-center gap-1">
                  {copied === g.id ? <><Check size={12}/>copied</> : <><Copy size={12}/>copy</>}
                </button>
              </div>
              {isOpen && g.script && (
                <div className="mt-5 pt-5 border-t hairline space-y-3">
                  {['hook','setup','value','cta'].map(k => (
                    <div key={k} className="grid grid-cols-[80px_1fr] gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-mute">{k}</div>
                      <div className="text-sm">{g.script[k]}</div>
                    </div>
                  ))}
                  {g.hooks?.length > 0 && (
                    <div className="pt-3 border-t hairline space-y-2">
                      <Kicker>hooks</Kicker>
                      {g.hooks.map((h, i) => <div key={i} className="text-sm"><span className="font-mono text-mute text-xs mr-2">{String(i + 1).padStart(2, '0')}</span>{h.text}</div>)}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
