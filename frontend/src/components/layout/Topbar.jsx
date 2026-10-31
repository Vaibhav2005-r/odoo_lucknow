import { useAuth } from '../../context/AuthContext';
import { LogOut, Menu } from 'lucide-react';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="glass sticky top-0 z-30 h-14 border-b border-black/[0.06] px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenu}
          aria-label="Open menu"
          className="lg:hidden -ml-2 p-2 rounded-full text-slate-600 hover:bg-black/[0.05]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="font-medium text-[15px] text-slate-800 truncate">Brightloop Subscription Management</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-b from-slate-200 to-slate-300 flex items-center justify-center text-[12px] font-semibold text-slate-700 ring-1 ring-black/5">
            {initials}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-800">{user?.name}</span>
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-100">
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          title="Logout"
          aria-label="Logout"
          className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-black/[0.05]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
