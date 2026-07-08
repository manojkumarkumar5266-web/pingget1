import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  passwordRecovery: boolean
  signUp: (email: string, password: string, role: 'user' | 'dp', fullName: string, phone: string, pincode?: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
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
      return p
    } catch (e) {
      console.error('Profile load exception:', e)
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return

      if (event === 'PASSWORD_RECOVERY') {
        setSession(session)
        setPasswordRecovery(true)
        setLoading(false)
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
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // Uses signup-user edge function which calls admin.createUser with email_confirm: true
  // This bypasses Supabase email verification entirely — users can sign in immediately
  const signUp = async (
    email: string, password: string,
    role: 'user' | 'dp', fullName: string, phone: string, pincode?: string
  ): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.functions.invoke('signup-user', {
      body: { email, password, role, full_name: fullName, phone, pincode },
    })
    if (error) return { error: error.message }
    if (data?.error) return { error: data.error }
    return { error: null }
  }

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message
        if (!msg || msg === '{}' || msg === '[object Object]') {
          return { error: 'Incorrect email or password. Please try again.' }
        }
        return { error: msg }
      }

      // Check profile status — block suspended/banned accounts immediately
      const { data: { session: s } } = await supabase.auth.getSession()
      if (s?.user) {
        const { data: p } = await supabase.from('profiles').select('status').eq('id', s.user.id).maybeSingle()
        if (p?.status === 'suspended') {
          await supabase.auth.signOut()
          return { error: 'Your account has been suspended. Please contact support.' }
        }
        if (p?.status === 'banned') {
          await supabase.auth.signOut()
          return { error: 'Your account has been banned. Please contact support.' }
        }
      }

      return { error: null }
    } catch (e: any) {
      return { error: e?.message || 'Sign in failed. Check your connection and try again.' }
    }
  }

  const signOut = async () => {
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
      signUp, signIn, signOut, refreshProfile, updatePassword, clearPasswordRecovery,
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
