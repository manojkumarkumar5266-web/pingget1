import { kickPushDelivery } from './notify'
import { supabase } from './supabase'

export const DEFAULT_ADVANCE_BOOKING_FEE = 20

/** Admin-set advance booking charge (`advance_settings.confirmation_fee`). Falls back to ₹20. */
export async function getAdvanceBookingFee(): Promise<number> {
  const { data } = await supabase.from('advance_settings').select('confirmation_fee').limit(1).maybeSingle()
  const n = Number(data?.confirmation_fee)
  if (Number.isFinite(n) && n > 0) return n
  return DEFAULT_ADVANCE_BOOKING_FEE
}

export async function getAdvancePaymentDeadlineMinutes(): Promise<number> {
  const { data } = await supabase.from('advance_settings').select('payment_deadline_minutes').limit(1).maybeSingle()
  const n = Number(data?.payment_deadline_minutes)
  return Number.isFinite(n) && n >= 5 ? n : 120
}

/** DP requests the admin booking charge in chat after the customer accepts the quotation. */
export async function requestAdvanceBookingPayment(opts: {
  request: {
    id: string
    user_id: string
    scheduled_date?: string | null
    scheduled_slot?: string | null
    scheduled_time?: string | null
  }
  roomId: string
  dpId: string
  amount?: number
}): Promise<{ paymentId?: string; amount: number; error?: string }> {
  const amount = opts.amount != null && opts.amount > 0 ? opts.amount : await getAdvanceBookingFee()
  const deadlineMinutes = await getAdvancePaymentDeadlineMinutes()
  const paymentDeadline = new Date(Date.now() + deadlineMinutes * 60_000).toISOString()

  const { data: ap, error } = await supabase.from('advance_payments').insert({
    request_id: opts.request.id,
    chat_room_id: opts.roomId,
    dp_id: opts.dpId,
    customer_id: opts.request.user_id,
    amount,
    payment_deadline: paymentDeadline,
    status: 'waiting',
  }).select('id').single()
  if (error || !ap?.id) return { amount, error: error?.message || 'Could not create payment request' }

  await supabase.from('requests').update({
    status: 'waiting_payment',
    advance_payment_id: ap.id,
    payment_deadline: paymentDeadline,
  }).eq('id', opts.request.id)

  await supabase.from('messages').insert({
    chat_room_id: opts.roomId,
    sender_id: opts.dpId,
    message_type: 'advance_payment',
    advance_payment_id: ap.id,
    quotation_data: {
      booking_id: opts.request.id,
      scheduled_date: opts.request.scheduled_date,
      scheduled_time: opts.request.scheduled_slot || opts.request.scheduled_time,
      amount,
      payment_deadline: new Date(paymentDeadline).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      }),
      purpose: 'Advance Booking Charge',
      status: 'waiting',
    },
  })

  await supabase.from('notifications').insert({
    user_id: opts.request.user_id,
    title: 'Pay booking charge',
    body: `Pay ₹${amount} booking charge in chat to confirm this advance booking.`,
    type: 'payment_request',
    related_id: opts.request.id,
  })
  kickPushDelivery()

  return { paymentId: ap.id, amount }
}
