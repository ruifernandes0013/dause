import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Calendar,
  Users, Percent, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import {
  formatCurrency, MONTHS, SOURCE_COLORS, SOURCE_BADGE,
  nightsBetween, YEAR_OPTIONS,
} from '../utils/formatters'

export default function Dashboard() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [reservations, setReservations] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [year])

  async function fetchData() {
    setLoading(true)
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
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRevenue = reservations.reduce((s, r) => s + +r.total_payout, 0)
  const totalCommissions = reservations.reduce((s, r) => s + +(r.commission || 0), 0)
  const totalDiscounts = reservations.reduce((s, r) => s + +(r.discount || 0), 0)
  const grossIncome = totalRevenue - totalCommissions - totalDiscounts
  const totalExpenses = expenses.reduce((s, e) => s + +e.amount, 0)
  const netIncome = grossIncome - totalExpenses
  const totalNights = reservations.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
  const occupancy = Math.round((totalNights / 365) * 100)

  // ── Monthly bar chart data ────────────────────────────────────────────────
  const monthlyData = MONTHS.map((name, i) => {
    const m = i + 1
    const mRes = reservations.filter(r => new Date(r.check_in).getMonth() + 1 === m)
    const commission = mRes.reduce((s, r) => s + +(r.commission || 0), 0)
    const gross = mRes.reduce(
      (s, r) => s + +r.total_payout - +(r.commission || 0) - +(r.discount || 0), 0
    )
    const exp = expenses.filter(e => +e.month === m).reduce((s, e) => s + +e.amount, 0)
    return { month: name.slice(0, 3), Gross: +gross.toFixed(2), Commission: +commission.toFixed(2), Expenses: +exp.toFixed(2), Net: +(gross - exp).toFixed(2) }
  })

  // ── Source pie ────────────────────────────────────────────────────────────
  const sourceData = ['Airbnb', 'Booking', 'Direct']
    .map(src => ({
      name: src,
      value: +reservations
        .filter(r => r.source === src)
        .reduce((s, r) => s + +r.total_payout, 0)
        .toFixed(2),
      count: reservations.filter(r => r.source === src).length,
    }))
    .filter(s => s.value > 0)

  const kpis = [
    {
      label: 'Total Bookings Value',
      value: formatCurrency(totalRevenue),
      sub: `${reservations.length} reservations`,
      icon: DollarSign,
      color: 'text-indigo-600', bg: 'bg-indigo-50',
    },
    {
      label: 'Gross Income',
      value: formatCurrency(grossIncome),
      sub: 'After commissions & discounts',
      icon: TrendingUp,
      color: 'text-emerald-600', bg: 'bg-emerald-50',
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      sub: 'Operational costs',
      icon: TrendingDown,
      color: 'text-red-500', bg: 'bg-red-50',
    },
    {
      label: 'Net Income',
      value: formatCurrency(netIncome),
      sub: 'After all deductions',
      icon: netIncome >= 0 ? ArrowUpRight : ArrowDownRight,
      color: netIncome >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: netIncome >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Nights Booked',
      value: totalNights,
      sub: `${occupancy}% occupancy rate`,
      icon: Calendar,
      color: 'text-blue-600', bg: 'bg-blue-50',
    },
    {
      label: 'Platform Commissions',
      value: formatCurrency(totalCommissions),
      sub: 'Paid to platforms',
      icon: Percent,
      color: 'text-amber-600', bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm">Property performance overview</p>
        </div>
        <select
          value={year}
          onChange={e => setYear(+e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
        >
          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
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

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Monthly bar chart */}
            <div className="xl:col-span-2 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Monthly Revenue vs Expenses</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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

            {/* Source pie */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Revenue by Source</h3>
              {sourceData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%" cy="50%"
                        outerRadius={75}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
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
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: SOURCE_COLORS[s.name] }}
                          />
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
                      <td className="p-3 text-slate-600 tabular-nums">
                        {new Date(r.check_in).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-3 text-slate-600 tabular-nums">
                        {new Date(r.check_out).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        {nightsBetween(r.check_in, r.check_out)}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-700 tabular-nums">
                        {formatCurrency(r.total_payout)}
                      </td>
                      <td className="p-3 text-right text-amber-600 tabular-nums">
                        {r.commission > 0 ? formatCurrency(r.commission) : '-'}
                      </td>
                      <td className="p-3 text-right font-medium text-emerald-600 tabular-nums">
                        {formatCurrency(+r.total_payout - +(r.commission || 0) - +(r.discount || 0))}
                      </td>
                    </tr>
                  ))}
                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">
                        No bookings yet. Add your first reservation.
                      </td>
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
