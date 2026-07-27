import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, FileText,
  CreditCard, UserCog, ChevronRight, Map, Settings, LogOut
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

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
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden print:h-auto print:block print:overflow-visible">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-navy text-white flex flex-col print:hidden">
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
        <div className="border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
          <div className="px-5 py-2 text-xs text-white/40">
            Phase 1 — Sales Module
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <Outlet />
      </main>
    </div>
  )
}
