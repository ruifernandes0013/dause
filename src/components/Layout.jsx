import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, BarChart3, Home,
  Menu, X, Calendar, ChevronLeft, ChevronRight, LogOut, Target,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/reservations', icon: Calendar, label: 'Reservations' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/goals', icon: Target, label: 'Goals' },
]

export default function Layout() {
  const { logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        bg-slate-800 flex flex-col shrink-0
        transform transition-all duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${collapsed ? 'md:w-14' : 'w-56'}
      `}>
        {/* Logo / header */}
        <div className={`p-4 border-b border-slate-700 flex items-center justify-between ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 rounded-lg p-1.5 shrink-0">
              <Home size={18} className="text-white" />
            </div>
            {!collapsed && (
              <div className="md:block">
                <h1 className="text-white font-bold text-sm leading-tight">Rental Manager</h1>
                <p className="text-slate-400 text-xs">Property Dashboard</p>
              </div>
            )}
          </div>
          {/* Mobile close */}
          <button
            className="md:hidden text-slate-400 hover:text-white p-1"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${collapsed ? 'md:justify-center md:px-0' : ''}
                ${isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer: collapse toggle + logout */}
        <div className={`p-2 border-t border-slate-700 space-y-0.5`}>
          {/* Logout */}
          <button
            onClick={logout}
            title="Sign out"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''}`}
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-white hover:bg-slate-700 transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden bg-slate-800 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            className="text-slate-300 hover:text-white p-0.5"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500 rounded-md p-1">
              <Home size={14} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Rental Manager</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
