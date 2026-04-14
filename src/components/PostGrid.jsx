import { Play, Heart, MessageCircle, Eye, Flame, ExternalLink } from 'lucide-react'
import { storage, KEYS } from '../lib/storage.js'
import { Button, Tag } from '../lib/ui.jsx'
import { useNavigate } from 'react-router-dom'

function fmt(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

export default function PostGrid({ posts }) {
  const nav = useNavigate()
  const pick = (p) => { storage.set(KEYS.SELECTED_TOPIC, { topic: p.title, from: p }); nav('/generate') }
  if (!posts?.length) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {posts.map(p => (
        <div key={p.id} className="group bg-white border border-ink/10 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition">
          <a href={p.url} target="_blank" rel="noreferrer" className="block relative aspect-[9/16] bg-ink">
            {p.thumbnail && <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-ivory text-xs font-mono">
              <Play size={12} fill="currentColor"/>{fmt(p.views)}
              {p.viral && <span className="ml-auto"><Tag tone="acid"><Flame size={10} className="inline -mt-px"/> VIRAL</Tag></span>}
            </div>
          </a>
          <div className="p-4 space-y-3">
            <div className="font-display text-[17px] leading-tight line-clamp-2 min-h-[2.6rem]">{p.title}</div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-mute truncate">@{p.author || p.channel}</div>
            <div className="flex items-center gap-3 text-xs font-mono text-mute">
              <span className="flex items-center gap-1"><Heart size={12}/>{fmt(p.likes)}</span>
              <span className="flex items-center gap-1"><MessageCircle size={12}/>{fmt(p.comments)}</span>
              {p.engagementRate > 0 && <span className="flex items-center gap-1"><Eye size={12}/>{p.engagementRate}%</span>}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="primary" className="flex-1 justify-center !py-2 text-xs" onClick={() => pick(p)}>Use as topic</Button>
              <a href={p.url} target="_blank" rel="noreferrer" className="p-2 text-mute hover:text-ink"><ExternalLink size={14}/></a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
