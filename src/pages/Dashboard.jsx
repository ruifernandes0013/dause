import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatCurrency, MONTHS, nightsBetween, YEAR_OPTIONS, EXPENSE_CATEGORIES,
} from '../utils/formatters'

const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export default function Dashboard() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [reservations, setReservations] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchData() }, [year])

  async function fetchData(manual = false) {
    manual ? setRefreshing(true) : setLoading(true)
    const [{ data: res, error: re }, { data: exp, error: ee }] = await Promise.all([
      supabase.from('reservations').select('*')
        .gte('check_in', `${year}-01-01`)
        .lte('check_in', `${year}-12-31`)
        .order('check_in'),
      supabase.from('expenses').select('*').eq('year', year),
    ])
    if (re) console.error(re)
    if (ee) console.error(ee)
    setReservations(res || [])
    setExpenses(exp || [])
    manual ? setRefreshing(false) : setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRevenue = reservations.reduce((s, r) => s + +r.total_payout, 0)
  const totalCommissions = reservations.reduce((s, r) => s + +(r.commission || 0), 0)
  const totalDiscounts = reservations.reduce((s, r) => s + +(r.discount || 0), 0)
  const grossIncome = totalRevenue - totalCommissions - totalDiscounts
  const totalExpenses = expenses.reduce((s, e) => s + +e.amount, 0)
  const netIncome = grossIncome - totalExpenses

  // ── Monthly breakdown data ────────────────────────────────────────────────
  const monthly = MONTHS.map((name, i) => {
    const m = i + 1
    const mRes = reservations.filter(r => new Date(r.check_in).getMonth() + 1 === m)
    const mExp = expenses.filter(e => +e.month === m)

    const totalReservation = mRes.reduce((s, r) => s + +r.total_payout, 0)
    const commission = mRes.reduce((s, r) => s + +(r.commission || 0), 0)
    const discounts = mRes.reduce((s, r) => s + +(r.discount || 0), 0)
    const mGross = totalReservation - commission - discounts
    const mExpTotal = mExp.reduce((s, e) => s + +e.amount, 0)
    const nights = mRes.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)

    const byCategory = {}
    EXPENSE_CATEGORIES.forEach(cat => {
      byCategory[cat] = mExp.filter(e => norm(e.category) === norm(cat)).reduce((s, e) => s + +e.amount, 0)
    })

    return {
      name, short: name.slice(0, 3), m,
      totalReservation, commission, discounts,
      grossIncome: mGross, totalExpenses: mExpTotal, netIncome: mGross - mExpTotal,
      nights, bookings: mRes.length,
      ...byCategory,
    }
  })

  const totals = {
    totalReservation: monthly.reduce((s, m) => s + m.totalReservation, 0),
    commission: monthly.reduce((s, m) => s + m.commission, 0),
    discounts: monthly.reduce((s, m) => s + m.discounts, 0),
    grossIncome: monthly.reduce((s, m) => s + m.grossIncome, 0),
    totalExpenses: monthly.reduce((s, m) => s + m.totalExpenses, 0),
    netIncome: monthly.reduce((s, m) => s + m.netIncome, 0),
    nights: monthly.reduce((s, m) => s + m.nights, 0),
    bookings: monthly.reduce((s, m) => s + m.bookings, 0),
  }
  EXPENSE_CATEGORIES.forEach(cat => {
    totals[cat] = expenses.filter(e => norm(e.category) === norm(cat)).reduce((s, e) => s + +e.amount, 0)
  })

  const fmt = (v) => v === 0 ? '—' : formatCurrency(v)
  const fmtNet = (v) => v === 0 ? '—' : (
    <span className={v >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(v)}</span>
  )

  const kpis = [
    { label: 'Total Bookings Value', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Gross Income', value: formatCurrency(grossIncome), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    {
      label: 'Net Income', value: formatCurrency(netIncome),
      icon: netIncome >= 0 ? ArrowUpRight : ArrowDownRight,
      color: netIncome >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: netIncome >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm">Property performance overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                  </div>
                  <div className={`${bg} ${color} p-2 rounded-lg`}>
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Breakdown table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Monthly Breakdown {year}</h3>
            </div>
            <table className="w-full text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px]">
                  <th className="text-left p-3 sticky left-0 bg-slate-50 min-w-[160px]">Category</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right px-2 py-3 min-w-[72px]">{m.slice(0, 3)}</th>
                  ))}
                  <th className="text-right px-3 py-3 min-w-[80px] font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={14} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-semibold text-[10px] uppercase tracking-widest">Revenue</td>
                </tr>
                {[
                  { key: 'totalReservation', label: 'Total Reserva', cls: 'text-slate-700' },
                  { key: 'commission', label: 'Comissão Plataforma', cls: 'text-amber-600' },
                  { key: 'discounts', label: 'Descontos', cls: 'text-orange-500' },
                  { key: 'grossIncome', label: 'Rendimento Bruto', cls: 'text-indigo-600 font-bold' },
                ].map(({ key, label, cls }) => (
                  <tr key={key} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className={`p-3 sticky left-0 bg-white text-slate-600 ${key === 'grossIncome' ? 'font-semibold' : ''}`}>{label}</td>
                    {monthly.map(m => (
                      <td key={m.m} className={`px-2 py-3 text-right tabular-nums ${cls}`}>{fmt(m[key])}</td>
                    ))}
                    <td className={`px-3 py-3 text-right font-bold tabular-nums ${cls}`}>{fmt(totals[key])}</td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={14} className="px-3 py-1.5 bg-red-50 text-red-700 font-semibold text-[10px] uppercase tracking-widest">Despesas</td>
                </tr>
                {EXPENSE_CATEGORIES.map(cat => (
                  <tr key={cat} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="p-3 sticky left-0 bg-white text-slate-600">{cat}</td>
                    {monthly.map(m => (
                      <td key={m.m} className="px-2 py-3 text-right text-red-500 tabular-nums">{fmt(m[cat] || 0)}</td>
                    ))}
                    <td className="px-3 py-3 text-right font-bold text-red-600 tabular-nums">{fmt(totals[cat])}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-red-50">
                  <td className="p-3 sticky left-0 bg-red-50 font-bold text-red-700">Total Despesas</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right font-bold text-red-700 tabular-nums">{fmt(m.totalExpenses)}</td>
                  ))}
                  <td className="px-3 py-3 text-right font-bold text-red-700 tabular-nums">{fmt(totals.totalExpenses)}</td>
                </tr>

                <tr className="border-t-2 border-slate-300 bg-emerald-50">
                  <td className="p-3 sticky left-0 bg-emerald-50 font-bold text-emerald-700">Rendimento Líquido</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right font-bold tabular-nums">
                      {m.netIncome === 0 ? '—' : fmtNet(m.netIncome)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtNet(totals.netIncome)}</td>
                </tr>

                <tr className="border-t border-slate-100">
                  <td className="p-3 sticky left-0 bg-white text-slate-500">Noites</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right text-slate-500">{m.nights || '—'}</td>
                  ))}
                  <td className="px-3 py-3 text-right font-medium text-slate-600">{totals.nights}</td>
                </tr>
                <tr className="border-t border-slate-50">
                  <td className="p-3 sticky left-0 bg-white text-slate-500">Reservas</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right text-slate-500">{m.bookings || '—'}</td>
                  ))}
                  <td className="px-3 py-3 text-right font-medium text-slate-600">{totals.bookings}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
