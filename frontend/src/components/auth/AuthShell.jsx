import Avatar from './Avatar';
import BrandPanel from './BrandPanel';
import ThemeToggle from '../ThemeToggle';

/**
 * Shared layout for sign in / sign up / password pages: animated brand panel on the left (large screens),
 * mascot + form on the right.
 */
export default function AuthShell({ title, subtitle, mood = 'idle', look = null, shake = false, children, footer }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-slate-50">
      <BrandPanel />

      <main className="auth-side relative flex items-center justify-center px-5 py-10 sm:px-10">
        <ThemeToggle className="absolute right-5 top-5 sm:right-8 sm:top-6" />
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center text-center">
            <Avatar mood={mood} look={look} size={150} className="auth-avatar" />
            <h1 className="mt-2 text-[28px] font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[15px] text-slate-500 max-w-[340px]">{subtitle}</p>}
          </div>

          <div className={`auth-stagger mt-7 ${shake ? 'auth-shake' : ''}`}>{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
