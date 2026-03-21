import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, CheckCircle2, Circle,
  Target, ListTodo, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { formatCurrency } from '../utils/formatters'

const GOAL_CATEGORIES = [
  'Revenue', 'Occupancy', 'Guest Experience', 'Property', 'Marketing', 'Other',
]

const PRIORITY_META = {
  high:   { label: 'High',   color: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-500' },
}

const EMPTY_TODO = { type: 'todo', title: '', description: '', priority: 'medium', status: 'active' }
const EMPTY_GOAL = { type: 'goal', title: '', description: '', category: 'Revenue', target_value: '', status: 'active' }

export default function Goals() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('todo') // 'todo' | 'goals'
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
      status: form.status || 'active',
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
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
  const doneTodos = todos.filter(i => i.status === 'done')

  const activeGoals = goals.filter(i => i.status === 'active')
  const doneGoals = goals.filter(i => i.status === 'done')

  const doneCount = tab === 'todo' ? doneTodos.length : doneGoals.length
  const activeCount = tab === 'todo' ? activeTodos.length : activeGoals.length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Goals & To Do</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track improvements and targets for your property</p>
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
          <Target size={15} /> Goals
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
          {/* Active items */}
          {tab === 'todo' ? (
            activeTodos.length === 0 ? (
              <EmptyState label="No tasks yet — add something to work on." />
            ) : (
              activeTodos.map(item => (
                <TodoCard key={item.id} item={item} onToggle={toggleDone} onEdit={openEdit} onDelete={handleDelete} />
              ))
            )
          ) : (
            activeGoals.length === 0 ? (
              <EmptyState label="No goals yet — set a target to pursue." />
            ) : (
              activeGoals.map(item => (
                <GoalCard key={item.id} item={item} onToggle={toggleDone} onEdit={openEdit} onDelete={handleDelete} />
              ))
            )
          )}

          {/* Done section */}
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
                <div className="mt-2 space-y-2 opacity-60">
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
                  placeholder={tab === 'todo' ? 'e.g. Replace kitchen faucet' : 'e.g. Reach 80% occupancy rate'}
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
                  placeholder="Optional notes…"
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
                    <label className="block text-xs font-medium text-slate-600 mb-1">Target value (€, %, or leave blank)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={form.target_value}
                      onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
                      placeholder="e.g. 2500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
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
    <div className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 group transition-all ${done ? 'border-slate-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
      <button onClick={() => onToggle(item)} className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
        {done ? <CheckCircle2 size={18} className="text-indigo-400" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</p>
        {item.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!done && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.color}`}>{pm.label}</span>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-1 text-slate-400 hover:text-slate-700 rounded">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function GoalCard({ item, onToggle, onEdit, onDelete }) {
  const done = item.status === 'done'
  const CATEGORY_COLORS = {
    Revenue: 'bg-emerald-100 text-emerald-700',
    Occupancy: 'bg-blue-100 text-blue-700',
    'Guest Experience': 'bg-purple-100 text-purple-700',
    Property: 'bg-orange-100 text-orange-700',
    Marketing: 'bg-pink-100 text-pink-700',
    Other: 'bg-slate-100 text-slate-600',
  }
  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other
  return (
    <div className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 group transition-all ${done ? 'border-slate-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
      <button onClick={() => onToggle(item)} className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
        {done ? <CheckCircle2 size={18} className="text-indigo-400" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</p>
        {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.category && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{item.category}</span>
          )}
          {item.target_value != null && (
            <span className="text-xs text-slate-500 font-medium">
              Target: {item.category === 'Occupancy' ? `${item.target_value}%` : formatCurrency(item.target_value)}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(item)} className="p-1 text-slate-400 hover:text-slate-700 rounded">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
          <Trash2 size={14} />
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
