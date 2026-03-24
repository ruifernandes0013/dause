import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, X, RefreshCw, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import {
  formatCurrency, SOURCES, MONTHS, SOURCE_BADGE,
  nightsBetween, YEAR_OPTIONS, EXPENSE_CATEGORIES,
} from '../utils/formatters'

const EMPTY_RES = {
  source: 'Booking',
  reservation_id: '',
  guest_name: '',
  check_in: '',
  check_out: '',
  guests: 1,
  total_payout: '',
  commission: '',
  discount: '',
  notes: '',
}

const EMPTY_EXP = {
  category: 'Água',
  amount: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  notes: '',
}

const CAT_COLORS = [
  '#6366f1','#f59e0b','#ef4444','#10b981','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7','#64748b',
]

function getBookingLink(source, reservationId) {
  if (!reservationId) return null
  if (source === 'Airbnb')
    return `https://www.airbnb.pt/multicalendar/1544429398201323521/reservation/${reservationId}`
  if (source === 'Booking')
    return `https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=${reservationId}&hotel_id=15732899`
  if (source === 'Direct')
    return `https://app.ynnov.pt/reservations/${reservationId}/edit`
  return null
}

const todayStr = new Date().toISOString().split('T')[0]

function isCurrentBooking(r) {
  return r.check_in <= todayStr && r.check_out > todayStr
}

