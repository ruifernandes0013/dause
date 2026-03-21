import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Calendar,
  Users, Percent, ArrowUpRight, ArrowDownRight, RefreshCw,
  BedDouble, Star,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { supabase } from '../lib/supabase'
import {
  formatCurrency, MONTHS, SOURCE_COLORS, SOURCE_BADGE,
  nightsBetween, YEAR_OPTIONS, EXPENSE_CATEGORIES,
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
      supabase
        .from('reservations')
        .select('*')
        .gte('check_in', `${year}-01-01`)
        .lte('check_in', `${year}-12-31`)
        .order('check_in', { ascending: false }),
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
  const totalNights = reservations.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
  const occupancy = Math.round((totalNights / daysInYear) * 100)
  const adr = totalNights > 0 ? grossIncome / totalNights : 0
  const revPar = grossIncome / daysInYear
  const avgStay = reservations.length > 0 ? totalNights / reservations.length : 0
  const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0

  // ── Monthly data (charts + breakdown table) ───────────────────────────────
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
    const monthAdr = nights > 0 ? +(mGross / nights).toFixed(2) : 0

    const byCategory = {}
    EXPENSE_CATEGORIES.forEach(cat => {
      byCategory[cat] = mExp.filter(e => norm(e.category) === norm(cat)).reduce((s, e) => s + +e.amount, 0)
    })

    return {
      name, short: name.slice(0, 3), m,
      totalReservation, commission, discounts,
      grossIncome: mGross, totalExpenses: mExpTotal, netIncome: mGross - mExpTotal,
      nights, bookings: mRes.length, adr: monthAdr,
      // Chart keys
      month: name.slice(0, 3),
      Gross: +mGross.toFixed(2),
      Commission: +commission.toFixed(2),
      Expenses: +mExpTotal.toFixed(2),
      Net: +(mGross - mExpTotal).toFixed(2),
      ADR: monthAdr,
      Nights: nights,
      ...byCategory,
    }
  })

  // ── Year totals ───────────────────────────────────────────────────────────
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

  // ── Source pie ────────────────────────────────────────────────────────────
  const sourceData = ['Airbnb', 'Booking', 'Direct']
    .map(src => ({
      name: src,
      value: +reservations.filter(r => r.source === src).reduce((s, r) => s + +r.total_payout, 0).toFixed(2),
      count: reservations.filter(r => r.source === src).length,
    }))
    .filter(s => s.value > 0)

  const kpis = [
    { label: 'Total Bookings Value', value: formatCurrency(totalRevenue), sub: `${reservations.length} reservations`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Gross Income', value: formatCurrency(grossIncome), sub: 'After commissions & discounts', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), sub: 'Operational costs', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Net Income', value: formatCurrency(netIncome), sub: 'After all deductions', icon: netIncome >= 0 ? ArrowUpRight : ArrowDownRight, color: netIncome >= 0 ? 'text-emerald-600' : 'text-red-600', bg: netIncome >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Nights Booked', value: totalNights, sub: `${occupancy}% occupancy rate`, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Platform Commissions', value: formatCurrency(totalCommissions), sub: 'Paid to platforms', icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'ADR', value: formatCurrency(adr), sub: 'Avg daily rate (gross/night)', icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'RevPAR', value: formatCurrency(revPar), sub: 'Revenue per available night', icon: BedDouble, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Avg Length of Stay', value: `${avgStay.toFixed(1)} nights`, sub: `Avg booking: ${formatCurrency(avgBookingValue)}`, icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
  ]

  const fmt = (v) => v === 0 ? '—' : formatCurrency(v)
  const fmtNet = (v) => v === 0 ? '—' : (
    <span className={v >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(v)}</span>
  )

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
            title="Refresh data"
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
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {kpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                  </div>
                  <div className={`${bg} ${color} p-2 rounded-lg`}>
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row 1: revenue bar + source pie */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Monthly Revenue vs Expenses</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} width={55} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Gross" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Commission" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Net" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Revenue by Source</h3>
              {sourceData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {sourceData.map(entry => (
                          <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {sourceData.map(s => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.name] }} />
                          <span className="text-slate-600">{s.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-700 font-medium">{formatCurrency(s.value)}</span>
                          <span className="text-slate-400 ml-1">({s.count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Charts row 2: ADR + Nights */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">ADR per Month (€/night)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} width={55} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Line type="monotone" dataKey="ADR" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Nights Booked per Month</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} />
                  <Tooltip />
                  <Bar dataKey="Nights" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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

          {/* Recent bookings */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Recent Bookings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="text-left p-3">Source</th>
                    <th className="text-left p-3">Guest</th>
                    <th className="text-left p-3">Check In</th>
                    <th className="text-left p-3">Check Out</th>
                    <th className="text-center p-3">Nights</th>
                    <th className="text-right p-3">Payout</th>
                    <th className="text-right p-3">Commission</th>
                    <th className="text-right p-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.slice(0, 8).map(r => (
                    <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
                          {r.source}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 text-xs">{r.guest_name || '—'}</td>
                      <td className="p-3 text-slate-600 tabular-nums">{new Date(r.check_in).toLocaleDateString('pt-PT')}</td>
                      <td className="p-3 text-slate-600 tabular-nums">{new Date(r.check_out).toLocaleDateString('pt-PT')}</td>
                      <td className="p-3 text-center text-slate-600">{nightsBetween(r.check_in, r.check_out)}</td>
                      <td className="p-3 text-right font-medium text-slate-700 tabular-nums">{formatCurrency(r.total_payout)}</td>
                      <td className="p-3 text-right text-amber-600 tabular-nums">{r.commission > 0 ? formatCurrency(r.commission) : '-'}</td>
                      <td className="p-3 text-right font-medium text-emerald-600 tabular-nums">
                        {formatCurrency(+r.total_payout - +(r.commission || 0) - +(r.discount || 0))}
                      </td>
                    </tr>
                  ))}
                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">No bookings yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
