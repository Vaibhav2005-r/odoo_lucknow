import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { homeFor } from '../../components/layout/RequireRole';
import AuthShell from '../../components/auth/AuthShell';

// Seeded demo accounts (see README). Shown while developing; set VITE_SHOW_DEMO_LOGINS=true to show
// them in a production build, or leave it unset to hide them.
const SHOW_DEMOS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';
const DEMOS = [
  { label: 'Admin', email: 'admin@brightloop.in', password: 'Admin@12345' },
  { label: 'Staff', email: 'staff@brightloop.in', password: 'Staff@12345' },
  { label: 'Customer', email: 'riya@sharmaretail.in', password: 'Customer@123' },
];

const inputClass =
  'peer w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-xs transition-colors hover:border-slate-300';
const iconClass =
  'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 transition-colors peer-focus:text-brand-600';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState(null); // 'email' | 'password' | null
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | success | error
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  // What the mascot does
  let mood = 'idle';
  if (status === 'success') mood = 'happy';
  else if (status === 'error') mood = 'sad';
  else if (focus === 'password') mood = showPassword ? 'peek' : 'cover';

  // While typing the email the eyes slide along the field, looking slightly down at it
  const look =
    focus === 'email' && status === 'idle'
      ? { x: Math.max(-0.85, Math.min(0.85, -0.85 + (email.length / 24) * 1.7)), y: 0.55 }
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || status === 'success') return;
    setLoading(true);
    setStatus('idle');
    try {
      const user = await login(email, password);
      setStatus('success');
      toast.success(`Welcome back, ${user.name}!`);
      later(() => navigate(homeFor(user.role), { replace: true }), 900);
    } catch (err) {
      setStatus('error');
      toast.error(err.message || 'Invalid email or password');
      later(() => setStatus('idle'), 1800);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (d) => {
    setEmail(d.email);
    setPassword(d.password);
    setStatus('idle');
    setShowPassword(false);
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage plans, subscriptions and billing."
      mood={mood}
      look={look}
      shake={status === 'error'}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
            Create account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[13px] font-medium text-slate-700 mb-1.5">
            Email address
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
              placeholder="you@company.com"
              className={inputClass}
            />
            <Mail className={iconClass} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-[13px] font-medium text-slate-700">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
              placeholder="Enter your password"
              className={`${inputClass} pr-12`}
            />
            <Lock className={iconClass} />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the password field focused so the mascot stays in pose
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || status === 'success'}
          className={`group relative w-full h-12 rounded-xl font-semibold text-[15px] text-white shadow-md overflow-hidden transition-all disabled:cursor-default ${
            status === 'success'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-b from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 hover:shadow-lg'
          }`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            {status === 'success' ? (
              <>
                <Check className="h-5 w-5" /> Signed in
              </>
            ) : loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Signing in
              </>
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </span>
        </button>

        {SHOW_DEMOS && (
          <div className="pt-2">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Try a demo account
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DEMOS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => fillDemo(d)}
                  className="h-10 rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 shadow-xs hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
