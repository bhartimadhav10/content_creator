import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Youtube, Instagram, Facebook, Sparkles, ArrowRight, Mic2, Users } from 'lucide-react'
import { Card, Kicker, Button } from '../lib/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { listGenerations, listCompetitors, listVoiceSamples } from '../lib/db.js'
import NewsWidget from '../components/NewsWidget.jsx'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Late night'
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [gens, setGens] = useState([])
  const [comps, setComps] = useState([])
  const [vcount, setVcount] = useState(0)

  useEffect(() => {
    if (!user) return
    listGenerations(user.id, 6).then(setGens)
    listCompetitors(user.id).then(setComps)
    listVoiceSamples(user.id).then(r => setVcount(r.length))
  }, [user])

  const first = profile?.creator_name?.split(' ')[0] || 'Creator'
  const platforms = profile?.platforms || []

  return (
    <div className="min-h-full bg-ivory">
      {/* Hero */}
      <div className="relative overflow-hidden bg-ink text-ivory grain">
        <div className="absolute -right-32 -top-32 w-[520px] h-[520px] rounded-full bg-acid/20 blur-3xl"/>
        <div className="absolute -left-20 -bottom-40 w-[420px] h-[420px] rounded-full ig-gradient opacity-25 blur-3xl"/>
        <div className="relative z-10 px-10 py-14">
          <Kicker className="!text-acid rise">{greeting().toLowerCase()}</Kicker>
          <h1 className="font-display text-6xl md:text-8xl tracking-tightest leading-[0.92] mt-3 rise rise-1">
            {greeting()}, <em className="italic text-acid">{first}.</em>
          </h1>
          <p className="mt-4 text-ivory/70 max-w-xl text-[15px] rise rise-2">
            {profile?.niche ? <>Today's research is tuned to <span className="text-ivory">{profile.niche}</span>.</> : 'Pick a niche in onboarding to personalize your feed.'}
          </p>
          <div className="mt-8 flex gap-3 rise rise-3">
            <Link to="/generate"><Button variant="accent"><Sparkles size={16}/>New script</Button></Link>
            <Link to="/youtube"><Button variant="outline" className="!border-ivory !text-ivory hover:!bg-ivory hover:!text-ink">Research shorts <ArrowRight size={16}/></Button></Link>
          </div>
        </div>
      </div>

      <div className="px-10 py-12 space-y-12">
        {/* Platform quick-jump */}
        <section>
          <Kicker>your platforms</Kicker>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {[
              { k: 'youtube', to: '/youtube', Icon: Youtube, label: 'YouTube Shorts', color: 'from-red-500/10 to-red-500/0', ring: 'hover:border-yt-red' },
              { k: 'instagram', to: '/instagram', Icon: Instagram, label: 'Instagram Reels', color: 'from-pink-500/10 to-orange-500/0', ring: 'hover:border-ig-pink' },
              { k: 'facebook', to: '/facebook', Icon: Facebook, label: 'Facebook', color: 'from-blue-500/10 to-blue-500/0', ring: 'hover:border-fb-blue' }
            ].map(({ k, to, Icon, label, color, ring }) => {
              const on = platforms.length === 0 || platforms.includes(k)
              return (
                <Link key={k} to={to} className={`group relative overflow-hidden rounded-2xl border-2 border-ink/10 ${ring} transition p-6 bg-white ${on ? '' : 'opacity-50'}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition`}/>
                  <div className="relative z-10 flex items-start justify-between">
                    <Icon size={32} />
                    <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition"/>
                  </div>
                  <div className="relative z-10 font-display text-2xl mt-8 leading-tight">{label}</div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-6"><Kicker>scripts generated</Kicker><div className="font-display text-5xl mt-2">{gens.length}</div></Card>
          <Card className="p-6"><Kicker>competitors tracked</Kicker><div className="font-display text-5xl mt-2">{comps.length}</div><Link to="/competitors" className="text-xs font-mono uppercase tracking-widest text-mute hover:text-ink mt-2 inline-flex items-center gap-1">manage <ArrowRight size={12}/></Link></Card>
          <Card className="p-6"><Kicker>voice samples</Kicker><div className="font-display text-5xl mt-2">{vcount}</div><Link to="/voice" className="text-xs font-mono uppercase tracking-widest text-mute hover:text-ink mt-2 inline-flex items-center gap-1">{vcount < 3 ? 'add more' : 'edit'} <ArrowRight size={12}/></Link></Card>
        </section>

        {/* News feed */}
        <section>
          <Kicker>free · real-time</Kicker>
          <h2 className="font-display text-3xl mt-1 mb-4">What's breaking in your world.</h2>
          <NewsWidget niche={profile?.niche?.split(',')[0]?.trim()} />
        </section>

        {/* Recent generations */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div><Kicker>recent work</Kicker><h2 className="font-display text-3xl mt-1">Pick up where you left off.</h2></div>
            <Link to="/history" className="text-sm font-medium marquee-underline">See all history →</Link>
          </div>
          {gens.length === 0 ? (
            <div className="bg-white border border-dashed border-ink/20 rounded-2xl p-10 text-center">
              <Mic2 className="mx-auto text-mute" size={28}/>
              <div className="font-display italic text-2xl mt-3">Your first script awaits.</div>
              <Link to="/generate" className="mt-4 inline-block"><Button variant="primary">Generate now <ArrowRight size={16}/></Button></Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gens.slice(0, 4).map(g => (
                <Card key={g.id} className="p-5 hover:shadow-sm transition">
                  <div className="flex items-center justify-between"><Kicker>{g.source_platform || 'script'}</Kicker><span className="text-[11px] font-mono text-mute">{new Date(g.created_at).toLocaleDateString()}</span></div>
                  <div className="font-display text-xl mt-2 line-clamp-2">{g.topic}</div>
                  <div className="text-sm text-mute mt-2 line-clamp-2">{g.script?.hook}</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
