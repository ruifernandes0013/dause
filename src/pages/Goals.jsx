import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, CheckCircle2, Circle,
  Target, ListTodo, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const GOAL_CATEGORIES = [
  'Revenue', 'Occupancy', 'Guest Experience', 'Property', 'Marketing', 'Other',
]

const PRIORITY_META = {
  high:   { label: 'High',   color: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-500' },
}

const CATEGORY_COLORS = {
  Revenue:           'bg-emerald-100 text-emerald-700',
  Occupancy:         'bg-blue-100 text-blue-700',
  'Guest Experience':'bg-purple-100 text-purple-700',
  Property:          'bg-orange-100 text-orange-700',
  Marketing:         'bg-pink-100 text-pink-700',
  Other:             'bg-slate-100 text-slate-600',
}

// ─── Curated seed data ───────────────────────────────────────────────────────

const SEED_GOALS = [
  {
    type: 'goal', category: 'Occupancy', target_value: 75, status: 'active',
    title: 'Occupancy Rate ≥ 75%',
    description: 'Industry benchmark for profitable STRs. Below 60% signals a pricing or listing problem. Track monthly in Reports.',
  },
  {
    type: 'goal', category: 'Revenue', target_value: 1500, status: 'active',
    title: 'Monthly Net Revenue ≥ €1,500',
    description: 'Minimum net after all expenses to justify the investment. Raise target once occupancy is stable.',
  },
  {
    type: 'goal', category: 'Revenue', target_value: 18000, status: 'active',
    title: 'Annual Net Revenue ≥ €18,000',
    description: 'Healthy ROI benchmark for a Portugal rental. Represents ~€1,500/month net consistently.',
  },
  {
    type: 'goal', category: 'Revenue', target_value: 80, status: 'active',
    title: 'Average Nightly Rate ≥ €80',
    description: 'Baseline ADR for a well-positioned property in Portugal. Adjust up in peak season (Jun–Sep) and for local events.',
  },
  {
    type: 'goal', category: 'Revenue', target_value: 15, status: 'active',
    title: 'Keep Platform Commission < 15%',
    description: 'Airbnb charges ~3% host fee; Booking.com charges ~15%. Shift more volume to Airbnb and Direct to lower blended rate.',
  },
  {
    type: 'goal', category: 'Guest Experience', target_value: 4.8, status: 'active',
    title: 'Guest Rating ≥ 4.8★ on Airbnb',
    description: 'Required for Superhost status. Below 4.7 risks lower search placement. Every 5-star review compounds visibility.',
  },
  {
    type: 'goal', category: 'Marketing', target_value: 20, status: 'active',
    title: 'Direct Bookings ≥ 20% of nights',
    description: 'Every direct booking saves ~15% commission. Build a repeat-guest list and offer a small discount to incentivise it.',
  },
]

const SEED_TODOS = [
  {
    type: 'todo', priority: 'high', status: 'active',
    title: 'Enable dynamic pricing',
    description: 'Use Airbnb Smart Pricing or PriceLabs to automatically adjust rates by season, demand, and local events. Can increase revenue 15–30%.',
  },
  {
    type: 'todo', priority: 'high', status: 'active',
    title: 'Update listing with professional photos',
    description: 'Listings with pro photos earn 20–35% more per booking. Prioritise the main photo — it determines click-through rate.',
  },
  {
    type: 'todo', priority: 'high', status: 'active',
    title: 'Set seasonal minimum prices',
    description: 'Set a higher floor price for summer (Jun–Sep), Christmas, Easter, and Portuguese national holidays (e.g. Apr 25, Jun 10).',
  },
  {
    type: 'todo', priority: 'high', status: 'active',
    title: 'Set up a direct booking option',
    description: 'A simple WhatsApp link or booking page for repeat guests. Saves ~15% per booking. Even a Google Form + bank transfer works to start.',
  },
  {
    type: 'todo', priority: 'medium', status: 'active',
    title: 'Create a digital welcome guide',
    description: 'Notion page or PDF with WiFi password, check-out rules, appliance instructions, and local tips. Reduces guest messages by ~40%.',
  },
  {
    type: 'todo', priority: 'medium', status: 'active',
    title: 'Set weekend minimum stay to 3 nights',
    description: 'Prevents 1-night Friday bookings that increase turnover cost without proportional revenue. Exceptions for last-minute gaps.',
  },
  {
    type: 'todo', priority: 'medium', status: 'active',
    title: 'Optimise listing title and description',
    description: 'Include neighbourhood, top amenities (pool, parking, AC), and proximity to attractions. Refresh every season with current selling points.',
  },
  {
    type: 'todo', priority: 'medium', status: 'active',
    title: 'Apply for Airbnb Superhost',
    description: 'Requires 4.8+ rating, 10+ stays/year, <1% cancellation rate. Superhost badge increases bookings and allows higher pricing.',
  },
  {
    type: 'todo', priority: 'medium', status: 'active',
    title: 'Respond to every guest review',
    description: 'Reply to all reviews — positive and negative. Shows professionalism and boosts Airbnb/Booking search ranking.',
  },
  {
    type: 'todo', priority: 'low', status: 'active',
    title: 'Add small premium amenities',
    description: 'Coffee machine, extra towels, welcome basket, or fast WiFi (>100 Mbps). Low cost, high review impact. Guests mention amenities in 60% of reviews.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_TODO = { type: 'todo', title: '', description: '', priority: 'medium', status: 'active' }
const EMPTY_GOAL = { type: 'goal', title: '', description: '', category: 'Revenue', target_value: '', status: 'active' }

export default function Goals() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('todo')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_TODO)
  const [saving, setSaving] = useState(false)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) { console.error(error); setLoading(false); return }

    if (!data || data.length === 0) {
      await seedDefaults()
    } else {
      setItems(data)
      setLoading(false)
    }
  }

  async function seedDefaults() {
    const seed = [...SEED_TODOS, ...SEED_GOALS]
    const { data, error } = await supabase.from('goals').insert(seed).select()
    if (error) console.error(error)
    setItems(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(tab === 'todo' ? { ...EMPTY_TODO } : { ...EMPTY_GOAL })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ ...item, target_value: item.target_value ?? '' })
    setShowModal(true)
  }

  async function toggleDone(item) {
    const next = item.status === 'done' ? 'active' : 'done'
    const { error } = await supabase
      .from('goals')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i))
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      type: tab === 'todo' ? 'todo' : 'goal',
      title: form.title.trim(),
      description: form.description || null,
      status: 'active',
      priority: form.priority || 'medium',
      target_value: form.target_value !== '' ? +form.target_value : null,
      category: form.category || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editing.id)
      if (!error) await fetchData()
    } else {
      const { error } = await supabase.from('goals').insert(payload)
      if (!error) await fetchData()
    }
    setSaving(false)
    setShowModal(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  const todos = items.filter(i => i.type === 'todo')
  const goals = items.filter(i => i.type === 'goal')

  const activeTodos = todos.filter(i => i.status === 'active')
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
  const doneTodos = todos.filter(i => i.status === 'done')

  const activeGoals = goals.filter(i => i.status === 'active')
  const doneGoals   = goals.filter(i => i.status === 'done')

  const doneCount   = tab === 'todo' ? doneTodos.length : doneGoals.length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Goals & To Do</h1>
          <p className="text-sm text-slate-500 mt-0.5">Key targets and actions to improve your rental results</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add {tab === 'todo' ? 'Task' : 'Goal'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('todo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'todo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListTodo size={15} /> To Do
          {activeTodos.length > 0 && tab !== 'todo' && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{activeTodos.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('goals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'goals' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Target size={15} /> Goals & KPIs
          {activeGoals.length > 0 && tab !== 'goals' && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{activeGoals.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {tab === 'todo' ? (
            activeTodos.length === 0
              ? <EmptyState label="All done — add a new task to keep improving." />
              : activeTodos.map(item => (
                  <TodoCard key={item.id} item={item} onToggle={toggleDone} onEdit={openEdit} onDelete={handleDelete} />
                ))
          ) : (
            activeGoals.length === 0
              ? <EmptyState label="No active goals — add a KPI target to pursue." />
              : activeGoals.map(item => (
                  <GoalCard key={item.id} item={item} onToggle={toggleDone} onEdit={openEdit} onDelete={handleDelete} />
                ))
          )}

          {doneCount > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowDone(v => !v)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showDone ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {doneCount} completed
              </button>
              {showDone && (
                <div className="mt-2 space-y-2 opacity-50">
                  {tab === 'todo'
                    ? doneTodos.map(item => (
                        <TodoCard key={item.id} item={item} onToggle={toggleDone} onEdit={openEdit} onDelete={handleDelete} />
                      ))
                    : doneGoals.map(item => (
                        <GoalCard key={item.id} item={item} onToggle={toggleDone} onEdit={openEdit} onDelete={handleDelete} />
                      ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="space-y-4 w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-800">
              {editing ? 'Edit' : 'Add'} {tab === 'todo' ? 'Task' : 'Goal'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={tab === 'todo' ? 'e.g. Replace kitchen faucet' : 'e.g. Occupancy Rate ≥ 80%'}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  rows={2}
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional context or notes…"
                />
              </div>
              {tab === 'todo' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <div className="flex gap-2">
                    {['high', 'medium', 'low'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, priority: p }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.priority === p
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'goals' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={form.category || 'Revenue'}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Target value (€ or %)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={form.target_value}
                      onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
                      placeholder="e.g. 1500"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TodoCard({ item, onToggle, onEdit, onDelete }) {
  const done = item.status === 'done'
  const pm = PRIORITY_META[item.priority] || PRIORITY_META.medium
  return (
    <div className={`bg-white border rounded-xl px-4 py-3.5 flex items-start gap-3 group transition-all ${
      done ? 'border-slate-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}>
      <button onClick={() => onToggle(item)} className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
        {done ? <CheckCircle2 size={18} className="text-indigo-400" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</p>
        {item.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>}
      </div>
      <div className="flex items-start gap-2 shrink-0 pt-0.5">
        {!done && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.color}`}>{pm.label}</span>
        )}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-1 text-slate-400 hover:text-slate-700 rounded">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function GoalCard({ item, onToggle, onEdit, onDelete }) {
  const done = item.status === 'done'
  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other

  const targetLabel = item.target_value != null
    ? item.category === 'Occupancy' || item.category === 'Marketing'
      ? `${item.target_value}%`
      : item.category === 'Guest Experience'
      ? `${item.target_value}★`
      : item.category === 'Revenue' && item.target_value < 100
      ? `${item.target_value}%`
      : `€${Number(item.target_value).toLocaleString('pt-PT')}`
    : null

  return (
    <div className={`bg-white border rounded-xl px-4 py-3.5 flex items-start gap-3 group transition-all ${
      done ? 'border-slate-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}>
      <button onClick={() => onToggle(item)} className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
        {done ? <CheckCircle2 size={18} className="text-indigo-400" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</p>
          {targetLabel && (
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{targetLabel}</span>
          )}
        </div>
        {item.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>}
        {item.category && (
          <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{item.category}</span>
        )}
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
        <button onClick={() => onEdit(item)} className="p-1 text-slate-400 hover:text-slate-700 rounded">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  )
}
