import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../../components/auth/AuthShell';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cover, setCover] = useState(false);

  const checks = [
    { label: 'More than 8 characters', valid: password.length > 8 },
    { label: 'At least one uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'At least one special character', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const allChecksPass = checks.every((c) => c.valid);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Invalid or missing reset token');
      return;
    }
    if (!allChecksPass) {
      toast.error('Password does not meet the security requirements');
      return;
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      setDone(true);
      toast.success('Password updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set new password" subtitle="Choose a secure password for your account" mood={done || (allChecksPass && passwordsMatch) ? 'happy' : cover ? 'cover' : 'idle'}>

        {done ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Password updated. You can now log in with your new credentials.
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm text-sm"
            >
              Sign in now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!token && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                Invalid reset link. Please request a new one.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setCover(true)}
                onBlur={() => setCover(false)}
                placeholder="•••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>

            {password.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">Password requirements:</div>
                {checks.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 ${c.valid ? 'text-green-700' : 'text-slate-500'}`}
                  >
                    {c.valid ? (
                      <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    )}
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setCover(true)}
                onBlur={() => setCover(false)}
                placeholder="•••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token || !allChecksPass || !passwordsMatch}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50 text-sm"
            >
              {loading ? 'Updating password...' : 'Update password'}
            </button>

            <div className="text-center text-sm">
              <Link to="/login" className="text-slate-600 hover:text-slate-900">
                Back to Sign in
              </Link>
            </div>
          </form>
        )}
    </AuthShell>
  );
}
