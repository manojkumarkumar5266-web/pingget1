import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pushNotificationService, PushNotificationPayload } from '@/services/pushNotificationService'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context'

export interface UsePushNotificationsResult {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
  registerDevice: () => Promise<void>
  unregisterDevice: () => Promise<void>
}

/**
 * React hook that manages FCM push notification lifecycle:
 * - Initializes the PushNotificationService on mount
 * - Registers the device token when the user is authenticated
 * - Listens for foreground notifications and deep-link taps
 * - Tracks unread notification count via Supabase Realtime
 * - Unregisters on sign out
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const tapHandlerRef = useRef<((e: Event) => void) | null>(null)
  const foregroundHandlerRef = useRef<((e: Event) => void) | null>(null)

  const refreshUnreadCount = useCallback(async () => {
    if (!profile) return
    const table = profile.role === 'admin' ? 'admin_notifications' : 'notifications'
    const query = supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
    if (profile.role !== 'admin') query.eq('user_id', profile.id)
    const { count } = await query
    setUnreadCount(count || 0)
  }, [profile])

  // Initialize service + register token
  useEffect(() => {
    pushNotificationService.initialize()
  }, [])

  useEffect(() => {
    if (!session?.user || !profile) return
    pushNotificationService.register(session.user.id).catch((err) =>
      console.error('[usePush] Register failed:', err?.message)
    )
    refreshUnreadCount()
  }, [session?.user, profile, refreshUnreadCount])

  // Realtime subscription for unread count
  useEffect(() => {
    if (!profile) return
    const table = profile.role === 'admin' ? 'admin_notifications' : 'notifications'
    const channel = supabase
      .channel(`push-notif-count-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => refreshUnreadCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, refreshUnreadCount])

  // Deep-link tap handler
  useEffect(() => {
    if (!profile) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PushNotificationPayload & { route: string }
      if (detail.route) {
        navigate(detail.route)
      }
    }
    tapHandlerRef.current = handler
    window.addEventListener('push-notification-tap', handler)
    return () => window.removeEventListener('push-notification-tap', handler)
  }, [profile, navigate])

  // Foreground notification handler — dispatch snackbar
  useEffect(() => {
    if (!profile) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PushNotificationPayload
      // The layout components already show toasts for request_accepted;
      // this dispatches a generic event for other notification types
      window.dispatchEvent(new CustomEvent('in-app-notification', { detail }))
    }
    foregroundHandlerRef.current = handler
    window.addEventListener('push-notification-foreground', handler)
    return () => window.removeEventListener('push-notification-foreground', handler)
  }, [profile])

  const registerDevice = useCallback(async () => {
    if (session?.user) await pushNotificationService.register(session.user.id)
  }, [session?.user])

  const unregisterDevice = useCallback(async () => {
    if (session?.user) await pushNotificationService.unregister(session.user.id)
  }, [session?.user])

  // Unregister on sign out
  useEffect(() => {
    if (!session && profile === null) {
      pushNotificationService.unregister().catch(() => {})
    }
  }, [session, profile])

  return { unreadCount, refreshUnreadCount, registerDevice, unregisterDevice }
}
