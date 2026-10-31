import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../auth/Avatar';

const TIPS = [
  'Run billing from the dashboard: invoices appear as drafts for you to confirm.',
  'Search any invoice by number or customer name from the Invoices page.',
  'Pause a subscription and billing stops; resume and skipped periods stay skipped.',
  'Use quotation templates to spin up a subscription in two clicks.',
  'Discounts apply automatically on the next invoice and stop when they run out.',
];

function TipCard() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % TIPS.length), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mx-3 mb-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
      <div className="flex items-start gap-2.5">
        <Avatar size={48} className="shrink-0 -ml-1 -mt-1" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">Tip</div>
          <p key={i} className="mt-0.5 text-[12px] leading-snug text-white/85 animate-[fade-in_0.6s_ease-out]">
            {TIPS[i]}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const role = user?.role || 'STAFF';

  return (
    <aside className="sidebar-bg relative w-64 h-full flex flex-col overflow-hidden text-white">
      <div className="bp-blob bp-blob-a !opacity-30" />
      <div className="bp-grid !opacity-20" />

      <div className="relative z-10 px-5 pt-6 pb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-[11px] bg-white/15 ring-1 ring-white/30 backdrop-blur flex items-center justify-center font-semibold text-sm shadow-md">
          LB
        </div>
        <div className="font-semibold text-[17px] tracking-tight">LoopBill</div>
      </div>

      <nav className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {NAV.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role));
          if (!visibleItems.length) return null;

          return (
            <div key={group.group}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45 px-3 mb-1.5">
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
                            ? 'bg-white/18 text-white font-semibold ring-1 ring-white/25 shadow-sm backdrop-blur'
                            : 'text-white/70 font-medium hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`h-[17px] w-[17px] shrink-0 transition-all ${
                              isActive ? 'text-white scale-110' : 'text-white/55 group-hover:text-white/90'
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

      <div className="relative z-10">
        <TipCard />
        <div className="px-5 pb-4 text-[11px] text-white/40">LoopBill v1.0.0</div>
      </div>
    </aside>
  );
}
