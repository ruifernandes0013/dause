import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { YEAR_OPTIONS, SOURCE_BADGE, formatCurrency, nightsBetween } from '../utils/formatters'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SOURCE_BAR = {
  Airbnb:  { bar: 'bg-rose-200',   text: 'text-rose-800',   hover: 'hover:bg-rose-300'   },
  Booking: { bar: 'bg-blue-200',   text: 'text-blue-800',   hover: 'hover:bg-blue-300'   },
  Direct:  { bar: 'bg-violet-200', text: 'text-violet-800', hover: 'hover:bg-violet-300' },
}
const DEFAULT_BAR = { bar: 'bg-slate-200', text: 'text-slate-700', hover: 'hover:bg-slate-300' }

export default function CalendarView() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchData() }, [year])

  async function fetchData(manual = false) {
    manual ? setRefreshing(true) : setLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .gte('check_out', `${year}-01-01`)
      .lte('check_in', `${year}-12-31`)
    setReservations(data || [])
    manual ? setRefreshing(false) : setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = new Date(year, month, 1).getDay()

  const cells = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function toDateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function getRes(day) {
    if (!day) return null
    const dateStr = toDateStr(day)
    return reservations.find(r => r.check_in <= dateStr && r.check_out > dateStr) || null
  }

  function getCellInfo(day) {
    const res = getRes(day)
    if (!res) return { res: null }

    const dateStr = toDateStr(day)
    const dow = new Date(year, month, day).getDay()
    const isCheckIn = res.check_in === dateStr

    // Is previous day in same row also occupied by this booking?
    const hasPrevInRow = dow !== 0 && day > 1 && res.check_in < dateStr

    // Is next day in same row also occupied by this booking?
    const hasNextInRow = dow !== 6 && day < daysInMonth && res.check_out > toDateStr(day + 1)

    // Show label on check-in or on the first cell of a new row for this booking
    const showLabel = isCheckIn || (dow === 0 && res.check_in < dateStr)

    return { res, isCheckIn, hasPrevInRow, hasNextInRow, showLabel }
  }

  const isToday = (day) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  // Weekend checkouts: any reservation for this year where check_out falls on Sat or Sun
  const weekendCheckouts = reservations
    .filter(r => {
      const dow = new Date(r.check_out + 'T12:00:00').getDay()
      return dow === 0 || dow === 6
    })
    .sort((a, b) => a.check_out.localeCompare(b.check_out))

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Calendar</h1>
          <p className="text-slate-500 text-sm">Occupancy overview</p>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-semibold text-slate-700">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="p-3">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>

            {/* Day cells — gap-0 so booking bars connect */}
            <div className="grid grid-cols-7 gap-0">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="h-10 sm:h-14" />

                const { res, isCheckIn, hasPrevInRow, hasNextInRow, showLabel } = getCellInfo(day)
                const colors = res ? (SOURCE_BAR[res.source] || DEFAULT_BAR) : null
                const label = res ? (res.guest_name || res.source) : null

                // Rounding: open sides connect to adjacent cells
                let rounding = 'rounded-lg'
                if (res) {
                  if (hasPrevInRow && hasNextInRow) rounding = 'rounded-none'
                  else if (hasPrevInRow) rounding = 'rounded-r-lg rounded-l-none'
                  else if (hasNextInRow) rounding = 'rounded-l-lg rounded-r-none'
                  else rounding = 'rounded-lg'
                }

                return (
                  <div
                    key={day}
                    title={res ? `${res.source}${res.guest_name ? ' · ' + res.guest_name : ''} · Check-in: ${res.check_in} · Check-out: ${res.check_out}` : 'Free'}
                    className={`
                      relative flex flex-col justify-start pt-1 px-1
                      h-10 sm:h-14 select-none transition-colors
                      ${res
                        ? `${colors.bar} ${colors.text} ${colors.hover}`
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg'
                      }
                      ${rounding}
                      ${isToday(day) ? 'ring-2 ring-indigo-500 ring-inset' : ''}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex items-center gap-1">
                      <span className={`text-[11px] sm:text-xs font-bold leading-none ${isCheckIn ? 'underline underline-offset-1' : ''}`}>
                        {day}
                      </span>
                      {isCheckIn && (
                        <span className="hidden sm:inline text-[8px] font-bold opacity-70 leading-none">IN</span>
                      )}
                    </div>

                    {/* Guest name / source label — only on first visible cell of booking */}
                    {res && showLabel && label && (
                      <span className="hidden sm:block text-[9px] leading-tight mt-0.5 font-medium opacity-80 truncate w-full">
                        {label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
          Free
        </div>
        {Object.entries(SOURCE_BAR).map(([src, { bar }]) => (
          <div key={src} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${bar}`} />
            {src}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-indigo-500" />
          Today
        </div>
        <div className="flex items-center gap-1.5">
          <span className="underline text-slate-500 text-[10px] font-bold">1</span>
          <span>Check-in day</span>
        </div>
      </div>

      {/* Weekend checkouts list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">Weekend Check-outs {year}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Bookings checking out on Saturday or Sunday</p>
        </div>
        {weekendCheckouts.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No weekend check-outs found for {year}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Guest</th>
                <th className="text-left p-3">Check-in</th>
                <th className="text-left p-3">Check-out</th>
                <th className="text-center p-3">Day</th>
                <th className="text-center p-3">Nights</th>
                <th className="text-right p-3">Payout</th>
              </tr>
            </thead>
            <tbody>
              {weekendCheckouts.map(r => {
                const checkoutDate = new Date(r.check_out + 'T12:00:00')
                const dow = checkoutDate.getDay()
                return (
                  <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">{r.guest_name || <span className="text-slate-300">—</span>}</td>
                    <td className="p-3 text-slate-600 tabular-nums">
                      {new Date(r.check_in + 'T12:00:00').toLocaleDateString('pt-PT')}
                    </td>
                    <td className="p-3 tabular-nums">
                      <span className={dow === 6 ? 'text-amber-600 font-semibold' : 'text-orange-600 font-semibold'}>
                        {checkoutDate.toLocaleDateString('pt-PT')}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dow === 6 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
                        {dow === 6 ? 'Sat' : 'Sun'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-600">
                      {nightsBetween(r.check_in, r.check_out)}
                    </td>
                    <td className="p-3 text-right font-medium text-slate-700 tabular-nums">
                      {formatCurrency(r.total_payout)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
