import { useState } from 'react'
import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom'
import { Youtube, Instagram, Facebook, Mic2, Sparkles, Settings as SettingsIcon, LayoutDashboard, Users, History as HistoryIcon, Menu, X, UserCog } from 'lucide-react'
import { AuthProvider, RequireAuth, useAuth } from './lib/auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import YouTubeTab from './pages/YouTubeTab.jsx'
import InstagramTab from './pages/InstagramTab.jsx'
import FacebookTab from './pages/FacebookTab.jsx'
import VoiceSamples from './pages/VoiceSamples.jsx'
import Generate from './pages/Generate.jsx'
import Settings from './pages/Settings.jsx'
import Competitors from './pages/Competitors.jsx'
import History from './pages/History.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'

const nav = [
  { to: '/', label: 'Home', Icon: LayoutDashboard, exact: true },
  { section: 'research' },
  { to: '/youtube', label: 'YouTube', Icon: Youtube, dot: 'bg-yt-red' },
  { to: '/instagram', label: 'Instagram', Icon: Instagram, dot: 'bg-ig-pink' },
  { to: '/facebook', label: 'Facebook', Icon: Facebook, dot: 'bg-fb-blue' },
  { section: 'create' },
  { to: '/voice', label: 'Voice', Icon: Mic2 },
  { to: '/generate', label: 'Generate', Icon: Sparkles, accent: true },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { section: 'context' },
  { to: '/competitors', label: 'Competitors', Icon: Users },
  { to: '/onboarding', label: 'Edit profile', Icon: UserCog },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon }
]

function Sidebar({ onNavigate }) {
  const { profile } = useAuth()
  const initial = (profile?.creator_name || '?').charAt(0).toUpperCase()
  return (
    <div className="h-full flex flex-col bg-ivory-soft">
      <Link to="/" onClick={onNavigate} className="p-5 border-b hairline">
        <div className="font-display text-xl tracking-tightest leading-none">Content<br/><em className="italic text-acid-deep">Agents.</em></div>
        <div className="font-mono text-[10px] tracking-widest uppercase text-mute mt-2">byo-key · v0.1</div>
      </Link>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((item, i) => item.section ? (
          <div key={i} className="px-3 pt-5 pb-1 font-mono text-[10px] tracking-[0.22em] uppercase text-mute">{item.section}</div>
        ) : (
          <NavLink key={item.to} to={item.to} end={item.exact} onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-ink text-ivory' : 'text-ink hover:bg-ink/5'}`}>
            {item.dot ? <span className={`w-2 h-2 rounded-full ${item.dot}`}/> : <item.Icon size={16}/>}
            <span className="flex-1">{item.label}</span>
            {item.accent && <span className="w-1.5 h-1.5 rounded-full bg-acid"/>}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t hairline">
        <Link to="/settings" onClick={onNavigate} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-ink/5 transition">
          <div className="w-8 h-8 rounded-full bg-ink text-ivory grid place-items-center font-display font-bold">{initial}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{profile?.creator_name || 'Creator'}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-mute truncate">{profile?.niche?.split(',')[0] || 'set niche'}</div>
          </div>
        </Link>
      </div>
    </div>
  )
}

function Shell({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="md:flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:block md:w-60 md:flex-shrink-0 md:border-r md:hairline">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-ivory-soft border-b hairline flex items-center justify-between px-4 h-14">
        <Link to="/" className="font-display text-lg tracking-tightest">Content<em className="italic"> Agents.</em></Link>
        <button onClick={() => setOpen(true)} className="p-2 -mr-2"><Menu size={20}/></button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 bg-ink/40 z-50" onClick={() => setOpen(false)}/>
          <div className="md:hidden fixed inset-y-0 left-0 w-72 z-50 shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-ink text-ivory"><X size={16}/></button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 overflow-auto scrollbar-thin">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding/></RequireAuth>} />
        <Route path="/" element={<RequireAuth><Shell><Dashboard/></Shell></RequireAuth>} />
        <Route path="/youtube" element={<RequireAuth><Shell><YouTubeTab/></Shell></RequireAuth>} />
        <Route path="/instagram" element={<RequireAuth><Shell><InstagramTab/></Shell></RequireAuth>} />
        <Route path="/facebook" element={<RequireAuth><Shell><FacebookTab/></Shell></RequireAuth>} />
        <Route path="/voice" element={<RequireAuth><Shell><VoiceSamples/></Shell></RequireAuth>} />
        <Route path="/generate" element={<RequireAuth><Shell><Generate/></Shell></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><Shell><History/></Shell></RequireAuth>} />
        <Route path="/competitors" element={<RequireAuth><Shell><Competitors/></Shell></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Shell><Settings/></Shell></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace/>} />
      </Routes>
    </AuthProvider>
  )
}
