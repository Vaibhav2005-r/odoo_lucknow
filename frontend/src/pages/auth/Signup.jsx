import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../../components/auth/AuthShell';

export default function Signup() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      const user = await api.post('/auth/signup', {
        name,
        email,
        password,
        confirmPassword,
      });
      setUser(user);
      toast.success('Account created successfully!');
      navigate('/portal', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Get started with Brightloop Customer Portal" mood={allChecksPass && passwordsMatch ? 'happy' : cover ? 'cover' : 'idle'} footer={<>Already have an account?{' '}<Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link></>}>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Riya Sharma"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="riya@company.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
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
            disabled={loading || !allChecksPass || !passwordsMatch}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50 text-sm"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
    </AuthShell>
  );
}
