import { useEffect, useState } from 'react'
import { useAuth } from '../../context'
import { supabase, City, Pincode } from '../../lib/supabase'
import { EmptyState, ErrorBanner } from '../../components/ui'
import { Plus, MapPin, Pause, Play, X, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

type CityWithPincodes = City & { pincodes?: Pincode[] }

export default function AdminCities() {
  const { profile } = useAuth()
  const [cities, setCities] = useState<CityWithPincodes[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCity, setExpandedCity] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddPincode, setShowAddPincode] = useState<string | null>(null)
  const [newCity, setNewCity] = useState('')
  const [commission, setCommission] = useState('10')
  const [newPincode, setNewPincode] = useState('')
  const [newAreaName, setNewAreaName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchCities() }, [])

  const fetchCities = async () => {
    const { data: cityData } = await supabase.from('cities').select('*').order('name')
    const { data: pincodeData } = await supabase.from('pincodes').select('*').order('pincode')
    const pincodesByCity = new Map<string, Pincode[]>()
    for (const p of pincodeData || []) {
      const arr = pincodesByCity.get(p.city_id) || []
      arr.push(p)
      pincodesByCity.set(p.city_id, arr)
    }
    setCities((cityData || []).map(c => ({ ...c, pincodes: pincodesByCity.get(c.id) || [] })))
    setLoading(false)
  }

  const logAction = async (action: string, details: string) => {
    await supabase.from('admin_logs').insert({ admin_id: profile!.id, action, details })
  }

  const addCity = async () => {
    setError(null)
    const { error } = await supabase.from('cities').insert({
      name: newCity, commission_pct: parseFloat(commission) || 10, is_active: true,
    })
    if (error) { setError(error.message); return }
    await logAction('city_add', `Added city: ${newCity}`)
    setNewCity(''); setCommission('10'); setShowAdd(false)
    fetchCities()
  }

  const toggleCity = async (city: CityWithPincodes) => {
    const newActive = !city.is_active
    await supabase.from('cities').update({ is_active: newActive }).eq('id', city.id)
    // Cascade: activate/deactivate all pincodes in this city
    await supabase.from('pincodes').update({ is_active: newActive }).eq('city_id', city.id)
    await logAction('city_toggle', `${city.name}: ${newActive ? 'activated' : 'deactivated'} (all pincodes updated)`)
    fetchCities()
  }

  const togglePause = async (city: CityWithPincodes) => {
    const newPaused = !city.service_paused
    await supabase.from('cities').update({ service_paused: newPaused }).eq('id', city.id)
    await logAction('city_pause', `${city.name}: ${newPaused ? 'paused' : 'resumed'}`)
    fetchCities()
  }

  const updateCommission = async (city: CityWithPincodes, pct: number) => {
    await supabase.from('cities').update({ commission_pct: pct }).eq('id', city.id)
    await logAction('city_commission', `${city.name}: commission ${pct}%`)
    fetchCities()
  }

  const togglePincode = async (pincode: Pincode) => {
    await supabase.from('pincodes').update({ is_active: !pincode.is_active }).eq('id', pincode.id)
    fetchCities()
  }

  const toggleAllPincodes = async (city: CityWithPincodes, active: boolean) => {
    await supabase.from('pincodes').update({ is_active: active }).eq('city_id', city.id)
    await logAction('pincodes_bulk', `${city.name}: all pincodes ${active ? 'activated' : 'deactivated'}`)
    fetchCities()
  }

  const addPincode = async (cityId: string) => {
    if (!newPincode.trim()) return
    await supabase.from('pincodes').insert({ city_id: cityId, pincode: newPincode.trim(), area_name: newAreaName.trim() || null, is_active: true })
    setNewPincode(''); setNewAreaName(''); setShowAddPincode(null)
    fetchCities()
  }

  const exportPincodes = () => {
    const rows: any[] = []
    for (const city of cities) {
      for (const p of city.pincodes || []) {
        rows.push({ City: city.name, Pincode: p.pincode, Area: p.area_name || '', Status: p.is_active ? 'Active' : 'Inactive', 'City Active': city.is_active ? 'Yes' : 'No' })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pincodes')
    XLSX.writeFile(wb, 'pincodes.xlsx')
  }

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading cities...</div>

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">City & Pincode Management</h1>
        <div className="flex gap-2">
          <button onClick={exportPincodes} className="btn-secondary text-sm"><Download size={16} /> Export</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus size={16} /> Add City</button>
        </div>
      </div>

      {cities.length === 0 ? (
        <EmptyState icon={<MapPin size={48} />} title="No cities added" description="Add cities to control service availability." />
      ) : (
        <div className="space-y-3">
          {cities.map(city => (
            <div key={city.id} className="card overflow-hidden">
              <div className="flex items-start justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{city.name}</p>
                    <span className={`badge ${city.is_active ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {city.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {city.service_paused && (
                      <span className="badge bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300">Paused</span>
                    )}
                    <span className="text-xs text-gray-400">{city.pincodes?.length || 0} pincodes</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-gray-500">Commission %</label>
                    <input
                      type="number"
                      defaultValue={city.commission_pct}
                      onBlur={e => updateCommission(city, parseFloat(e.target.value) || 10)}
                      className="input h-7 w-16 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button onClick={() => toggleCity(city)} title={city.is_active ? 'Deactivate city' : 'Activate city'} className="btn-ghost p-1.5">
                    {city.is_active ? <ToggleRight size={20} className="text-success-600" /> : <ToggleLeft size={20} className="text-gray-400" />}
                  </button>
                  <button onClick={() => togglePause(city)} title={city.service_paused ? 'Resume service' : 'Pause service'} className="btn-ghost p-1.5">
                    {city.service_paused ? <Play size={16} className="text-success-500" /> : <Pause size={16} className="text-warning-500" />}
                  </button>
                  <button
                    onClick={() => setExpandedCity(expandedCity === city.id ? null : city.id)}
                    className="btn-ghost p-1.5"
                  >
                    {expandedCity === city.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>
              </div>

              {expandedCity === city.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Pincodes</p>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAllPincodes(city, true)} className="text-xs text-success-600 dark:text-success-400 font-medium">Activate All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => toggleAllPincodes(city, false)} className="text-xs text-error-600 dark:text-error-400 font-medium">Deactivate All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setShowAddPincode(city.id)} className="text-xs font-medium" style={{ color: '#556d34' }}>+ Add</button>
                    </div>
                  </div>
                  {showAddPincode === city.id && (
                    <div className="mb-3 flex gap-2 flex-wrap">
                      <input className="input h-8 flex-1 min-w-24 py-1 text-sm" value={newPincode} onChange={e => setNewPincode(e.target.value)} placeholder="Pincode" maxLength={6} />
                      <input className="input h-8 flex-1 min-w-32 py-1 text-sm" value={newAreaName} onChange={e => setNewAreaName(e.target.value)} placeholder="Area name (optional)" />
                      <button onClick={() => addPincode(city.id)} className="btn-primary h-8 px-3 text-sm">Add</button>
                      <button onClick={() => setShowAddPincode(null)} className="btn-ghost h-8 px-2"><X size={14} /></button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {(city.pincodes || []).map(p => (
                      <div key={p.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${p.is_active ? 'bg-success-50 dark:bg-success-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                        <div>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{p.pincode}</span>
                          {p.area_name && <span className="ml-2 text-xs text-gray-500">{p.area_name}</span>}
                        </div>
                        <button onClick={() => togglePincode(p)} className="btn-ghost p-1">
                          {p.is_active
                            ? <ToggleRight size={18} className="text-success-600" />
                            : <ToggleLeft size={18} className="text-gray-400" />}
                        </button>
                      </div>
                    ))}
                    {(city.pincodes || []).length === 0 && (
                      <p className="text-xs text-gray-400 col-span-2">No pincodes added yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4" onClick={() => setShowAdd(false)}>
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add City</h3>
              <button onClick={() => setShowAdd(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">City Name</label>
                <input className="input" value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="e.g. Hyderabad" />
              </div>
              <div>
                <label className="label">Commission %</label>
                <input type="number" className="input" value={commission} onChange={e => setCommission(e.target.value)} />
              </div>
              {error && <ErrorBanner message={error} />}
            </div>
            <button onClick={addCity} disabled={!newCity} className="btn-primary mt-4 w-full">Add City</button>
          </div>
        </div>
      )}
    </div>
  )
}
