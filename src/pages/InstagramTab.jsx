import { useState, useEffect } from 'react'
import { Instagram, Search, Hash } from 'lucide-react'
import { Button, Input, Empty, Spinner, Kicker } from '../lib/ui.jsx'
import { instagramSearch } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { saveResearch, latestResearch, listCompetitors } from '../lib/db.js'
import PostGrid from '../components/PostGrid.jsx'

export default function InstagramTab() {
  const { user, profile } = useAuth()
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [err, setErr] = useState('')
  const [comps, setComps] = useState([])

  useEffect(() => {
    if (!user) return
    latestResearch(user.id, 'instagram').then(r => { if (r) { setPosts(r.results); setTags(r.query) } })
    listCompetitors(user.id, 'instagram').then(setComps)
  }, [user])

  const run = async (q = tags) => {
    const hashtags = q.split(',').map(t => t.trim()).filter(Boolean)
    if (!hashtags.length) return
    setLoading(true); setErr(''); setPosts([])
    try {
      const results = await instagramSearch({ hashtags, resultsLimit: 30 })
      setPosts(results); setTags(q)
      await saveResearch(user.id, { platform: 'instagram', query: q, results })
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 ig-gradient"/>
        <div className="absolute inset-0 grain opacity-60"/>
        <div className="relative z-10 px-10 pt-10 pb-8 text-white">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/70">research · instagram reels</div>
          <h1 className="font-display text-6xl md:text-7xl tracking-tightest leading-[0.95] mt-3 max-w-3xl">
            Reels that <em className="italic">ate.</em>
          </h1>
          <p className="mt-3 text-white/80 max-w-md text-sm">Hashtag scraping via Apify — ~$2.30 per 1,000 reels. $5 free credit monthly.</p>
        </div>
      </div>
      <div className="p-10 space-y-8">
        <div className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"/>
            <Input className="pl-9" placeholder="aitools, claudecode, vibecoding" value={tags} onChange={e => setTags(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
          </div>
          <Button variant="ig" onClick={() => run()} disabled={loading || !tags.trim()}>{loading ? <Spinner/> : <Search size={16}/>}{loading ? 'Scraping…' : 'Search'}</Button>
        </div>
        {comps.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Kicker>your competitors</Kicker>
            {comps.map(c => <span key={c.id} className="text-sm font-medium px-3 py-1.5 bg-white border border-ink/10 rounded-full">@{c.handle}</span>)}
          </div>
        )}
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{err}</div>}
        {!loading && !posts.length && !err && <Empty title="No reels yet." hint="Add hashtags. Requires Apify token + Worker URL in Settings." />}
        {posts.length > 0 && (<><div className="font-mono text-[11px] uppercase tracking-widest text-mute">{posts.length} reels · sorted by likes</div><PostGrid posts={posts} theme="instagram" /></>)}
      </div>
    </div>
  )
}
