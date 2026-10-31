import { useAuth } from '../../context/AuthContext';
import { LogOut, User } from 'lucide-react';

export default function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <div className="font-medium text-slate-700">Brightloop Subscription Management</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <span className="font-medium text-slate-800">{user?.name}</span>
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-100">
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          title="Logout"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
