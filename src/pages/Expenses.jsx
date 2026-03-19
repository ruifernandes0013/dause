import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { formatCurrency, EXPENSE_CATEGORIES, MONTHS, YEAR_OPTIONS } from '../utils/formatters'

const EMPTY = {
  category: 'Água',
  amount: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  notes: '',
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: '',
    category: '',
  })

  useEffect(() => { fetchData() }, [filters.year])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('year', filters.year)
      .order('month')
      .order('created_at')
    if (error) console.error(error)
    setExpenses(data || [])
    setLoading(false)
  }

  const filtered = expenses.filter(e => {
    if (filters.month && e.month !== +filters.month) return false
    if (filters.category && e.category !== filters.category) return false
    return true
  })

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY, year: filters.year, month: filters.month ? +filters.month : new Date().getMonth() + 1 })
    setShowModal(true)
  }

  function openEdit(e) {
    setEditing(e.id)
    setForm({ category: e.category, amount: e.amount, month: e.month, year: e.year, notes: e.notes || '' })
    setShowModal(true)
  }

  async function handleSave(ev) {
    ev.preventDefault()
    setSaving(true)
    const payload = {
      category: form.category,
      amount: +form.amount,
      month: +form.month,
      year: +form.year,
      notes: form.notes || null,
    }
    if (editing) {
      await supabase.from('expenses').update(payload).eq('id', editing)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    fetchData()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchData()
  }

  // Category summary for the filtered set
  const categorySummary = EXPENSE_CATEGORIES.map(cat => ({
    category: cat,
    total: filtered.filter(e => e.category === cat).reduce((s, e) => s + +e.amount, 0),
  })).filter(c => c.total > 0)

  const grandTotal = filtered.reduce((s, e) => s + +e.amount, 0)

  const sel = (props) => (
    <select
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
    />
  )

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Expenses</h1>
          <p className="text-slate-500 text-sm">
            {filtered.length} entries · {formatCurrency(grandTotal)} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
        >
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-wrap gap-2">
        <select
          value={filters.year}
          onChange={e => setFilters(f => ({ ...f, year: +e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filters.month}
          onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Table */}
        <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Period</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Notes</th>
                <th className="p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No expenses found.</td>
                </tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-700">{e.category}</td>
                  <td className="p-3 text-slate-500 text-xs">
                    {MONTHS[e.month - 1]} {e.year}
                  </td>
                  <td className="p-3 text-right font-medium text-red-600 tabular-nums">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{e.notes || '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => openEdit(e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="p-3 font-semibold text-slate-600">Total</td>
                  <td className="p-3 text-right font-bold text-red-600 tabular-nums">
                    {formatCurrency(grandTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Category sidebar summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 h-fit">
          <h3 className="font-semibold text-slate-700 text-sm mb-3">By Category</h3>
          {categorySummary.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-6">No data</p>
          ) : (
            <div className="space-y-2">
              {categorySummary.map(({ category, total }) => {
                const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-600 truncate mr-2">{category}</span>
                      <span className="text-red-600 font-medium shrink-0">{formatCurrency(total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1">
                      <div
                        className="bg-red-400 h-1 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs">
                <span className="font-bold text-slate-700">Total</span>
                <span className="font-bold text-red-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Edit Expense' : 'Add Expense'}
          onClose={() => setShowModal(false)}
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              {sel({
                value: form.category,
                onChange: e => setForm(f => ({ ...f, category: e.target.value })),
                required: true,
                children: EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>),
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
                {sel({
                  value: form.month,
                  onChange: e => setForm(f => ({ ...f, month: e.target.value })),
                  required: true,
                  children: MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>),
                })}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                {sel({
                  value: form.year,
                  onChange: e => setForm(f => ({ ...f, year: e.target.value })),
                  children: YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>),
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (€)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Optional"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
