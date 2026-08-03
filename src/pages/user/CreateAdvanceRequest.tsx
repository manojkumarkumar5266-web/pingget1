import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, type AdvanceSettings } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import PremiumCalendar from '../../components/PremiumCalendar'
import PremiumTimeSlotSelector from '../../components/PremiumTimeSlotSelector'
import RecurringSelector, { type RecurringType } from '../../components/RecurringSelector'
import {
  ArrowLeft, Camera, Mic, MicOff, X, Play, Pause, Store, Package, Trash2, Plus,
  MapPin, Navigation, Home, Edit2, ShoppingBag, Calendar, Clock, Tag,
  IndianRupee, FileText, ChevronRight, Check, ChevronLeft, Phone, AlertCircle,
  Repeat,
} from 'lucide-react'

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
  { name: 'Shopping', icon: '🛒' },
  { name: 'Pickup', icon: '📦' },
  { name: 'Delivery', icon: '🚚' },
  { name: 'Documents', icon: '📄' },
  { name: 'Medicine', icon: '💊' },
  { name: 'Food', icon: '🍱' },
  { name: 'Flowers', icon: '🌸' },
  { name: 'Gifts', icon: '🎁' },
  { name: 'Groceries', icon: '🥬' },
  { name: 'Laundry', icon: '👔' },
  { name: 'Courier', icon: '📮' },
  { name: 'Personal Assistant', icon: '🤝' },
  { name: 'Custom Request', icon: '✨' },
]

