import { useState, useEffect } from 'react'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from './ui'
import { SELECTED_ADDRESS_KEY } from '../lib/customImages'
import { MapPin, Home, Plus, X, Edit2, Trash2, Navigation } from 'lucide-react'

export type SavedAddress = {
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

const MAX_ADDRESSES = 5

export function formatAddress(addr: SavedAddress | null | undefined): string {
  if (!addr) return ''
  return [addr.house_no, addr.flat_no, addr.building_name, addr.street, addr.area, addr.city, addr.pincode]
    .filter(Boolean)
    .join(', ')
}

export function formatShortAddress(addr: SavedAddress | null | undefined): string {
  if (!addr) return ''
  return [addr.house_no, addr.flat_no, addr.building_name, addr.area].filter(Boolean).join(', ')
}

/** Compact address picker for User Home — selection persisted for Instant/Advance requests. */
export default function AddressPicker({ compact = true }: { compact?: boolean }) {
  const { profile } = useAuth()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_ADDRESS_KEY)
  )
  const [showList, setShowList] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const fetchAddresses = async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    const list = (data as SavedAddress[]) || []
    setAddresses(list)
    const stored = localStorage.getItem(SELECTED_ADDRESS_KEY)
    if (stored && list.some(a => a.id === stored)) {
      setSelectedAddressId(stored)
    } else if (list.length > 0) {
      setSelectedAddressId(list[0].id)
      localStorage.setItem(SELECTED_ADDRESS_KEY, list[0].id)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [profile?.id])

  useEffect(() => {
    if (selectedAddressId) localStorage.setItem(SELECTED_ADDRESS_KEY, selectedAddressId)
  }, [selectedAddressId])

  const selected = addresses.find(a => a.id === selectedAddressId) || null

  const resetForm = () => {
    setAddrHouse(''); setAddrFlat(''); setAddrBuilding(''); setAddrLandmark('')
    setAddrStreet(''); setAddrArea(''); setAddrCity(''); setAddrPincode('')
    setAddrLat(null); setAddrLng(null); setEditingId(null); setError(null)
  }

  const startEdit = (addr: SavedAddress) => {
    setEditingId(addr.id)
    setAddrHouse(addr.house_no || ''); setAddrFlat(addr.flat_no || '')
    setAddrBuilding(addr.building_name || ''); setAddrLandmark(addr.landmark || '')
    setAddrStreet(addr.street || ''); setAddrArea(addr.area || '')
    setAddrCity(addr.city || ''); setAddrPincode(addr.pincode || '')
    setAddrLat(addr.lat); setAddrLng(addr.lng)
    setShowList(false); setShowForm(true)
  }

  const deleteAddress = async (id: string) => {
    if (!profile?.id) return
    await supabase.from('addresses').delete().eq('id', id).eq('user_id', profile.id)
    if (selectedAddressId === id) {
      setSelectedAddressId(null)
      localStorage.removeItem(SELECTED_ADDRESS_KEY)
    }
    await fetchAddresses()
  }

  const pickLocation = () => {
    if (!navigator.geolocation) { setError('Location not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setAddrLat(pos.coords.latitude); setAddrLng(pos.coords.longitude); setError(null) },
      () => setError('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const saveAddress = async () => {
    if (!profile?.id) return
    if (!addrHouse.trim() && !addrFlat.trim() && !addrBuilding.trim()) {
      setError('Please enter at least a house/flat/building'); return
    }
    if (!addrPincode || addrPincode.length !== 6) {
      setError('Please enter a 6-digit pincode'); return
    }
    if (!editingId && addresses.length >= MAX_ADDRESSES) {
      setError(`You can save up to ${MAX_ADDRESSES} addresses.`); return
    }
    setSaving(true)
    const payload = {
      user_id: profile.id,
      label: addrHouse || addrFlat || addrBuilding || 'Address',
      house_no: addrHouse.trim() || null,
      flat_no: addrFlat.trim() || null,
      building_name: addrBuilding.trim() || null,
      landmark: addrLandmark.trim() || null,
      street: addrStreet.trim() || null,
      area: addrArea.trim() || null,
      city: addrCity.trim() || null,
      pincode: addrPincode,
      lat: addrLat,
      lng: addrLng,
    }
    let data: SavedAddress | null = null
    if (editingId) {
      const { data: updated, error: err } = await supabase
        .from('addresses').update(payload).eq('id', editingId).eq('user_id', profile.id).select().single()
      if (err) { setSaving(false); setError(err.message); return }
      data = updated as SavedAddress
    } else {
      const { data: inserted, error: err } = await supabase.from('addresses').insert(payload).select().single()
      if (err) { setSaving(false); setError(err.message); return }
      data = inserted as SavedAddress
    }
    setSaving(false)
    if (data) {
      await fetchAddresses()
      setSelectedAddressId(data.id)
      localStorage.setItem(SELECTED_ADDRESS_KEY, data.id)
      setShowForm(false)
      resetForm()
    }
  }

  if (showForm) {
    return (
      <div className="mb-4 rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{editingId ? 'Edit Address' : 'New Address'}</h3>
          <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">House No.</label><input className="input" value={addrHouse} onChange={e => setAddrHouse(e.target.value)} /></div>
          <div><label className="label">Flat No.</label><input className="input" value={addrFlat} onChange={e => setAddrFlat(e.target.value)} /></div>
        </div>
        <div><label className="label">Building</label><input className="input" value={addrBuilding} onChange={e => setAddrBuilding(e.target.value)} /></div>
        <div><label className="label">Landmark</label><input className="input" value={addrLandmark} onChange={e => setAddrLandmark(e.target.value)} /></div>
        <div><label className="label">Street</label><input className="input" value={addrStreet} onChange={e => setAddrStreet(e.target.value)} /></div>
        <div><label className="label">Area</label><input className="input" value={addrArea} onChange={e => setAddrArea(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">City</label><input className="input" value={addrCity} onChange={e => setAddrCity(e.target.value)} /></div>
          <div><label className="label">PIN</label><input className="input" value={addrPincode} onChange={e => setAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} /></div>
        </div>
        <button type="button" onClick={pickLocation} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm" style={{ border: '1.5px dashed rgba(166,179,0,0.3)', color: '#A6B300' }}>
          <Navigation size={15} /> {addrLat ? 'Location set' : 'Use current location'}
        </button>
        {error && <ErrorBanner message={error} />}
        <button type="button" onClick={saveAddress} disabled={saving} className="w-full rounded-2xl py-3.5 text-sm font-bold" style={{ background: '#A6B300', color: '#0B0B0B' }}>
          {saving ? 'Saving...' : 'Save Address'}
        </button>
      </div>
    )
  }

  if (showList) {
    return (
      <div className="mb-4 rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Select Address</h3>
          <button type="button" onClick={() => setShowList(false)} className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {addresses.map(addr => (
            <div key={addr.id} className="rounded-2xl p-3 flex items-start gap-2" style={selectedAddressId === addr.id ? { background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.3)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <button type="button" className="flex-1 text-left min-w-0" onClick={() => { setSelectedAddressId(addr.id); setShowList(false) }}>
                <p className="text-sm font-semibold text-white truncate">{addr.label || 'Address'}</p>
                <p className="text-xs text-white/50 truncate">{formatAddress(addr)}</p>
              </button>
              <button type="button" onClick={() => startEdit(addr)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}><Edit2 size={12} className="text-white/60" /></button>
              <button type="button" onClick={() => deleteAddress(addr.id)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}><Trash2 size={12} className="text-red-400" /></button>
            </div>
          ))}
        </div>
        {addresses.length < MAX_ADDRESSES && (
          <button type="button" onClick={() => { resetForm(); setShowForm(true); setShowList(false) }} className="w-full rounded-2xl py-3 text-sm font-bold" style={{ background: '#A6B300', color: '#0B0B0B' }}>
            <Plus size={16} className="inline mr-1" /> Add New Address
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={compact ? 'mb-4' : 'mb-5'}>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Select Address</p>
      {selected ? (
        <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.12)' }}>
            <Home size={18} style={{ color: '#A6B300' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Deliver To</p>
            <p className="text-sm font-medium text-white truncate">{formatShortAddress(selected) || formatAddress(selected)}</p>
          </div>
          <button type="button" onClick={() => setShowList(true)} className="rounded-xl px-3 py-1.5 text-xs font-bold" style={{ background: '#A6B300', color: '#0B0B0B' }}>
            <MapPin size={12} className="inline mr-0.5" /> Select
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="w-full rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(166,179,0,0.35)', color: '#A6B300' }}>
          <Plus size={16} /> Add delivery address
        </button>
      )}
    </div>
  )
}

/** Load currently selected home address (for Instant/Advance submit). */
export async function getSelectedDeliveryAddress(userId: string): Promise<{ text: string; lat: number | null; lng: number | null; id: string | null } | null> {
  const id = localStorage.getItem(SELECTED_ADDRESS_KEY)
  let query = supabase.from('addresses').select('*').eq('user_id', userId)
  if (id) query = query.eq('id', id)
  const { data } = await (id ? query.maybeSingle() : query.order('created_at', { ascending: false }).limit(1).maybeSingle())
  if (!data) return null
  const addr = data as SavedAddress
  return { text: formatAddress(addr), lat: addr.lat, lng: addr.lng, id: addr.id }
}