const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export default function Reservations() {
  // — Reservations state —
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showResModal, setShowResModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_RES)
  const [saving, setSaving] = useState(false)
  const [togglingPaid, setTogglingPaid] = useState(null)
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    source: '',
    dateFrom: '',
    dateTo: '',
    guestName: '',
    bookingId: '',
  })

  // — Expenses state —
  const [expenses, setExpenses] = useState([])
  const [expLoading, setExpLoading] = useState(true)
  const [expRefreshing, setExpRefreshing] = useState(false)
  const [showExpModal, setShowExpModal] = useState(false)
  const [expEditing, setExpEditing] = useState(null)
  const [expForm, setExpForm] = useState(EMPTY_EXP)
  const [expSaving, setExpSaving] = useState(false)
  const [expCatFilter, setExpCatFilter] = useState('')

  useEffect(() => { fetchData(); fetchExpenses() }, [filters.year])

  // — Reservations data —
  async function fetchData(manual = false) {
    manual ? setRefreshing(true) : setLoading(true)
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('check_in', `${filters.year}-01-01`)
      .lte('check_in', `${filters.year}-12-31`)
      .order('check_in', { ascending: true })
    if (error) console.error(error)
    setReservations(data || [])
    manual ? setRefreshing(false) : setLoading(false)
  }

  async function togglePaid(r) {
    setTogglingPaid(r.id)
    await supabase.from('reservations').update({ paid: !r.paid }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, paid: !r.paid } : x))
    setTogglingPaid(null)
  }

  const filtered = reservations.filter(r => {
    if (filters.month && new Date(r.check_in).getMonth() + 1 !== +filters.month) return false
    if (filters.source && r.source !== filters.source) return false
    if (filters.dateFrom && r.check_in < filters.dateFrom) return false
    if (filters.dateTo && r.check_in > filters.dateTo) return false
    if (filters.guestName) {
      const q = filters.guestName.toLowerCase()
      if (!(r.guest_name || '').toLowerCase().includes(q)) return false
    }
    if (filters.bookingId) {
      const q = filters.bookingId.toLowerCase()
      if (!(r.reservation_id || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const hasActiveSearch = filters.guestName || filters.bookingId || filters.dateFrom || filters.dateTo

  function clearSearch() {
    setFilters(f => ({ ...f, guestName: '', bookingId: '', dateFrom: '', dateTo: '' }))
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_RES)
    setShowResModal(true)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      source: r.source,
      reservation_id: r.reservation_id || '',
      guest_name: r.guest_name || '',
      check_in: r.check_in,
      check_out: r.check_out,
      guests: r.guests || 1,
      total_payout: r.total_payout,
      commission: r.commission || '',
      discount: r.discount || '',
      notes: r.notes || '',
    })
    setShowResModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      source: form.source,
      reservation_id: form.reservation_id || null,
      guest_name: form.guest_name || null,
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
    setShowResModal(false)
    fetchData()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this reservation?')) return
    await supabase.from('reservations').delete().eq('id', id)
    fetchData()
  }

  const totalPayout = filtered.reduce((s, r) => s + +r.total_payout, 0)
  const totalCommission = filtered.reduce((s, r) => s + +(r.commission || 0), 0)
  const totalDiscount = filtered.reduce((s, r) => s + +(r.discount || 0), 0)
  const totalGross = totalPayout - totalCommission - totalDiscount
  const totalNights = filtered.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
  const unpaidCount = filtered.filter(r => !r.paid).length
  const totalPaid = filtered
    .filter(r => r.paid)
    .reduce((s, r) => s + +r.total_payout - +(r.commission || 0) - +(r.discount || 0), 0)
  const totalUnpaid = filtered
    .filter(r => !r.paid)
    .reduce((s, r) => s + +r.total_payout - +(r.commission || 0) - +(r.discount || 0), 0)

  // — Expenses data —
  async function fetchExpenses(manual = false) {
    manual ? setExpRefreshing(true) : setExpLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('year', filters.year)
      .order('month')
      .order('created_at')
    if (error) console.error(error)
    setExpenses(data || [])
    manual ? setExpRefreshing(false) : setExpLoading(false)
  }

  const filteredExp = expenses.filter(e => {
    if (filters.dateFrom || filters.dateTo) {
      const fromMonth = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00').getMonth() + 1 : 1
      const toMonth = filters.dateTo ? new Date(filters.dateTo + 'T00:00:00').getMonth() + 1 : 12
      if (+e.month < fromMonth || +e.month > toMonth) return false
    } else if (filters.month) {
      if (+e.month !== +filters.month) return false
    }
    if (expCatFilter && norm(e.category) !== norm(expCatFilter)) return false
    return true
  })

  const grandTotal = filteredExp.reduce((s, e) => s + +e.amount, 0)

  const categorySummary = EXPENSE_CATEGORIES.map(cat => ({
    category: cat,
    total: filteredExp.filter(e => norm(e.category) === norm(cat)).reduce((s, e) => s + +e.amount, 0),
  })).filter(c => c.total > 0)

  const totalNetRevenue = totalGross - grandTotal

  function openAddExp() {
    setExpEditing(null)
    setExpForm({ ...EMPTY_EXP, year: filters.year, month: filters.month ? +filters.month : new Date().getMonth() + 1 })
    setShowExpModal(true)
  }

  function openEditExp(e) {
    setExpEditing(e.id)
    setExpForm({ category: e.category, amount: e.amount, month: e.month, year: e.year, notes: e.notes || '' })
    setShowExpModal(true)
  }

  async function handleExpSave(ev) {
    ev.preventDefault()
    setExpSaving(true)
    const payload = {
      category: expForm.category,
      amount: +expForm.amount,
      month: +expForm.month,
      year: +expForm.year,
      notes: expForm.notes || null,
    }
    if (expEditing) {
      await supabase.from('expenses').update(payload).eq('id', expEditing)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setExpSaving(false)
    setShowExpModal(false)
    fetchExpenses()
  }

  async function handleExpDelete(id) {
    if (!window.confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  // — Form helpers —
  const field = (label, children) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
  const input = (props) => <input {...props} className={inputCls} />
  const selCls = (props) => <select {...props} className={inputCls} />

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reservations</h1>
          <p className="text-slate-500 text-sm">
            {filtered.length} results
            {unpaidCount > 0 && (
              <span className="ml-2 text-orange-500 font-medium">{unpaidCount} unpaid</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 shadow-sm disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
          >
            <Plus size={15} /> <span className="hidden sm:inline">Add Reservation</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="flex flex-wrap gap-2">
          <select
            value={filters.year}
            onChange={e => setFilters(f => ({ ...f, year: +e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={filters.month}
            onChange={e => setFilters(f => ({ ...f, month: e.target.value, dateFrom: '', dateTo: '' }))}
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

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Guest name…"
              value={filters.guestName}
              onChange={e => setFilters(f => ({ ...f, guestName: e.target.value }))}
              className="border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-sm w-36"
            />
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Booking ID…"
              value={filters.bookingId}
              onChange={e => setFilters(f => ({ ...f, bookingId: e.target.value }))}
              className="border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-sm w-36"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value, month: e.target.value ? '' : f.month }))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value, month: e.target.value ? '' : f.month }))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          {hasActiveSearch && (
            <button
              onClick={clearSearch}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 border border-slate-200 rounded-lg"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Bookings', val: filtered.length, cls: 'text-slate-700' },
          { label: 'Total Payout', val: formatCurrency(totalPayout), cls: 'text-indigo-600' },
          { label: 'Commissions', val: formatCurrency(totalCommission), cls: 'text-amber-600' },
          { label: 'Discounts', val: formatCurrency(totalDiscount), cls: 'text-orange-500' },
          { label: 'Gross Revenue', val: formatCurrency(totalGross), cls: 'text-emerald-600' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100 text-center">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-base font-bold ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Net Revenue card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
          <div className="flex-1 text-center py-2">
            <p className="text-xs text-slate-400 mb-0.5">Gross Revenue</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalGross)}</p>
          </div>
          <div className="hidden sm:block text-slate-300 text-xl font-light">−</div>
          <div className="block sm:hidden text-center text-slate-300 text-sm">minus</div>
          <div className="flex-1 text-center py-2">
            <p className="text-xs text-slate-400 mb-0.5">Total Expenses</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="hidden sm:block text-slate-300 text-xl font-light">=</div>
          <div className="block sm:hidden text-center text-slate-300 text-sm">equals</div>
          <div className={`flex-1 text-center py-2 rounded-lg ${totalNetRevenue >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className="text-xs text-slate-400 mb-0.5">Net Revenue</p>
            <p className={`text-xl font-bold ${totalNetRevenue >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(totalNetRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
          Current stay
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-500" />
          Paid
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-orange-400" />
          Unpaid
        </div>
      </div>

      {/* Reservations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Check In</th>
              <th className="text-left p-3">Check Out</th>
              <th className="text-center p-3">Nights</th>
              <th className="text-center p-3">Guests</th>
              <th className="text-right p-3">Payout</th>
              <th className="text-right p-3">Commission</th>
              <th className="text-right p-3">Gross</th>
              <th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">No reservations found.</td>
              </tr>
            ) : filtered.map(r => {
              const isCurrent = isCurrentBooking(r)
              const net = +r.total_payout - +(r.commission || 0) - +(r.discount || 0)
              return (
                <tr
                  key={r.id}
                  className={`border-t transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-100 hover:bg-blue-100'
                      : 'border-slate-50 hover:bg-slate-50'
                  }`}
                >
                  <td className="p-3">
                    <button
                      onClick={() => togglePaid(r)}
                      disabled={togglingPaid === r.id}
                      title={r.paid ? 'Mark as unpaid' : 'Mark as paid'}
                      className="flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {r.paid ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Paid
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                          <Clock size={11} /> Unpaid
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
                        {r.source}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          TODAY
                        </span>
                      )}
                    </div>
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
                  <td className="p-3 text-right font-medium text-emerald-600 tabular-nums">
                    {formatCurrency(net)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {getBookingLink(r.source, r.reservation_id) && (
                        <a
                          href={getBookingLink(r.source, r.reservation_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          title={`Open in ${r.source}`}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button onClick={() => openEdit(r)} className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600 rounded">
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
                <td colSpan={6} className="p-3 text-slate-600">Total — {totalNights} nights</td>
                <td className="p-3 text-right text-slate-700 tabular-nums">{formatCurrency(totalPayout)}</td>
                <td className="p-3 text-right text-amber-600 tabular-nums">{formatCurrency(totalCommission)}</td>
                <td className="p-3 text-right text-emerald-600 tabular-nums">{formatCurrency(totalGross)}</td>
                <td />
              </tr>
              <tr className="border-t border-slate-200 text-xs">
                <td colSpan={6} className="px-3 py-2 text-slate-400">Gross breakdown by payment status</td>
                <td colSpan={2} className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 size={11} /> Paid: {formatCurrency(totalPaid)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1 text-orange-500 font-medium">
                    <Clock size={11} /> Unpaid: {formatCurrency(totalUnpaid)}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Expenses Section ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Expenses</h2>
          <p className="text-slate-500 text-sm">
            {filteredExp.length} entries · {formatCurrency(grandTotal)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchExpenses(true)}
            disabled={expRefreshing}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 shadow-sm disabled:opacity-50"
            title="Refresh expenses"
          >
            <RefreshCw size={15} className={expRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddExp}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm"
          >
            <Plus size={15} /> <span className="hidden sm:inline">Add Expense</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Expense category filter */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <select
          value={expCatFilter}
          onChange={e => setExpCatFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Expenses table + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
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
              {expLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Loading…</td>
                </tr>
              ) : filteredExp.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No expenses found.</td>
                </tr>
              ) : filteredExp.map(e => (
                <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-700">{e.category}</td>
                  <td className="p-3 text-slate-500 text-xs">{MONTHS[e.month - 1]} {e.year}</td>
                  <td className="p-3 text-right font-medium text-red-600 tabular-nums">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{e.notes || '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEditExp(e)} className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleExpDelete(e.id)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredExp.length > 0 && (
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

        {/* Category sidebar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 h-fit">
          <h3 className="font-semibold text-slate-700 text-sm mb-3">By Category</h3>
          {categorySummary.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-6">No data</p>
          ) : (
            <div className="space-y-2">
              {categorySummary.map(({ category, total }) => {
                const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
                const idx = EXPENSE_CATEGORIES.indexOf(category)
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-600 truncate mr-2">{category}</span>
                      <span className="font-medium shrink-0" style={{ color: CAT_COLORS[idx % CAT_COLORS.length] }}>
                        {formatCurrency(total)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `${pct}%`, background: CAT_COLORS[idx % CAT_COLORS.length] }}
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

      {/* Reservation Modal */}
      {showResModal && (
        <Modal
          title={editing ? 'Edit Reservation' : 'Add Reservation'}
          onClose={() => setShowResModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {field('Source',
                <select
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  className={inputCls}
                  required
                >
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {field('Guest Name',
                input({
                  type: 'text',
                  value: form.guest_name,
                  onChange: e => setForm(f => ({ ...f, guest_name: e.target.value })),
                  placeholder: 'Optional',
                })
              )}
            </div>

            {field('Reservation ID',
              input({
                type: 'text',
                value: form.reservation_id,
                onChange: e => setForm(f => ({ ...f, reservation_id: e.target.value })),
                placeholder: 'Optional',
              })
            )}

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
                input({ type: 'number', min: 1, value: form.guests, onChange: e => setForm(f => ({ ...f, guests: e.target.value })) })
              )}
              {field('Total Payout (€)',
                input({ type: 'number', step: '0.01', min: 0, value: form.total_payout, onChange: e => setForm(f => ({ ...f, total_payout: e.target.value })), required: true, placeholder: '0.00' })
              )}
              {field('Commission (€)',
                input({ type: 'number', step: '0.01', min: 0, value: form.commission, onChange: e => setForm(f => ({ ...f, commission: e.target.value })), placeholder: '0.00' })
              )}
              {field('Discount (€)',
                input({ type: 'number', step: '0.01', min: 0, value: form.discount, onChange: e => setForm(f => ({ ...f, discount: e.target.value })), placeholder: '0.00' })
              )}
            </div>

            {(form.total_payout || form.commission || form.discount) && (
              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="text-emerald-700 font-medium">Gross Revenue Preview</span>
                <span className="text-emerald-700 font-bold">
                  {formatCurrency((+form.total_payout || 0) - (+form.commission || 0) - (+form.discount || 0))}
                </span>
              </div>
            )}

            {field('Notes',
              input({ type: 'text', value: form.notes, onChange: e => setForm(f => ({ ...f, notes: e.target.value })), placeholder: 'Optional' })
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowResModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Reservation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Expense Modal */}
      {showExpModal && (
        <Modal
          title={expEditing ? 'Edit Expense' : 'Add Expense'}
          onClose={() => setShowExpModal(false)}
          size="sm"
        >
          <form onSubmit={handleExpSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              {selCls({
                value: expForm.category,
                onChange: e => setExpForm(f => ({ ...f, category: e.target.value })),
                required: true,
                children: EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>),
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
                {selCls({
                  value: expForm.month,
                  onChange: e => setExpForm(f => ({ ...f, month: e.target.value })),
                  required: true,
                  children: MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>),
                })}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                {selCls({
                  value: expForm.year,
                  onChange: e => setExpForm(f => ({ ...f, year: e.target.value })),
                  children: YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>),
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (€)</label>
              <input
                type="number" step="0.01" min="0"
                value={expForm.amount}
                onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                className={inputCls}
                required
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input
                type="text"
                value={expForm.notes}
                onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls}
                placeholder="Optional"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={expSaving}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {expSaving ? 'Saving…' : expEditing ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
