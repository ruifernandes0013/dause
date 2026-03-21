import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatCurrency, MONTHS, EXPENSE_CATEGORIES,
  nightsBetween, YEAR_OPTIONS, SOURCE_COLORS, SOURCE_BADGE,
} from '../utils/formatters'

const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [reservations, setReservations] = useState([])
  const [expenses, setExpenses] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [year])

  async function fetchData(manual = false) {
    manual ? setRefreshing(true) : setLoading(true)
    const [{ data: res }, { data: exp }] = await Promise.all([
      supabase.from('reservations').select('*')
        .gte('check_in', `${year}-01-01`)
        .lte('check_in', `${year}-12-31`)
        .order('check_in'),
      supabase.from('expenses').select('*').eq('year', year),
    ])
    setReservations(res || [])
    setExpenses(exp || [])
    manual ? setRefreshing(false) : setLoading(false)
  }

  // ── Core metrics ──────────────────────────────────────────────────────────
  const totalRevenue = reservations.reduce((s, r) => s + +r.total_payout, 0)
  const totalCommissions = reservations.reduce((s, r) => s + +(r.commission || 0), 0)
  const totalDiscounts = reservations.reduce((s, r) => s + +(r.discount || 0), 0)
  const grossIncome = totalRevenue - totalCommissions - totalDiscounts
  const totalExpenses = expenses.reduce((s, e) => s + +e.amount, 0)
  const netIncome = grossIncome - totalExpenses
  const totalNights = reservations.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
  const occupancy = totalNights / daysInYear
  const adr = totalNights > 0 ? grossIncome / totalNights : 0
  const revPar = grossIncome / daysInYear
  const avgStay = reservations.length > 0 ? totalNights / reservations.length : 0
  const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0
  const netMargin = grossIncome > 0 ? (netIncome / grossIncome) * 100 : 0
  const commissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0
  const expenseRatio = grossIncome > 0 ? (totalExpenses / grossIncome) * 100 : 0

  // ── Source performance ────────────────────────────────────────────────────
  const sourcePerf = ['Airbnb', 'Booking', 'Direct'].map(src => {
    const sRes = reservations.filter(r => r.source === src)
    const nights = sRes.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
    const revenue = sRes.reduce((s, r) => s + +r.total_payout, 0)
    const commission = sRes.reduce((s, r) => s + +(r.commission || 0), 0)
    const discount = sRes.reduce((s, r) => s + +(r.discount || 0), 0)
    const gross = revenue - commission - discount
    const srcAdr = nights > 0 ? gross / nights : 0
    const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
    return { src, bookings: sRes.length, nights, revenue, commission, gross, adr: srcAdr, share }
  }).filter(s => s.bookings > 0)

  // ── Source pie ────────────────────────────────────────────────────────────
  const sourceData = sourcePerf.map(s => ({ name: s.src, value: +s.revenue.toFixed(2) }))

  // ── Monthly chart data ────────────────────────────────────────────────────
  const monthly = MONTHS.map((name, i) => {
    const m = i + 1
    const mRes = reservations.filter(r => new Date(r.check_in).getMonth() + 1 === m)
    const mExp = expenses.filter(e => +e.month === m)
    const commission = mRes.reduce((s, r) => s + +(r.commission || 0), 0)
    const mGross = mRes.reduce((s, r) => s + +r.total_payout - +(r.commission || 0) - +(r.discount || 0), 0)
    const mExpTotal = mExp.reduce((s, e) => s + +e.amount, 0)
    const nights = mRes.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
    const monthAdr = nights > 0 ? +(mGross / nights).toFixed(2) : 0
    return {
      month: name.slice(0, 3),
      'Gross Income': +mGross.toFixed(2),
      'Expenses': +mExpTotal.toFixed(2),
      'Net Income': +(mGross - mExpTotal).toFixed(2),
      Nights: nights,
      ADR: monthAdr,
      Commission: +commission.toFixed(2),
    }
  })

  // ── Expense totals by category ────────────────────────────────────────────
  const expByCategory = EXPENSE_CATEGORIES
    .map(cat => ({
      name: cat,
      value: +expenses.filter(e => norm(e.category) === norm(cat)).reduce((s, e) => s + +e.amount, 0).toFixed(2),
    }))
    .filter(c => c.value > 0)

  // ── Best / worst month ────────────────────────────────────────────────────
  const monthlyNet = monthly.map((m, i) => ({ ...m, idx: i }))
  const bestMonth = [...monthlyNet].sort((a, b) => b['Net Income'] - a['Net Income'])[0]
  const worstMonth = [...monthlyNet].filter(m => m['Gross Income'] > 0).sort((a, b) => a['Net Income'] - b['Net Income'])[0]

  // ── Projections ───────────────────────────────────────────────────────────
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12
  const monthsWithData = monthly.filter(m => m['Gross Income'] > 0).length
  const projectionMonths = monthsWithData > 0 ? monthsWithData : 1
  const avgMonthlyGross = grossIncome / projectionMonths
  const avgMonthlyNet = netIncome / projectionMonths
  const avgMonthlyExpenses = totalExpenses / projectionMonths
  const avgMonthlyRevenue = totalRevenue / projectionMonths
  const avgMonthlyCommissions = totalCommissions / projectionMonths
  const avgMonthlyNights = totalNights / projectionMonths

  const remainingMonths = 12 - currentMonth
  const projectedGross = grossIncome + avgMonthlyGross * remainingMonths
  const projectedNet = netIncome + avgMonthlyNet * remainingMonths
  const projectedRevenue = totalRevenue + avgMonthlyRevenue * remainingMonths
  const projectedCommissions = totalCommissions + avgMonthlyCommissions * remainingMonths
  const projectedExpenses = totalExpenses + avgMonthlyExpenses * remainingMonths
  const projectedNights = totalNights + avgMonthlyNights * remainingMonths
  const projectedOccupancy = projectedNights / daysInYear

  const hasProjections = new Date().getFullYear() === year && monthsWithData > 0 && remainingMonths > 0

  const pct = (v) => `${v.toFixed(1)}%`

  const kpis = [
    { label: 'ADR', value: formatCurrency(adr), sub: 'Gross income per booked night', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'RevPAR', value: formatCurrency(revPar), sub: 'Revenue per available night', color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Occupancy Rate', value: pct(occupancy * 100), sub: `${totalNights} nights of ${daysInYear}`, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg Length of Stay', value: `${avgStay.toFixed(1)} nights`, sub: `${reservations.length} bookings total`, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Avg Booking Value', value: formatCurrency(avgBookingValue), sub: 'Per reservation (payout)', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Net Margin', value: pct(netMargin), sub: 'Net / Gross income', color: netMargin >= 0 ? 'text-emerald-600' : 'text-red-600', bg: netMargin >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Commission Rate', value: pct(commissionRate), sub: 'Commissions / Total payout', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Expense Ratio', value: pct(expenseRatio), sub: 'Expenses / Gross income', color: 'text-red-500', bg: 'bg-red-50' },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500 text-sm">Performance analysis {year}</p>
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
        <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
      ) : (
        <>
          {/* Analytical KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map(({ label, value, sub, color, bg }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Financial Summary {year}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Full revenue & cost breakdown for the year</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-100">
              {[
                { label: 'Total Payout', value: formatCurrency(totalRevenue), color: 'text-slate-700', note: `${reservations.length} bookings` },
                { label: 'Commissions', value: formatCurrency(totalCommissions), color: 'text-amber-600', note: `${commissionRate.toFixed(1)}% of payout` },
                { label: 'Discounts', value: formatCurrency(totalDiscounts), color: 'text-orange-500', note: 'Applied deductions' },
                { label: 'Gross Income', value: formatCurrency(grossIncome), color: 'text-indigo-600', note: 'Payout − comm − disc' },
                { label: 'Expenses', value: formatCurrency(totalExpenses), color: 'text-red-500', note: `${expenseRatio.toFixed(1)}% of gross` },
                { label: 'Net Income', value: formatCurrency(netIncome), color: netIncome >= 0 ? 'text-emerald-600' : 'text-red-600', note: `${netMargin.toFixed(1)}% margin` },
              ].map(({ label, value, color, note }) => (
                <div key={label} className="px-4 py-4">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className={`text-lg font-bold mt-0.5 tabular-nums ${color}`}>{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Year-End Projections */}
          {hasProjections && (
            <div className="bg-gradient-to-r from-indigo-50 to-sky-50 rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-indigo-100">
                <h3 className="font-semibold text-slate-700 text-sm">Year-End Projection ({year})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Based on {monthsWithData} months of data · avg {formatCurrency(avgMonthlyGross)}/mo gross · {remainingMonths} months remaining
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-indigo-100">
                {[
                  { label: 'Projected Payout', value: formatCurrency(projectedRevenue), color: 'text-slate-700', note: `+${formatCurrency(avgMonthlyRevenue)}/mo` },
                  { label: 'Projected Commissions', value: formatCurrency(projectedCommissions), color: 'text-amber-600', note: `+${formatCurrency(avgMonthlyCommissions)}/mo` },
                  { label: 'Projected Gross', value: formatCurrency(projectedGross), color: 'text-indigo-600', note: `+${formatCurrency(avgMonthlyGross)}/mo` },
                  { label: 'Projected Expenses', value: formatCurrency(projectedExpenses), color: 'text-red-500', note: `+${formatCurrency(avgMonthlyExpenses)}/mo` },
                  { label: 'Projected Net', value: formatCurrency(projectedNet), color: projectedNet >= 0 ? 'text-emerald-600' : 'text-red-600', note: `+${formatCurrency(avgMonthlyNet)}/mo` },
                  { label: 'Proj. Occupancy', value: pct(projectedOccupancy * 100), color: 'text-blue-600', note: `${Math.round(projectedNights)} nights / ${daysInYear}` },
                ].map(({ label, value, color, note }) => (
                  <div key={label} className="px-4 py-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-lg font-bold mt-0.5 tabular-nums ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best / Worst month highlight */}
          {(bestMonth || worstMonth) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bestMonth && bestMonth['Net Income'] > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Best Month</p>
                  <p className="text-lg font-bold text-emerald-700 mt-1">{bestMonth.month}</p>
                  <p className="text-sm text-emerald-600">Net: {formatCurrency(bestMonth['Net Income'])} · Gross: {formatCurrency(bestMonth['Gross Income'])}</p>
                </div>
              )}
              {worstMonth && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs text-red-500 font-medium uppercase tracking-wide">Worst Month (active)</p>
                  <p className="text-lg font-bold text-red-600 mt-1">{worstMonth.month}</p>
                  <p className="text-sm text-red-500">Net: {formatCurrency(worstMonth['Net Income'])} · Gross: {formatCurrency(worstMonth['Gross Income'])}</p>
                </div>
              )}
            </div>
          )}

          {/* Charts row 1: Revenue vs Expenses + Source pie */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Monthly Revenue vs Expenses</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} width={60} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Gross Income" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Net Income" fill="#10b981" radius={[3, 3, 0, 0]} />
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
                    {sourcePerf.map(s => (
                      <div key={s.src} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.src] }} />
                          <span className="text-slate-600">{s.src}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-700 font-medium">{formatCurrency(s.revenue)}</span>
                          <span className="text-slate-400 ml-1">({s.bookings})</span>
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
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} width={60} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Line type="monotone" dataKey="ADR" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Nights Booked per Month</h3>
              <ResponsiveContainer width="100%" height={220}>
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

          {/* Source performance table */}
          {sourcePerf.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700 text-sm">Source Performance</h3>
                <p className="text-xs text-slate-400 mt-0.5">Which channel generates the most value per night</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="text-left p-3">Source</th>
                    <th className="text-center p-3">Bookings</th>
                    <th className="text-center p-3">Nights</th>
                    <th className="text-right p-3">Gross Payout</th>
                    <th className="text-right p-3">Commission</th>
                    <th className="text-right p-3">Net Gross</th>
                    <th className="text-right p-3">ADR</th>
                    <th className="text-right p-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sourcePerf.map(s => (
                    <tr key={s.src} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[s.src] || 'bg-slate-100 text-slate-600'}`}>
                          {s.src}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-600">{s.bookings}</td>
                      <td className="p-3 text-center text-slate-600">{s.nights}</td>
                      <td className="p-3 text-right text-slate-700 tabular-nums">{formatCurrency(s.revenue)}</td>
                      <td className="p-3 text-right text-amber-600 tabular-nums">{s.commission > 0 ? formatCurrency(s.commission) : '—'}</td>
                      <td className="p-3 text-right font-medium text-emerald-600 tabular-nums">{formatCurrency(s.gross)}</td>
                      <td className="p-3 text-right font-semibold text-purple-600 tabular-nums">{formatCurrency(s.adr)}</td>
                      <td className="p-3 text-right text-slate-500 tabular-nums">{s.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-sm">
                    <td className="p-3 text-slate-600">Total</td>
                    <td className="p-3 text-center text-slate-600">{reservations.length}</td>
                    <td className="p-3 text-center text-slate-600">{totalNights}</td>
                    <td className="p-3 text-right text-slate-700 tabular-nums">{formatCurrency(totalRevenue)}</td>
                    <td className="p-3 text-right text-amber-600 tabular-nums">{formatCurrency(totalCommissions)}</td>
                    <td className="p-3 text-right text-emerald-600 tabular-nums">{formatCurrency(grossIncome)}</td>
                    <td className="p-3 text-right text-purple-600 tabular-nums">{formatCurrency(adr)}</td>
                    <td className="p-3 text-right text-slate-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Expense breakdown */}
          {expByCategory.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Expense Breakdown by Category</h3>
              <ResponsiveContainer width="100%" height={Math.max(160, expByCategory.length * 36)}>
                <BarChart
                  data={expByCategory}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 140, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
