import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { supabase } from '../lib/supabase'
import {
  formatCurrency, MONTHS, EXPENSE_CATEGORIES,
  nightsBetween, YEAR_OPTIONS,
} from '../utils/formatters'

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [reservations, setReservations] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [year])

  async function fetchData() {
    setLoading(true)
    const [{ data: res }, { data: exp }] = await Promise.all([
      supabase.from('reservations').select('*')
        .gte('check_in', `${year}-01-01`)
        .lte('check_in', `${year}-12-31`)
        .order('check_in'),
      supabase.from('expenses').select('*').eq('year', year),
    ])
    setReservations(res || [])
    setExpenses(exp || [])
    setLoading(false)
  }

  // ── Build per-month data ──────────────────────────────────────────────────
  const monthly = MONTHS.map((name, i) => {
    const m = i + 1
    const mRes = reservations.filter(r => new Date(r.check_in).getMonth() + 1 === m)
    const mExp = expenses.filter(e => +e.month === m)

    const totalReservation = mRes.reduce((s, r) => s + +r.total_payout, 0)
    const commission = mRes.reduce((s, r) => s + +(r.commission || 0), 0)
    const discounts = mRes.reduce((s, r) => s + +(r.discount || 0), 0)
    const grossIncome = totalReservation - commission - discounts
    const nights = mRes.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)

    const byCategory = {}
    EXPENSE_CATEGORIES.forEach(cat => {
      byCategory[cat] = mExp
        .filter(e => e.category === cat)
        .reduce((s, e) => s + +e.amount, 0)
    })
    const totalExpenses = mExp.reduce((s, e) => s + +e.amount, 0)
    const netIncome = grossIncome - totalExpenses

    return {
      name, short: name.slice(0, 3), m,
      totalReservation, commission, discounts,
      grossIncome, totalExpenses, netIncome,
      nights, bookings: mRes.length,
      ...byCategory,
    }
  })

  // ── Year totals row ───────────────────────────────────────────────────────
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
    totals[cat] = monthly.reduce((s, m) => s + (m[cat] || 0), 0)
  })

  // Only show categories that have any spend
  const activeCategories = EXPENSE_CATEGORIES.filter(cat => totals[cat] > 0)

  // ── Chart data ─────────────────────────────────────────────────────────────
  const barData = monthly.map(m => ({
    month: m.short,
    'Gross Income': +m.grossIncome.toFixed(2),
    'Expenses': +m.totalExpenses.toFixed(2),
    'Net Income': +m.netIncome.toFixed(2),
  }))

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (v) => v === 0 ? '—' : formatCurrency(v)
  const fmtNet = (v) => v === 0 ? '—' : (
    <span className={v >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(v)}</span>
  )

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Annual Report</h1>
          <p className="text-slate-500 text-sm">Full year breakdown</p>
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
        <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
      ) : (
        <>
          {/* Year KPI banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Bookings Value', val: totals.totalReservation, cls: 'text-indigo-600' },
              { label: 'Gross Income', val: totals.grossIncome, cls: 'text-blue-600' },
              { label: 'Total Expenses', val: totals.totalExpenses, cls: 'text-red-600' },
              { label: 'Net Income', val: totals.netIncome, cls: totals.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-lg font-bold mt-0.5 ${cls}`}>{formatCurrency(val)}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Monthly Performance {year}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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

          {/* Excel-style breakdown table */}
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

                {/* ── Revenue section ─────────────────────────────────── */}
                <tr>
                  <td
                    colSpan={14}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-semibold text-[10px] uppercase tracking-widest"
                  >
                    Revenue
                  </td>
                </tr>

                {[
                  { key: 'totalReservation', label: 'Total Reserva', cls: 'text-slate-700' },
                  { key: 'commission', label: 'Comissão Plataforma', cls: 'text-amber-600' },
                  { key: 'discounts', label: 'Descontos', cls: 'text-orange-500' },
                  { key: 'grossIncome', label: 'Rendimento Bruto', cls: 'text-indigo-600 font-bold' },
                ].map(({ key, label, cls }) => (
                  <tr key={key} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className={`p-3 sticky left-0 bg-white text-slate-600 ${key === 'grossIncome' ? 'font-semibold' : ''}`}>
                      {label}
                    </td>
                    {monthly.map(m => (
                      <td key={m.m} className={`px-2 py-3 text-right tabular-nums ${cls}`}>
                        {fmt(m[key])}
                      </td>
                    ))}
                    <td className={`px-3 py-3 text-right font-bold tabular-nums ${cls}`}>
                      {fmt(totals[key])}
                    </td>
                  </tr>
                ))}

                {/* ── Expenses section ─────────────────────────────────── */}
                <tr>
                  <td
                    colSpan={14}
                    className="px-3 py-1.5 bg-red-50 text-red-700 font-semibold text-[10px] uppercase tracking-widest"
                  >
                    Despesas
                  </td>
                </tr>

                {activeCategories.map(cat => (
                  <tr key={cat} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="p-3 sticky left-0 bg-white text-slate-600">{cat}</td>
                    {monthly.map(m => (
                      <td key={m.m} className="px-2 py-3 text-right text-red-500 tabular-nums">
                        {fmt(m[cat] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-bold text-red-600 tabular-nums">
                      {fmt(totals[cat])}
                    </td>
                  </tr>
                ))}

                <tr className="border-t border-slate-200 bg-red-50">
                  <td className="p-3 sticky left-0 bg-red-50 font-bold text-red-700">Total Despesas</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right font-bold text-red-700 tabular-nums">
                      {fmt(m.totalExpenses)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-bold text-red-700 tabular-nums">
                    {fmt(totals.totalExpenses)}
                  </td>
                </tr>

                {/* ── Net income ───────────────────────────────────────── */}
                <tr className="border-t-2 border-slate-300 bg-emerald-50">
                  <td className="p-3 sticky left-0 bg-emerald-50 font-bold text-emerald-700">
                    Rendimento Líquido
                  </td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right font-bold tabular-nums">
                      {m.netIncome === 0 ? '—' : fmtNet(m.netIncome)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-bold tabular-nums">
                    {fmtNet(totals.netIncome)}
                  </td>
                </tr>

                {/* ── Occupancy stats ──────────────────────────────────── */}
                <tr className="border-t border-slate-100">
                  <td className="p-3 sticky left-0 bg-white text-slate-500">Noites</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right text-slate-500">
                      {m.nights || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-medium text-slate-600">{totals.nights}</td>
                </tr>
                <tr className="border-t border-slate-50">
                  <td className="p-3 sticky left-0 bg-white text-slate-500">Reservas</td>
                  {monthly.map(m => (
                    <td key={m.m} className="px-2 py-3 text-right text-slate-500">
                      {m.bookings || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-medium text-slate-600">{totals.bookings}</td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* Expense breakdown bar chart */}
          {activeCategories.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Expense Breakdown by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={activeCategories.map(cat => ({ name: cat, value: +totals[cat].toFixed(2) }))}
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
