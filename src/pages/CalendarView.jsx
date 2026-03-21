import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { YEAR_OPTIONS, SOURCE_BADGE, formatCurrency, nightsBetween } from '../utils/formatters'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SOURCE_COLOR = {
  Airbnb:  '#f43f5e',
  Booking: '#3b82f6',
  Direct:  '#8b5cf6',
}
const DEFAULT_COLOR = '#94a3b8'

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

  function getDayInfo(day) {
    const dateStr = toDateStr(day)
    const occupied = reservations.find(r => r.check_in <= dateStr && r.check_out > dateStr)
    const isCheckIn = occupied?.check_in === dateStr
    const checkout = !occupied ? reservations.find(r => r.check_out === dateStr) : null
    const dow = new Date(year, month, day).getDay()
    const showLabel = occupied && (isCheckIn || dow === 0)
    const label = occupied ? (occupied.guest_name || occupied.source) : null
    return { dateStr, occupied, isCheckIn, checkout, showLabel, label, dow }
  }

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Weekend events for selected month: check-ins or check-outs falling on Sat/Sun
  const weekendEvents = []
  reservations.forEach(r => {
    const ci = new Date(r.check_in + 'T12:00:00')
    const co = new Date(r.check_out + 'T12:00:00')

    if (ci.getFullYear() === year && ci.getMonth() === month && [0, 6].includes(ci.getDay())) {
      weekendEvents.push({ type: 'check-in', date: r.check_in, dow: ci.getDay(), booking: r })
    }
    if (co.getFullYear() === year && co.getMonth() === month && [0, 6].includes(co.getDay())) {
      weekendEvents.push({ type: 'check-out', date: r.check_out, dow: co.getDay(), booking: r })
    }
  })
  weekendEvents.sort((a, b) => a.date.localeCompare(b.date))

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

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="h-12 sm:h-16" />

                const { occupied, isCheckIn, checkout, showLabel, label } = getDayInfo(day)
                const barColor = occupied ? (SOURCE_COLOR[occupied.source] || DEFAULT_COLOR) : null
                const checkoutColor = checkout ? (SOURCE_COLOR[checkout.source] || DEFAULT_COLOR) : null

                return (
                  <div
                    key={day}
                    title={
                      occupied
                        ? `${occupied.source}${occupied.guest_name ? ' · ' + occupied.guest_name : ''} · IN: ${occupied.check_in} · OUT: ${occupied.check_out}`
                        : checkout
                          ? `Check-out: ${checkout.source}${checkout.guest_name ? ' · ' + checkout.guest_name : ''}`
                          : 'Free'
                    }
                    className={`
                      relative flex flex-col items-start justify-start
                      h-12 sm:h-16 px-1.5 pt-1 rounded-lg select-none
                      ${occupied ? 'bg-white' : checkout ? 'bg-white' : 'bg-emerald-50'}
                      ${isToday(day) ? 'ring-2 ring-indigo-500 ring-inset' : 'border border-slate-100'}
                    `}
                  >
                    {/* Day number */}
                    <span className={`text-[11px] sm:text-xs font-bold leading-none ${
                      occupied ? 'text-slate-700' : checkout ? 'text-slate-500' : 'text-emerald-700'
                    }`}>
                      {day}
                    </span>

                    {/* Guest name / label on check-in or row start */}
                    {occupied && showLabel && label && (
                      <span className="hidden sm:block text-[8px] leading-tight mt-0.5 text-slate-500 truncate w-full font-medium">
                        {label}
                      </span>
                    )}

                    {/* Check-in badge */}
                    {isCheckIn && (
                      <span
                        className="hidden sm:inline-block text-[7px] font-bold px-1 py-px rounded leading-none mt-0.5"
                        style={{ background: barColor + '33', color: barColor }}
                      >
                        IN
                      </span>
                    )}

                    {/* Check-out badge */}
                    {checkout && !occupied && (
                      <span
                        className="hidden sm:inline-block text-[7px] font-bold px-1 py-px rounded leading-none mt-0.5"
                        style={{ background: checkoutColor + '22', color: checkoutColor }}
                      >
                        OUT
                      </span>
                    )}

                    {/* Narrow bottom bar for occupied days */}
                    {occupied && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg"
                        style={{ background: barColor }}
                      />
                    )}

                    {/* Narrow bottom bar (lighter) for checkout days */}
                    {checkout && !occupied && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg opacity-30"
                        style={{ background: checkoutColor }}
                      />
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
          <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
          Free
        </div>
        {Object.entries(SOURCE_COLOR).map(([src, color]) => (
          <div key={src} className="flex items-center gap-1.5">
            <div className="w-6 h-1 rounded-full" style={{ background: color }} />
            {src}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-indigo-500" />
          Today
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1 rounded-full bg-slate-300 opacity-40" />
          Check-out day
        </div>
      </div>

      {/* Weekend cleaning schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">
            Weekend Activity — {MONTH_NAMES[month]} {year}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Check-ins & check-outs on Saturday/Sunday — call the cleaning company
          </p>
        </div>
        {weekendEvents.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            No weekend check-ins or check-outs in {MONTH_NAMES[month]}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left p-3">Day</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Event</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Guest</th>
                <th className="text-center p-3">Nights</th>
                <th className="text-right p-3">Payout</th>
              </tr>
            </thead>
            <tbody>
              {weekendEvents.map((ev, idx) => {
                const r = ev.booking
                const isIn = ev.type === 'check-in'
                return (
                  <tr key={idx} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="p-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ev.dow === 6 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {ev.dow === 6 ? 'Sat' : 'Sun'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 tabular-nums font-medium">
                      {new Date(ev.date + 'T12:00:00').toLocaleDateString('pt-PT')}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isIn
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isIn ? 'Check-in' : 'Check-out'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">{r.guest_name || <span className="text-slate-300">—</span>}</td>
                    <td className="p-3 text-center text-slate-600">{nightsBetween(r.check_in, r.check_out)}</td>
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
