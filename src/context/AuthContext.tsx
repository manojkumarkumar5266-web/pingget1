import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile, initialAuthUrl } from '../lib/supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  passwordRecovery: boolean
  oauthError: string | null
  oauthResolving: boolean
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
  const passwordRecoveryRef = useRef(false)
  const [oauthResolving, setOauthResolving] = useState(false)

  // Set by signUpWithEmail so onAuthStateChange knows to wait for the
  // signup flow to finish inserting the profile before checking it.
  const signupInProgress = useRef(false)
  // Prevent duplicate profile loads racing against each other
  const profileLoadingRef = useRef(false)
  // Prevent duplicate Google profile resolution calls
  const googleResolvingRef = useRef(false)
  // Track if we've seen the initial session
  const initialSessionDone = useRef(false)
  // Track if we've detected a recovery token from the URL
  const recoveryFromUrl = useRef(false)

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
      let p = data ? (data as Profile) : null
      // For DP accounts, delivery_partners.status is the authoritative approval
      // status. The profiles.status may lag behind (e.g. admin approved the DP
      // but profiles.status wasn't updated due to a CHECK constraint). Sync them.
      if (p?.role === 'dp') {
        const { data: dpRow } = await supabase
          .from('delivery_partners')
          .select('status')
          .eq('user_id', userId)
          .maybeSingle()
        if (dpRow?.status && dpRow.status !== p.status) {
          p = { ...p, status: dpRow.status }
        }
        supabase.from('delivery_partners')
          .update({ is_online: true })
          .eq('user_id', userId)
          .then(() => {})
      }
      console.log('[Auth] loadProfile result:', p ? `role=${p.role} status=${p.status}` : 'null')
      setProfile(p)
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
    // Prevent duplicate calls — both getSession() and onAuthStateChange may fire
    if (googleResolvingRef.current) {
      console.log('[Auth] resolveGoogleProfile skipped — already resolving')
      return null
    }
    googleResolvingRef.current = true
    setOauthResolving(true)
    const role = sessionStorage.getItem('pingget_oauth_role') as 'user' | 'dp' | null
    const mode = sessionStorage.getItem('pingget_oauth_mode') as 'signup' | 'signin' | null
    try {
      const { data, error } = await supabase.functions.invoke('link-google-account', {
        body: {
          user_id: user.id,
          email: user.email,
          role: role || 'user',
          mode: mode || 'signin',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        },
      })
      if (error || !data?.success) {
        console.error('[Auth] link-google-account error:', error?.message || data?.error)
        sessionStorage.removeItem('pingget_oauth_role')
        sessionStorage.removeItem('pingget_oauth_mode')
        setOauthError(data?.error || 'Failed to link Google account.')
        await supabase.auth.signOut()
        setProfile(null)
        setOauthResolving(false)
        googleResolvingRef.current = false
        return null
      }
      sessionStorage.removeItem('pingget_oauth_role')
      sessionStorage.removeItem('pingget_oauth_mode')
      const p = data.profile as Profile
      setProfile(p)
      console.log('[Auth] Google profile resolved:', p ? `role=${p.role} status=${p.status}` : 'null')
      setOauthResolving(false)
      googleResolvingRef.current = false
      return p
    } catch (e) {
      console.error('[Auth] link-google-account exception:', e)
      sessionStorage.removeItem('pingget_oauth_role')
      sessionStorage.removeItem('pingget_oauth_mode')
      setOauthError('Failed to link Google account.')
      await supabase.auth.signOut()
      setProfile(null)
      setOauthResolving(false)
      googleResolvingRef.current = false
      return null
    }
  }, [])

  useEffect(() => {
    console.log('[Auth] Initial session restore starting')
    // Detect password recovery from URL hash OR query params before anything else.
    // Use initialAuthUrl (captured before the Supabase client cleared the hash)
    // because window.location.hash is already empty by the time this runs.
    const urlHash = initialAuthUrl.hash
    const urlParams = new URLSearchParams(initialAuthUrl.search)
    const urlQuery = urlParams.get('type')
    // Mobile (Capacitor): the deep link handler calls setSession() which
    // fires SIGNED_IN (not PASSWORD_RECOVERY), so it sets a sessionStorage
    // flag we check here.
    const mobileRecoveryFlag = sessionStorage.getItem('pingget_password_recovery')
    if (mobileRecoveryFlag === 'true') {
      console.log('[Auth] Recovery flag detected from mobile deep link')
      sessionStorage.removeItem('pingget_password_recovery')
      recoveryFromUrl.current = true
      passwordRecoveryRef.current = true
      setPasswordRecovery(true)
    } else if ((urlHash && urlHash.includes('type=recovery')) || urlQuery === 'recovery') {
      console.log('[Auth] Recovery token detected in URL')
      recoveryFromUrl.current = true
      passwordRecoveryRef.current = true
      setPasswordRecovery(true)
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] Session restore:', session?.user?.id || 'no session')
      initialSessionDone.current = true
      setSession(session)
      if (session?.user) {
        // Don't load profile during password recovery
        if (passwordRecoveryRef.current) {
          console.log('[Auth] Password recovery in progress, skipping profile load')
          setLoading(false)
          return
        }
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
        passwordRecoveryRef.current = true
        setPasswordRecovery(true)
        setSession(session)
        // Don't load profile during recovery — the recovery user may not have one
        setLoading(false)
        return
      }

      setSession(session)

      if (event === 'SIGNED_OUT') {
        console.log('[Auth] Signed out event')
        setProfile(null)
        setPasswordRecovery(false)
        passwordRecoveryRef.current = false
        setLoading(false)
        return
      }

      // If password recovery is in progress, ignore SIGNED_IN events
      if (passwordRecoveryRef.current) {
        console.log('[Auth] Password recovery in progress, ignoring', event)
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
        // Skip if initial session hasn't been processed yet (avoids double-load race)
        if (!initialSessionDone.current) {
          console.log('[Auth] Initial session not done yet, skipping')
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
    // Don't clear passwordRecovery here — the ResetPassword component
    // needs it to stay true so it can show the success screen.
    // It will be cleared after signOut completes via onAuthStateChange.
    await supabase.auth.signOut()
    return { error: null }
  }

  const clearPasswordRecovery = () => { setPasswordRecovery(false); passwordRecoveryRef.current = false }
  const clearOauthError = () => setOauthError(null)

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile, loading, passwordRecovery, oauthError, oauthResolving,
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
