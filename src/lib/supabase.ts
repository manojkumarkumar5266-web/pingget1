import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[PingGET] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in .env (shared by User, DP, and Admin apps).')
}

// Capture the initial URL hash/search BEFORE the Supabase client processes
// and clears it (detectSessionInUrl: true). Used by AuthContext to detect
// password recovery links that fire their event before we subscribe.
export const initialAuthUrl = typeof window !== 'undefined'
  ? { hash: window.location.hash, search: window.location.search }
  : { hash: '', search: '' }

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

export type Profile = {
  id: string
  role: 'user' | 'dp' | 'admin'
  status: 'active' | 'suspended' | 'banned' | 'pending' | 'rejected'
  full_name: string
  email: string | null
  phone: string | null
  photo_url: string | null
  address: string | null
  city: string | null
  pincode: string | null
  gps_lat: number | null
  gps_lng: number | null
  preferred_language: string
  created_at: string
}

export type DeliveryPartner = {
  id: string
  user_id: string
  aadhaar_number: string | null
  emergency_contact: string | null
  vehicle_type: string | null
  driving_license_url: string | null
  upi_id: string | null
  bank_account: string | null
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'deleted'
  is_online: boolean
  rating_avg: number
  rating_count: number
  service_range_meters: number
  current_lat: number | null
  current_lng: number | null
  heading: number | null
  speed_kmh: number | null
  battery_level: number | null
  last_location_at: string | null
  created_at: string
}

export type RequestStatus =
  | 'pending' | 'accepted' | 'confirmed' | 'shopping' | 'purchased'
  | 'on_the_way' | 'arrived' | 'delivered' | 'cash_received' | 'completed' | 'cancelled'
  | 'scheduled' | 'expired' | 'rescheduled'
  // V3 Reservation-based advance request statuses
  | 'searching_dp' | 'dp_reserved' | 'waiting_payment' | 'payment_verified'
  | 'booking_confirmed' | 'task_started' | 'task_completed' | 'no_dp_found'

export type DeliveryRequest = {
  id: string
  user_id: string
  description: string | null
  photo_urls: string[] | null
  voice_note_url: string | null
  preferred_shop: string | null
  pickup_address: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_address: string
  delivery_lat: number | null
  delivery_lng: number | null
  expected_time: string | null
  max_budget: number | null
  special_instructions: string | null
  radius_meters: number
  status: RequestStatus
  accepted_dp_id: string | null
  created_at: string
  delivery_proof_url: string | null
  delivery_proof_by: string | null
  delivery_proof_at: string | null
  dp_lat: number | null
  dp_lng: number | null
  dp_heading: number | null
  dp_last_update: string | null
  order_type: 'instant' | 'advance'
  is_scheduled: boolean
  scheduled_date: string | null
  scheduled_time: string | null
  scheduled_slot: string | null
  scheduled_timestamp: string | null
  request_category: string | null
  shop_name: string | null
  shop_phone: string | null
  shop_address: string | null
  shop_lat: number | null
  shop_lng: number | null
  estimated_task_duration: number | null
  estimated_total_charge: number | null
  charge_breakdown: Record<string, number> | null
  recurring_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  recurring_interval_days: number | null
  recurring_weekday: number | null
  recurring_month_day: number | null
  recurring_parent_id: string | null
  recurring_count: number
  reschedule_count: number
  reschedule_history: Array<Record<string, unknown>> | null
  cancellation_reason: string | null
  cancelled_by: string | null
  cancellation_fee: number | null
  expired_at: string | null
  // V3 reservation fields
  reserved_dp_id: string | null
  reserved_at: string | null
  payment_deadline: string | null
  advance_payment_id: string | null
  task_started_at: string | null
  task_completed_at: string | null
  dp_cancelled_count: number
  search_radius_current: number | null
}

export type AdvancePayment = {
  id: string
  request_id: string
  chat_room_id: string | null
  dp_id: string
  customer_id: string
  amount: number
  payment_deadline: string | null
  status: 'waiting' | 'proof_uploaded' | 'verified' | 'rejected' | 'expired'
  screenshot_url: string | null
  upi_ref: string | null
  transaction_id: string | null
  customer_remarks: string | null
  uploaded_at: string | null
  verified_by: string | null
  verified_at: string | null
  reject_reason: string | null
  admin_override: boolean
  created_at: string
}

