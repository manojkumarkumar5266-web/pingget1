import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env file.')
}

// Capture the initial URL hash/search BEFORE the Supabase client processes
// and clears it (detectSessionInUrl: true). Used by AuthContext to detect
// password recovery links that fire their event before we subscribe.
export const initialAuthUrl = typeof window !== 'undefined'
  ? { hash: window.location.hash, search: window.location.search }
  : { hash: '', search: '' }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
}

export type ChatRoom = {
  id: string
  request_id: string
  user_id: string
  dp_id: string
  created_at: string
}

export type MessageType = 'text' | 'image' | 'voice' | 'location' | 'quotation' | 'order_summary'

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
