import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PortalLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="font-bold text-lg text-brand-600">LoopBill Portal</div>
          <nav className="flex gap-4">
            <NavLink
              to="/portal"
              end
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`
              }
            >
              My Subscriptions
            </NavLink>
            <NavLink
              to="/portal/invoices"
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`
              }
            >
              My Invoices
            </NavLink>
            <NavLink
              to="/portal/profile"
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`
              }
            >
              Profile
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
