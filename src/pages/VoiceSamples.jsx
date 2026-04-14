import { useState, useEffect } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { Button, Textarea, Card, PageHeader, Spinner } from '../lib/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { listVoiceSamples, replaceVoiceSamples } from '../lib/db.js'

export default function VoiceSamples() {
  const { user } = useAuth()
  const [samples, setSamples] = useState(['', '', ''])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user) return
    listVoiceSamples(user.id).then(rows => {
      setSamples(rows.length ? rows.map(r => r.content) : ['', '', ''])
      setLoading(false)
    }).catch(e => { setErr(e.message); setLoading(false) })
  }, [user])

  const update = (i, v) => { const n = [...samples]; n[i] = v; setSamples(n) }
  const add = () => setSamples([...samples, ''])
  const remove = (i) => setSamples(samples.filter((_, idx) => idx !== i))

  const save = async () => {
    setSaving(true); setErr('')
    try { await replaceVoiceSamples(user.id, samples); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch (e) { setErr(e.message) }
    setSaving(false)
  }

  const wc = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

  return (
    <div>
      <PageHeader
        kicker="voice · calibration"
        title={<>Teach it <em className="italic">your voice.</em></>}
        subtitle="Paste past scripts verbatim — slang, pauses, code-switching. The model mirrors what you give it."
        right={<Button variant="accent" onClick={save} disabled={saving}>{saving ? <Spinner/> : saved ? <><Check size={16}/>Saved</> : 'Save all'}</Button>}
      />
      <div className="p-10 max-w-4xl space-y-4">
        {err && <div className="text-sm text-red-600">{err}</div>}
        {loading ? <div className="text-mute">Loading…</div> : (
          <>
            {samples.map((s, i) => (
              <Card key={i} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[11px] tracking-widest uppercase text-mute">Sample {String(i + 1).padStart(2, '0')}</div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-mute font-mono">{wc(s)} words</span>
                    {samples.length > 1 && <button onClick={() => remove(i)} className="text-mute hover:text-red-600"><Trash2 size={14}/></button>}
                  </div>
                </div>
                <Textarea rows={7} placeholder="Paste a past script verbatim…" value={s} onChange={e => update(i, e.target.value)} />
              </Card>
            ))}
            <Button variant="ghost" onClick={add}><Plus size={16}/>Add another sample</Button>
          </>
        )}
      </div>
    </div>
  )
}
