import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { Button, Input, Kicker } from '../lib/ui.jsx'

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  const next = loc.state?.from?.pathname || '/'

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setErr(''); setMsg('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        nav(next, { replace: true })
      }
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-full grid md:grid-cols-[1.1fr_1fr]">
      {/* Left: hero */}
      <div className="relative bg-ink text-ivory p-12 md:p-16 flex flex-col justify-between overflow-hidden grain">
        <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full bg-acid/30 blur-3xl" />
        <div className="absolute right-10 bottom-10 w-[260px] h-[260px] rounded-full ig-gradient opacity-30 blur-3xl" />
        <div className="relative z-10 space-y-2">
          <Kicker className="!text-acid">⟶ content agents</Kicker>
          <div className="font-mono text-xs text-ivory/60">v0.1 · built for creators</div>
        </div>
        <div className="relative z-10 space-y-8">
          <h1 className="font-display text-6xl md:text-7xl leading-[0.92] tracking-tightest">
            Your voice.<br/>
            <span className="italic text-acid">Their</span> virality.<br/>
            <span className="text-ivory/50">Zero guesswork.</span>
          </h1>
          <p className="text-ivory/70 max-w-md text-[15px] leading-relaxed">
            Research what's blowing up on YouTube, Instagram, and Facebook — then generate scripts in <em className="font-display italic">your</em> exact voice. Bring your own API keys. Nothing stored on our servers.
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-ivory/50 uppercase tracking-widest">
            <span>YouTube</span>·<span>Instagram</span>·<span>Facebook</span>
          </div>
        </div>
        <div className="relative z-10 font-mono text-[11px] text-ivory/40 tracking-wider">
          NO KEY STORAGE · YOUR DATA STAYS YOURS
        </div>
      </div>

      {/* Right: form */}
      <div className="p-8 md:p-16 flex items-center bg-ivory">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <Kicker>{mode === 'signup' ? 'create an account' : 'welcome back'}</Kicker>
            <h2 className="font-display text-4xl tracking-tightest">
              {mode === 'signup' ? <>Start <span className="italic">creating.</span></> : <>Sign <span className="italic">in.</span></>}
            </h2>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Input type="email" required placeholder="you@creator.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Input type="password" required minLength={6} placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
            {err && <div className="text-sm text-red-600">{err}</div>}
            {msg && <div className="text-sm text-green-700">{msg}</div>}
            <Button type="submit" variant="accent" className="w-full justify-center !py-3.5" disabled={loading}>
              {mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={16}/>
            </Button>
          </form>

          <div className="text-sm text-mute text-center">
            {mode === 'signup' ? 'Already have an account?' : "Don't have one yet?"}{' '}
            <button onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')} className="text-ink font-semibold marquee-underline">
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
