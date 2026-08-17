import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from './ui'
import { SELECTED_ADDRESS_KEY } from '../lib/customImages'
import { MapPin, Home, Plus, X, Edit2, Trash2, Navigation } from 'lucide-react'
import { pg } from '../design/tokens'
import { Surface, CTA, IconButton, SectionLabel } from '../design/primitives'

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

function AddressFormHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-[17px] font-extrabold tracking-tight">{title}</h3>
      <IconButton onClick={onClose} className="!h-9 !w-9 !rounded-xl">
        <X size={16} />
      </IconButton>
    </div>
  )
}

/** Compact address picker for User Home — selection persisted for Instant/Advance requests. */
export default function AddressPicker({
  compact = true,
  inline = false,
  onSelect,
  defaultOpenList = false,
}: {
  compact?: boolean
  /** Compact chip for greeting header row */
  inline?: boolean
  /** Called when user picks an address (Home + tracking update) */
  onSelect?: (addr: SavedAddress) => void
  /** Open the address list immediately (tracking “Change address”) */
  defaultOpenList?: boolean
}) {
  const { profile } = useAuth()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_ADDRESS_KEY)
  )
  const [showList, setShowList] = useState(defaultOpenList)
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

  const pickAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id)
    localStorage.setItem(SELECTED_ADDRESS_KEY, addr.id)
    setShowList(false)
    onSelect?.(addr)
  }

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
      pickAddress(data)
      setShowForm(false)
      resetForm()
    }
  }

  if (showForm && !inline) {
    return (
      <Surface className={`${compact ? 'mb-4' : 'mb-5'} p-4`}>
        <AddressFormHeader title={editingId ? 'Edit Address' : 'New Address'} onClose={() => { setShowForm(false); resetForm() }} />
        <div className="space-y-3">
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
          <CTA type="button" variant="secondary" onClick={pickLocation} className="w-full !min-h-[48px] border-dashed" style={{ border: `1.5px dashed rgba(196,214,0,0.35)`, color: pg.lime, background: pg.limeDim }}>
            <Navigation size={15} /> {addrLat ? 'Location set' : 'Use current location'}
          </CTA>
          {error && <ErrorBanner message={error} />}
          <CTA type="button" onClick={saveAddress} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Address'}
          </CTA>
        </div>
      </Surface>
    )
  }

  if (showList && !inline) {
    return (
      <Surface className={`${compact ? 'mb-4' : 'mb-5'} p-4`}>
        <AddressFormHeader title="Select Address" onClose={() => setShowList(false)} />
        <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
          {addresses.map(addr => (
            <Surface
              key={addr.id}
              accent={selectedAddressId === addr.id}
              className="!flex items-start gap-2 p-3"
              style={selectedAddressId !== addr.id ? { background: pg.bgElevated } : undefined}
            >
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => pickAddress(addr)}>
                <p className="truncate text-sm font-extrabold">{addr.label || 'Address'}</p>
                <p className="truncate text-xs" style={{ color: pg.text3 }}>{formatAddress(addr)}</p>
              </button>
              <IconButton onClick={() => startEdit(addr)} className="!h-8 !w-8 !rounded-xl">
                <Edit2 size={12} />
              </IconButton>
              <button
                type="button"
                onClick={() => deleteAddress(addr.id)}
                className="flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-90"
                style={{ background: 'rgba(255,77,79,0.12)', border: '1px solid rgba(255,77,79,0.2)', color: pg.danger }}
              >
                <Trash2 size={12} />
              </button>
            </Surface>
          ))}
        </div>
        {addresses.length < MAX_ADDRESSES && (
          <CTA type="button" onClick={() => { resetForm(); setShowForm(true); setShowList(false) }} className="w-full">
            <Plus size={16} /> Add New Address
          </CTA>
        )}
      </Surface>
    )
  }

  const popupForm = (
    <Surface className="p-4">
      <AddressFormHeader title={editingId ? 'Edit Address' : 'New Address'} onClose={() => { setShowForm(false); resetForm() }} />
      <div className="space-y-3">
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
        <CTA type="button" variant="secondary" onClick={pickLocation} className="w-full !min-h-[48px] border-dashed" style={{ border: `1.5px dashed rgba(196,214,0,0.35)`, color: pg.lime, background: pg.limeDim }}>
          <Navigation size={15} /> {addrLat ? 'Location set' : 'Use current location'}
        </CTA>
        {error && <ErrorBanner message={error} />}
        <CTA type="button" onClick={saveAddress} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Address'}
        </CTA>
      </div>
    </Surface>
  )

  const popupList = (
    <Surface className="p-4">
      <AddressFormHeader title="Select Address" onClose={() => setShowList(false)} />
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
        {addresses.map(addr => (
          <Surface
            key={addr.id}
            accent={selectedAddressId === addr.id}
            className="!flex items-start gap-2 p-3"
            style={selectedAddressId !== addr.id ? { background: pg.bgElevated } : undefined}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => pickAddress(addr)}
            >
              <p className="truncate text-sm font-extrabold">{addr.label || 'Address'}</p>
              <p className="truncate text-xs" style={{ color: pg.text3 }}>{formatAddress(addr)}</p>
            </button>
            <IconButton onClick={() => { startEdit(addr); setShowList(false); setShowForm(true) }} className="!h-8 !w-8 !rounded-xl">
              <Edit2 size={12} />
            </IconButton>
            <button
              type="button"
              onClick={() => deleteAddress(addr.id)}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-90"
              style={{ background: 'rgba(255,77,79,0.12)', border: '1px solid rgba(255,77,79,0.2)', color: pg.danger }}
            >
              <Trash2 size={12} />
            </button>
          </Surface>
        ))}
      </div>
      {addresses.length < MAX_ADDRESSES && (
        <CTA type="button" onClick={() => { resetForm(); setShowForm(true); setShowList(false) }} className="w-full">
          <Plus size={16} /> Add New Address
        </CTA>
      )}
      <CTA type="button" className="mt-2 w-full" onClick={() => setShowList(false)}>
        Done
      </CTA>
    </Surface>
  )

  const popup = inline && (showList || showForm)
    ? createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => { setShowList(false); setShowForm(false); resetForm() }}
        >
          <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-[24px]" onClick={e => e.stopPropagation()}>
            {showForm ? popupForm : popupList}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div className={inline ? '' : compact ? 'mb-4' : 'mb-5'}>
        {!inline && <SectionLabel title="Select Address" />}
        {selected ? (
          <Surface
            className={`flex items-center gap-2 ${inline ? 'p-2.5' : 'gap-3 p-3.5'}`}
            onClick={inline ? () => setShowList(true) : undefined}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded-xl ${inline ? 'h-9 w-9' : 'h-11 w-11 rounded-2xl'}`}
              style={{ background: pg.limeDim }}
            >
              <Home size={inline ? 15 : 18} style={{ color: pg.lime }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: pg.text3 }}>
                Deliver To
              </p>
              <p className={`font-bold ${inline ? 'line-clamp-2 text-xs leading-snug' : 'truncate text-sm'}`}>
                {formatShortAddress(selected) || formatAddress(selected)}
              </p>
            </div>
            {!inline && (
              <CTA type="button" onClick={() => setShowList(true)} className="!min-h-[36px] !rounded-xl !px-3 !py-1.5 !text-xs">
                <MapPin size={12} /> Select
              </CTA>
            )}
          </Surface>
        ) : (
          <CTA
            type="button"
            variant="secondary"
            onClick={() => setShowForm(true)}
            className={inline ? '!min-h-[44px] !rounded-xl !px-3 !py-2 !text-xs' : 'w-full border-dashed'}
            style={{ border: `1.5px dashed rgba(196,214,0,0.35)`, color: pg.lime, background: pg.limeDim }}
          >
            <Plus size={inline ? 14 : 16} /> {inline ? 'Add address' : 'Add delivery address'}
          </CTA>
        )}
      </div>
      {popup}
    </>
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