const TASK_DURATIONS = [15, 30, 45, 60, 90, 120]

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

  const [description, setDescription] = useState('')
  const [maxBudget, setMaxBudget] = useState('')

  const [recurringType, setRecurringType] = useState<RecurringType>('none')
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(1)
  const [recurringWeekday, setRecurringWeekday] = useState<number | null>(null)
  const [recurringMonthDay, setRecurringMonthDay] = useState<number | null>(1)

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

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  // Calendar logic
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDays = settings?.max_advance_days ?? 7
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + maxDays)

  const getSelectableDates = (): Date[] => {
    const dates: Date[] = []
    for (let i = 1; i <= maxDays; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      dates.push(d)
    }
    return dates
  }
  const selectableDates = getSelectableDates()

  const timeSlots = settings
    ? generateTimeSlots(settings.business_hours_start, settings.business_hours_end, settings.slot_duration_minutes)
    : []

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

  const canProceedStep1 = !!category
  const canProceedStep2 = !!selectedDate && !!selectedSlot
  const canProceedStep3 = !!fullAddressText && (description.trim().length > 0 || customDescription.trim().length > 0 || photoFiles.length > 0 || voiceBlob !== null)

  const handleSubmit = async () => {
    setError(null)
    if (!fullAddressText) { setError('Please select or add a delivery address'); return }
    if (!category) { setError('Please select a category'); return }
    if (!selectedDate || !selectedSlot) { setError('Please select date and time slot'); return }
    if (!settings) { setError('Settings not loaded yet. Please wait.'); return }

    const fullDescription = [
      category === 'Custom Request' && customDescription.trim() ? customDescription.trim() : null,
      description.trim() || null,
    ].filter(Boolean).join('\n')
    if (!fullDescription.trim()) { setError('Please describe your task or add items'); return }

    setLoading(true)
    try {
      if (recording) stopRecording()
      const ts = Date.now()
      const photoUrls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        const url = await uploadToStorage(photoFiles[i], `requests/${profile!.id}/${ts}-photo-${i}`)
        if (url) photoUrls.push(url)
      }
      const voiceUrl = voiceBlob ? await uploadToStorage(voiceBlob, `requests/${profile!.id}/${ts}-voice.webm`) : null

      const slotStart = selectedSlot.split('-')[0]
      const [sh, sm] = slotStart.split(':').map(Number)
      const scheduledTimestamp = new Date(selectedDate)
      scheduledTimestamp.setHours(sh, sm, 0, 0)

      const { data: inserted, error: insertError } = await supabase.from('requests').insert({
        user_id: profile!.id,
        description: fullDescription,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        voice_note_url: voiceUrl,
        preferred_shop: shopName.trim() || null,
        pickup_address: shopAddress.trim() || null,
        pickup_lat: shopLat,
        pickup_lng: shopLng,
        delivery_address: fullAddressText,
        delivery_lat: selectedAddress?.lat || null,
        delivery_lng: selectedAddress?.lng || null,
        max_budget: maxBudget ? parseFloat(maxBudget) : null,
        special_instructions: null,
        radius_meters: 10000,
        status: 'searching_dp',
        order_type: 'advance',
        is_scheduled: true,
        scheduled_date: formatDateKey(selectedDate),
        scheduled_time: selectedSlot.split('-')[0],
        scheduled_slot: selectedSlot,
        scheduled_timestamp: scheduledTimestamp.toISOString(),
        request_category: category,
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
      }).select('id').single()

      if (insertError) throw insertError

      await supabase.from('notifications').insert({
        user_id: profile!.id,
        title: 'Advance Request Created',
        body: `Your ${category} request is scheduled for ${formatDateKey(selectedDate)} at ${selectedSlot}. We are now searching for a delivery partner to reserve immediately.`,
        type: 'advance_request_created',
        related_id: inserted.id,
      })

      navigate('/app/orders')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0B0B0B' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20" style={{ borderTopColor: '#A6B300' }} />
      </div>
    )
  }

  if (settings && !settings.enabled) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: '#0B0B0B' }}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4" style={{ background: '#0B0B0B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => navigate('/app')} className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ArrowLeft size={20} style={{ color: '#fff' }} />
          </button>
          <h1 className="text-lg font-bold text-white">Advance Request</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <p className="text-white/60">Advance Requests are currently disabled by the admin.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0B0B0B' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4" style={{ background: '#0B0B0B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => step === 1 ? navigate('/app') : setStep(step - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {step === 1 ? <ArrowLeft size={20} style={{ color: '#fff' }} /> : <ChevronLeft size={20} style={{ color: '#fff' }} />}
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Advance Request</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Schedule a task up to {maxDays} days ahead</p>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="h-1.5 rounded-full transition-all" style={{
              width: s === step ? 24 : 8,
              background: s <= step ? '#A6B300' : 'rgba(255,255,255,0.15)',
            }} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-4 pt-5 space-y-5">
        {/* STEP 1: Category Selection */}
        {step === 1 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>What do you need done?</p>
              <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Choose a category for your scheduled task</p>
              <div className="grid grid-cols-3 gap-2.5">
                {REQUEST_CATEGORIES.map(cat => (
                  <button key={cat.name} onClick={() => setCategory(cat.name)}
                    className="relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-all active:scale-90"
                    style={category === cat.name
                      ? { background: 'rgba(166,179,0,0.12)', border: '1.5px solid rgba(166,179,0,0.4)' }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-center text-[10px] font-semibold leading-tight" style={{ color: category === cat.name ? '#A6B300' : 'rgba(255,255,255,0.55)' }}>
                      {cat.name}
                    </span>
                    {category === cat.name && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: '#A6B300' }}>
                        <Check size={11} className="text-[#0B0B0B]" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Request Description */}
            {category === 'Custom Request' && (
              <div className="rounded-2xl p-4 animate-slide-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label className="label flex items-center gap-1.5 mb-2" style={{ color: '#C4D600' }}>
                  <FileText size={14} /> Describe your task
                </label>
                <textarea className="input min-h-[120px] resize-none text-sm leading-relaxed"
                  value={customDescription} onChange={e => setCustomDescription(e.target.value)}
                  placeholder="Describe any legal task you want a delivery partner to perform. Be as detailed as possible — what to pick up, where to go, what to do..." />
              </div>
            )}

            {/* Task Duration */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Estimated Task Duration</p>
              <div className="flex flex-wrap gap-2">
                {TASK_DURATIONS.map(d => (
                  <button key={d} onClick={() => setTaskDuration(d)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95"
                    style={taskDuration === d
                      ? { background: '#A6B300', color: '#0B0B0B' }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {d < 60 ? `${d} min` : `${d / 60} hr`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Date & Time */}
        {step === 2 && (
          <div className="space-y-5 animate-slide-up">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Select Date & Time</p>
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
              />
            )}

            {settings?.recurring_enabled && selectedDate && selectedSlot && (
              <RecurringSelector
                recurringType={recurringType}
                onTypeChange={setRecurringType}
                intervalDays={recurringIntervalDays}
                onIntervalChange={setRecurringIntervalDays}
                weekday={recurringWeekday}
                onWeekdayChange={setRecurringWeekday}
                monthDay={recurringMonthDay}
                onMonthDayChange={setRecurringMonthDay}
                enabled={settings.recurring_enabled}
              />
            )}
          </div>
        )}

        {/* STEP 3: Task Details + Shop + Address */}
        {step === 3 && (
          <div className="space-y-5 animate-slide-up">
            {/* Shop Details (Optional) */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Shop Details <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <label className="label flex items-center gap-1.5" style={{ color: '#C4D600' }}><Store size={13} /> Shop Name</label>
                  <input className="input" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Reliance Fresh, D-Mart" />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5" style={{ color: '#C4D600' }}><Phone size={13} /> Shop Phone</label>
                  <input className="input" value={shopPhone} onChange={e => setShopPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Shop contact number" maxLength={10} />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5" style={{ color: '#C4D600' }}><MapPin size={13} /> Shop Address</label>
                  <input className="input" value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="Shop address / landmark" />
                </div>
                <button onClick={pickShopLocation}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all active:scale-95"
                  style={{ background: shopLat ? 'rgba(166,179,0,0.1)' : 'rgba(255,255,255,0.04)', border: `1.5px dashed ${shopLat ? 'rgba(166,179,0,0.3)' : 'rgba(255,255,255,0.15)'}`, color: shopLat ? '#A6B300' : 'rgba(255,255,255,0.5)' }}>
                  <Navigation size={15} />
                  {shopLat ? `Location set (${shopLat.toFixed(4)}, ${shopLng?.toFixed(4)})` : 'Set shop location on map'}
                </button>
              </div>
            </div>

            {/* Items / Description */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Items & Notes</p>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <textarea className="input min-h-[120px] resize-none text-sm leading-relaxed"
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="List items with quantities, brand preferences, or any specific instructions..." />

                {/* Photos */}
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold" style={{ color: '#C4D600' }}>Add Photos</p>
                  <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
                  {photoPreviews.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {photoPreviews.map((preview, idx) => (
                        <div key={idx} className="relative">
                          <img src={preview} alt={`Photo ${idx + 1}`} className="h-20 w-20 rounded-2xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                          <button onClick={() => removePhoto(idx)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => photoInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all active:scale-95"
                    style={{ background: 'rgba(166,179,0,0.08)', border: '1.5px dashed rgba(166,179,0,0.25)', color: '#A6B300' }}>
                    <Camera size={16} />
                    {photoPreviews.length > 0 ? 'Add More Photos' : 'Add Photos'}
                  </button>
                </div>

                {/* Voice Note */}
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold" style={{ color: '#C4D600' }}>Voice Note</p>
                  {voiceBlob ? (
                    <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
                      <button onClick={playVoice}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90"
                        style={{ background: 'linear-gradient(135deg, #A6B300, #808000)' }}>
                        {playingVoice ? <Pause size={16} className="text-[#0B0B0B]" /> : <Play size={16} className="text-[#0B0B0B]" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="voice-wave-bar" style={{ height: `${12 + Math.random() * 16}px`, opacity: playingVoice ? 1 : 0.4 }} />
                          ))}
                        </div>
                        <p className="text-xs font-semibold" style={{ color: '#A6B300' }}>Voice Note · {fmtDur(voiceDuration)}</p>
                      </div>
                      <button onClick={clearVoice} className="p-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : recording ? (
                    <button onClick={stopRecording}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-sm font-semibold"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="voice-wave-bar" style={{ height: `${12 + Math.random() * 16}px`, background: '#ef4444' }} />
                        ))}
                      </div>
                      <MicOff size={18} /> Stop · {fmtDur(voiceDuration)}
                    </button>
                  ) : (
                    <button onClick={startRecording}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-all active:scale-95"
                      style={{ background: 'rgba(166,179,0,0.08)', border: '1.5px dashed rgba(166,179,0,0.25)', color: '#A6B300' }}>
                      <Mic size={16} /> Record Voice Note
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Budget */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Budget <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label className="label flex items-center gap-1.5" style={{ color: '#C4D600' }}><IndianRupee size={13} /> Max Budget</label>
                <input className="input" type="number" value={maxBudget} onChange={e => setMaxBudget(e.target.value)} placeholder="Estimated maximum budget" />
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Delivery Address</p>
              {fullAddressText && !showAddressForm && !showAddressList ? (
                <div>
                  {addresses.length > 1 && (
                    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                      {addresses.map(addr => (
                        <button key={addr.id} onClick={() => setSelectedAddressId(addr.id)}
                          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${selectedAddressId === addr.id ? 'text-[#0B0B0B]' : 'text-white/50'}`}
                          style={selectedAddressId === addr.id ? { background: 'linear-gradient(135deg, #A6B300, #808000)' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {addr.label || 'Address'}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                      <Home size={18} style={{ color: '#A6B300' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Deliver To</p>
                      <p className="text-sm font-medium text-white truncate">{shortAddressText || fullAddressText}</p>
                    </div>
                    <button onClick={() => setShowAddressList(true)}
                      className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
                      style={{ background: '#A6B300', color: '#0B0B0B' }}>
                      <MapPin size={12} /> Select
                    </button>
                  </div>
                </div>
              ) : showAddressList && !showAddressForm ? (
                <div className="rounded-2xl p-4 space-y-3 animate-slide-up" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Your Addresses ({addresses.length}/{MAX_ADDRESSES})</h3>
                    <button onClick={() => { setShowAddressList(false); resetAddrForm() }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </button>
                  </div>
                  {addresses.length === 0 ? (
                    <div className="py-6 text-center">
                      <MapPin size={28} className="mx-auto mb-2 text-white/30" />
                      <p className="text-sm font-medium text-white/60 mb-1">No address found</p>
                      <p className="text-xs text-white/40 mb-4">Add an address so your partner knows where to deliver</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {addresses.map(addr => {
                        const addrFull = [addr.house_no, addr.flat_no, addr.building_name, addr.landmark, addr.street, addr.area, addr.city, addr.pincode].filter(Boolean).join(', ')
                        return (
                          <div key={addr.id} className={`rounded-2xl p-3 transition-all ${selectedAddressId === addr.id ? 'border-2' : 'border'}`}
                            style={selectedAddressId === addr.id ? { background: 'rgba(166,179,0,0.08)', borderColor: 'rgba(166,179,0,0.3)' } : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="flex items-start gap-3">
                              <button onClick={() => { setSelectedAddressId(addr.id); setShowAddressList(false) }} className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Home size={14} className="text-white/40 shrink-0" />
                                  <p className="text-sm font-semibold text-white truncate">{addr.label || 'Address'}</p>
                                  {selectedAddressId === addr.id && <span className="text-[10px] font-bold" style={{ color: '#A6B300' }}>SELECTED</span>}
                                </div>
                                <p className="text-xs text-white/50 truncate">{addrFull}</p>
                              </button>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => startEditAddress(addr)} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}><Edit2 size={12} className="text-white/60" /></button>
                                <button onClick={() => deleteAddress(addr.id)} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}><Trash2 size={12} className="text-red-400" /></button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {addresses.length < MAX_ADDRESSES ? (
                    <button onClick={() => { resetAddrForm(); setShowAddressForm(true) }}
                      className="w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
                      <Plus size={16} className="inline mr-1" /> Add New Address
                    </button>
                  ) : (
                    <p className="text-center text-xs text-yellow-400/80 py-2">Maximum {MAX_ADDRESSES} addresses reached.</p>
                  )}
                </div>
              ) : addresses.length === 0 && !showAddressForm ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <MapPin size={28} className="mx-auto mb-2 text-white/30" />
                  <p className="text-sm font-medium text-white/60 mb-1">No address found</p>
                  <p className="text-xs text-white/40 mb-4">Add an address so your partner knows where to deliver</p>
                  <button onClick={() => setShowAddressForm(true)}
                    className="rounded-2xl px-6 py-3 text-sm font-bold transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
                    <Plus size={16} className="inline mr-1" /> Add Address
                  </button>
                </div>
              ) : showAddressForm ? (
                <div className="rounded-2xl p-4 space-y-3 animate-slide-up" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{editingAddressId ? 'Edit Address' : 'New Address'}</h3>
                    <button onClick={() => { setShowAddressForm(false); resetAddrForm() }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">House No.</label><input className="input" value={addrHouse} onChange={e => setAddrHouse(e.target.value)} placeholder="H.No" /></div>
                    <div><label className="label">Flat No.</label><input className="input" value={addrFlat} onChange={e => setAddrFlat(e.target.value)} placeholder="Flat" /></div>
                  </div>
                  <div><label className="label">Building Name</label><input className="input" value={addrBuilding} onChange={e => setAddrBuilding(e.target.value)} placeholder="Building / Apartment" /></div>
                  <div><label className="label">Landmark</label><input className="input" value={addrLandmark} onChange={e => setAddrLandmark(e.target.value)} placeholder="Near..." /></div>
                  <div><label className="label">Street</label><input className="input" value={addrStreet} onChange={e => setAddrStreet(e.target.value)} placeholder="Street name" /></div>
                  <div><label className="label">Area</label><input className="input" value={addrArea} onChange={e => setAddrArea(e.target.value)} placeholder="Area / Locality" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">City</label><input className="input" value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="City" /></div>
                    <div><label className="label">PIN Code</label><input className="input" value={addrPincode} onChange={e => setAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit" maxLength={6} /></div>
                  </div>
                  <button onClick={pickAddrLocation}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all active:scale-95"
                    style={{ background: addrLat ? 'rgba(166,179,0,0.1)' : 'rgba(255,255,255,0.04)', border: `1.5px dashed ${addrLat ? 'rgba(166,179,0,0.3)' : 'rgba(255,255,255,0.15)'}`, color: addrLat ? '#A6B300' : 'rgba(255,255,255,0.5)' }}>
                    <Navigation size={15} />
                    {addrLat ? `Location set (${addrLat.toFixed(4)}, ${addrLng?.toFixed(4)})` : 'Select exact location on map'}
                  </button>
                  {error && <ErrorBanner message={error} />}
                  <button onClick={saveAddress} disabled={savingAddress}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
                    {savingAddress ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              ) : null}
            </div>

            {error && <ErrorBanner message={error} />}
          </div>
        )}

        {/* STEP 4: Review & Charges */}
        {step === 4 && (
          <div className="space-y-5 animate-slide-up">
            {/* Summary Timeline */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Request Summary</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                    <Tag size={14} style={{ color: '#A6B300' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Category</p>
                    <p className="text-sm font-semibold text-white">{category}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                    <Calendar size={14} style={{ color: '#A6B300' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Date</p>
                    <p className="text-sm font-semibold text-white">
                      {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                    <Clock size={14} style={{ color: '#A6B300' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Time Slot</p>
                    <p className="text-sm font-semibold text-white">{selectedSlot?.replace('-', ' to ')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                    <Home size={14} style={{ color: '#A6B300' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Delivery Address</p>
                    <p className="text-sm font-semibold text-white truncate">{shortAddressText || fullAddressText}</p>
                  </div>
                </div>
                {shopName && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                      <Store size={14} style={{ color: '#A6B300' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Shop</p>
                      <p className="text-sm font-semibold text-white">{shopName}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
                    <Clock size={14} style={{ color: '#A6B300' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Estimated Duration</p>
                    <p className="text-sm font-semibold text-white">{taskDuration < 60 ? `${taskDuration} minutes` : `${taskDuration / 60} hour`}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recurring Summary */}
            {recurringType !== 'none' && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Repeat size={14} style={{ color: '#818cf8' }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#818cf8' }}>Recurring Request</p>
                </div>
                <p className="text-sm font-semibold text-white">
                  {recurringType === 'daily' && 'Repeats every day'}
                  {recurringType === 'weekly' && `Repeats every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][recurringWeekday ?? 1]}`}
                  {recurringType === 'monthly' && `Repeats on day ${recurringMonthDay} of each month`}
                  {recurringType === 'custom' && `Repeats every ${recurringIntervalDays} days`}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  New scheduled requests will be created automatically for each occurrence.
                </p>
              </div>
            )}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(166,179,0,0.06)', border: '1px solid rgba(166,179,0,0.2)' }}>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Estimated Charges</p>
              <div className="space-y-2">
                {Object.entries(charges.breakdown).map(([key, val]) => (
                  val !== 0 && (
                    <div key={key} className="flex justify-between text-sm">
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{key}</span>
                      <span className="font-semibold text-white">₹{val.toFixed(2)}</span>
                    </div>
                  )
                ))}
                <div className="flex justify-between pt-2 mt-2" style={{ borderTop: '1px solid rgba(166,179,0,0.2)' }}>
                  <span className="text-sm font-bold text-white">Estimated Total</span>
                  <span className="text-lg font-bold" style={{ color: '#A6B300' }}>₹{charges.total.toFixed(2)}</span>
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

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-4" style={{ background: 'linear-gradient(180deg, transparent, #0B0B0B 30%)' }}>
        <div className="mx-auto max-w-md">
          {step < 4 ? (
            <button type="button"
              onClick={() => {
                if (step === 1 && !canProceedStep1) { setError('Please select a category'); return }
                if (step === 2 && !canProceedStep2) { setError('Please select date and time slot'); return }
                if (step === 3 && !canProceedStep3) { setError('Please add a description or items, and select a delivery address'); return }
                setError(null)
                setStep(step + 1)
              }}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2) || (step === 3 && !canProceedStep3)}
              className="w-full flex items-center justify-center rounded-2xl py-4 text-base font-bold tracking-wide transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
              style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(166,179,0,0.35)' }}>
              <span className="flex items-center gap-2">Continue <ChevronRight size={18} strokeWidth={2.5} /></span>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="w-full flex items-center justify-center rounded-2xl py-4 text-base font-bold tracking-wide transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(166,179,0,0.35)' }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B0B0B]/30" style={{ borderTopColor: '#0B0B0B' }} />
                  Scheduling...
                </span>
              ) : (
                <span className="flex items-center gap-2"><Package size={18} strokeWidth={2.5} /> Schedule Request</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
