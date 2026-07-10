import { ReactNode, useEffect, useState } from 'react'
import { Loader as Loader2, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, CirclePause as PauseCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Spinner({ size = 24 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-primary-500" />
}

export function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size={32} />
    </div>
  )
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && <div className="mb-4 text-gray-300 dark:text-gray-600">{icon}</div>}
      <p className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/40 dark:text-error-300 animate-slide-up">
      {message}
    </div>
  )
}

export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
    >
      {initials}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: 'Pending', accepted: 'Accepted', confirmed: 'Confirmed',
    shopping: 'Shopping', purchased: 'Purchased', on_the_way: 'On The Way',
    arrived: 'Arrived', delivered: 'Delivered', cash_received: 'Cash Received',
    completed: 'Completed', cancelled: 'Cancelled',
  }
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    accepted: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    confirmed: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    shopping: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
    purchased: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
    on_the_way: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
    arrived: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
    delivered: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    cash_received: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    completed: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300',
  }
  return (
    <span className={`badge ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  )
}

export function ServiceStatusBanner({ cityName }: { cityName?: string | null }) {
  const [status, setStatus] = useState<{ active: boolean; paused: boolean; name: string } | null>(null)

  useEffect(() => {
    if (!cityName) return
    supabase
      .from('cities')
      .select('name, is_active, service_paused')
      .ilike('name', cityName)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStatus({ active: data.is_active, paused: data.service_paused, name: data.name })
      })
  }, [cityName])

  if (!status) return null

  if (!status.active) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/40 dark:text-error-300">
        <AlertTriangle size={16} className="shrink-0" />
        <span><strong>{status.name}</strong> is currently not serviceable. We'll be available soon.</span>
      </div>
    )
  }

  if (status.paused) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-800 dark:bg-warning-950/40 dark:text-warning-300">
        <PauseCircle size={16} className="shrink-0" />
        <span>Service in <strong>{status.name}</strong> is temporarily paused. We'll resume soon.</span>
      </div>
    )
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300">
      <CheckCircle size={16} className="shrink-0" />
      <span>Service is active in <strong>{status.name}</strong>.</span>
    </div>
  )
}

export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? 'currentColor' : 'none'} stroke="currentColor" className={i <= Math.round(value) ? 'text-accent-400' : 'text-gray-300 dark:text-gray-600'}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  )
}
