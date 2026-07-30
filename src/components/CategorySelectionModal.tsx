import { useState, useMemo } from 'react'
import { X, Search, Plus, Minus, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { FOOD_CATEGORIES, type FoodCategory, type FoodItem } from '../data/foodData'
import { MEDICINE_LIST, MEDICINE_CATEGORIES, type MedicineItem } from '../data/medicineData'
import {
  GROCERY_CATEGORIES, PARCEL_TYPES, STATIONERY_ITEMS,
  HARDWARE_ITEMS, PERSONAL_CARE_ITEMS, GIFT_ITEMS,
  type GroceryCategory, type GroceryItem, type ParcelType,
} from '../data/groceryData'

export type SelectedItem = {
  name: string
  quantity: number
  price: number
}

export type CategorySelection = {
  category: string
  items: SelectedItem[]
}

type Props = {
  category: string
  onClose: () => void
  onSave: (selection: CategorySelection) => void
}

type SimpleItem = { name: string; price: number; unit?: string }

function getCategoryData(category: string): { type: 'food' | 'medicine' | 'grouped' | 'simple' | 'parcel'; data: any } {
  switch (category) {
    case 'Food':
      return { type: 'food', data: FOOD_CATEGORIES }
    case 'Medicine':
      return { type: 'medicine', data: MEDICINE_LIST }
    case 'Groceries':
      return { type: 'grouped', data: GROCERY_CATEGORIES }
    case 'Parcel':
      return { type: 'parcel', data: PARCEL_TYPES }
    case 'Stationery':
      return { type: 'simple', data: STATIONERY_ITEMS }
    case 'Hardware':
      return { type: 'simple', data: HARDWARE_ITEMS }
    case 'Gifts':
      return { type: 'simple', data: GIFT_ITEMS }
    case 'Personal Care':
      return { type: 'simple', data: PERSONAL_CARE_ITEMS }
    default:
      return { type: 'simple', data: [] }
  }
}

export default function CategorySelectionModal({ category, onClose, onSave }: Props) {
  const { type, data } = getCategoryData(category)
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({})
  const [search, setSearch] = useState('')
  const [activeSub, setActiveSub] = useState<string>(type === 'food' ? FOOD_CATEGORIES[0].name : type === 'medicine' ? MEDICINE_CATEGORIES[0] : type === 'grouped' ? GROCERY_CATEGORIES[0].name : '')

  const toggleItem = (name: string, defaultPrice: number) => {
    setSelected(prev => {
      const next = { ...prev }
      if (next[name]) {
        delete next[name]
      } else {
        next[name] = { name, quantity: 1, price: defaultPrice }
      }
      return next
    })
  }

  const updateQty = (name: string, delta: number) => {
    setSelected(prev => {
      if (!prev[name]) return prev
      const newQty = Math.max(1, prev[name].quantity + delta)
      return { ...prev, [name]: { ...prev[name], quantity: newQty } }
    })
  }

  const updatePrice = (name: string, price: number) => {
    setSelected(prev => {
      if (!prev[name]) return prev
      return { ...prev, [name]: { ...prev[name], price: Math.max(0, price) } }
    })
  }

  const handleSave = () => {
    const items = Object.values(selected)
    if (items.length === 0) { onClose(); return }
    onSave({ category, items })
  }

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) return null
    const q = search.toLowerCase()
    if (type === 'food') {
      return FOOD_CATEGORIES.flatMap((c: FoodCategory) =>
        c.items.filter((item: FoodItem) => item.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      )
    }
    if (type === 'medicine') {
      return MEDICINE_LIST.filter((m: MedicineItem) =>
        m.name.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
      ).map((m: MedicineItem) => ({ name: `${m.brand} - ${m.name}`, price: m.price }))
    }
    if (type === 'grouped') {
      return GROCERY_CATEGORIES.flatMap((c: GroceryCategory) =>
        c.items.filter((item: GroceryItem) => item.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      )
    }
    if (type === 'simple') {
      return (data as SimpleItem[]).filter((item: SimpleItem) => item.name.toLowerCase().includes(q))
    }
    return null
  }, [search, type, data])

  const selectedCount = Object.keys(selected).length
  const totalAmount = Object.values(selected).reduce((s, i) => s + i.quantity * i.price, 0)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:scale-90 transition-transform">
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{category}</h2>
        </div>
        {selectedCount > 0 && (
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {selectedCount} item{selectedCount === 1 ? '' : 's'} · ₹{totalAmount}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${category.toLowerCase()}...`}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sub-category sidebar (food, medicine, grocery) */}
        {(type === 'food' || type === 'medicine' || type === 'grouped') && !search && (
          <div className="w-32 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {(type === 'food' ? FOOD_CATEGORIES : type === 'medicine' ? MEDICINE_CATEGORIES.map((c: string) => ({ name: c, icon: '' })) : GROCERY_CATEGORIES).map((sub: { name: string; icon: string }) => (
              <button
                key={sub.name}
                onClick={() => setActiveSub(sub.name)}
                className={`flex w-full items-center gap-2 px-3 py-3 text-left text-xs font-medium transition-colors ${
                  activeSub === sub.name
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-r-2 border-primary-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {sub.icon && <span className="text-base">{sub.icon}</span>}
                <span className="flex-1">{sub.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {search && filteredItems ? (
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No items found for "{search}"</p>
              ) : (
                filteredItems.map((item: SimpleItem, i: number) => {
                  const name = item.name
                  const price = item.price
                  const sel = selected[name]
                  return (
                    <div key={i} className={`rounded-xl border p-3 transition-all ${sel ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                          <p className="text-xs text-gray-500">₹{price}{item.unit ? ` / ${item.unit}` : ''}</p>
                        </div>
                        {sel ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(name, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 active:scale-90 transition-transform">
                              <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                            </button>
                            <span className="min-w-[24px] text-center text-sm font-bold text-gray-900 dark:text-white">{sel.quantity}</span>
                            <button onClick={() => updateQty(name, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 active:scale-90 transition-transform">
                              <Plus size={14} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => toggleItem(name, price)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 active:scale-90 transition-transform">
                            <Plus size={16} className="text-primary-600 dark:text-primary-400" />
                          </button>
                        )}
                      </div>
                      {sel && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-gray-500">Price ₹</label>
                          <input
                            type="number"
                            value={sel.price}
                            onChange={e => updatePrice(name, Number(e.target.value))}
                            className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-500"
                          />
                          <span className="text-xs text-gray-400">= ₹{sel.quantity * sel.price}</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : type === 'food' ? (
            <div className="space-y-2">
              {FOOD_CATEGORIES.find((c: FoodCategory) => c.name === activeSub)?.items.map((item: FoodItem, i: number) => {
                const sel = selected[item.name]
                return (
                  <div key={i} className={`rounded-xl border p-3 transition-all ${sel ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-500">₹{item.price}</p>
                      </div>
                      {sel ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.name, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 active:scale-90 transition-transform">
                            <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-bold text-gray-900 dark:text-white">{sel.quantity}</span>
                          <button onClick={() => updateQty(item.name, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 active:scale-90 transition-transform">
                            <Plus size={14} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleItem(item.name, item.price)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 active:scale-90 transition-transform">
                          <Plus size={16} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      )}
                    </div>
                    {sel && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Price ₹</label>
                        <input
                          type="number"
                          value={sel.price}
                          onChange={e => updatePrice(item.name, Number(e.target.value))}
                          className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-500"
                        />
                        <span className="text-xs text-gray-400">= ₹{sel.quantity * sel.price}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : type === 'medicine' ? (
            <div className="space-y-2">
              {MEDICINE_LIST.filter((m: MedicineItem) => m.category === activeSub).map((med: MedicineItem, i: number) => {
                const name = `${med.brand} - ${med.name}`
                const sel = selected[name]
                return (
                  <div key={i} className={`rounded-xl border p-3 transition-all ${sel ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                        <p className="text-xs text-gray-500">{med.category} · ₹{med.price}</p>
                      </div>
                      {sel ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(name, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 active:scale-90 transition-transform">
                            <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-bold text-gray-900 dark:text-white">{sel.quantity}</span>
                          <button onClick={() => updateQty(name, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 active:scale-90 transition-transform">
                            <Plus size={14} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleItem(name, med.price)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 active:scale-90 transition-transform">
                          <Plus size={16} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      )}
                    </div>
                    {sel && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Price ₹</label>
                        <input
                          type="number"
                          value={sel.price}
                          onChange={e => updatePrice(name, Number(e.target.value))}
                          className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-500"
                        />
                        <span className="text-xs text-gray-400">= ₹{sel.quantity * sel.price}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : type === 'grouped' ? (
            <div className="space-y-2">
              {GROCERY_CATEGORIES.find((c: GroceryCategory) => c.name === activeSub)?.items.map((item: GroceryItem, i: number) => {
                const sel = selected[item.name]
                return (
                  <div key={i} className={`rounded-xl border p-3 transition-all ${sel ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-500">₹{item.price} / {item.unit}</p>
                      </div>
                      {sel ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.name, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 active:scale-90 transition-transform">
                            <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-bold text-gray-900 dark:text-white">{sel.quantity}</span>
                          <button onClick={() => updateQty(item.name, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 active:scale-90 transition-transform">
                            <Plus size={14} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleItem(item.name, item.price)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 active:scale-90 transition-transform">
                          <Plus size={16} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      )}
                    </div>
                    {sel && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Price ₹</label>
                        <input
                          type="number"
                          value={sel.price}
                          onChange={e => updatePrice(item.name, Number(e.target.value))}
                          className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-500"
                        />
                        <span className="text-xs text-gray-400">= ₹{sel.quantity * sel.price}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : type === 'parcel' ? (
            <div className="space-y-2">
              {PARCEL_TYPES.map((p: ParcelType, i: number) => {
                const sel = selected[p.name]
                return (
                  <div key={i} className={`rounded-xl border p-3 transition-all ${sel ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl">{p.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.description}</p>
                        </div>
                      </div>
                      {sel ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(p.name, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 active:scale-90 transition-transform">
                            <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-bold text-gray-900 dark:text-white">{sel.quantity}</span>
                          <button onClick={() => updateQty(p.name, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 active:scale-90 transition-transform">
                            <Plus size={14} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleItem(p.name, 0)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 active:scale-90 transition-transform">
                          <Plus size={16} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      )}
                    </div>
                    {sel && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Estimated value ₹</label>
                        <input
                          type="number"
                          value={sel.price}
                          onChange={e => updatePrice(p.name, Number(e.target.value))}
                          className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-500"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {(data as SimpleItem[]).map((item: SimpleItem, i: number) => {
                const sel = selected[item.name]
                return (
                  <div key={i} className={`rounded-xl border p-3 transition-all ${sel ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-500">₹{item.price}{item.unit ? ` / ${item.unit}` : ''}</p>
                      </div>
                      {sel ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.name, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 active:scale-90 transition-transform">
                            <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-bold text-gray-900 dark:text-white">{sel.quantity}</span>
                          <button onClick={() => updateQty(item.name, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 active:scale-90 transition-transform">
                            <Plus size={14} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleItem(item.name, item.price)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 active:scale-90 transition-transform">
                          <Plus size={16} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      )}
                    </div>
                    {sel && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Price ₹</label>
                        <input
                          type="number"
                          value={sel.price}
                          onChange={e => updatePrice(item.name, Number(e.target.value))}
                          className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-500"
                        />
                        <span className="text-xs text-gray-400">= ₹{sel.quantity * sel.price}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer save bar */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 pb-6">
        <button
          onClick={handleSave}
          disabled={selectedCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          style={{ background: 'linear-gradient(135deg, #808000, #606000)', color: 'white' }}
        >
          {selectedCount > 0 ? (
            <>Save {selectedCount} item{selectedCount === 1 ? '' : 's'} · ₹{totalAmount}</>
          ) : (
            'Select items to save'
          )}
        </button>
      </div>
    </div>
  )
}
