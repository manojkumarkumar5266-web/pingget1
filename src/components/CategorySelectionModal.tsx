import { useState, useEffect, useMemo } from 'react'
import { X, Search, Plus, Minus, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type SelectedItem = {
  name: string
  quantity: number
  price: number
}

export type CategorySelection = {
  category: string
  items: SelectedItem[]
}

type DbCategory = {
  id: string
  name: string
  icon: string
}

type DbItem = {
  id: string
  name: string
  category_id: string
}

type Props = {
  category: string
  categoryId?: string
  onClose: () => void
  onSave: (selection: CategorySelection) => void
}

export default function CategorySelectionModal({ category, categoryId, onClose, onSave }: Props) {
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({})
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<DbItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      let query = supabase.from('items').select('id, name, category_id').eq('is_active', true)
      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }
      const { data } = await query.order('sort_order')
      setItems((data as DbItem[]) || [])
      setLoading(false)
    }
    fetchItems()
  }, [categoryId])

  const toggleItem = (name: string) => {
    setSelected(prev => {
      const next = { ...prev }
      if (next[name]) {
        delete next[name]
      } else {
        next[name] = { name, quantity: 1, price: 0 }
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

  const filteredItems = useMemo(() => {
    if (!search) return items
    return items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
  }, [items, search])

  const selectedCount = Object.keys(selected).length
  const totalAmount = Object.values(selected).reduce((s, i) => s + i.quantity * i.price, 0)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#F4F6F5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <X size={20} className="text-black/65" />
          </button>
          <h2 className="text-lg font-bold text-[#0F1A14]">{category}</h2>
        </div>
        {selectedCount > 0 && (
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            {selectedCount} item{selectedCount === 1 ? '' : 's'}{totalAmount > 0 ? ` · ₹${totalAmount}` : ''}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <Search size={18} className="text-black/40 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${category.toLowerCase()}...`}
            className="flex-1 bg-transparent text-sm text-[#0F1A14] outline-none placeholder:text-black/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-black/40">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-white/60" />
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-black/40">
            {search ? `No items found for "${search}"` : 'No items available in this category'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item, i) => {
              const sel = selected[item.name]
              return (
                <div key={item.id || i} className="rounded-xl p-3 transition-all"
                  style={sel
                    ? { border: '1px solid rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.05)' }
                    : { border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0F1A14]">{item.name}</p>
                    </div>
                    {sel ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.name, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform"
                          style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <Minus size={14} className="text-black/65" />
                        </button>
                        <span className="min-w-[24px] text-center text-sm font-bold text-[#0F1A14]">{sel.quantity}</span>
                        <button onClick={() => updateQty(item.name, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform"
                          style={{ background: '#facc15' }}>
                          <Plus size={14} className="text-black" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => toggleItem(item.name)}
                        className="flex h-8 w-8 items-center justify-center rounded-full active:scale-90 transition-transform"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <Plus size={16} className="text-black/65" />
                      </button>
                    )}
                  </div>
                  {sel && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-black/50">Your price ₹</label>
                      <input
                        type="number"
                        value={sel.price || ''}
                        onChange={e => updatePrice(item.name, Number(e.target.value))}
                        placeholder="0"
                        className="w-24 rounded-lg px-2 py-1 text-sm text-[#0F1A14] outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                      />
                      {sel.price > 0 && (
                        <span className="text-xs text-black/40">= ₹{sel.quantity * sel.price}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer save bar */}
      <div className="px-4 py-3 pb-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={handleSave}
          disabled={selectedCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
          style={{ background: selectedCount > 0 ? '#facc15' : 'rgba(255,255,255,0.08)', color: selectedCount > 0 ? '#000' : 'rgba(255,255,255,0.4)' }}>
          {selectedCount > 0 ? (
            <>Save {selectedCount} item{selectedCount === 1 ? '' : 's'}{totalAmount > 0 ? ` · ₹${totalAmount}` : ''} <ChevronRight size={18} /></>
          ) : (
            'Select items to save'
          )}
        </button>
      </div>
    </div>
  )
}
