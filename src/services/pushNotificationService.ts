import { Capacitor } from '@capacitor/core'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { supabase } from '@/lib/supabase'

// ── Notification channel IDs ──
export const NOTIFICATION_CHANNELS = {
  ORDERS: 'orders',
  CHAT: 'chat',
  PAYMENTS: 'payments',
  ANNOUNCEMENTS: 'announcements',
  SYSTEM: 'system',
} as const

export type NotificationChannelId = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS]

// ── Notification types per role ──
export const NOTIFICATION_TYPES = {
  // User notifications
  DELIVERY_ACCEPTED: 'delivery_accepted',
  DELIVERY_REJECTED: 'delivery_rejected',
  DELIVERY_ARRIVED: 'delivery_arrived',
  DELIVERY_STARTED: 'delivery_started',
  DELIVERY_COMPLETED: 'delivery_completed',
  NEW_CHAT_MESSAGE: 'new_chat_message',
  ADMIN_ANNOUNCEMENT: 'admin_announcement',
  PAYMENT_COMPLETED: 'payment_completed',
  REFUND_PROCESSED: 'refund_processed',
  ACCOUNT_APPROVED: 'account_approved',
  ACCOUNT_REJECTED: 'account_rejected',
  // Delivery Partner notifications
  NEW_NEARBY_REQUEST: 'new_nearby_request',
  REQUEST_CANCELLED: 'request_cancelled',
  REQUEST_ASSIGNED: 'request_assigned',
  PAYMENT_CREDITED: 'payment_credited',
  WEEKLY_EARNINGS_SUMMARY: 'weekly_earnings_summary',
  ACCOUNT_SUSPENDED: 'account_suspended',
  // Admin notifications
  NEW_CUSTOMER_REGISTRATION: 'new_customer_registration',
  NEW_DP_REGISTRATION: 'new_dp_registration',
  NEW_REQUEST_CREATED: 'new_request_created',
  ORDER_ACCEPTED: 'order_accepted',
  ORDER_COMPLETED: 'order_completed',
  PAYMENT_FAILURE: 'payment_failure',
  CUSTOMER_COMPLAINT: 'customer_complaint',
  SYSTEM_ERROR: 'system_error',
  DAILY_SUMMARY: 'daily_summary',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

// ── Push payload shape ──
export interface PushNotificationPayload {
  title: string
  body: string
  image?: string
  route?: string
  entityId?: string
  notificationType: NotificationType | string
  createdAt?: string
}

// ── Deep-link route resolver ──
export function resolveNotificationRoute(
  notificationType: string,
  entityId?: string | null,
  role?: string
): string {
  const id = entityId || ''
  switch (notificationType) {
    // User routes — delivery lifecycle opens tracking (request id), not chat
    case NOTIFICATION_TYPES.DELIVERY_ACCEPTED:
    case NOTIFICATION_TYPES.DELIVERY_ARRIVED:
    case NOTIFICATION_TYPES.DELIVERY_STARTED:
    case NOTIFICATION_TYPES.DELIVERY_COMPLETED:
    case 'request_accepted':
    case 'order_status':
    case 'order_confirmed':
    case 'order_delivered':
    case 'delivered':
    case 'task_started':
      return id ? `/app/track/${id}` : '/app'
    case NOTIFICATION_TYPES.NEW_CHAT_MESSAGE:
    case 'chat_message':
    case 'new_chat_message':
      return id ? `/app/chat/${id}` : '/app'
    case NOTIFICATION_TYPES.PAYMENT_COMPLETED:
    case NOTIFICATION_TYPES.REFUND_PROCESSED:
      return `/app/orders`
    case NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT:
      return `/app/notifications`
    // DP routes
    case NOTIFICATION_TYPES.NEW_NEARBY_REQUEST:
    case NOTIFICATION_TYPES.REQUEST_ASSIGNED:
      return `/dp`
    case NOTIFICATION_TYPES.REQUEST_CANCELLED:
      return `/dp/orders`
    case NOTIFICATION_TYPES.PAYMENT_CREDITED:
    case NOTIFICATION_TYPES.WEEKLY_EARNINGS_SUMMARY:
      return `/dp/wallet`
    // Admin routes
    case NOTIFICATION_TYPES.NEW_CUSTOMER_REGISTRATION:
      return `/admin/users`
    case NOTIFICATION_TYPES.NEW_DP_REGISTRATION:
      return `/admin/dps`
    case NOTIFICATION_TYPES.NEW_REQUEST_CREATED:
    case NOTIFICATION_TYPES.ORDER_ACCEPTED:
    case NOTIFICATION_TYPES.ORDER_COMPLETED:
      return `/admin/orders`
    case NOTIFICATION_TYPES.PAYMENT_FAILURE:
      return `/admin/payments`
    default:
      return role === 'admin' ? '/admin' : role === 'dp' ? '/dp' : '/app'
  }
}

// ── Retry helper ──
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 2000): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      console.error(`[Push] Attempt ${attempt + 1}/${maxRetries} failed:`, err?.message)
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
  throw lastError || new Error('Retry exhausted')
}

