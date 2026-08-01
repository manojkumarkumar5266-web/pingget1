import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import CategorySelectionModal, { type CategorySelection } from '../../components/CategorySelectionModal'
import { Camera, Mic, MicOff, X, Play, Pause, Store, ArrowLeft, Package, Trash2, Plus, ChevronRight, FileText, MapPin, Navigation, Home, Edit2, ListChecks, ShoppingBag } from 'lucide-react'

type DbCategory = { id: string; name: string; icon: string }

const ICON_MAP: Record<string, string> = {
  Food: '🍱', Medicine: '💊', Grocery: '🛒', Parcel: '📦',
  Courier: '🚀', Gift: '🎁', Laundry: '👔', Documents: '📄',
  Flowers: '🌸', Electronics: '📱',
  Vegetables: '🥕', Fruits: '🍎', Stationery: '✏️', Sports: '⚽',
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#A6B300', Medicine: '#A6B300', Grocery: '#A6B300', Parcel: '#A6B300',
  Courier: '#A6B300', Gift: '#A6B300', Laundry: '#A6B300', Documents: '#A6B300',
  Flowers: '#A6B300', Electronics: '#A6B300',
  Vegetables: '#A6B300', Fruits: '#A6B300', Stationery: '#A6B300', Sports: '#A6B300',
}

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

