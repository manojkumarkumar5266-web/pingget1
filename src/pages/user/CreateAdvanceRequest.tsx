import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, type AdvanceSettings } from '../../lib/supabase'
import { kickPushDelivery } from '../../lib/notify'
import { ErrorBanner } from '../../components/ui'
import PremiumCalendar from '../../components/PremiumCalendar'
import PremiumTimeSlotSelector from '../../components/PremiumTimeSlotSelector'
import RecurringSelector, { type RecurringType } from '../../components/RecurringSelector'
import {
  ArrowLeft, Camera, Mic, MicOff, X, Play, Pause, Store, Package, Trash2, Plus,
  MapPin, Navigation, Home, Edit2, ShoppingBag, Calendar, Clock, Tag,
  IndianRupee, FileText, ChevronRight, Check, ChevronLeft, Phone, AlertCircle,
  Repeat, Search,
} from 'lucide-react'
import { getCategoryImage } from '../../lib/customImages'
import { getSelectedDeliveryAddress } from '../../components/AddressPicker'
import { TopChrome, IconButton, CTA, Surface, SectionLabel } from '../../design/primitives'
import { pg } from '../../design/tokens'
import { uploadMediaFile } from '../../lib/uploadMedia'
import { userRadiusMeters } from '../../lib/searchRadius'

type SavedAddress = {
  id: string
  label: string
  house_no: string | null
  flat_no: string | null
  building_name: string | null
  landmark: string | null
  street: string | null
  area: string | null
  city: string | null
  pincode: string | null
  lat: number | null
  lng: number | null
}

const REQUEST_CATEGORIES = [
  { name: 'Shopping' },
  { name: 'Pickup' },
  { name: 'Delivery' },
  { name: 'Documents' },
  { name: 'Medicine' },
  { name: 'Food' },
  { name: 'Flowers' },
  { name: 'Gifts' },
  { name: 'Groceries' },
  { name: 'Laundry' },
  { name: 'Courier' },
  { name: 'Personal Assistant' },
  { name: 'Custom Request' },
]

const TASK_DURATIONS = [15, 30, 45, 60, 90, 120] // kept for charge calc fallback; UI removed

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function generateTimeSlots(start: string, end: string, durationMin: number): { key: string; label: string; start: string; end: string }[] {
  const startMin = parseTimeToMinutes(start)
  const endMin = parseTimeToMinutes(end)
  const slots: { key: string; label: string; start: string; end: string }[] = []
  for (let t = startMin; t + durationMin <= endMin; t += durationMin) {
    const s = formatMinutesToTime(t)
    const e = formatMinutesToTime(t + durationMin)
    slots.push({ key: `${s}-${e}`, label: `${s} - ${e}`, start: s, end: e })
  }
  return slots
}

function isNightTime(slotStart: string, nightStart: string, nightEnd: string): boolean {
  const s = parseTimeToMinutes(slotStart)
  const ns = parseTimeToMinutes(nightStart)
  const ne = parseTimeToMinutes(nightEnd)
  if (ns < ne) {
    return s >= ns && s < ne
  }
  return s >= ns || s < ne
}

function isPeakTime(slotStart: string, peakStart: string, peakEnd: string): boolean {
  const s = parseTimeToMinutes(slotStart)
  const ps = parseTimeToMinutes(peakStart)
  const pe = parseTimeToMinutes(peakEnd)
  if (ps < pe) {
    return s >= ps && s < pe
  }
  return s >= ps || s < pe
}

