import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChefHat, Package, CalendarClock, LogOut } from 'lucide-react'
import { useBranch } from '../context/BranchContext'

const NAV = [
  { to: '/dashboard/kitchen',   label: 'Mutfak',     icon: ChefHat },
  { to: '/dashboard/scheduled', label: 'Randevulu',  icon: CalendarClock },
  { to: '/dashboard/stock',     label: 'Stok',       icon: Package },
]

export default function BranchLayout() {
  const { branch, logout } = useBranch()
  const location  = useLocation()
  const navigate  = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col bg-brand-dark p-5">
        {/* Brand */}
        <div className="mb-8">
          <p className="text-2xl font-bold tracking-tight text-white">KCAL</p>
          <p className="mt-0.5 text-xs text-slate-400">{branch?.name ?? 'Şube Paneli'}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {NAV.map(item => {
            const Icon   = item.icon
            const active = location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-brand-primary text-white shadow-[0_6px_18px_rgba(132,204,22,0.35)]'
                    : 'hover:bg-white/5 hover:text-white'
                }`}
                style={active ? undefined : { color: 'rgba(255,255,255,0.75)' }}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-red-400"
        >
          <LogOut size={16} />
          Çıkış
        </button>
      </aside>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3.5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            {branch?.name ?? 'Şube Paneli'}
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-brand-bg px-3 py-1.5">
            <div className="h-7 w-7 rounded-lg bg-brand-primary text-center text-xs font-bold leading-7 text-white">
              {(branch?.name ?? 'Ş')[0].toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {branch?.name ?? 'Şube'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
