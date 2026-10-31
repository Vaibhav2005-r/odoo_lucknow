import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import { homeFor } from '../../components/layout/RequireRole';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, setUser } = useAuth();
  const [state, setState] = useState(token ? 'working' : 'error'); // working | ok | error
  const [message, setMessage] = useState(token ? '' : 'This link is missing its token.');
  const started = useRef(false); // React StrictMode runs effects twice; the link may only be used once

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setState('ok');
        // re-read who is signed in: the server just refreshed their session, and this page may have
        // loaded before the app knew the user, so never rely on the value captured when it mounted
        api.get('/auth/me').then(setUser).catch(() => {});
      })
      .catch((err) => {
        setState('error');
        setMessage(err.message || 'This verification link is invalid or has expired.');
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = user ? homeFor(user.role) : '/login';

  return (
    <AuthShell
      title={state === 'ok' ? 'Email confirmed' : state === 'error' ? 'Link not valid' : 'Confirming your email'}
      subtitle={
        state === 'ok'
          ? 'Thanks. Your account is fully set up.'
          : state === 'error'
            ? message
            : 'One moment while we check your link.'
      }
      mood={state === 'ok' ? 'happy' : state === 'error' ? 'sad' : 'idle'}
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          {state === 'working' && <Loader2 className="h-6 w-6 animate-spin text-brand-600" />}
          {state === 'ok' && <CheckCircle2 className="h-7 w-7 text-emerald-500" />}
          {state === 'error' && <XCircle className="h-7 w-7 text-rose-500" />}
        </div>
        {state !== 'working' && (
          <Link
            to={next}
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-700 text-[15px] font-semibold text-white shadow-md"
          >
            {user ? 'Continue' : 'Go to sign in'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
        {state === 'error' && user && !user.emailVerified && (
          <p className="text-sm text-slate-500">You can request a fresh link from the banner in your portal.</p>
        )}
      </div>
    </AuthShell>
  );
}
