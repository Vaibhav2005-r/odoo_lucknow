import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const role = user?.role || 'STAFF';

  return (
    <aside className="w-64 h-full flex flex-col bg-slate-100/80 backdrop-blur-2xl border-r border-black/[0.06]">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-[11px] bg-gradient-to-b from-brand-500 to-brand-700 flex items-center justify-center font-semibold text-white text-sm shadow-md ring-1 ring-black/10">
          LB
        </div>
        <div className="font-semibold text-[17px] text-slate-900 tracking-tight">LoopBill</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {NAV.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role));
          if (!visibleItems.length) return null;

          return (
            <div key={group.group}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 px-3 mb-1.5">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = Icons[item.icon] || Icons.Circle;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-[7px] rounded-[10px] text-[14px] transition-all ${
                          isActive
                            ? 'bg-white text-slate-900 font-semibold shadow-sm ring-1 ring-black/[0.04]'
                            : 'text-slate-700 font-medium hover:bg-black/[0.05]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                              isActive ? 'text-brand-600' : 'text-slate-500 group-hover:text-slate-700'
                            }`}
                            strokeWidth={isActive ? 2.2 : 1.9}
                          />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-slate-400">LoopBill v1.0.0</div>
    </aside>
  );
}
