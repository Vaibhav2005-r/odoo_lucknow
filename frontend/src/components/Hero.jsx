import { Link } from 'react-router-dom';
import Avatar from './auth/Avatar';
import CountUp from './CountUp';

/**
 * Branded banner shown at the top of the main screens: same gradient, glass cards and mascot as the
 * sign-in page. chips: [{ label, value, format }]; actions: [{ to, label, primary }]
 */
export default function Hero({ title, subtitle, mood = 'idle', chips = [], actions = [], className = '' }) {
  return (
    <section className={`brand-panel hero relative overflow-hidden rounded-3xl text-white ${className}`}>
      <div className="bp-blob bp-blob-a" />
      <div className="bp-blob bp-blob-b" />
      <div className="bp-grid" />

      <div className="relative z-10 grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <h2 className="text-[26px] sm:text-[32px] leading-tight font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">{subtitle}</p>}

          {actions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {actions.map((a) => (
                <Link
                  key={a.to + a.label}
                  to={a.to}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all ${
                    a.primary
                      ? 'hero-cta shadow-md hover:shadow-lg hover:-translate-y-0.5'
                      : 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25'
                  }`}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="relative hidden items-center gap-4 lg:flex">
          {chips.length > 0 && (
            <div className="flex flex-col gap-3">
              {chips.map((c, i) => (
                <div key={c.label} className={`bp-card min-w-[190px] ${i % 2 ? 'bp-float-b' : 'bp-float-a'}`} style={{ padding: '12px 16px' }}>
                  <div className="text-[11px] uppercase tracking-wider text-white/60">{c.label}</div>
                  <div className="mt-0.5 text-xl font-semibold tracking-tight">
                    <CountUp value={c.value} format={c.format} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Avatar mood={mood} size={150} />
        </div>
      </div>
    </section>
  );
}
