import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context'
import { Plus, Trash2, ToggleLeft, ToggleRight, GripVertical, X, Save } from 'lucide-react'
import { AdminShell, AdminHeader } from './adminChrome'
import { pg } from '../../design/tokens'

type InfoCard = {
  id: string
  title: string
  description: string
  image_url: string | null
  icon: string
  bg_color: string
  sort_order: number
  is_active: boolean
}

export default function AdminInfoCards() {
  const { profile } = useAuth()
  const [cards, setCards] = useState<InfoCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InfoCard | null>(null)
  const [form, setForm] = useState({ title: '', description: '', icon: '📦', bg_color: 'rgba(196,214,0,0.08)', image_url: '', sort_order: 0 })

  const fetchCards = async () => {
    const { data } = await supabase.from('info_cards').select('*').order('sort_order', { ascending: true })
    setCards((data as InfoCard[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchCards() }, [])

  const toggleActive = async (card: InfoCard) => {
    await supabase.from('info_cards').update({ is_active: !card.is_active }).eq('id', card.id)
    fetchCards()
  }

  const deleteCard = async (id: string) => {
    if (!confirm('Delete this card?')) return
    await supabase.from('info_cards').delete().eq('id', id)
    fetchCards()
  }

  const openNew = () => {
    setEditing(null)
    setForm({ title: '', description: '', icon: '📦', bg_color: 'rgba(196,214,0,0.08)', image_url: '', sort_order: cards.length + 1 })
    setShowModal(true)
  }

  const openEdit = (card: InfoCard) => {
    setEditing(card)
    setForm({ title: card.title, description: card.description, icon: card.icon, bg_color: card.bg_color, image_url: card.image_url || '', sort_order: card.sort_order })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title || !form.description) return
    const payload = { ...form, image_url: form.image_url || null }
    if (editing) {
      await supabase.from('info_cards').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('info_cards').insert(payload)
    }
    setShowModal(false)
    fetchCards()
  }

  if (loading) return <AdminShell><p style={{ color: pg.text3 }}>Loading...</p></AdminShell>

  return (
    <AdminShell>
      <AdminHeader title="Swipe Cards" action={
        <button onClick={openNew} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={16} /> New Card
        </button>
      } />

      <p className="mb-5 text-sm" style={{ color: pg.text3 }}>Cards shown to users on home screen (max 10)</p>

      <div className="mx-auto max-w-2xl">

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/40">No cards yet. Create one to show on the user home screen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center self-stretch">
                  <GripVertical size={16} className="text-white/20" />
                </div>
                <div className="text-2xl">{card.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">{card.title}</p>
                  <p className="text-sm text-white/50 line-clamp-2">{card.description}</p>
                  <p className="mt-1 text-xs text-white/30">Order: {card.sort_order}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(card)} className="transition-transform active:scale-90">
                    {card.is_active
                      ? <ToggleRight size={24} style={{ color: '#C4D600' }} />
                      : <ToggleLeft size={24} className="text-white/30" />}
                  </button>
                  <button onClick={() => openEdit(card)} className="rounded-lg px-2 py-1 text-xs font-semibold text-white/60 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>Edit</button>
                  <button onClick={() => deleteCard(card.id)} className="rounded-lg p-1.5 hover:bg-red-500/10">
                    <Trash2 size={15} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-t-3xl p-5 animate-slide-in-bottom" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editing ? 'Edit Card' : 'New Card'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-white/40" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Icon (emoji)</label>
                <input className="input" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="📦" />
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Card title" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-20 resize-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Card description" />
              </div>
              <div>
                <label className="label">Image URL (optional)</label>
                <input className="input" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Background Color</label>
                <input className="input" value={form.bg_color} onChange={e => setForm({ ...form, bg_color: e.target.value })} placeholder="rgba(196,214,0,0.08)" />
              </div>
              <div>
                <label className="label">Sort Order</label>
                <input type="number" className="input" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2">
                <Save size={16} /> {editing ? 'Update' : 'Create'} Card
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminShell>
  )
}
