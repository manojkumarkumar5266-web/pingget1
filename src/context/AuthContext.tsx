import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  passwordRecovery: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: (role: 'user' | 'dp') => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        console.error('Profile load error:', error.message)
        setProfile(null)
        return null
      }
      const p = data ? (data as Profile) : null
      setProfile(p)
      if (p?.role === 'dp') {
        supabase.from('delivery_partners')
          .update({ is_online: true, last_online_at: new Date().toISOString() })
          .eq('user_id', userId)
          .then(() => {})
      }
      return p
    } catch (e) {
      console.error('Profile load exception:', e)
      setProfile(null)
      return null
    }
  }, [])

  const ensureProfile = useCallback(async (user: User): Promise<void> => {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (existing) return

    const role = sessionStorage.getItem('pingget_oauth_role') || 'user'
    const meta = user.user_metadata || {}
    const fullName = meta.full_name || meta.name || user.email?.split('@')[0] || 'New User'
    const phone = meta.phone || ''

    const insertData: Record<string, unknown> = {
      id: user.id, role, full_name: fullName, status: 'active', preferred_language: 'en',
    }
    if (phone) insertData.phone = phone
    if (meta.avatar_url) insertData.photo_url = meta.avatar_url

    const { error } = await supabase.from('profiles').insert(insertData)
    if (error && !error.message.includes('duplicate')) {
      console.error('OAuth profile creation failed:', error.message)
    }
    sessionStorage.removeItem('pingget_oauth_role')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        ensureProfile(session.user).then(() => loadProfile(session.user.id)).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      // Don't re-fetch profile on token refresh — just update session silently
      if (event === 'TOKEN_REFRESHED') { setSession(session); return }

      if (event === 'PASSWORD_RECOVERY') {
        setSession(session)
        setPasswordRecovery(true)
        if (session?.user) {
          loadProfile(session.user.id).finally(() => setLoading(false))
        } else {
          setLoading(false)
        }
        return
      }

      setSession(session)

      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setPasswordRecovery(false)
        setLoading(false)
        return
      }

      if (session?.user) {
        setLoading(true)
        ensureProfile(session.user).then(() => loadProfile(session.user.id)).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile, ensureProfile])

  const signInWithEmail = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signInWithGoogle = async (role: 'user' | 'dp'): Promise<{ error: string | null }> => {
    sessionStorage.setItem('pingget_oauth_role', role)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signUpWithEmail = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) return { error: signUpError.message }
    const userId = signUpData.user?.id
    if (userId) {
      try {
        await supabase.functions.invoke('confirm-email', { body: { user_id: userId } })
      } catch { /* best effort */ }
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) return { error: signInError.message }
    return { error: null }
  }

  const signOut = async () => {
    if (profile?.role === 'dp' && profile.id) {
      await supabase.from('delivery_partners')
        .update({ is_online: false })
        .eq('user_id', profile.id)
    }
    await supabase.auth.signOut()
    setProfile(null)
    setPasswordRecovery(false)
  }

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id)
  }

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    setPasswordRecovery(false)
    await supabase.auth.signOut()
    setProfile(null)
    return { error: null }
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, loading, passwordRecovery,
      signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, refreshProfile, updatePassword, clearPasswordRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
