import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import {
  formatCurrency, SOURCES, MONTHS, SOURCE_BADGE,
  nightsBetween, YEAR_OPTIONS,
} from '../utils/formatters'

const EMPTY = {
  source: 'Booking',
  reservation_id: '',
  check_in: '',
  check_out: '',
  guests: 1,
  total_payout: '',
  commission: '',
  discount: '',
  notes: '',
}

export default function Reservations() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: '',
    source: '',
  })

  useEffect(() => { fetchData() }, [filters.year])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('check_in', `${filters.year}-01-01`)
      .lte('check_in', `${filters.year}-12-31`)
      .order('check_in', { ascending: true })
    if (error) console.error(error)
    setReservations(data || [])
    setLoading(false)
  }

  const filtered = reservations.filter(r => {
    if (filters.month && new Date(r.check_in).getMonth() + 1 !== +filters.month) return false
    if (filters.source && r.source !== filters.source) return false
    return true
  })

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      source: r.source,
      reservation_id: r.reservation_id || '',
      check_in: r.check_in,
      check_out: r.check_out,
      guests: r.guests || 1,
      total_payout: r.total_payout,
      commission: r.commission || '',
      discount: r.discount || '',
      notes: r.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      source: form.source,
      reservation_id: form.reservation_id || null,
      check_in: form.check_in,
      check_out: form.check_out,
      guests: +form.guests || 1,
      total_payout: +form.total_payout || 0,
      commission: +form.commission || 0,
      discount: +form.discount || 0,
      notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('reservations').update(payload).eq('id', editing)
      if (error) console.error(error)
    } else {
      const { error } = await supabase.from('reservations').insert(payload)
      if (error) console.error(error)
    }
    setSaving(false)
    setShowModal(false)
    fetchData()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this reservation?')) return
    await supabase.from('reservations').delete().eq('id', id)
    fetchData()
  }

  // Summary totals for filtered view
  const totalPayout = filtered.reduce((s, r) => s + +r.total_payout, 0)
  const totalCommission = filtered.reduce((s, r) => s + +(r.commission || 0), 0)
  const totalDiscount = filtered.reduce((s, r) => s + +(r.discount || 0), 0)
  const totalNet = totalPayout - totalCommission - totalDiscount
  const totalNights = filtered.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)

  const field = (label, children) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )

  const input = (props) => (
    <input
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
    />
  )

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reservations</h1>
          <p className="text-slate-500 text-sm">{filtered.length} results</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
        >
          <Plus size={15} /> Add Reservation
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
          value={filters.source}
          onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Bookings', val: filtered.length, cls: 'text-slate-700' },
          { label: 'Total Payout', val: formatCurrency(totalPayout), cls: 'text-indigo-600' },
          { label: 'Commissions', val: formatCurrency(totalCommission), cls: 'text-amber-600' },
          { label: 'Discounts', val: formatCurrency(totalDiscount), cls: 'text-orange-500' },
          { label: 'Net Revenue', val: formatCurrency(totalNet), cls: 'text-emerald-600' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100 text-center">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-base font-bold ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Reservation ID</th>
              <th className="text-left p-3">Check In</th>
              <th className="text-left p-3">Check Out</th>
              <th className="text-center p-3">Nights</th>
              <th className="text-center p-3">Guests</th>
              <th className="text-right p-3">Payout</th>
              <th className="text-right p-3">Commission</th>
              <th className="text-right p-3">Discount</th>
              <th className="text-right p-3">Net</th>
              <th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400">
                  No reservations found for this filter.
                </td>
              </tr>
            ) : filtered.map(r => {
              const net = +r.total_payout - +(r.commission || 0) - +(r.discount || 0)
              return (
                <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 font-mono text-xs truncate max-w-[120px]">
                    {r.reservation_id || '—'}
                  </td>
                  <td className="p-3 text-slate-700 tabular-nums">
                    {new Date(r.check_in).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="p-3 text-slate-700 tabular-nums">
                    {new Date(r.check_out).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="p-3 text-center text-slate-600">
                    {nightsBetween(r.check_in, r.check_out)}
                  </td>
                  <td className="p-3 text-center text-slate-600">{r.guests || 1}</td>
                  <td className="p-3 text-right font-medium text-slate-700 tabular-nums">
                    {formatCurrency(r.total_payout)}
                  </td>
                  <td className="p-3 text-right text-amber-600 tabular-nums">
                    {r.commission > 0 ? formatCurrency(r.commission) : '—'}
                  </td>
                  <td className="p-3 text-right text-orange-500 tabular-nums">
                    {r.discount > 0 ? formatCurrency(r.discount) : '—'}
                  </td>
                  <td className="p-3 text-right font-medium text-emerald-600 tabular-nums">
                    {formatCurrency(net)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-sm">
                <td colSpan={6} className="p-3 text-slate-600">
                  Total — {totalNights} nights
                </td>
                <td className="p-3 text-right text-slate-700 tabular-nums">
                  {formatCurrency(totalPayout)}
                </td>
                <td className="p-3 text-right text-amber-600 tabular-nums">
                  {formatCurrency(totalCommission)}
                </td>
                <td className="p-3 text-right text-orange-500 tabular-nums">
                  {formatCurrency(totalDiscount)}
                </td>
                <td className="p-3 text-right text-emerald-600 tabular-nums">
                  {formatCurrency(totalNet)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Edit Reservation' : 'Add Reservation'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {field('Source',
                <select
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  required
                >
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {field('Reservation ID',
                input({
                  type: 'text',
                  value: form.reservation_id,
                  onChange: e => setForm(f => ({ ...f, reservation_id: e.target.value })),
                  placeholder: 'Optional',
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {field('Check In',
                input({
                  type: 'date',
                  value: form.check_in,
                  onChange: e => setForm(f => ({ ...f, check_in: e.target.value })),
                  required: true,
                })
              )}
              {field('Check Out',
                input({
                  type: 'date',
                  value: form.check_out,
                  onChange: e => setForm(f => ({ ...f, check_out: e.target.value })),
                  required: true,
                  min: form.check_in,
                })
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {field('Guests',
                input({
                  type: 'number', min: 1,
                  value: form.guests,
                  onChange: e => setForm(f => ({ ...f, guests: e.target.value })),
                })
              )}
              {field('Total Payout (€)',
                input({
                  type: 'number', step: '0.01', min: 0,
                  value: form.total_payout,
                  onChange: e => setForm(f => ({ ...f, total_payout: e.target.value })),
                  required: true,
                  placeholder: '0.00',
                })
              )}
              {field('Commission (€)',
                input({
                  type: 'number', step: '0.01', min: 0,
                  value: form.commission,
                  onChange: e => setForm(f => ({ ...f, commission: e.target.value })),
                  placeholder: '0.00',
                })
              )}
              {field('Discount (€)',
                input({
                  type: 'number', step: '0.01', min: 0,
                  value: form.discount,
                  onChange: e => setForm(f => ({ ...f, discount: e.target.value })),
                  placeholder: '0.00',
                })
              )}
            </div>

            {/* Net preview */}
            {(form.total_payout || form.commission || form.discount) && (
              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="text-emerald-700 font-medium">Net Revenue Preview</span>
                <span className="text-emerald-700 font-bold">
                  {formatCurrency(
                    (+form.total_payout || 0) - (+form.commission || 0) - (+form.discount || 0)
                  )}
                </span>
              </div>
            )}

            {field('Notes',
              input({
                type: 'text',
                value: form.notes,
                onChange: e => setForm(f => ({ ...f, notes: e.target.value })),
                placeholder: 'Optional',
              })
            )}

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
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Reservation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
