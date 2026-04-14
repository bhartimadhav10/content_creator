import { useEffect, useState } from 'react'
import { listCompetitors } from '../lib/db.js'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Check, Youtube, Instagram, Facebook, Plus, X } from 'lucide-react'
import { Button, Input, Textarea, Kicker } from '../lib/ui.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'

const NICHES = ['AI tools', 'Coding', 'Fitness', 'Finance', 'Food', 'Fashion', 'Travel', 'Education', 'Comedy', 'Beauty', 'Gaming', 'Business', 'Wellness', 'Music']
const TONES = ['Casual', 'Authoritative', 'Playful', 'Hinglish', 'Poetic', 'Sarcastic', 'Warm', 'Punchy']
const GOALS = ['Grow followers', 'Monetize', 'Educate', 'Build brand', 'Drive traffic', 'Sell a product']

function Chip({ active, children, ...rest }) {
  return (
    <button type="button"
      className={`px-4 py-2 rounded-full text-sm font-medium border transition ${active ? 'bg-ink text-ivory border-ink' : 'bg-white text-ink border-ink/15 hover:border-ink/40'}`}
      {...rest}>{children}</button>
  )
}

export default function Onboarding() {
  const { user, profile, setProfile } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [creator, setCreator] = useState('')
  const [niches, setNiches] = useState([])
  const [customNiche, setCustomNiche] = useState('')
  const [platforms, setPlatforms] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [compDraft, setCompDraft] = useState({ platform: 'instagram', handle: '' })
  const [tone, setTone] = useState([])
  const [goals, setGoals] = useState([])

  // Pre-fill from existing profile so users can edit anytime
  useEffect(() => {
    if (!profile) return
    setCreator(profile.creator_name || '')
    setPlatforms(profile.platforms || [])
    const split = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean)
    const profNiches = split(profile.niche)
    const preset = profNiches.filter(n => NICHES.includes(n))
    const custom = profNiches.filter(n => !NICHES.includes(n)).join(', ')
    setNiches(preset); setCustomNiche(custom)
    setTone(split(profile.tone).filter(t => TONES.includes(t)))
    setGoals(split(profile.goals).filter(g => GOALS.includes(g)))
    if (user) listCompetitors(user.id).then(rows =>
      setCompetitors(rows.map(r => ({ platform: r.platform, handle: r.handle })))
    )
  }, [profile, user])

  const toggle = (arr, set) => (v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  const addCompetitor = () => {
    if (!compDraft.handle.trim()) return
    setCompetitors([...competitors, { ...compDraft, handle: compDraft.handle.trim().replace(/^@/, '') }])
    setCompDraft({ ...compDraft, handle: '' })
  }
  const removeCompetitor = (i) => setCompetitors(competitors.filter((_, idx) => idx !== i))

  const steps = [
    {
      kicker: 'step 01 / 05',
      title: <>What should we <em className="italic">call you?</em></>,
      valid: creator.trim().length > 0,
      body: (
        <div className="space-y-4 max-w-md">
          <Input autoFocus placeholder="Your creator name" value={creator} onChange={e => setCreator(e.target.value)} />
          <p className="text-sm text-mute">We'll use this to personalize everything — scripts, dashboard, even the way hooks are written.</p>
        </div>
      )
    },
    {
      kicker: 'step 02 / 05',
      title: <>Pick your <em className="italic">niche.</em></>,
      valid: niches.length > 0 || customNiche.trim().length > 0,
      body: (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 max-w-2xl">
            {NICHES.map(n => <Chip key={n} active={niches.includes(n)} onClick={() => toggle(niches, setNiches)(n)}>{n}</Chip>)}
          </div>
          <div className="max-w-md">
            <Kicker className="mb-2">or type your own</Kicker>
            <Input placeholder="e.g. Claude Code tips, vibe coding" value={customNiche} onChange={e => setCustomNiche(e.target.value)} />
          </div>
        </div>
      )
    },
    {
      kicker: 'step 03 / 05',
      title: <>Where do you <em className="italic">post?</em></>,
      valid: platforms.length > 0,
      body: (
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          {[
            { k: 'youtube', label: 'YouTube Shorts', Icon: Youtube, color: 'text-yt-red' },
            { k: 'instagram', label: 'Instagram Reels', Icon: Instagram, color: 'text-ig-pink' },
            { k: 'facebook', label: 'Facebook', Icon: Facebook, color: 'text-fb-blue' }
          ].map(({ k, label, Icon, color }) => {
            const on = platforms.includes(k)
            return (
              <button key={k} onClick={() => toggle(platforms, setPlatforms)(k)}
                className={`p-6 rounded-2xl border-2 text-left transition ${on ? 'border-ink bg-ink text-ivory' : 'border-ink/10 bg-white hover:border-ink/30'}`}>
                <Icon size={28} className={on ? 'text-acid' : color} />
                <div className="font-display text-xl mt-3">{label}</div>
                {on && <div className="mt-2 text-[11px] font-mono uppercase tracking-widest text-acid">Selected</div>}
              </button>
            )
          })}
        </div>
      )
    },
    {
      kicker: 'step 04 / 05',
      title: <>Who do you <em className="italic">compete with?</em></>,
      valid: true,
      body: (
        <div className="space-y-5 max-w-2xl">
          <p className="text-sm text-mute">Add 3–5 creators in your niche. We'll auto-research them and suggest trending topics from their recent posts. (Skip if you're not sure.)</p>
          <div className="flex gap-2">
            <select className="px-3 py-3 border border-ink/10 rounded-lg bg-ivory-soft text-sm"
              value={compDraft.platform} onChange={e => setCompDraft({ ...compDraft, platform: e.target.value })}>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
            <Input placeholder="@handle or channel name" value={compDraft.handle}
              onChange={e => setCompDraft({ ...compDraft, handle: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCompetitor())} />
            <Button variant="ghost" onClick={addCompetitor}><Plus size={16}/></Button>
          </div>
          <div className="space-y-2">
            {competitors.map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-white border border-ink/10 rounded-lg px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-mute w-20">{c.platform}</span>
                <span className="flex-1 font-medium">@{c.handle}</span>
                <button onClick={() => removeCompetitor(i)} className="text-mute hover:text-red-600"><X size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      kicker: 'step 05 / 05',
      title: <>Your <em className="italic">voice</em> &amp; <em className="italic">goals.</em></>,
      valid: tone.length > 0 && goals.length > 0,
      body: (
        <div className="space-y-8 max-w-2xl">
          <div>
            <Kicker className="mb-3">tone (pick any)</Kicker>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => <Chip key={t} active={tone.includes(t)} onClick={() => toggle(tone, setTone)(t)}>{t}</Chip>)}
            </div>
          </div>
          <div>
            <Kicker className="mb-3">goals</Kicker>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => <Chip key={g} active={goals.includes(g)} onClick={() => toggle(goals, setGoals)(g)}>{g}</Chip>)}
            </div>
          </div>
        </div>
      )
    }
  ]

  const s = steps[step]

  const finish = async () => {
    setSaving(true); setErr('')
    try {
      const nicheStr = [...niches, customNiche].filter(Boolean).join(', ')
      const payload = {
        id: user.id,
        email: user.email,
        creator_name: creator,
        niche: nicheStr,
        platforms,
        tone: tone.join(', '),
        goals: goals.join(', '),
        onboarded: true,
        updated_at: new Date().toISOString()
      }
      const compRows = competitors.map(c => ({ user_id: user.id, platform: c.platform, handle: c.handle }))
      // upsert profile + replace competitors list, in parallel
      const compOp = (async () => {
        await supabase.from('competitors').delete().eq('user_id', user.id)
        if (compRows.length) await supabase.from('competitors').insert(compRows)
      })()
      const [{ error: pErr, data: pData }] = await Promise.all([
        supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select().single(),
        compOp
      ])
      if (pErr) throw pErr
      setProfile(pData)              // optimistic — no re-fetch needed
      nav('/', { replace: true })
    } catch (e) { setErr(e.message); setSaving(false) }
  }

  const onKey = (e) => {
    if (e.key !== 'Enter') return
    if (e.target.tagName === 'TEXTAREA') return
    // allow Enter inside the competitor draft input to only add a competitor
    if (step === 3 && e.target.placeholder?.includes('@handle')) return
    if (!s.valid || saving) return
    e.preventDefault()
    step < steps.length - 1 ? setStep(step + 1) : finish()
  }

  return (
    <div className="min-h-full bg-ivory relative grain" onKeyDown={onKey}>
      <div className="max-w-4xl mx-auto px-8 py-14 relative z-10">
        {/* progress */}
        <div className="flex items-center gap-2 mb-16">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition ${i < step ? 'bg-ink' : i === step ? 'bg-acid' : 'bg-ink/10'}`}/>
          ))}
        </div>

        <div key={step} className="rise space-y-8">
          <Kicker>{s.kicker}</Kicker>
          <h1 className="font-display text-6xl md:text-7xl tracking-tightest leading-[0.95] max-w-3xl">{s.title}</h1>
          <div className="pt-2">{s.body}</div>
          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex items-center gap-3 pt-8">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16}/> Back</Button>}
            {step < steps.length - 1 && (
              <Button variant="accent" disabled={!s.valid} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16}/></Button>
            )}
            {step === steps.length - 1 && (
              <Button variant="accent" disabled={!s.valid || saving} onClick={finish}>
                {saving ? 'Saving…' : <>Finish <Check size={16}/></>}
              </Button>
            )}
            <div className="ml-auto font-mono text-[11px] tracking-widest uppercase text-mute">press enter ↵</div>
          </div>
        </div>
      </div>
    </div>
  )
}
