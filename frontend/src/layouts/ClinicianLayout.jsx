import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, Users, Monitor, Bell,
  FileText, Settings, LogOut, Search, ChevronDown, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const PAGE_TITLES = {
  '/clinician/dashboard':  'Dashboard',
  '/clinician/patients':   'Patient Management',
  '/clinician/alerts':     'Alerts & Notifications',
  '/clinician/reports':    'Reports',
  '/clinician/settings':   'Settings',
};

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',       to: '/clinician/dashboard', end: true  },
  { icon: Users,           label: 'Patients',         to: '/clinician/patients', end: false },
  { icon: Monitor,         label: 'Live Monitoring',  to: '/clinician/patients', end: true  },
  { icon: Bell,            label: 'Alerts',           to: '/clinician/alerts',   end: true, badge: true },
  { icon: FileText,        label: 'Reports',          to: '/clinician/reports',  end: true  },
  { icon: Settings,        label: 'Settings',         to: '/clinician/settings', end: true  },
];

const getInitials = (name = '') =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

export default function ClinicianLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [alertsCount, setAlertsCount]   = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const menuRef = useRef(null);

  // Fetch unread alerts count
  useEffect(() => {
    api.get('/alerts?status=unresolved')
      .then((res) => {
        const data = res.data?.alerts ?? res.data ?? [];
        setAlertsCount(Array.isArray(data) ? data.filter(a => a.status !== 'resolved').length : 0);
      })
      .catch(() => {});
  }, [location.pathname]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path),
  )?.[1] ?? 'Vital X';

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/clinician/patients?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-navy-900 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-800">
          <div className="p-2 bg-brand rounded-lg flex-shrink-0">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none tracking-tight">Vital X</p>
            <p className="text-navy-600 text-[11px] mt-0.5 font-medium tracking-wide">Monitoring System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
          {NAV.map((item) => (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-400 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={18}
                    className={`flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && alertsCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {alertsCount > 99 ? '99+' : alertsCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user info + logout */}
        <div className="border-t border-navy-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.name || 'Clinician'}</p>
              <p className="text-slate-500 text-xs capitalize">Clinician</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm transition-colors w-full px-1 py-1 rounded"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-800 flex-1 truncate">{pageTitle}</h1>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative hidden sm:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients…"
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand w-56 transition"
            />
          </form>

          {/* Notification bell */}
          <button
            onClick={() => navigate('/clinician/alerts')}
            className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Alerts"
          >
            <Bell size={18} />
            {alertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 bg-brand rounded-full flex items-center justify-center text-white text-xs font-bold">
                {getInitials(user?.name)}
              </div>
              <span className="hidden md:block font-medium truncate max-w-[120px]">{user?.name || 'Clinician'}</span>
              <ChevronDown size={14} className={`transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/clinician/settings'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <User size={14} /> Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
