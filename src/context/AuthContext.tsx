import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  passwordRecovery: boolean
  oauthError: string | null
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: (role: 'user' | 'dp') => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  clearPasswordRecovery: () => void
  clearOauthError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  // Set by signUpWithEmail so onAuthStateChange knows to wait for the
  // signup flow to finish inserting the profile before checking it.
  const signupInProgress = useRef(false)

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

  // For Google sign-in, block access if no existing profile (user hasn't signed up)
  const ensureProfile = useCallback(async (user: User): Promise<{ blocked: boolean; error: string | null }> => {
    const provider = user.app_metadata?.provider
    if (provider !== 'google') return { blocked: false, error: null }

    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (existing) return { blocked: false, error: null }

    sessionStorage.removeItem('pingget_oauth_role')
    return {
      blocked: true,
      error: `No account found for "${user.email}". Please sign up first, then sign in with Google.`,
    }
  }, [])

  // Check if Google sign-in email matches an existing email-password account
  const checkGoogleEmailMatch = useCallback(async (user: User): Promise<{ ok: boolean; error: string | null }> => {
    const oauthMode = sessionStorage.getItem('pingget_oauth_mode') || 'signin'
    sessionStorage.removeItem('pingget_oauth_mode')

    if (oauthMode === 'signup') return { ok: true, error: null }

    // Sign-in mode: the Google email must match an existing account
    const googleEmail = user.email?.toLowerCase()
    if (!googleEmail) return { ok: true, error: null }

    const isGoogleProvider = user.app_metadata?.provider === 'google'
    if (!isGoogleProvider) return { ok: true, error: null }

    // Look up auth.users by email using admin API via edge function
    try {
      const { data, error } = await supabase.functions.invoke('check-email', { body: { email: googleEmail } })
      if (error) return { ok: true, error: null }

      // Sign-in: the account must already exist
      if (!data?.exists) {
        return {
          ok: false,
          error: `No account found for "${googleEmail}". Please sign up first using the same email, then sign in with Google.`,
        }
      }

      // If account exists but belongs to a different user ID, the email doesn't match
      if (data?.user_id && data.user_id !== user.id) {
        return {
          ok: false,
          error: `The Google email "${googleEmail}" does not match the email you signed up with. Please use the same email you used during signup, or sign in with your email and password.`,
        }
      }
      return { ok: true, error: null }
    } catch {
      return { ok: true, error: null }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const { ok, error } = await checkGoogleEmailMatch(session.user)
        if (!ok && error) {
          setOauthError(error)
          await supabase.auth.signOut()
          setProfile(null)
          setLoading(false)
          return
        }
        ensureProfile(session.user).then(({ blocked, error: ensureErr }) => {
          if (blocked && ensureErr) {
            setOauthError(ensureErr)
            supabase.auth.signOut().then(() => { setProfile(null); setLoading(false) })
            return
          }
          loadProfile(session.user.id).finally(() => setLoading(false))
        })
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
        // If signup is in progress, the AuthScreen flow will insert the
        // profile and call refreshProfile — don't check or load it here.
        if (signupInProgress.current) {
          setSession(session)
          setLoading(false)
          return
        }
        setLoading(true)
        checkGoogleEmailMatch(session.user).then(async ({ ok, error }) => {
          if (!ok && error) {
            setOauthError(error)
            await supabase.auth.signOut()
            setProfile(null)
            setLoading(false)
            return
          }
          ensureProfile(session.user).then(({ blocked, error: ensureErr }) => {
            if (blocked && ensureErr) {
              setOauthError(ensureErr)
              supabase.auth.signOut().then(() => { setProfile(null); setLoading(false) })
              return
            }
            loadProfile(session.user.id).finally(() => setLoading(false))
          })
        })
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile, ensureProfile, checkGoogleEmailMatch])

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
    signupInProgress.current = true
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { signupInProgress.current = false; return { error: signUpError.message } }
    const userId = signUpData.user?.id
    if (userId) {
      try {
        await supabase.functions.invoke('confirm-email', { body: { user_id: userId } })
      } catch { /* best effort */ }
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { signupInProgress.current = false; return { error: signInError.message } }
    return { error: null }
  }

  const signOut = async () => {
    signupInProgress.current = false
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
    signupInProgress.current = false
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

  const clearOauthError = () => setOauthError(null)

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, loading, passwordRecovery, oauthError,
      signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, refreshProfile, updatePassword, clearPasswordRecovery, clearOauthError,
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