export default function CreateRequest() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [description, setDescription] = useState('')
  const [preferredShop, setPreferredShop] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [activeCategory, setActiveCategory] = useState<{ name: string; id: string } | null>(null)
  const [selections, setSelections] = useState<CategorySelection[]>([])
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [showDetails, setShowDetails] = useState(false)

  const [gpsLat, setGpsLat] = useState<number | null>(profile?.gps_lat || null)
  const [gpsLng, setGpsLng] = useState<number | null>(profile?.gps_lng || null)
  const [gpsSaved, setGpsSaved] = useState(false)

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
    supabase.from('categories').select('id, name, icon').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data as DbCategory[]) || []))
  }, [])

  const fetchAddresses = async () => {
    if (!profile?.id) return
    const { data } = await supabase.from('addresses').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setAddresses((data as SavedAddress[]) || [])
    if (data && data.length > 0 && !selectedAddressId) setSelectedAddressId(data[0].id)
  }
  useEffect(() => { fetchAddresses() }, [profile?.id])

  useEffect(() => {
    const getGps = async (lat: number, lng: number) => {
      setGpsLat(lat); setGpsLng(lng)
      try { await supabase.rpc('update_location', { p_lat: lat, p_lng: lng }); setGpsSaved(true) } catch {}
    }
    if (gpsLat && gpsLng) { if (!gpsSaved) getGps(gpsLat, gpsLng); return }
    navigator.geolocation?.getCurrentPosition(
      pos => getGps(pos.coords.latitude, pos.coords.longitude),
      () => {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  const selectedAddress = addresses.find(a => a.id === selectedAddressId)
  const fullAddressText = selectedAddress
    ? [selectedAddress.house_no, selectedAddress.flat_no, selectedAddress.building_name, selectedAddress.street, selectedAddress.area, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(', ')
    : null
  const deliveryAddressText = fullAddressText
  const shortAddressText = selectedAddress
    ? [selectedAddress.house_no, selectedAddress.flat_no, selectedAddress.building_name, selectedAddress.area].filter(Boolean).join(', ')
    : null

  const pickLocationOnMap = () => {
    if (!navigator.geolocation) { setError('Location not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setAddrLat(pos.coords.latitude); setAddrLng(pos.coords.longitude); setError(null) },
      () => setError('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

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

  const handleSubmit = async () => {
    setError(null)
    if (!deliveryAddressText) { setError('Please select or add a delivery address'); return }
    const selectionLines: string[] = []
    selections.forEach(sel => {
      selectionLines.push(`[${sel.category}]`)
      sel.items.forEach(item => {
        const priceStr = item.price > 0 ? ` ₹${item.price}` : ''
        selectionLines.push(`  ${item.name} ×${item.quantity}${priceStr}`)
      })
    })
    const fullDescription = [...selectionLines, description.trim()].filter(Boolean).join('\n')
    if (!fullDescription.trim()) { setError('Please select items or add a description'); return }
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
      const { data: inserted, error } = await supabase.from('requests').insert({
        user_id: profile!.id, description: fullDescription,
        photo_urls: photoUrls.length > 0 ? photoUrls : null, voice_note_url: voiceUrl,
        preferred_shop: preferredShop.trim() || null, pickup_address: pickupAddress.trim() || null,
        delivery_address: deliveryAddressText,
        delivery_lat: selectedAddress?.lat || null, delivery_lng: selectedAddress?.lng || null,
        pickup_lat: gpsLat, pickup_lng: gpsLng,
        expected_time: null, max_budget: null, special_instructions: null, radius_meters: 10000, status: 'pending',
      }).select('id').single()
      if (error) throw error
      navigate(`/app/scanning/${inserted.id}`)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const totalItems = selections.reduce((s, sel) => s + sel.items.length, 0)
  const canSubmit = (selections.length > 0 || description.trim().length > 0) && !loading && !!deliveryAddressText

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0B0B0B' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4"
        style={{ background: '#0B0B0B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button type="button" onClick={() => navigate('/app')}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ArrowLeft size={20} style={{ color: '#fff' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">New Request</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Tell us what you need delivered</p>
        </div>
        {totalItems > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5" style={{ background: '#A6B300' }}>
            <ShoppingBag size={14} className="text-[#0B0B0B]" />
            <span className="text-xs font-bold text-[#0B0B0B]">{totalItems}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-4 pt-5 space-y-5">
        {/* Delivery Address Card - Colorful */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Delivery Address</p>
          {deliveryAddressText && !showAddressForm && !showAddressList ? (
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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(166,179,0,0.12)' }}>
                  <Home size={18} style={{ color: '#A6B300' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Deliver To</p>
                  <p className="text-sm font-medium text-white truncate">{shortAddressText || deliveryAddressText}</p>
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
                <p className="text-center text-xs text-yellow-400/80 py-2">Maximum {MAX_ADDRESSES} addresses reached. Delete or edit one to add a new address.</p>
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
              <button onClick={pickLocationOnMap}
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

        {/* Category Grid - Colorful */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>What do you need?</p>
          <div className="grid grid-cols-4 gap-2.5">
            {categories.map(cat => {
              const sel = selections.find(s => s.category === cat.name)
              const color = CATEGORY_COLORS[cat.name] || '#A6B300'
              return (
                <button key={cat.id} type="button" onClick={() => setActiveCategory({ name: cat.name, id: cat.id })}
                  className="relative flex flex-col items-center gap-2 rounded-2xl p-3 transition-all active:scale-90"
                  style={sel
                    ? { background: `${color}22`, border: `1.5px solid ${color}66` }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-2xl">{ICON_MAP[cat.name] || cat.icon}</span>
                  <span className="text-center text-[10px] font-semibold leading-tight" style={{ color: sel ? color : 'rgba(255,255,255,0.55)' }}>
                    {cat.name}
                  </span>
                  {sel && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: color }}>
                      {sel.items.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Items Summary - Colorful */}
        {selections.length > 0 && (
          <div className="space-y-2 animate-slide-up">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Selected Items</p>
            {selections.map(sel => {
              const color = CATEGORY_COLORS[sel.category] || '#A6B300'
              return (
                <div key={sel.category} className="rounded-2xl p-4" style={{ background: `${color}11`, border: `1px solid ${color}33` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ICON_MAP[sel.category] || '📦'}</span>
                      <p className="font-bold text-white text-sm">{sel.category}</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>
                        {sel.items.length} item{sel.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button type="button" onClick={() => setSelections(prev => prev.filter(s => s.category !== sel.category))}
                      className="flex h-7 w-7 items-center justify-center rounded-xl transition-colors"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sel.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="font-semibold text-white">{item.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>×{item.quantity}</span>
                        {item.price > 0 && <span style={{ color }}>₹{item.quantity * item.price}</span>}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setActiveCategory({ name: sel.category, id: categories.find(c => c.name === sel.category)?.id || '' })}
                    className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color }}>
                    <Plus size={12} /> Edit items
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Items List & Notes — colorful card */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <label className="label flex items-center gap-1.5 mb-2">
            <ListChecks size={14} /> Items List & Notes
            <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea className="input min-h-[140px] resize-none text-sm leading-relaxed" value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="List the items you need with quantities, e.g. 2kg onions, 1 litre milk, 1 packet bread. Add brand preferences or specific instructions..." />

          {/* Photos inside notes section */}
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Add Photos (items, shopping list, prescription)</p>
            <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
            {photoPreviews.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {photoPreviews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    <img src={preview} alt={`Photo ${idx + 1}`} className="h-20 w-20 rounded-2xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    <button type="button" onClick={() => removePhoto(idx)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => photoInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all active:scale-95"
              style={{ background: 'rgba(166,179,0,0.08)', border: '1.5px dashed rgba(166,179,0,0.25)', color: '#A6B300' }}>
              <Camera size={16} />
              {photoPreviews.length > 0 ? 'Add More Photos' : 'Add Item Photos / Shopping List / Prescription'}
            </button>
          </div>

          {/* Voice note inside notes section */}
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Voice Note</p>
            {voiceBlob ? (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
                <button type="button" onClick={playVoice}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90"
                  style={{ background: 'linear-gradient(135deg, #A6B300, #808000)' }}>
                  {playingVoice ? <Pause size={16} className="text-[#0B0B0B]" /> : <Play size={16} className="text-[#0B0B0B]" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="voice-wave-bar"
                        style={{ height: `${12 + Math.random() * 16}px`, opacity: playingVoice ? 1 : 0.4 }} />
                    ))}
                  </div>
                  <p className="text-xs font-semibold" style={{ color: '#A6B300' }}>Voice Note · {fmtDur(voiceDuration)}</p>
                </div>
                <button type="button" onClick={clearVoice} className="p-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <X size={16} />
                </button>
              </div>
            ) : recording ? (
              <button type="button" onClick={stopRecording}
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
              <button type="button" onClick={startRecording}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-all active:scale-95"
                style={{ background: 'rgba(166,179,0,0.08)', border: '1.5px dashed rgba(166,179,0,0.25)', color: '#A6B300' }}>
                <Mic size={16} /> Record Voice Note
              </button>
            )}
          </div>
        </div>

        {/* Preferred Shop + Pickup Location — colorful cards */}
        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label className="label flex items-center gap-1.5"><Store size={13} style={{ color: '#A6B300' }} /> Preferred Shop <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input className="input" value={preferredShop} onChange={e => setPreferredShop(e.target.value)} placeholder="e.g. Reliance Fresh, D-Mart, More, Medical Shop" />
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label className="label flex items-center gap-1.5"><MapPin size={13} style={{ color: '#A6B300' }} /> Pickup Location <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input className="input" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Where the partner should collect items" />
          </div>
        </div>

        {error && <ErrorBanner message={error} />}
      </div>

      {/* Sticky Submit Bar - Colorful */}
      <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-4"
        style={{ background: 'linear-gradient(180deg, transparent, #0B0B0B 30%)' }}>
        <div className="mx-auto max-w-md">
          {totalItems > 0 && (
            <div className="mb-3 flex items-center justify-between text-sm">
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>{totalItems} item{totalItems !== 1 ? 's' : ''} selected</span>
              <span className="font-semibold" style={{ color: '#A6B300' }}>Ready to submit</span>
            </div>
          )}
          <button type="button" onClick={handleSubmit} disabled={!canSubmit}
            className="w-full rounded-xl py-4 text-base font-bold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: canSubmit ? '#A6B300' : 'rgba(255,255,255,0.08)', color: canSubmit ? '#0B0B0B' : 'rgba(255,255,255,0.3)' }}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B0B0B]/30" style={{ borderTopColor: '#0B0B0B' }} />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2"><Package size={18} strokeWidth={2.5} /> Submit Request</span>
            )}
          </button>
        </div>
      </div>

      {activeCategory && (
        <CategorySelectionModal
          category={activeCategory.name} categoryId={activeCategory.id}
          onClose={() => setActiveCategory(null)}
          onSave={(selection) => {
            setSelections(prev => [...prev.filter(s => s.category !== selection.category), selection])
            setActiveCategory(null)
          }}
        />
      )}
    </div>
  )
}
