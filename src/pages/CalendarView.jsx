import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'
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
const DEFAULT_COLOR = '#10b981'

export default function CalendarView() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedDates, setExpandedDates] = useState({})

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
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  function toDateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // For a given week row, return all booking bar segments
  function getWeekBars(week) {
    const result = []
    reservations.forEach(r => {
      const cols = []
      for (let col = 0; col < 7; col++) {
        const day = week[col]
        if (!day) continue
        const dateStr = toDateStr(day)
        if (r.check_in <= dateStr && r.check_out > dateStr) cols.push(col)
      }
      if (cols.length === 0) return

      const startCol = cols[0]
      const endCol = cols[cols.length - 1]

      // isStart: booking check_in is within this week
      const isStart = r.check_in === toDateStr(week[startCol])

      // isEnd: booking ends on or before the day after the last occupied day
      const endDay = week[endCol]
      const nextD = new Date(year, month, endDay + 1)
      const nextDStr = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(nextD.getDate()).padStart(2, '0')}`
      const isEnd = r.check_out <= nextDStr

      result.push({ booking: r, startCol, endCol, isStart, isEnd })
    })
    return result
  }

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Weekend events for selected month
  const weekendEvents = []
  reservations.forEach(r => {
    const ci = new Date(r.check_in + 'T12:00:00')
    const co = new Date(r.check_out + 'T12:00:00')
    if (ci.getFullYear() === year && ci.getMonth() === month && [0, 6].includes(ci.getDay()))
      weekendEvents.push({ type: 'check-in', date: r.check_in, dow: ci.getDay(), booking: r })
    if (co.getFullYear() === year && co.getMonth() === month && [0, 6].includes(co.getDay()))
      weekendEvents.push({ type: 'check-out', date: r.check_out, dow: co.getDay(), booking: r })
  })
  weekendEvents.sort((a, b) => a.date.localeCompare(b.date))

  const weekendByDate = {}
  weekendEvents.forEach(ev => {
    if (!weekendByDate[ev.date]) weekendByDate[ev.date] = []
    weekendByDate[ev.date].push(ev)
  })

  function toggleDate(date) {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Calendar</h1>
          <p className="text-slate-500 text-sm">Occupancy overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 shadow-sm disabled:opacity-50">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm">
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-semibold text-slate-700">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
        ) : (
          <div>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-slate-200">
              {DAYS.map((d, i) => (
                <div key={d} className={`
                  text-center py-2 text-xs font-semibold border-r last:border-r-0 border-slate-100
                  ${i === 0 || i === 6 ? 'text-slate-400 bg-slate-50' : 'text-slate-500'}
                `}>
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>

            {/* Week rows */}
            {weeks.map((week, wi) => {
              const weekBars = getWeekBars(week)
              const hasBar = weekBars.length > 0
              const rowHeight = hasBar ? 76 : 52

              return (
                <div
                  key={wi}
                  className="relative border-b border-slate-100 last:border-b-0"
                  style={{ minHeight: `${rowHeight}px` }}
                >
                  {/* Day cells */}
                  <div className="grid grid-cols-7" style={{ minHeight: `${rowHeight}px` }}>
                    {week.map((day, col) => {
                      const weekend = col === 0 || col === 6
                      return (
                        <div
                          key={day || `e${col}`}
                          className={`
                            border-r last:border-r-0 border-slate-100
                            pt-1.5 pl-2
                            ${!day ? (weekend ? 'bg-slate-50/60' : 'bg-white') : ''}
                            ${day && weekend ? 'bg-slate-50/40' : ''}
                            ${day && !weekend ? 'bg-white' : ''}
                            ${day && isToday(day) ? '!bg-indigo-50' : ''}
                          `}
                          style={{ minHeight: `${rowHeight}px` }}
                        >
                          {day && (
                            <span className={`text-xs font-semibold leading-none ${
                              isToday(day)
                                ? 'text-indigo-600'
                                : weekend ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {day}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Booking bars — absolutely positioned */}
                  {weekBars.map(({ booking, startCol, endCol, isStart, isEnd }) => {
                    const color = SOURCE_COLOR[booking.source] || DEFAULT_COLOR
                    const label = booking.guest_name || booking.source
                    const colW = 100 / 7
                    const INSET = 3

                    const leftInset = isStart ? INSET : 0
                    const rightInset = isEnd ? INSET : 0

                    const borderRadius = [
                      isStart ? '5px' : '0',
                      isEnd   ? '5px' : '0',
                      isEnd   ? '5px' : '0',
                      isStart ? '5px' : '0',
                    ].join(' ')

                    return (
                      <div
                        key={booking.id}
                        className="absolute flex items-center overflow-hidden select-none"
                        title={`${booking.source}${booking.guest_name ? ' · ' + booking.guest_name : ''} · ${booking.check_in} → ${booking.check_out} · ${nightsBetween(booking.check_in, booking.check_out)} nights`}
                        style={{
                          left: `calc(${startCol * colW}% + ${leftInset}px)`,
                          width: `calc(${(endCol - startCol + 1) * colW}% - ${leftInset + rightInset}px)`,
                          top: '28px',
                          height: '28px',
                          background: color,
                          borderRadius,
                          paddingLeft: '8px',
                          paddingRight: '6px',
                        }}
                      >
                        <span style={{
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1,
                        }}>
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {Object.entries(SOURCE_COLOR).map(([src, color]) => (
          <div key={src} className="flex items-center gap-1.5">
            <div className="w-6 h-3 rounded" style={{ background: color }} />
            {src}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300" />
          Today
        </div>
      </div>

      {/* Weekend cleaning schedule — collapsed by date */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">
            Weekend Activity — {MONTH_NAMES[month]} {year}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Check-ins &amp; check-outs on Sat/Sun — for cleaning coordination
          </p>
        </div>

        {Object.keys(weekendByDate).length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            No weekend activity in {MONTH_NAMES[month]}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {Object.entries(weekendByDate).map(([date, events]) => {
              const isOpen = expandedDates[date]
              const dow = new Date(date + 'T12:00:00').getDay()
              const formatted = new Date(date + 'T12:00:00').toLocaleDateString('pt-PT', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
              })
              return (
                <div key={date}>
                  <button
                    onClick={() => toggleDate(date)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        dow === 6 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {dow === 6 ? 'Sat' : 'Sun'}
                      </span>
                      <span className="font-medium text-slate-700 text-sm">{formatted}</span>
                      <span className="text-xs text-slate-400">
                        {events.map(e => e.type === 'check-in' ? 'Check-in' : 'Check-out').join(' · ')}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="bg-slate-50 border-t border-slate-100 divide-y divide-slate-100">
                      {events.map((ev, i) => {
                        const r = ev.booking
                        const isIn = ev.type === 'check-in'
                        return (
                          <div key={i} className="px-4 py-3 flex flex-wrap items-center gap-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${
                              isIn ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {isIn ? 'Check-in' : 'Check-out'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
                              {r.source}
                            </span>
                            {r.guest_name && (
                              <span className="text-sm text-slate-700 font-medium">{r.guest_name}</span>
                            )}
                            <span className="text-xs text-slate-400">
                              {new Date(r.check_in + 'T12:00:00').toLocaleDateString('pt-PT')} → {new Date(r.check_out + 'T12:00:00').toLocaleDateString('pt-PT')}
                            </span>
                            <span className="text-xs text-slate-500">{nightsBetween(r.check_in, r.check_out)} nights</span>
                            <span className="ml-auto text-sm font-semibold text-slate-700 tabular-nums">
                              {formatCurrency(r.total_payout)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
