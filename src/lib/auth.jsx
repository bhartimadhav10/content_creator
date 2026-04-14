import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase.js'

const AuthCtx = createContext({ user: null, profile: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(uid) {
    if (!uid) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data || null)
  }

  useEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; setLoading(false) } }
    // hard timeout so the app never hangs on a bad env / network
    const t = setTimeout(() => { if (!done) { console.error('[auth] getSession timeout — check VITE_SUPABASE_URL / ANON_KEY, then restart vite'); finish() } }, 6000)

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) console.error('[auth] getSession error', error)
      setUser(data?.session?.user || null)
      try { await loadProfile(data?.session?.user?.id) } catch (e) { console.error('[auth] loadProfile error', e) }
      clearTimeout(t); finish()
    }).catch(e => { console.error('[auth] getSession threw', e); clearTimeout(t); finish() })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
      // fire-and-forget so UI doesn't block on profile fetch
      loadProfile(session?.user?.id).catch(e => console.error('[auth] loadProfile error', e))
    })
    return () => { clearTimeout(t); sub.subscription.unsubscribe() }
  }, [])

  const refreshProfile = () => user && loadProfile(user.id)

  return <AuthCtx.Provider value={{ user, profile, loading, refreshProfile, setProfile }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

export function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="h-full grid place-items-center"><div className="font-display italic text-2xl text-mute">loading…</div></div>
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  if (!profile?.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return children
}

export async function signOut() { await supabase.auth.signOut() }