export type AdvanceSettings = {
  id: string
  enabled: boolean
  max_advance_days: number
  notification_lead_minutes: number
  business_hours_start: string
  business_hours_end: string
  slot_duration_minutes: number
  advance_booking_fee: number
  platform_fee: number
  min_service_charge: number
  max_service_charge: number
  dp_convenience_charge: number
  emergency_charge: number
  holiday_charge: number
  night_charge: number
  night_charge_start: string
  night_charge_end: string
  peak_hour_charge: number
  peak_hours_start: string
  peak_hours_end: string
  cancellation_cutoff_minutes: number
  reschedule_cutoff_minutes: number
  recurring_enabled: boolean
  weekend_charge: number
  weekend_charge_enabled: boolean
  platform_fee_percent: number
  dp_convenience_percent: number
  cancellation_fee_after_accept: number
  admin_override_cancellation: boolean
  expiry_mode: '30_minutes' | '1_hour' | '2_hours' | '4_hours' | 'end_of_slot' | 'never'
  expiry_custom_minutes: number
  reminder_24h: boolean
  reminder_12h: boolean
  reminder_2h: boolean
  reminder_1h: boolean
  reminder_30m: boolean
  reminder_15m: boolean
  reminder_5m: boolean
  expand_search_radius: boolean
  search_radius_increment_meters: number
  max_search_radius_meters: number
  // V3 fields
  confirmation_fee: number
  reservation_search_radius_meters: number
  payment_deadline_minutes: number
  dp_cancel_research: boolean
  min_advance_buffer_minutes: number
  created_at: string
  updated_at: string
}

export type ChatRoom = {
  id: string
  request_id: string
  user_id: string
  dp_id: string
  created_at: string
}

export type MessageType = 'text' | 'image' | 'voice' | 'location' | 'quotation' | 'order_summary' | 'advance_payment' | 'payment_proof'

export type Message = {
  id: string
  chat_room_id: string
  sender_id: string
  content: string | null
  message_type: MessageType
  attachment_url: string | null
  location_lat: number | null
  location_lng: number | null
  quotation_data: any
  is_read: boolean
  read_at: string | null
  advance_payment_id: string | null
  created_at: string
}

export type Order = {
  id: string
  request_id: string
  user_id: string
  dp_id: string
  items_summary: string | null
  item_cost: number | null
  delivery_charge: number
  commission_pct: number
  commission_amount: number
  dp_earnings: number
  status: string
  completed_at: string | null
  created_at: string
}

export type City = {
  id: string
  name: string
  is_active: boolean
  service_paused: boolean
  commission_pct: number
}

export type Pincode = {
  id: string
  city_id: string
  pincode: string
  area_name: string | null
  is_active: boolean
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
  image_url: string | null
  route: string | null
  entity_id: string | null
  notification_type: string | null
  read_at: string | null
  deleted_at: string | null
}

export type DeviceToken = {
  id: string
  user_id: string
  token: string
  platform: string
  app_version: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type NotificationDeliveryLog = {
  id: string
  notification_id: string | null
  device_token_id: string | null
  token: string | null
  status: string
  error_message: string | null
  fcm_message_id: string | null
  created_at: string
}

export type Wallet = {
  id: string
  dp_user_id: string
  total_earnings: number
  commission_due: number
  commission_paid: number
  outstanding_balance: number
}

export type Rating = {
  id: string
  order_id: string
  rater_id: string
  rated_id: string
  stars: number
  review: string | null
  created_at: string
}

export type CommissionPayment = {
  id: string
  dp_user_id: string
  amount: number
  payment_method: string | null
  transaction_id: string | null
  status: string
  created_at: string
}

export type DpCommissionReceipt = {
  id: string
  dp_user_id: string
  amount: number
  upi_ref: string
  screenshot_url: string | null
  status: 'submitted' | 'confirmed' | 'rejected'
  reject_reason: string | null
  submitted_at: string
  confirmed_at: string | null
  confirmed_by: string | null
}
