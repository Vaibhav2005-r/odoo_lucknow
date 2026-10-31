import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import AuthShell from '../../components/auth/AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      toast.success('Reset email requested');
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email address and we'll send you a password reset link." mood={submitted ? 'happy' : 'idle'}>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              If that email is registered, a reset link has been sent. Please check your inbox.
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              💡 <strong>Development mode:</strong> Check your local Mailpit inbox at{' '}
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
              >
                http://localhost:8025
              </a>
            </div>
            <Link
              to="/login"
              className="block text-center w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm text-sm"
            >
              Back to Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50 text-sm"
            >
              {loading ? 'Sending link...' : 'Send reset link'}
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
