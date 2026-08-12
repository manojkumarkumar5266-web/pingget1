import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, X, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { AdminShell, AdminHeader } from './adminChrome'
import { pg } from '../../design/tokens'

type Category = {
  id: string
  name: string
  icon: string
  sort_order: number
  is_active: boolean
}

type Item = {
  id: string
  name: string
  category_id: string
  sort_order: number
  is_active: boolean
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Record<string, Item[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [showAddItem, setShowAddItem] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    const { data: cats } = await supabase.from('categories').select('*').order('sort_order')
    setCategories((cats as Category[]) || [])
    const { data: allItems } = await supabase.from('items').select('*').order('sort_order')
    const itemMap: Record<string, Item[]> = {}
    ;(allItems as Item[] || []).forEach(item => {
      if (!itemMap[item.category_id]) itemMap[item.category_id] = []
      itemMap[item.category_id].push(item)
    })
    setItems(itemMap)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const addCategory = async () => {
    if (!newCatName.trim()) return
    const { error } = await supabase.from('categories').insert({
      name: newCatName.trim(),
      icon: newCatIcon || '📦',
      sort_order: categories.length + 1,
      is_active: true,
    })
    if (!error) {
      setNewCatName(''); setNewCatIcon('📦'); setShowAddCat(false); fetchAll()
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category and all its items?')) return
    await supabase.from('categories').delete().eq('id', id)
    fetchAll()
  }

  const addItem = async (categoryId: string) => {
    if (!newItemName.trim()) return
    const catItems = items[categoryId] || []
    const { error } = await supabase.from('items').insert({
      category_id: categoryId,
      name: newItemName.trim(),
      sort_order: catItems.length + 1,
      is_active: true,
    })
    if (!error) {
      setNewItemName(''); setShowAddItem(null); fetchAll()
    }
  }

  const deleteItem = async (id: string) => {
    await supabase.from('items').delete().eq('id', id)
    fetchAll()
  }

  const toggleCategoryActive = async (cat: Category) => {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    fetchAll()
  }

  return (
    <AdminShell>
      <AdminHeader title="Categories & Items" action={
        <button onClick={() => setShowAddCat(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={16} /> Add Category
        </button>
      } />

      <div className="mx-auto max-w-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-white/60" />
          </div>
        ) : categories.length === 0 ? (
          <p className="py-8 text-center text-sm text-black/40">No categories yet. Add one to get started.</p>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => {
              const catItems = items[cat.id] || []
              const isOpen = expanded === cat.id
              return (
                <div key={cat.id} className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3 p-3">
                    <button onClick={() => setExpanded(isOpen ? null : cat.id)} className="flex flex-1 items-center gap-2 text-left">
                      {isOpen ? <ChevronDown size={16} className="text-black/40" /> : <ChevronRight size={16} className="text-black/40" />}
                      <span className="text-xl">{cat.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-[#0F1A14]">{cat.name}</p>
                        <p className="text-xs text-black/40">{catItems.length} item{catItems.length === 1 ? '' : 's'} · {cat.is_active ? 'Active' : 'Inactive'}</p>
                      </div>
                    </button>
                    <button onClick={() => toggleCategoryActive(cat)} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cat.is_active ? 'bg-green-500/20 text-green-400' : 'bg-black/5 text-black/40'}`}>
                      {cat.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} className="text-black/30 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/8 px-3 py-2">
                      {catItems.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {catItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2">
                              <span className="text-sm text-black/75">{item.name}</span>
                              <button onClick={() => deleteItem(item.id)} className="text-black/30 hover:text-red-400">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {showAddItem === cat.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            placeholder="Item name"
                            className="flex-1 rounded-lg px-3 py-2 text-sm text-[#0F1A14] outline-none"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                            onKeyDown={e => { if (e.key === 'Enter') addItem(cat.id) }}
                          />
                          <button onClick={() => addItem(cat.id)} className="rounded-lg px-3 py-2 text-sm font-bold text-black" style={{ background: '#facc15' }}>
                            Add
                          </button>
                          <button onClick={() => { setShowAddItem(null); setNewItemName('') }} className="rounded-lg px-2 py-2 text-black/40">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setShowAddItem(cat.id)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-black/50 hover:text-black/75">
                          <Plus size={14} /> Add Item
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F4F6F5]/60" onClick={() => setShowAddCat(false)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl p-5" style={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F1A14]">Add Category</h2>
              <button onClick={() => setShowAddCat(false)} className="text-black/40"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Icon (emoji)</label>
                <input className="input" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="📦" maxLength={4} />
              </div>
              <div>
                <label className="label">Category Name</label>
                <input className="input" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Biryani, Groceries" onKeyDown={e => { if (e.key === 'Enter') addCategory() }} />
              </div>
              <button onClick={addCategory} disabled={!newCatName.trim()} className="btn-primary w-full disabled:opacity-40">
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
