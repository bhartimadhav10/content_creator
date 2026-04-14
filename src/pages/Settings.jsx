import { useState } from 'react'
import { Check, X, Eye, EyeOff, Trash2, Shield } from 'lucide-react'
import { storage, KEYS } from '../lib/storage.js'
import { Button, Input, Card, PageHeader, Spinner, Kicker } from '../lib/ui.jsx'
import { testGroqKey, testYouTubeKey } from '../lib/api.js'
import { useAuth, signOut } from '../lib/auth.jsx'

function KeyRow({ label, storageKey, placeholder, helper, onTest }) {
  const [value, setValue] = useState(storage.get(storageKey) || '')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState('')
  const save = () => { value ? storage.set(storageKey, value) : storage.remove(storageKey); setStatus(null) }
  const clear = () => { setValue(''); storage.remove(storageKey); setStatus(null) }
  const test = async () => { save(); if (!onTest) return; setStatus('loading'); setErr(''); try { await onTest(); setStatus('ok') } catch (e) { setStatus('fail'); setErr(e.message) } }
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div><div className="font-semibold">{label}</div>{helper && <div className="text-xs text-mute mt-0.5">{helper}</div>}</div>
        {status === 'ok' && <span className="text-green-700 flex items-center gap-1 text-sm"><Check size={16}/>Valid</span>}
        {status === 'fail' && <span className="text-red-600 flex items-center gap-1 text-sm"><X size={16}/>{err}</span>}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={e => setValue(e.target.value)} onBlur={save} />
          <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink">{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
        </div>
        {onTest && <Button variant="ghost" onClick={test} disabled={!value || status === 'loading'}>{status === 'loading' ? <Spinner/> : 'Test'}</Button>}
        {value && <Button variant="ghost" onClick={clear}><Trash2 size={16}/></Button>}
      </div>
    </Card>
  )
}

export default function Settings() {
  const { user, profile } = useAuth()
  return (
    <div>
      <PageHeader kicker="settings" title={<>Keys &amp; <em className="italic">account.</em></>} subtitle="API keys live only in your browser. Nothing is sent to our servers." />
      <div className="p-10 max-w-3xl space-y-6">
        <div className="flex items-center gap-3 bg-ink text-ivory rounded-2xl p-5">
          <Shield size={20} className="text-acid"/>
          <div className="text-sm">Signed in as <span className="font-mono text-acid">{user?.email}</span> · {profile?.creator_name || 'creator'}</div>
          <Button variant="outline" className="ml-auto !border-ivory !text-ivory hover:!bg-ivory hover:!text-ink" onClick={signOut}>Sign out</Button>
        </div>

        <div className="bg-acid/20 border border-acid/40 rounded-2xl p-4 text-sm">
          <strong>Good news:</strong> Groq &amp; YouTube work out-of-the-box on our shared quota. The fields below are optional — add your own keys only as a fallback when our shared quota is busy.
        </div>

        <Kicker>api keys</Kicker>
        <KeyRow label="Groq API Key (optional fallback)" storageKey={KEYS.GROQ} placeholder="gsk_... (leave blank to use ours)" helper="Free tier at console.groq.com. Used only if our shared quota is rate-limited." onTest={testGroqKey} />
        <KeyRow label="YouTube Data API Key (optional fallback)" storageKey={KEYS.YOUTUBE} placeholder="AIza... (leave blank to use ours)" helper="Free quota at console.cloud.google.com. Used only as fallback." onTest={testYouTubeKey} />
        <KeyRow label="Apify API Token (required for IG + FB)" storageKey={KEYS.APIFY} placeholder="apify_api_..." helper="$5/mo free credit at apify.com. Bring your own — we don't subsidize scraping." />
      </div>
    </div>
  )
}
