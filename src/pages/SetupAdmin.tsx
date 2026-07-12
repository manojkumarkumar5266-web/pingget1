import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShieldCheck, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

export default function SetupAdmin() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleCreate = async () => {
    setStatus('loading')
    setMessage('')

    const { data, error } = await supabase.functions.invoke('create-admin', {
      body: {
        email: 'manojadmin26@pingget.com',
        password: 'Titli@3352',
        full_name: 'Manoj Admin',
        phone: '9999999999',
        setup_key: 'pingget-admin-setup-2026',
      },
    })

    if (error || data?.error) {
      setStatus('error')
      setMessage(data?.error ?? error?.message ?? 'Unknown error')
      return
    }

    setStatus('success')
    setMessage('Admin account created. Redirecting to login...')
    setTimeout(() => { window.location.href = '/admin/login' }, 2000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-700/40 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck size={22} className="text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400 tracking-wide">Admin Setup</span>
        </div>

        <p className="mb-6 text-sm text-gray-400">
          Click the button below to create the admin account. After creation, you'll be redirected to the login page.
        </p>

        {status === 'error' && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-900/40 border border-red-700/40 px-4 py-3 text-sm text-red-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {message}
          </div>
        )}

        {status === 'success' ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-900/40 border border-green-700/40 px-4 py-3 text-sm text-green-300">
            <CheckCircle size={16} className="shrink-0" />
            {message}
          </div>
        ) : (
          <button
            onClick={handleCreate}
            disabled={status === 'loading'}
            className="w-full rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-gray-950 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {status === 'loading' && <Loader2 size={16} className="animate-spin" />}
            {status === 'loading' ? 'Creating Admin...' : 'Create Admin Account'}
          </button>
        )}
      </div>
    </div>
  )
}
