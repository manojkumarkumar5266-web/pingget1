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
  // Prevent duplicate profile loads racing against each other
  const profileLoadingRef = useRef(false)

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (profileLoadingRef.current) {
      console.log('[Auth] loadProfile skipped — already loading')
      return null
    }
    profileLoadingRef.current = true
    try {
      console.log('[Auth] loadProfile start for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        console.error('[Auth] Profile load error:', error.message)
        setProfile(null)
        return null
      }
      const p = data ? (data as Profile) : null
      console.log('[Auth] loadProfile result:', p ? `role=${p.role} status=${p.status}` : 'null')
      setProfile(p)
      if (p?.role === 'dp') {
        supabase.from('delivery_partners')
          .update({ is_online: true })
          .eq('user_id', userId)
          .then(() => {})
      }
      return p
    } catch (e) {
      console.error('[Auth] Profile load exception:', e)
      setProfile(null)
      return null
    } finally {
      profileLoadingRef.current = false
    }
  }, [])

  // Google users: link their Google auth user to an existing email/password profile,
  // or create a new profile if this is a signup. Uses an edge function because
  // changing the primary key of a profile row requires service-role access.
  const resolveGoogleProfile = useCallback(async (user: User): Promise<Profile | null> => {
    if (user.app_metadata?.provider !== 'google') return null
    const role = sessionStorage.getItem('pingget_oauth_role') as 'user' | 'dp' | null
    const mode = sessionStorage.getItem('pingget_oauth_mode') as 'signup' | 'signin' | null
    try {
      const { data, error } = await supabase.functions.invoke('link-google-account', {
        body: { user_id: user.id, email: user.email, role: role || 'user', mode: mode || 'signin' },
      })
      if (error || !data?.success) {
        console.error('[Auth] link-google-account error:', error?.message || data?.error)
        sessionStorage.removeItem('pingget_oauth_role')
        sessionStorage.removeItem('pingget_oauth_mode')
        setOauthError(data?.error || 'Failed to link Google account.')
        await supabase.auth.signOut()
        setProfile(null)
        return null
      }
      sessionStorage.removeItem('pingget_oauth_role')
      sessionStorage.removeItem('pingget_oauth_mode')
      const p = data.profile as Profile
      setProfile(p)
      console.log('[Auth] Google profile resolved:', p ? `role=${p.role} status=${p.status}` : 'null')
      return p
    } catch (e) {
      console.error('[Auth] link-google-account exception:', e)
      sessionStorage.removeItem('pingget_oauth_role')
      sessionStorage.removeItem('pingget_oauth_mode')
      setOauthError('Failed to link Google account.')
      await supabase.auth.signOut()
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    console.log('[Auth] Initial session restore starting')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] Session restore:', session?.user?.id || 'no session')
      setSession(session)
      if (session?.user) {
        if (session.user.app_metadata?.provider === 'google') {
          await resolveGoogleProfile(session.user)
        } else {
          await loadProfile(session.user.id)
        }
      }
      setLoading(false)
      console.log('[Auth] Initial session restore complete, loading=false')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange:', event, session?.user?.id || 'no session')

      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed, updating session silently')
        setSession(session)
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[Auth] Password recovery event')
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
        console.log('[Auth] Signed out event')
        setProfile(null)
        setPasswordRecovery(false)
        setLoading(false)
        return
      }

      if (session?.user) {
        // If signup is in progress, the AuthScreen flow will insert the
        // profile and call refreshProfile — don't check or load it here.
        if (signupInProgress.current) {
          console.log('[Auth] Signup in progress, skipping profile load')
          setSession(session)
          setLoading(false)
          return
        }
        setLoading(true)
        if (session.user.app_metadata?.provider === 'google') {
          resolveGoogleProfile(session.user).finally(() => setLoading(false))
        } else {
          loadProfile(session.user.id).finally(() => setLoading(false))
        }
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile, resolveGoogleProfile])

  const signInWithEmail = async (email: string, password: string): Promise<{ error: string | null }> => {
    console.log('[Auth] signInWithEmail:', email)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[Auth] signInWithEmail error:', error.message)
      return { error: error.message }
    }
    console.log('[Auth] signInWithEmail success')
    return { error: null }
  }

  const signInWithGoogle = async (role: 'user' | 'dp'): Promise<{ error: string | null }> => {
    console.log('[Auth] signInWithGoogle, role:', role)
    sessionStorage.setItem('pingget_oauth_role', role)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    })
    if (error) {
      console.error('[Auth] signInWithGoogle error:', error.message)
      return { error: error.message }
    }
    return { error: null }
  }

  const signUpWithEmail = async (email: string, password: string): Promise<{ error: string | null }> => {
    console.log('[Auth] signUpWithEmail:', email)
    signupInProgress.current = true
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      console.error('[Auth] signUpWithEmail error:', signUpError.message)
      signupInProgress.current = false
      return { error: signUpError.message }
    }
    console.log('[Auth] signUpWithEmail success')
    return { error: null }
  }

  const signOut = async () => {
    console.log('[Auth] signOut called')
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
    console.log('[Auth] refreshProfile called')
    signupInProgress.current = false
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (currentSession?.user) await loadProfile(currentSession.user.id)
  }

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    console.log('[Auth] updatePassword called')
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
