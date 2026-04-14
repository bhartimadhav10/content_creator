import { useState, useEffect } from 'react'
import { Youtube, Search } from 'lucide-react'
import { Button, Input, PageHeader, Empty, Spinner, Kicker } from '../lib/ui.jsx'
import { youtubeSearch } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { saveResearch, latestResearch, listCompetitors } from '../lib/db.js'
import PostGrid from '../components/PostGrid.jsx'

export default function YouTubeTab() {
  const { user, profile } = useAuth()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [err, setErr] = useState('')
  const [comps, setComps] = useState([])

  useEffect(() => {
    if (!user) return
    latestResearch(user.id, 'youtube').then(r => { if (r) { setPosts(r.results); setQuery(r.query) } })
    listCompetitors(user.id, 'youtube').then(setComps)
    if (!query && profile?.niche) setQuery(profile.niche.split(',')[0]?.trim() || '')
  }, [user, profile])

  const run = async (q = query) => {
    if (!q.trim()) return
    setLoading(true); setErr(''); setPosts([])
    try {
      const results = await youtubeSearch({ query: q, maxResults: 30 })
      setPosts(results); setQuery(q)
      await saveResearch(user.id, { platform: 'youtube', query: q, results })
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader kicker="research · youtube shorts" title={<><span className="text-yt-red">Red</span> pill<br/><em className="italic">Shorts.</em></>} subtitle="What's spiking right now in your niche — sorted by views." />
      <div className="p-10 space-y-8">
        <div className="flex gap-2 max-w-2xl">
          <Input placeholder={profile?.niche || "e.g. Claude Code, vibe coding"} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
          <Button variant="yt" onClick={() => run()} disabled={loading || !query.trim()}>{loading ? <Spinner/> : <Search size={16}/>}{loading ? 'Searching…' : 'Search'}</Button>
        </div>
        {comps.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Kicker>your competitors</Kicker>
            {comps.map(c => (
              <button key={c.id} onClick={() => run(c.handle)} className="text-sm font-medium px-3 py-1.5 bg-white border border-ink/10 rounded-full hover:border-ink/40 transition">@{c.handle}</button>
            ))}
          </div>
        )}
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{err}</div>}
        {!loading && !posts.length && !err && <Empty title="No searches yet." hint="Enter keywords or tap a competitor above." />}
        {posts.length > 0 && (<><div className="font-mono text-[11px] uppercase tracking-widest text-mute">{posts.length} results · sorted by views</div><PostGrid posts={posts} theme="youtube" /></>)}
      </div>
    </div>
  )
}
