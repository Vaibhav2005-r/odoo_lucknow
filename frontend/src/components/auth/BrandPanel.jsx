import { useEffect, useState } from 'react';
import { Check, TrendingUp, RefreshCw } from 'lucide-react';

// Counts up to `target` once, easing out. Skips the animation for people who prefer reduced motion.
function useCountUp(target, ms = 1800, delay = 500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return undefined;
    }
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        setValue(target * (1 - (1 - p) ** 3));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, ms, delay]);
  return value;
}

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function BrandPanel() {
  const mrr = useCountUp(1504058);

  return (
    <aside className="brand-panel relative hidden lg:flex flex-col justify-between overflow-hidden text-white p-12 xl:p-16">
      {/* drifting colour blobs and a faint dot grid */}
      <div className="bp-blob bp-blob-a" />
      <div className="bp-blob bp-blob-b" />
      <div className="bp-blob bp-blob-c" />
      <div className="bp-grid" />

      <header className="relative z-10 flex items-center gap-3">
        <div className="h-10 w-10 rounded-[12px] bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center font-semibold">
          LB
        </div>
        <div className="text-lg font-semibold tracking-tight">LoopBill</div>
      </header>

      <div className="relative z-10 my-10 min-h-[330px]">
        {/* invoice paid */}
        <div className="bp-card bp-float-a absolute left-0 top-0 w-[290px]">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="rgba(52,199,89,0.18)" />
              <circle cx="20" cy="20" r="18" fill="none" stroke="#34c759" strokeWidth="2.5" className="bp-draw" pathLength="1" />
              <path d="M12 21 l6 6 l11 -13" fill="none" stroke="#34c759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="bp-draw bp-draw-late" pathLength="1" />
            </svg>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-white/60">Invoice paid</div>
              <div className="font-semibold text-sm truncate">INV/2026/00124</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-semibold tabular">₹12,980</div>
              <div className="text-[11px] text-emerald-300">via UPI</div>
            </div>
          </div>
        </div>

        {/* MRR */}
        <div className="bp-card bp-float-b absolute left-16 top-[104px] w-[340px]">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/60">
            <span>Monthly recurring revenue</span>
            <span className="inline-flex items-center gap-1 text-emerald-300 normal-case tracking-normal text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> 18.4%
            </span>
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{inr(mrr)}</div>
          <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="mt-2 w-full h-[62px]" aria-hidden="true">
            <defs>
              <linearGradient id="bp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 58 C30 54 40 40 70 42 S110 56 140 36 S190 30 215 22 S270 10 300 6 V70 H0 Z" fill="url(#bp-area)" className="bp-fade" />
            <path d="M0 58 C30 54 40 40 70 42 S110 56 140 36 S190 30 215 22 S270 10 300 6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" pathLength="1" vectorEffect="non-scaling-stroke" className="bp-draw bp-draw-spark" />
          </svg>
        </div>

        {/* renewal ring */}
        <div className="bp-card bp-float-c absolute left-6 top-[262px] w-[300px]">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray="163.4" className="bp-ring" />
            </svg>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/60">
                <RefreshCw className="h-3 w-3" /> Auto-renewal
              </div>
              <div className="font-semibold text-sm mt-0.5">CRM Monthly · 12 days left</div>
              <div className="text-xs text-white/60">Next invoice generates itself</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-md">
        <h2 className="text-[34px] leading-[1.1] font-semibold tracking-tight">Every subscription, one calm workspace.</h2>
        <p className="mt-3 text-white/70 text-[15px] leading-relaxed">
          Plans, renewals, invoices and payments for Brightloop Software, without spreadsheets or missed renewals.
        </p>
        <ul className="mt-5 grid gap-2 text-sm text-white/85">
          {['Invoices created automatically, never twice', 'Taxes and discounts applied for you', 'Customers manage their own plans'].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
                <Check className="h-3 w-3" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
