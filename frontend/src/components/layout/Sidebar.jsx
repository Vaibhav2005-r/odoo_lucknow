import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || 'STAFF';

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      <div className="p-5 flex items-center gap-2 border-b border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white">
          LB
        </div>
        <div className="font-semibold text-lg text-white tracking-wide">LoopBill</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {NAV.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role));
          if (!visibleItems.length) return null;

          return (
            <div key={group.group}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-3 mb-2">
                {group.group}
              </div>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = Icons[item.icon] || Icons.Circle;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        LoopBill v1.0.0
      </div>
    </aside>
  );
}