export default function CreateAdvanceRequest() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<AdvanceSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const [step, setStep] = useState(1)
  const [category, setCategory] = useState<string | null>(null)
  const [customDescription, setCustomDescription] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [shopName, setShopName] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [shopLat, setShopLat] = useState<number | null>(null)
  const [shopLng, setShopLng] = useState<number | null>(null)
  const [taskDuration, setTaskDuration] = useState<number>(30)
  /** Multi-category drafts saved from category popup sheets */
  type CatDraft = {
    category: string
    description: string
    selectedDate: Date | null
    selectedSlot: string | null
    photoFiles: File[]
    photoPreviews: string[]
    voiceBlob: Blob | null
    voiceDuration: number
  }
  const [categoryDrafts, setCategoryDrafts] = useState<CatDraft[]>(() => {
    try {
      const raw = sessionStorage.getItem('adv_category_drafts_meta')
      if (!raw) return []
      const parsed = JSON.parse(raw) as Omit<CatDraft, 'photoFiles' | 'photoPreviews' | 'voiceBlob'>[]
      return parsed.map(p => ({ ...p, photoFiles: [], photoPreviews: [], voiceBlob: null, selectedDate: p.selectedDate ? new Date(p.selectedDate) : null }))
    } catch { return [] }
  })
  const [sheetCategory, setSheetCategory] = useState<string | null>(null)

  const [description, setDescription] = useState('')
  const [maxBudget, setMaxBudget] = useState('')

  const [recurringType, setRecurringType] = useState<RecurringType>('none')
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(1)
  const [recurringWeekday, setRecurringWeekday] = useState<number | null>(null)
  const [recurringMonthDay, setRecurringMonthDay] = useState<number | null>(1)
  const [recurringMaxOccurrences, setRecurringMaxOccurrences] = useState(15)

  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [recording, setRecording] = useState(false)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [playingVoice, setPlayingVoice] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceUrlRef = useRef<string | null>(null)

  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addrHouse, setAddrHouse] = useState('')
  const [addrFlat, setAddrFlat] = useState('')
  const [addrBuilding, setAddrBuilding] = useState('')
  const [addrLandmark, setAddrLandmark] = useState('')
  const [addrStreet, setAddrStreet] = useState('')
  const [addrArea, setAddrArea] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrPincode, setAddrPincode] = useState('')
  const [addrLat, setAddrLat] = useState<number | null>(null)
  const [addrLng, setAddrLng] = useState<number | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [showAddressList, setShowAddressList] = useState(false)
  const MAX_ADDRESSES = 5

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('advance_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as AdvanceSettings)
        setSettingsLoading(false)
      })
  }, [])

  const fetchAddresses = async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setAddresses((data as SavedAddress[]) || [])
    if (data && data.length > 0 && !selectedAddressId) setSelectedAddressId(data[0].id)
  }
  useEffect(() => { fetchAddresses() }, [profile?.id])

  // Step 3 (old shop/items page) is retired — bounce to review
  useEffect(() => {
    if (step === 3) setStep(4)
  }, [step])

  const selectedAddress = addresses.find(a => a.id === selectedAddressId)
  const fullAddressText = selectedAddress
    ? [selectedAddress.house_no, selectedAddress.flat_no, selectedAddress.building_name, selectedAddress.street, selectedAddress.area, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(', ')
    : null
  const shortAddressText = selectedAddress
    ? [selectedAddress.house_no, selectedAddress.flat_no, selectedAddress.building_name, selectedAddress.area].filter(Boolean).join(', ')
    : null

  const resetAddrForm = () => {
    setAddrHouse(''); setAddrFlat(''); setAddrBuilding(''); setAddrLandmark('')
    setAddrStreet(''); setAddrArea(''); setAddrCity(''); setAddrPincode('')
    setAddrLat(null); setAddrLng(null); setEditingAddressId(null)
  }

  const startEditAddress = (addr: SavedAddress) => {
    setEditingAddressId(addr.id)
    setAddrHouse(addr.house_no || ''); setAddrFlat(addr.flat_no || '')
    setAddrBuilding(addr.building_name || ''); setAddrLandmark(addr.landmark || '')
    setAddrStreet(addr.street || ''); setAddrArea(addr.area || '')
    setAddrCity(addr.city || ''); setAddrPincode(addr.pincode || '')
    setAddrLat(addr.lat); setAddrLng(addr.lng)
    setShowAddressList(false); setShowAddressForm(true)
  }

  const deleteAddress = async (addrId: string) => {
    if (!profile?.id) return
    await supabase.from('addresses').delete().eq('id', addrId).eq('user_id', profile.id)
    if (selectedAddressId === addrId) setSelectedAddressId(null)
    await fetchAddresses()
  }

  const saveAddress = async () => {
    if (!profile?.id) return
    if (!addrHouse.trim() && !addrFlat.trim() && !addrBuilding.trim()) { setError('Please enter at least a house/flat/building'); return }
    if (!addrPincode || addrPincode.length !== 6) { setError('Please enter a 6-digit pincode'); return }
    if (!editingAddressId && addresses.length >= MAX_ADDRESSES) {
      setError(`You can save up to ${MAX_ADDRESSES} addresses. Please delete or edit an existing one to add a new address.`)
      return
    }
    setSavingAddress(true)
    const label = addrHouse || addrFlat || addrBuilding || 'Address'
    const payload = {
      user_id: profile.id, label,
      house_no: addrHouse.trim() || null, flat_no: addrFlat.trim() || null,
      building_name: addrBuilding.trim() || null, landmark: addrLandmark.trim() || null,
      street: addrStreet.trim() || null, area: addrArea.trim() || null,
      city: addrCity.trim() || null, pincode: addrPincode,
      lat: addrLat, lng: addrLng,
    }
    let data: SavedAddress | null = null
    if (editingAddressId) {
      const { data: updated, error: updErr } = await supabase.from('addresses').update(payload).eq('id', editingAddressId).eq('user_id', profile.id).select().single()
      if (updErr) { setSavingAddress(false); setError(updErr.message); return }
      data = updated as SavedAddress
    } else {
      const { data: inserted, error: insErr } = await supabase.from('addresses').insert(payload).select().single()
      if (insErr) { setSavingAddress(false); setError(insErr.message); return }
      data = inserted as SavedAddress
    }
    setSavingAddress(false)
    if (data) {
      await fetchAddresses()
      setSelectedAddressId(data.id)
      setShowAddressForm(false)
      resetAddrForm()
    }
  }

  const pickShopLocation = () => {
    if (!navigator.geolocation) { setError('Location not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setShopLat(pos.coords.latitude); setShopLng(pos.coords.longitude); setError(null) },
      () => setError('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const pickAddrLocation = () => {
    if (!navigator.geolocation) { setError('Location not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setAddrLat(pos.coords.latitude); setAddrLng(pos.coords.longitude); setError(null) },
      () => setError('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }
  const removePhoto = (idx: number) => {
    setPhotoPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx) })
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const startRecording = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) { setError('Microphone not supported.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr; audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current)
        voiceUrlRef.current = URL.createObjectURL(blob)
        setVoiceBlob(blob); stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); setRecording(true); setVoiceDuration(0)
      durationTimerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000)
    } catch (err: any) { setError('Could not start recording: ' + (err.message || err)) }
  }
  const stopRecording = () => {
    mediaRecorderRef.current?.stop(); setRecording(false)
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null }
  }
  const playVoice = () => {
    if (!voiceUrlRef.current) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlayingVoice(false); return }
    const audio = new Audio(voiceUrlRef.current); audioRef.current = audio; setPlayingVoice(true)
    audio.onended = () => { setPlayingVoice(false); audioRef.current = null }
    audio.play().catch(() => { setPlayingVoice(false); audioRef.current = null })
  }
  const clearVoice = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingVoice(false); setVoiceBlob(null); setVoiceDuration(0)
    if (voiceUrlRef.current) { URL.revokeObjectURL(voiceUrlRef.current); voiceUrlRef.current = null }
  }

  // Calendar logic — today is now selectable
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDays = settings?.max_advance_days ?? 7
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + maxDays)
  const bufferMinutes = settings?.min_advance_buffer_minutes ?? 30

  const getSelectableDates = (): Date[] => {
    const dates: Date[] = []
    for (let i = 0; i <= maxDays; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      dates.push(d)
    }
    return dates
  }
  const selectableDates = getSelectableDates()

  // Customer advance booking: available slots 5:00 AM – 11:00 PM
  const timeSlots = generateTimeSlots(
    '05:00',
    '23:00',
    settings?.slot_duration_minutes || 30,
  )

  // Charge calculation — enhanced with weekend charge + percentage support
  const calculateCharges = (): { breakdown: Record<string, number>; total: number } => {
    if (!settings) return { breakdown: {}, total: 0 }
    const breakdown: Record<string, number> = {
      'Advance Booking Fee': settings.advance_booking_fee,
      'Platform Fee': settings.platform_fee,
      'DP Convenience': settings.dp_convenience_charge,
    }
    let total = settings.advance_booking_fee + settings.platform_fee + settings.dp_convenience_charge

    // Percentage-based platform fee (on top of fixed)
    if (settings.platform_fee_percent > 0 && maxBudget) {
      const pctFee = (parseFloat(maxBudget) * settings.platform_fee_percent) / 100
      breakdown['Platform Fee (%)'] = pctFee
      total += pctFee
    }
    // Percentage-based DP convenience (on top of fixed)
    if (settings.dp_convenience_percent > 0 && maxBudget) {
      const pctConv = (parseFloat(maxBudget) * settings.dp_convenience_percent) / 100
      breakdown['DP Convenience (%)'] = pctConv
      total += pctConv
    }

    if (selectedSlot) {
      const slotStart = selectedSlot.split('-')[0]
      if (isNightTime(slotStart, settings.night_charge_start, settings.night_charge_end) && settings.night_charge > 0) {
        breakdown['Night Charge'] = settings.night_charge
        total += settings.night_charge
      }
      if (isPeakTime(slotStart, settings.peak_hours_start, settings.peak_hours_end) && settings.peak_hour_charge > 0) {
        breakdown['Peak Hour Charge'] = settings.peak_hour_charge
        total += settings.peak_hour_charge
      }
    }

    // Weekend charge
    if (settings.weekend_charge_enabled && settings.weekend_charge > 0 && selectedDate) {
      const day = selectedDate.getDay()
      if (day === 0 || day === 6) {
        breakdown['Weekend Charge'] = settings.weekend_charge
        total += settings.weekend_charge
      }
    }

    if (settings.emergency_charge > 0) {
      breakdown['Emergency Charge'] = settings.emergency_charge
      total += settings.emergency_charge
    }
    if (settings.holiday_charge > 0) {
      breakdown['Holiday Charge'] = settings.holiday_charge
      total += settings.holiday_charge
    }
    if (total < settings.min_service_charge) {
      breakdown['Minimum Adjustment'] = settings.min_service_charge - total
      total = settings.min_service_charge
    }
    if (total > settings.max_service_charge) {
      const excess = total - settings.max_service_charge
      if (breakdown['Minimum Adjustment']) breakdown['Minimum Adjustment'] -= excess
      else breakdown['Max Cap Adjustment'] = -excess
      total = settings.max_service_charge
    }
    return { breakdown, total }
  }
  const charges = calculateCharges()

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const canProceedStep1 = categoryDrafts.length > 0 || !!category
  const canProceedStep2 = !!selectedDate && !!selectedSlot
  const canProceedStep3 = true // address from Home; details already in category drafts

  /** Admin toggle — default ON when settings row missing the flag */
  const recurringEnabled = settings?.recurring_enabled !== false

  const onRecurringTypeChange = (t: RecurringType) => {
    setRecurringType(t)
    if (t === 'daily') setRecurringMaxOccurrences(15)
    else if (t === 'weekly') setRecurringMaxOccurrences(4)
    else if (t === 'monthly') setRecurringMaxOccurrences(3)
    else if (t === 'custom') setRecurringMaxOccurrences(15)
  }

  const recurringSelectorProps = {
    recurringType,
    onTypeChange: onRecurringTypeChange,
    intervalDays: recurringIntervalDays,
    onIntervalChange: setRecurringIntervalDays,
    weekday: recurringWeekday,
    onWeekdayChange: setRecurringWeekday,
    monthDay: recurringMonthDay,
    onMonthDayChange: setRecurringMonthDay,
    maxOccurrences: recurringMaxOccurrences,
    onMaxOccurrencesChange: setRecurringMaxOccurrences,
    enabled: recurringEnabled,
  } as const

  const handleSubmit = async () => {
    setError(null)
    const homeAddr = await getSelectedDeliveryAddress(profile!.id)
    const deliveryText = homeAddr?.text || fullAddressText
    if (!deliveryText) {
      setError('Please select a delivery address on the Home page first')
      // Stay on review — address comes from Home; do not bounce to obsolete step 3
      if (step !== 4) setStep(4)
      return
    }

    const drafts = categoryDrafts.length > 0 ? categoryDrafts : null
    const primary = drafts?.[0]
    const cat = primary?.category || category
    const date = primary?.selectedDate || selectedDate
    const slot = primary?.selectedSlot || selectedSlot
    if (!cat) { setError('Please select a category'); return }
    if (!date || !slot) {
      setError('Please select date and time slot')
      if (step === 1) setStep(2)
      return
    }
    if (!settings) { setError('Settings not loaded yet. Please wait.'); return }

    const fullDescription = drafts
      ? drafts.map(d => `[${d.category}]\n${d.description}\nScheduled: ${d.selectedDate ? formatDateKey(d.selectedDate) : ''} ${d.selectedSlot || ''}`).join('\n\n')
      : [
          category === 'Custom Request' && customDescription.trim() ? customDescription.trim() : null,
          description.trim() || null,
        ].filter(Boolean).join('\n')
    if (!fullDescription.trim()) { setError('Please describe your task or add items'); return }

    setLoading(true)
    try {
      if (recording) stopRecording()
      const ts = Date.now()
      const photoUrls: string[] = []
      const filesToUpload = primary?.photoFiles?.length ? primary.photoFiles : photoFiles
      for (let i = 0; i < filesToUpload.length; i++) {
        try {
          photoUrls.push(await uploadMediaFile(filesToUpload[i], `requests/${profile!.id}/${ts}-photo-${i}`))
        } catch (upErr: any) {
          throw new Error(upErr?.message || 'Photo upload failed. Please try again.')
        }
      }
      const voiceSrc = primary?.voiceBlob || voiceBlob
      let voiceUrl: string | null = null
      if (voiceSrc) {
        try {
          voiceUrl = await uploadMediaFile(voiceSrc, `requests/${profile!.id}/${ts}-voice`, {
            compress: false,
            contentType: voiceSrc.type || 'audio/webm',
          })
        } catch (upErr: any) {
          throw new Error(upErr?.message || 'Voice upload failed. Please try again.')
        }
      }

      const slotStart = slot.split('-')[0]
      const [sh, sm] = slotStart.split(':').map(Number)
      const scheduledTimestamp = new Date(date)
      scheduledTimestamp.setHours(sh, sm, 0, 0)

      const bufferMs = bufferMinutes * 60 * 1000
      if (scheduledTimestamp.getTime() < Date.now() + bufferMs) {
        setError('The selected time slot is no longer available. Please choose a future time slot.')
        setLoading(false)
        if (step === 1) setStep(2)
        return
      }

      const insertPayload: Record<string, unknown> = {
        user_id: profile!.id,
        description: fullDescription,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        voice_note_url: voiceUrl,
        preferred_shop: shopName.trim() || null,
        pickup_address: shopAddress.trim() || null,
        pickup_lat: shopLat,
        pickup_lng: shopLng,
        delivery_address: deliveryText,
        delivery_lat: homeAddr?.lat ?? selectedAddress?.lat ?? null,
        delivery_lng: homeAddr?.lng ?? selectedAddress?.lng ?? null,
        max_budget: maxBudget ? parseFloat(maxBudget) : null,
        special_instructions: null,
        radius_meters: userRadiusMeters(),
        status: 'searching_dp',
        order_type: 'advance',
        is_scheduled: true,
        scheduled_date: formatDateKey(date),
        scheduled_time: slotStart,
        scheduled_slot: slot,
        scheduled_timestamp: scheduledTimestamp.toISOString(),
        request_category: drafts ? drafts.map(d => d.category).join(', ') : cat,
        shop_name: shopName.trim() || null,
        shop_phone: shopPhone.trim() || null,
        shop_address: shopAddress.trim() || null,
        shop_lat: shopLat,
        shop_lng: shopLng,
        estimated_task_duration: taskDuration,
        estimated_total_charge: charges.total,
        charge_breakdown: charges.breakdown,
        recurring_type: recurringType,
        recurring_interval_days: recurringType === 'custom' ? recurringIntervalDays : null,
        recurring_weekday: recurringType === 'weekly' ? recurringWeekday : null,
        recurring_month_day: recurringType === 'monthly' ? recurringMonthDay : null,
        recurring_count: 0,
      }
      // Only send when recurring — avoids failing if migration not applied yet
      if (recurringType !== 'none') {
        insertPayload.recurring_max_occurrences = recurringMaxOccurrences
      }

      let { data: inserted, error: insertError } = await supabase
        .from('requests')
        .insert(insertPayload)
        .select('id')
        .single()

      // Retry without recurring_max_occurrences if column missing on older DB
      if (
        insertError &&
        recurringType !== 'none' &&
        /recurring_max_occurrences/i.test(insertError.message || '')
      ) {
        delete insertPayload.recurring_max_occurrences
        const retry = await supabase.from('requests').insert(insertPayload).select('id').single()
        inserted = retry.data
        insertError = retry.error
      }

      if (insertError) throw insertError
      if (!inserted?.id) throw new Error('Could not create request. Please try again.')

      sessionStorage.removeItem('adv_category_drafts_meta')
      await supabase.from('notifications').insert({
        user_id: profile!.id,
        title: 'Advance Request Created',
        body: `Your advance request is scheduled. Searching for a delivery partner.`,
        type: 'advance_request_created',
        related_id: inserted.id,
      })
      kickPushDelivery()

      navigate(`/app/scanning/${inserted.id}`)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10" style={{ borderTopColor: '#0C8A3E' }} />
      </div>
    )
  }

  if (settings && !settings.enabled) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: pg.bg }}>
        <TopChrome
          left={
            <IconButton onClick={() => navigate('/app')}>
              <ArrowLeft size={20} />
            </IconButton>
          }
          center={<p className="text-base font-extrabold">Advance Request</p>}
        />
        <div className="flex flex-1 items-center justify-center px-6">
          <Surface className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto mb-4" style={{ color: pg.text4 }} />
            <p style={{ color: pg.text3 }}>Advance Requests are currently disabled by the admin.</p>
          </Surface>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col" style={{ background: pg.bg }}>
      <TopChrome
        left={
          <IconButton onClick={() => {
            if (step === 1) {
              navigate('/app')
              return
            }
            // Skip obsolete shop/items step (step 3) — category sheet already collects notes/date
            if (step === 4 && categoryDrafts.length > 0) {
              setStep(1)
              return
            }
            if (step === 4) {
              setStep(2)
              return
            }
            if (step === 3) {
              setStep(2)
              return
            }
            setStep(step - 1)
          }}>
            {step === 1 ? <ArrowLeft size={20} /> : <ChevronLeft size={20} />}
          </IconButton>
        }
        center={
          <div>
            <p className="text-base font-extrabold">Advance Request</p>
            <p className="text-[10px]" style={{ color: pg.text3 }}>Up to {maxDays} days ahead</p>
          </div>
        }
        right={
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: s === step ? 20 : 6,
                  background: s <= step ? pg.lime : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        }
      />

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-32 pt-2">
        {/* STEP 1: Category Selection — images + popup sheet */}
        {step === 1 && (
          <div className="space-y-5">
            {error && <ErrorBanner message={error} />}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>What do you need done?</p>
              <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Choose a category for your scheduled task</p>
              <div className="grid grid-cols-3 gap-2">
                {REQUEST_CATEGORIES.map(cat => {
                  const saved = categoryDrafts.find(d => d.category === cat.name)
                  const selected = !!(saved || category === cat.name)
                  return (
                    <button key={cat.name} type="button" onClick={() => {
                      setCategory(cat.name)
                      setSheetCategory(cat.name)
                      if (saved) {
                        setDescription(saved.description)
                        setSelectedDate(saved.selectedDate)
                        setSelectedSlot(saved.selectedSlot)
                      } else {
                        setDescription(cat.name === 'Custom Request' ? customDescription : '')
                        setSelectedDate(null)
                        setSelectedSlot(null)
                      }
                    }}
                      className="relative text-left transition active:scale-[0.98]"
                      style={selected
                        ? { background: 'rgba(196,214,0,0.1)', border: '1.5px solid rgba(196,214,0,0.45)', borderRadius: 14, padding: 6 }
                        : { background: pg.surface, border: `1px solid ${pg.line}`, borderRadius: 14, padding: 6 }}>
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <img
                          src={getCategoryImage(cat.name)}
                          alt={cat.name}
                          className="h-full w-full object-contain"
                          style={{ background: 'transparent', display: 'block', imageRendering: 'auto' }}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      </div>
                      <span className="mt-1.5 block text-center text-[10px] font-extrabold leading-tight" style={{ color: selected ? pg.lime : pg.text2 }}>
                        {cat.name}
                      </span>
                      {saved && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: pg.lime }}>
                          <Check size={11} style={{ color: pg.limeText }} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {categoryDrafts.length > 0 && (
              <div className="rounded-2xl p-3" style={{ background: 'rgba(196,214,0,0.08)', border: '1px solid rgba(196,214,0,0.2)' }}>
                <p className="text-xs font-bold" style={{ color: '#0C8A3E' }}>{categoryDrafts.length} categor{categoryDrafts.length === 1 ? 'y' : 'ies'} saved</p>
                <p className="text-[11px] text-black/50 mt-0.5">
                  Tap a category to edit · After date &amp; time, choose <span style={{ color: '#0C8A3E' }}>Recurring booking</span> (daily / monthly) · then Review
                </p>
              </div>
            )}

            {/* Category detail half-sheet */}
            {sheetCategory && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#000000]/60" onClick={() => setSheetCategory(null)}>
                <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl p-5 space-y-4" style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={getCategoryImage(sheetCategory)} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      <h3 className="text-base font-bold text-[#F5F7F6]">{sheetCategory}</h3>
                    </div>
                    <button type="button" onClick={() => setSheetCategory(null)} className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <X size={16} className="text-black/50" />
                    </button>
                  </div>

                  <div className="rounded-2xl p-3 relative" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold" style={{ color: '#0C8A3E' }}>Notes</p>
                      <div className="flex gap-2">
                        <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
                        <button type="button" onClick={() => photoInputRef.current?.click()} className="rounded-lg px-2 py-1 text-[11px] font-bold" style={{ background: 'rgba(196,214,0,0.15)', color: '#0C8A3E' }}>
                          <Camera size={12} className="inline mr-1" />Photo
                        </button>
                        {recording ? (
                          <button type="button" onClick={stopRecording} className="rounded-lg px-2 py-1 text-[11px] font-bold text-red-400">Stop</button>
                        ) : (
                          <button type="button" onClick={startRecording} className="rounded-lg px-2 py-1 text-[11px] font-bold" style={{ background: 'rgba(196,214,0,0.15)', color: '#0C8A3E' }}>
                            <Mic size={12} className="inline mr-1" />Voice
                          </button>
                        )}
                      </div>
                    </div>
                    {photoPreviews.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {photoPreviews.map((p, i) => (
                          <div key={i} className="relative">
                            <img src={p} alt="" className="h-12 w-12 rounded-lg object-cover" />
                            <button type="button" onClick={() => removePhoto(i)} className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center"><X size={8} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {voiceBlob && (
                      <div className="mb-2 text-xs" style={{ color: '#0C8A3E' }}>Voice note attached · {Math.floor(voiceDuration / 60)}:{String(voiceDuration % 60).padStart(2, '0')}</div>
                    )}
                    <textarea className="input min-h-[100px] resize-none text-sm" value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Describe this task…" />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>Select date & time</p>
                    <PremiumCalendar selectedDate={selectedDate} onSelect={setSelectedDate} maxDays={maxDays} />
                    {selectedDate && settings && (
                      <div className="mt-3">
                        <PremiumTimeSlotSelector
                          slots={timeSlots}
                          selectedSlot={selectedSlot}
                          onSelect={setSelectedSlot}
                          selectedDate={selectedDate}
                          nightStart={settings.night_charge_start}
                          nightEnd={settings.night_charge_end}
                          peakStart={settings.peak_hours_start}
                          peakEnd={settings.peak_hours_end}
                          bufferMinutes={bufferMinutes}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!description.trim() && photoFiles.length === 0 && !voiceBlob) {
                        setError('Add notes, photo, or voice for this category'); return
                      }
                      if (!selectedDate || !selectedSlot) {
                        setError('Select date and time slot'); return
                      }
                      const draft: CatDraft = {
                        category: sheetCategory,
                        description: description.trim(),
                        selectedDate,
                        selectedSlot,
                        photoFiles: [...photoFiles],
                        photoPreviews: [...photoPreviews],
                        voiceBlob,
                        voiceDuration,
                      }
                      setCategoryDrafts(prev => {
                        const next = [...prev.filter(d => d.category !== sheetCategory), draft]
                        sessionStorage.setItem('adv_category_drafts_meta', JSON.stringify(next.map(d => ({
                          category: d.category, description: d.description,
                          selectedDate: d.selectedDate?.toISOString() || null,
                          selectedSlot: d.selectedSlot, voiceDuration: d.voiceDuration,
                        }))))
                        return next
                      })
                      setCategory(sheetCategory)
                      setSheetCategory(null)
                      setError(null)
                      // clear media for next category (keep date/slot + recurring for next edit)
                      setPhotoFiles([]); setPhotoPreviews([]); setVoiceBlob(null); setVoiceDuration(0)
                      setDescription('')
                    }}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold"
                    style={{ background: '#0C8A3E', color: '#050505' }}
                  >
                    Save & choose another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Date & Time */}
        {step === 2 && (
          <div className="space-y-5 animate-slide-up">
            {error && <ErrorBanner message={error} />}
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>Select Date & Time</p>
            <PremiumCalendar selectedDate={selectedDate} onSelect={setSelectedDate} maxDays={maxDays} />

            {selectedDate && settings && (
              <PremiumTimeSlotSelector
                slots={timeSlots}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
                selectedDate={selectedDate}
                nightStart={settings.night_charge_start}
                nightEnd={settings.night_charge_end}
                peakStart={settings.peak_hours_start}
                peakEnd={settings.peak_hours_end}
                bufferMinutes={bufferMinutes}
              />
            )}
          </div>
        )}

        {/* STEP 3 removed from flow (shop/items form was obsolete; category sheet covers notes) */}
        {step === 3 && (
          <div className="py-8 text-center text-sm" style={{ color: pg.text3 }}>
            Continuing to review…
          </div>
        )}

        {/* STEP 4: Review & Charges */}
        {step === 4 && (
          <div className="space-y-5 animate-slide-up">
            {/* Summary Timeline */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>Request Summary</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(196,214,0,0.12)' }}>
                    <Tag size={14} style={{ color: '#0C8A3E' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Category</p>
                    <p className="text-sm font-semibold text-[#F5F7F6]">{category}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(196,214,0,0.12)' }}>
                    <Calendar size={14} style={{ color: '#0C8A3E' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Date</p>
                    <p className="text-sm font-semibold text-[#F5F7F6]">
                      {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(196,214,0,0.12)' }}>
                    <Clock size={14} style={{ color: '#0C8A3E' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Time Slot</p>
                    <p className="text-sm font-semibold text-[#F5F7F6]">{selectedSlot?.replace('-', ' to ')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(196,214,0,0.12)' }}>
                    <Home size={14} style={{ color: '#0C8A3E' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Delivery Address</p>
                    <p className="text-sm font-semibold text-[#F5F7F6] truncate">{shortAddressText || fullAddressText}</p>
                  </div>
                </div>
                {shopName && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(196,214,0,0.12)' }}>
                      <Store size={14} style={{ color: '#0C8A3E' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Shop</p>
                      <p className="text-sm font-semibold text-[#F5F7F6]">{shopName}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(196,214,0,0.12)' }}>
                    <Clock size={14} style={{ color: '#0C8A3E' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Estimated Duration</p>
                    <p className="text-sm font-semibold text-[#F5F7F6]">{taskDuration < 60 ? `${taskDuration} minutes` : `${taskDuration / 60} hour`}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recurring — always editable on review (most users skip step 2) */}
            {recurringEnabled ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>
                  Recurring booking (optional)
                </p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Repeat this advance task daily, weekly, monthly, or every N days (e.g. 15 days).
                </p>
                <RecurringSelector {...recurringSelectorProps} />
              </div>
            ) : (
              <div className="rounded-2xl p-3 text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>
                Recurring booking is currently turned off by admin (Advance Request Settings).
              </div>
            )}

            {recurringType !== 'none' && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(12,138,62,0.1)', border: '1px solid rgba(12,138,62,0.25)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Repeat size={14} style={{ color: '#0C8A3E' }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>Selected recurring plan</p>
                </div>
                <p className="text-sm font-semibold text-[#F5F7F6]">
                  {recurringType === 'daily' && `Daily for ${recurringMaxOccurrences} days`}
                  {recurringType === 'weekly' && `Every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][recurringWeekday ?? 1]} · ${recurringMaxOccurrences} weeks`}
                  {recurringType === 'monthly' && `Day ${recurringMonthDay} each month · ${recurringMaxOccurrences} months`}
                  {recurringType === 'custom' && `Every ${recurringIntervalDays} days · ${recurringMaxOccurrences} times`}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Your partner is notified for each occurrence. Discuss and pay for the series in advance when they accept.
                </p>
              </div>
            )}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(196,214,0,0.06)', border: '1px solid rgba(196,214,0,0.2)' }}>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#0C8A3E' }}>Estimated Charges</p>
              <div className="space-y-2">
                {Object.entries(charges.breakdown).map(([key, val]) => (
                  val !== 0 && (
                    <div key={key} className="flex justify-between text-sm">
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{key}</span>
                      <span className="font-semibold text-[#F5F7F6]">₹{val.toFixed(2)}</span>
                    </div>
                  )
                ))}
                <div className="flex justify-between pt-2 mt-2" style={{ borderTop: '1px solid rgba(196,214,0,0.2)' }}>
                  <span className="text-sm font-bold text-[#F5F7F6]">Estimated Total</span>
                  <span className="text-lg font-bold" style={{ color: '#0C8A3E' }}>₹{charges.total.toFixed(2)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Final charges may vary based on actual task. Partner will confirm before starting.
              </p>
            </div>

            {error && <ErrorBanner message={error} />}
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-10 flex justify-center px-4 py-4"
        style={{ background: `linear-gradient(180deg, transparent, ${pg.bg} 30%)` }}
      >
        <div className="w-full max-w-lg">
          {step === 1 && categoryDrafts.length > 0 ? (
            <div className="space-y-2">
              <CTA
                className="w-full"
                onClick={() => {
                  setError(null)
                  // Restore schedule from first draft so review + recurring have context
                  const primary = categoryDrafts[0]
                  if (primary?.selectedDate) setSelectedDate(primary.selectedDate)
                  if (primary?.selectedSlot) setSelectedSlot(primary.selectedSlot)
                  setStep(4)
                }}
                disabled={loading}
              >
                Review &amp; Submit ({categoryDrafts.length})
              </CTA>
              <p className="text-center text-[11px]" style={{ color: pg.text4 }}>
                Next: recurring options, address, and schedule
              </p>
            </div>
          ) : step < 4 ? (
            <CTA
              className="w-full"
              onClick={() => {
                if (step === 1 && !canProceedStep1) { setError('Save at least one category first'); return }
                if (step === 2 && !canProceedStep2) { setError('Please select date and time slot'); return }
                setError(null)
                // Skip obsolete shop/items form (step 3) — go straight to review
                if (step === 2) {
                  setStep(4)
                  return
                }
                setStep(step + 1)
              }}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            >
              Continue <ChevronRight size={18} strokeWidth={2.5} />
            </CTA>
          ) : (
            <CTA className="w-full" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Scheduling...' : <><Package size={18} strokeWidth={2.5} /> Schedule Request</>}
            </CTA>
          )}
        </div>
      </div>

    </div>
  )
}
