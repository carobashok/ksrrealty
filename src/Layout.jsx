import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, FileText,
  CreditCard, UserCog, ChevronRight, Map, Settings
} from 'lucide-react'

const nav = [
  { to: '/dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/projects',   label: 'Projects',         icon: Building2 },
  { to: '/customers',  label: 'Customers',        icon: Users },
  { to: '/bookings',   label: 'Bookings',         icon: FileText },
  { to: '/payments',   label: 'Payments',         icon: CreditCard },
  { to: '/employees',  label: 'Employees',        icon: UserCog },
  { to: '/settings',   label: 'Settings',          icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-navy text-white flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-xs font-bold tracking-widest text-gold uppercase">Carob Technologies</p>
          <p className="text-base font-bold text-white mt-0.5">KSR MIS</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-xs text-white/40">
          Phase 1 — Sales Module
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
