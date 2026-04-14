import { useState, useEffect } from 'react'
import { Facebook, Search, Link2 } from 'lucide-react'
import { Button, Input, Empty, Spinner, Kicker } from '../lib/ui.jsx'
import { facebookSearch } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { saveResearch, latestResearch, listCompetitors } from '../lib/db.js'
import PostGrid from '../components/PostGrid.jsx'

export default function FacebookTab() {
  const { user } = useAuth()
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [err, setErr] = useState('')
  const [comps, setComps] = useState([])

  useEffect(() => {
    if (!user) return
    latestResearch(user.id, 'facebook').then(r => { if (r) { setPosts(r.results); setUrls(r.query) } })
    listCompetitors(user.id, 'facebook').then(setComps)
  }, [user])

  const run = async (q = urls) => {
    const pageUrls = q.split(/[\n,]/).map(u => u.trim()).filter(Boolean)
    if (!pageUrls.length) return
    setLoading(true); setErr(''); setPosts([])
    try {
      const results = await facebookSearch({ pageUrls, resultsLimit: 30 })
      setPosts(results); setUrls(q)
      await saveResearch(user.id, { platform: 'facebook', query: q, results })
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div className="bg-fb-blue text-white relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-20"/>
        <div className="relative z-10 px-10 pt-10 pb-8">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/70">research · facebook pages</div>
          <h1 className="font-display text-6xl md:text-7xl tracking-tightest leading-[0.95] mt-3 max-w-3xl">The <em className="italic">feed</em>, decoded.</h1>
          <p className="mt-3 text-white/80 max-w-md text-sm">Scrape posts from any public Facebook Page. ~$2.30 per 1,000 posts via Apify.</p>
        </div>
      </div>
      <div className="p-10 space-y-8">
        <div className="flex gap-2 max-w-3xl">
          <div className="relative flex-1">
            <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"/>
            <Input className="pl-9" placeholder="https://facebook.com/PageName (comma or newline separated)" value={urls} onChange={e => setUrls(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
          </div>
          <Button variant="fb" onClick={() => run()} disabled={loading || !urls.trim()}>{loading ? <Spinner/> : <Search size={16}/>}{loading ? 'Scraping…' : 'Search'}</Button>
        </div>
        {comps.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Kicker>your competitors</Kicker>
            {comps.map(c => <span key={c.id} className="text-sm font-medium px-3 py-1.5 bg-white border border-ink/10 rounded-full">{c.handle}</span>)}
          </div>
        )}
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{err}</div>}
        {!loading && !posts.length && !err && <Empty title="No posts yet." hint="Paste Facebook Page URLs. Requires Apify token + Worker URL in Settings." />}
        {posts.length > 0 && (<><div className="font-mono text-[11px] uppercase tracking-widest text-mute">{posts.length} posts · sorted by likes</div><PostGrid posts={posts} theme="facebook" /></>)}
      </div>
    </div>
  )
}
