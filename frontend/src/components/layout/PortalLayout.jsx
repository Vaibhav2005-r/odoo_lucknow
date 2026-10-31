import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Layers,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [summary, setSummary] = useState({
    pendingQuotations: 0,
    activeSubscriptions: 0,
    unpaidInvoices: 0,
    paidInvoices: 0,
    outstandingAmount: 0,
  });

  const fetchSummary = async () => {
    try {
      const res = await api.get('/customers/portal-summary');
      if (res?.data) {
        setSummary(res.data);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const navLinks = [
    {
      to: '/portal',
      label: 'My Subscriptions',
      icon: Layers,
      end: true,
      badge: summary.pendingQuotations > 0 ? `${summary.pendingQuotations} pending` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      to: '/portal/invoices',
      label: 'My Invoices',
      icon: FileText,
      badge: summary.unpaidInvoices > 0 ? `${summary.unpaidInvoices} due` : null,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      to: '/portal/profile',
      label: 'My Profile & Security',
      icon: User,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="glass border-b border-black/[0.06] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-8">
              <Link to="/portal" className="flex items-center gap-2 group">
                <div className="w-9 h-9 rounded-[11px] bg-gradient-to-b from-brand-500 to-brand-700 text-white flex items-center justify-center font-semibold text-lg shadow-md ring-1 ring-black/10 group-hover:scale-105 transition-transform">
                  L
                </div>
                <div>
                  <div className="font-bold text-base text-slate-900 leading-tight">
                    LoopBill <span className="text-brand-600 text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-brand-50 border border-brand-200 ml-1">Portal</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Customer Account Center</div>
                </div>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Right User Bar */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 border border-brand-200 flex items-center justify-center text-xs font-bold">
                  {(user?.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="text-left text-xs">
                  <div className="font-semibold text-slate-800 line-clamp-1 max-w-[140px]">{user?.name}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[140px]">{user?.email}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                title="Sign out of customer portal"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black/[0.06] bg-white/90 backdrop-blur-xl px-4 pt-2 pb-4 space-y-2 shadow-lg animate-[rise_0.35s_var(--ease-apple)]">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-800 border border-brand-200 flex items-center justify-center text-sm font-bold">
                  {(user?.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">{user?.name}</div>
                  <div className="text-[11px] text-slate-500">{user?.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100"
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>

            <nav className="space-y-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-black/[0.06] py-5 px-6 text-center text-xs text-slate-400">
        LoopBill Portal &copy; {new Date().getFullYear()} &bull; Secure Customer Billing & Subscriptions
      </footer>
    </div>
  );
}
