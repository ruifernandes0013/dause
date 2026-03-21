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
const DEFAULT_COLOR = '#94a3b8'

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

  // Split cells into week rows
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  function toDateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function getOccupied(day) {
    const dateStr = toDateStr(day)
    return reservations.find(r => r.check_in <= dateStr && r.check_out > dateStr) || null
  }

  // For each week, compute booking bar segments (startCol → endCol per booking)
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
      if (cols.length > 0) {
        result.push({ booking: r, startCol: cols[0], endCol: cols[cols.length - 1] })
      }
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
    if (ci.getFullYear() === year && ci.getMonth() === month && [0, 6].includes(ci.getDay())) {
      weekendEvents.push({ type: 'check-in', date: r.check_in, dow: ci.getDay(), booking: r })
    }
    if (co.getFullYear() === year && co.getMonth() === month && [0, 6].includes(co.getDay())) {
      weekendEvents.push({ type: 'check-out', date: r.check_out, dow: co.getDay(), booking: r })
    }
  })
  weekendEvents.sort((a, b) => a.date.localeCompare(b.date))

  // Group weekend events by date
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
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>

            {/* Week rows */}
            <div className="space-y-1">
              {weeks.map((week, wi) => {
                const weekBars = getWeekBars(week)
                return (
                  <div key={wi}>
                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-0.5">
                      {week.map((day, col) => {
                        if (!day) return <div key={`e${col}`} className="h-10 sm:h-12" />
                        const occupied = getOccupied(day)
                        const dow = new Date(year, month, day).getDay()
                        const isCheckIn = occupied?.check_in === toDateStr(day)
                        const showLabel = occupied && (isCheckIn || dow === 0)
                        const label = occupied ? (occupied.guest_name || occupied.source) : null
                        return (
                          <div
                            key={day}
                            title={occupied
                              ? `${occupied.source}${occupied.guest_name ? ' · ' + occupied.guest_name : ''} · IN: ${occupied.check_in} · OUT: ${occupied.check_out}`
                              : 'Free'
                            }
                            className={`
                              relative h-10 sm:h-12 rounded-lg flex flex-col items-start justify-start
                              pt-1 px-1.5 select-none
                              ${occupied ? 'bg-white border border-slate-100' : 'bg-emerald-50 border border-emerald-100'}
                              ${isToday(day) ? 'ring-2 ring-indigo-500 ring-inset' : ''}
                            `}
                          >
                            <span className={`text-[11px] sm:text-xs font-bold leading-none ${
                              occupied ? 'text-slate-700' : 'text-emerald-700'
                            }`}>
                              {day}
                            </span>
                            {showLabel && label && (
                              <span className="hidden sm:block text-[8px] leading-tight mt-0.5 text-slate-400 truncate w-full">
                                {label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Booking bar — one row per week, flex-1 segments aligned to grid columns */}
                    {weekBars.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 h-1.5">
                        {[0, 1, 2, 3, 4, 5, 6].map(col => {
                          const bar = weekBars.find(b => col >= b.startCol && col <= b.endCol)
                          if (!bar) return <div key={col} className="flex-1" />
                          const color = SOURCE_COLOR[bar.booking.source] || DEFAULT_COLOR
                          const isLeft = col === bar.startCol
                          const isRight = col === bar.endCol
                          const br = `${isLeft ? '9999px' : '0'} ${isRight ? '9999px' : '0'} ${isRight ? '9999px' : '0'} ${isLeft ? '9999px' : '0'}`
                          return (
                            <div
                              key={col}
                              className="flex-1"
                              style={{ background: color, borderRadius: br }}
                            />
                          )
                        })}
                      </div>
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
          Bookable
        </div>
        {Object.entries(SOURCE_COLOR).map(([src, color]) => (
          <div key={src} className="flex items-center gap-1.5">
            <div className="w-8 h-1.5 rounded-full" style={{ background: color }} />
            {src}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-indigo-500" />
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
              const dayLabel = dow === 6 ? 'Sat' : 'Sun'
              const formatted = new Date(date + 'T12:00:00').toLocaleDateString('pt-PT', {
                day: '2-digit', month: 'short', year: 'numeric',
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
                        {dayLabel}
                      </span>
                      <span className="font-medium text-slate-700 text-sm">{formatted}</span>
                      <span className="text-xs text-slate-400">
                        {events.map(e => e.type === 'check-in' ? 'Check-in' : 'Check-out').join(' · ')}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2 bg-slate-50">
                      {events.map((ev, i) => {
                        const r = ev.booking
                        const isIn = ev.type === 'check-in'
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-3 py-2 border-t border-slate-100 first:border-t-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              isIn ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {isIn ? 'Check-in' : 'Check-out'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.source] || 'bg-slate-100 text-slate-600'}`}>
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
