import { useEffect, useState } from 'react'
import { Plus, Trash2, Youtube, Instagram, Facebook } from 'lucide-react'
import { Button, Input, Card, PageHeader, Kicker, Spinner } from '../lib/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { listCompetitors, addCompetitor, removeCompetitor } from '../lib/db.js'

const ICONS = { youtube: Youtube, instagram: Instagram, facebook: Facebook }
const COLORS = { youtube: 'text-yt-red', instagram: 'text-ig-pink', facebook: 'text-fb-blue' }

export default function Competitors() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ platform: 'instagram', handle: '' })
  const [err, setErr] = useState('')

  const reload = () => listCompetitors(user.id).then(setRows).finally(() => setLoading(false))
  useEffect(() => { if (user) reload() }, [user])

  const add = async () => {
    if (!draft.handle.trim()) return
    try { await addCompetitor(user.id, { platform: draft.platform, handle: draft.handle.trim().replace(/^@/, '') }); setDraft({ ...draft, handle: '' }); reload() }
    catch (e) { setErr(e.message) }
  }
  const del = async (id) => { await removeCompetitor(id); reload() }

  const groups = rows.reduce((acc, r) => ({ ...acc, [r.platform]: [...(acc[r.platform] || []), r] }), {})

  return (
    <div>
      <PageHeader kicker="intel" title={<>Know your <em className="italic">rivals.</em></>} subtitle="Add creators in your niche. We'll surface them on every research tab." />
      <div className="p-10 max-w-4xl space-y-8">
        <Card className="p-5">
          <Kicker className="mb-3">add new</Kicker>
          <div className="flex gap-2">
            <select className="px-3 py-3 border border-ink/10 rounded-lg bg-ivory-soft text-sm" value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value })}>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
            <Input placeholder="@handle, channel name, or Page URL" value={draft.handle} onChange={e => setDraft({ ...draft, handle: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} />
            <Button variant="accent" onClick={add}><Plus size={16}/>Add</Button>
          </div>
        </Card>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {loading && <Spinner/>}

        {['youtube', 'instagram', 'facebook'].map(p => {
          const items = groups[p] || []
          if (!items.length) return null
          const Icon = ICONS[p]
          return (
            <section key={p}>
              <div className="flex items-center gap-2 mb-3"><Icon size={18} className={COLORS[p]}/><Kicker>{p}</Kicker><span className="text-xs font-mono text-mute">· {items.length}</span></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map(c => (
                  <div key={c.id} className="flex items-center gap-3 bg-white border border-ink/10 rounded-lg px-4 py-3">
                    <span className="flex-1 font-medium">@{c.handle}</span>
                    <button onClick={() => del(c.id)} className="text-mute hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {!loading && rows.length === 0 && <div className="text-center py-16 text-mute"><div className="font-display italic text-2xl">No competitors yet.</div></div>}
      </div>
    </div>
  )
}
