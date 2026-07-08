import { useState } from 'react'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ShieldCheck, LogOut, AlertTriangle } from 'lucide-react'

// This page is only rendered in development builds (import.meta.env.DEV).
// It is never included in production bundles.
export default function DevAdminSetup() {
  const { user, signOut } = useAuth()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleMakeMeAdmin = async () => {
    if (!user?.email) {
      setStatus('error')
      setMessage('You must be signed in to use this page. Go to /auth and sign in first.')
      return
    }

    setStatus('loading')
    setMessage('')

    const { data, error } = await supabase.functions.invoke('promote-admin', {
      body: {
        email: user.email,
        admin_key: import.meta.env.VITE_ADMIN_PROMO_KEY,
      },
    })

    if (error || data?.error) {
      setStatus('error')
      setMessage(data?.error ?? error?.message ?? 'Unknown error')
      return
    }

    setStatus('success')
    setMessage('You are now an admin. Sign out and sign back in to access the admin dashboard.')
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/auth'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-700/40 bg-gray-900 p-8 shadow-2xl">
        {/* Dev-only badge */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400 tracking-wide">Admin Setup</span>
          </div>
          <span className="rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
            Dev Only
          </span>
        </div>

        <p className="mb-1 text-sm text-gray-400">
          Signed in as
        </p>
        <p className="mb-6 truncate text-base font-semibold text-white">
          {user?.email ?? <span className="italic text-gray-500">Not signed in</span>}
        </p>

        {status === 'success' ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-900/40 border border-green-700/40 px-4 py-3 text-sm text-green-300">
              {message}
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
            >
              <LogOut size={16} />
              Sign Out &amp; Sign In Again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {status === 'error' && (
              <div className="flex items-start gap-2 rounded-xl bg-red-900/40 border border-red-700/40 px-4 py-3 text-sm text-red-300">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {message}
              </div>
            )}
            <button
              onClick={handleMakeMeAdmin}
              disabled={status === 'loading' || !user}
              className="w-full rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-gray-950 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Promoting...' : 'Make Me Admin'}
            </button>
            {!user && (
              <a href="/auth" className="block text-center text-xs text-gray-500 underline hover:text-gray-400">
                Sign in first
              </a>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-[10px] text-gray-600">
          This page does not exist in production builds.
        </p>
      </div>
    </div>
  )
}