// ── PushNotificationService ──
class PushNotificationService {
  private static instance: PushNotificationService
  private initialized = false
  private currentToken: string | null = null
  private listenersRegistered = false

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService()
    }
    return PushNotificationService.instance
  }

  /**
   * Initialize FCM, request permission, create notification channels (Android),
   * and register listeners. Called once on app launch.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Non-native platform — skipping FCM init')
      this.initialized = true
      return
    }

    try {
      // Create Android notification channels
      await this.createChannels()

      // Request notification permission (Android 13+)
      await this.requestPermission()

      // Register listeners for token refresh and incoming notifications
      this.subscribeListeners()

      this.initialized = true
      console.log('[Push] Initialized successfully')
    } catch (err: any) {
      console.error('[Push] Initialize failed:', err?.message)
      this.initialized = true // Don't block app launch on failure
    }
  }

  /**
   * Request notification permission (Android 13+ POST_NOTIFICATIONS).
   */
  async requestPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false
    try {
      const { receive } = await FirebaseMessaging.checkPermissions()
      if (receive === 'granted') return true
      const { receive: after } = await FirebaseMessaging.requestPermissions()
      return after === 'granted'
    } catch (err: any) {
      console.error('[Push] Permission request failed:', err?.message)
      return false
    }
  }

  /**
   * Create Android notification channels for different notification categories.
   */
  private async createChannels(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    if (Capacitor.getPlatform() !== 'android') return
    try {
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNELS.ORDERS,
        name: 'Orders',
        description: 'Delivery request and order updates',
        importance: 4, // HIGH
        visibility: 1, // PUBLIC
        vibration: true,
        sound: 'default',
      })
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNELS.CHAT,
        name: 'Chat',
        description: 'New chat messages',
        importance: 3, // DEFAULT
        visibility: 1,
        vibration: true,
        sound: 'default',
      })
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNELS.PAYMENTS,
        name: 'Payments',
        description: 'Payment and refund updates',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: 'default',
      })
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNELS.ANNOUNCEMENTS,
        name: 'Announcements',
        description: 'Admin announcements and broadcasts',
        importance: 4,
        visibility: 1,
        vibration: true,
        sound: 'default',
      })
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNELS.SYSTEM,
        name: 'System',
        description: 'Account and system notifications',
        importance: 3,
        visibility: 1,
        vibration: true,
        sound: 'default',
      })
      console.log('[Push] Notification channels created')
    } catch (err: any) {
      console.error('[Push] Channel creation failed:', err?.message)
    }
  }

  /**
   * Map a notification type to its channel ID.
   */
  getChannelForType(notificationType: string): NotificationChannelId {
    const chatTypes = [NOTIFICATION_TYPES.NEW_CHAT_MESSAGE]
    const paymentTypes = [
      NOTIFICATION_TYPES.PAYMENT_COMPLETED,
      NOTIFICATION_TYPES.REFUND_PROCESSED,
      NOTIFICATION_TYPES.PAYMENT_CREDITED,
      NOTIFICATION_TYPES.PAYMENT_FAILURE,
      NOTIFICATION_TYPES.WEEKLY_EARNINGS_SUMMARY,
    ]
    const announcementTypes = [NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT]
    const systemTypes = [
      NOTIFICATION_TYPES.ACCOUNT_APPROVED,
      NOTIFICATION_TYPES.ACCOUNT_REJECTED,
      NOTIFICATION_TYPES.ACCOUNT_SUSPENDED,
      NOTIFICATION_TYPES.SYSTEM_ERROR,
      NOTIFICATION_TYPES.DAILY_SUMMARY,
    ]
    if (chatTypes.includes(notificationType as any)) return NOTIFICATION_CHANNELS.CHAT
    if (paymentTypes.includes(notificationType as any)) return NOTIFICATION_CHANNELS.PAYMENTS
    if (announcementTypes.includes(notificationType as any)) return NOTIFICATION_CHANNELS.ANNOUNCEMENTS
    if (systemTypes.includes(notificationType as any)) return NOTIFICATION_CHANNELS.SYSTEM
    return NOTIFICATION_CHANNELS.ORDERS
  }

  /**
   * Register the device with Firebase and get the FCM token.
   * Saves/updates the token in Supabase.
   */
  async register(userId: string): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return null
    try {
      const { token } = await FirebaseMessaging.getToken()
      this.currentToken = token
      console.log('[Push] FCM token obtained')
      await this.saveToken(userId, token)
      return token
    } catch (err: any) {
      console.error('[Push] Register failed:', err?.message)
      return null
    }
  }

  /**
   * Save or update the FCM token in Supabase.
   * Uses upsert so old tokens update instead of creating duplicates.
   * Retries on failure.
   */
  async saveToken(userId: string, token: string, platform?: string): Promise<void> {
    const resolvedPlatform = platform || Capacitor.getPlatform()
    await withRetry(async () => {
      const { error } = await supabase
        .from('device_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            platform: resolvedPlatform,
            app_version: (window as any).APP_VERSION || '1.0.0',
            is_active: true,
          },
          { onConflict: 'token' }
        )
      if (error) throw error
      console.log('[Push] Token saved to Supabase')
    })
  }

  /**
   * Delete the FCM token from Firebase and mark it inactive in Supabase.
   */
  async deleteToken(userId?: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    try {
      await FirebaseMessaging.deleteToken()
      if (userId && this.currentToken) {
        await supabase
          .from('device_tokens')
          .update({ is_active: false })
          .eq('token', this.currentToken)
          .eq('user_id', userId)
      }
      this.currentToken = null
      console.log('[Push] Token deleted')
    } catch (err: any) {
      console.error('[Push] Delete token failed:', err?.message)
    }
  }

  /**
   * Unregister the device: delete token and remove listeners.
   */
  async unregister(userId?: string): Promise<void> {
    await this.deleteToken(userId)
    this.listenersRegistered = false
  }

  /**
   * Subscribe to FCM token refresh and notification events.
   * Should be called once after initialize().
   */
  subscribeListeners(): void {
    if (!Capacitor.isNativePlatform()) return
    if (this.listenersRegistered) return
    this.listenersRegistered = true

    // Token refresh — Firebase rotates the token
    FirebaseMessaging.addListener('tokenReceived', async (event) => {
      console.log('[Push] Token refreshed')
      this.currentToken = event.token
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await this.saveToken(session.user.id, event.token).catch((err) =>
          console.error('[Push] Token refresh save failed:', err?.message)
        )
      }
    })

    // Notification received while app is open (foreground)
    FirebaseMessaging.addListener('notificationReceived', async (event) => {
      console.log('[Push] Foreground notification received')
      await this.handleForegroundNotification(event.notification)
    })

    // Notification tapped (app was background/closed or foreground)
    FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      console.log('[Push] Notification tapped')
      this.handleNotificationTap(event.notification)
    })
  }

  /**
   * Display a beautiful local notification when the app is in the foreground.
   * Includes sound and vibration.
   */
  private async handleForegroundNotification(notification: any): Promise<void> {
    try {
      const payload = this.extractPayload(notification)
      const channelId = this.getChannelForType(payload.notificationType)

      // Vibrate
      try {
        await Haptics.impact({ style: ImpactStyle.Medium })
      } catch {}

      // Show local notification
      const notifId = Date.now()
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: payload.title,
            body: payload.body,
            channelId,
            smallIcon: 'ic_notification',
            largeIcon: payload.image || undefined,
            ongoing: false,
            autoCancel: true,
          },
        ],
      })

      // Dispatch a custom event so the React layer can show in-app banners
      window.dispatchEvent(
        new CustomEvent('push-notification-foreground', { detail: payload })
      )
    } catch (err: any) {
      console.error('[Push] Foreground handling failed:', err?.message)
    }
  }

  /**
   * Handle notification tap — navigate to the correct screen via deep link.
   */
  private handleNotificationTap(notification: any): void {
    const payload = this.extractPayload(notification)
    let route = payload.route
    if (!route && payload.notificationType) {
      route = resolveNotificationRoute(payload.notificationType, payload.entityId)
    }
    if (route) {
      window.dispatchEvent(
        new CustomEvent('push-notification-tap', { detail: { ...payload, route } })
      )
    }
  }

  /**
   * Extract the PushNotificationPayload from an FCM notification object.
   */
  private extractPayload(notification: any): PushNotificationPayload {
    const data = notification?.data || {}
    return {
      title: notification?.title || data?.title || 'New notification',
      body: notification?.body || data?.body || '',
      image: data?.image || data?.imageUrl || undefined,
      route: data?.route || undefined,
      entityId: data?.entityId || data?.entity_id || undefined,
      notificationType: data?.notificationType || data?.notification_type || data?.type || '',
      createdAt: data?.createdAt || data?.created_at || new Date().toISOString(),
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance()
