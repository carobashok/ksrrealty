import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, FileText,
  CreditCard, UserCog, ChevronRight, ChevronDown, Map, Settings, LogOut, Handshake, FolderCog, XCircle, ArrowDownLeft, FolderOpen
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const nav = [
  { to: '/dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/projects',   label: 'Projects',         icon: Building2 },
  {
    group: 'master',
    label: 'Master',
    icon: FolderCog,
    items: [
      { to: '/customers',        label: 'Customers',        icon: Users },
      { to: '/employees',        label: 'Employees',        icon: UserCog },
      { to: '/channel-partners', label: 'Channel Partners', icon: Handshake },
    ],
  },
  { to: '/bookings',   label: 'Bookings',         icon: FileText },
  { to: '/documents',     label: 'Documents',        icon: FolderOpen },
  { to: '/receipts',      label: 'Receipts',         icon: ArrowDownLeft },
  { to: '/payments',       label: 'Payments',         icon: CreditCard },
  { to: '/cancellations',  label: 'Cancellations',    icon: XCircle },
  { to: '/settings',   label: 'Settings',          icon: Settings },
]

export default function Layout() {
  const { signOut } = useAuth()

  const { data: settings } = useQuery({
    queryKey: ['company-settings-layout'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('company_settings')
        .select('logo_url, account_holder_name')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  })
  const navigate = useNavigate()
  const location = useLocation()

  const masterPaths = nav.find(n => n.group === 'master')?.items.map(i => i.to) || []
  const [masterOpen, setMasterOpen] = useState(masterPaths.includes(location.pathname))

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden print:h-auto print:block print:overflow-visible">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-navy text-white flex flex-col print:hidden">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10 flex flex-col items-center">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.account_holder_name || 'KSR Realty'}
              className="h-20 w-auto object-contain"
            />
          ) : (
            <>
              <p className="text-xs font-bold tracking-widest text-gold uppercase">Carob Technologies</p>
              <p className="text-base font-bold text-white mt-0.5">KSR MIS</p>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {nav.map((item) => {
            if (item.group) {
              const GroupIcon = item.icon
              return (
                <div key={item.group}>
                  <button
                    onClick={() => setMasterOpen((o) => !o)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <GroupIcon size={17} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {masterOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {masterOpen && (
                    <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 mt-0.5">
                      {item.items.map(({ to, label, icon: Icon }) => (
                        <NavLink
                          key={to}
                          to={to}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-brand text-white'
                                : 'text-white/60 hover:bg-white/10 hover:text-white'
                            }`
                          }
                        >
                          <Icon size={15} />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            )
          })}
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
