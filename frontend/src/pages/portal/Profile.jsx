import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  ShieldCheck,
  KeyRound,
  FileText,
  CreditCard,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Form inputs
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers/me');
      const data = res.data;
      setProfile(data);
      setName(data?.name || '');
      setPhone(data?.phone || '');
      setCompany(data?.company || '');
      setAddress(data?.address || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load your profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const res = await api.patch('/customers/me', {
        name: name.trim(),
        phone: phone.trim() || null,
        company: company.trim() || null,
        address: address.trim() || null,
      });

      setProfile((prev) => ({ ...prev, ...res.data }));
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const targetEmail = profile?.email || user?.email;
    if (!targetEmail) {
      toast.error('No email address associated with this account');
      return;
    }

    try {
      setResettingPassword(true);
      await api.post('/auth/forgot-password', { email: targetEmail });
      setResetSent(true);
      toast.success(`Password reset link sent to ${targetEmail}`);
    } catch (err) {
      toast.error(err.message || 'Failed to send password reset link');
    } finally {
      setResettingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Clock className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-sm">Loading your profile details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-50 border-2 border-brand-200 text-brand-700 flex items-center justify-center font-bold text-2xl shadow-xs">
            {(name || profile?.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{profile?.name || user?.name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{profile?.email || user?.email}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Customer Account
              </span>
            </p>
          </div>
        </div>

        {/* Quick Balance Status */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 flex items-center gap-4 self-start md:self-auto">
          <div>
            <div className="text-xs text-slate-500 font-medium">Outstanding Balance</div>
            <div className={`text-lg font-bold ${profile?.outstandingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              ₹{Number(profile?.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="border-l border-slate-200 pl-4 text-xs text-slate-500 space-y-1">
            <div>Subscriptions: <strong className="text-slate-800">{profile?._count?.subscriptions || 0}</strong></div>
            <div>Invoices: <strong className="text-slate-800">{profile?._count?.invoices || 0}</strong></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Editable Profile Information */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Personal & Company Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">Keep your billing and contact details up-to-date</p>
            </div>
            <User className="w-5 h-5 text-slate-400" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g. Riya Sharma"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Company / Organization
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g. Acme Corp India"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  GSTIN / Tax ID
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={profile?.gstin || 'Not Provided'}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">To update your registered GSTIN, please contact our billing team.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profile?.email || user?.email || ''}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Primary email is managed through your authentication credentials.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Billing Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  placeholder="Street address, City, State, PIN code"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500/30 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Security & Preferences */}
        <div className="space-y-6">
          {/* Security Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-slate-900">Security & Access</h2>
            </div>

            <div className="space-y-4">
              <div className="text-xs text-slate-600">
                Your account is protected with encrypted authentication tokens and strict role-based data isolation.
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Password Management</div>
                <div>Need to update your password? You can request a secure reset link sent to your registered email.</div>
              </div>

              {resetSent ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    A password reset link has been dispatched to <strong>{profile?.email || user?.email}</strong>. Check your inbox and spam folder.
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPasswordReset}
                  disabled={resettingPassword}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  {resettingPassword ? 'Sending reset link...' : 'Send Password Reset Link'}
                </button>
              )}
            </div>
          </div>

          {/* Customer Portal Information Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <CreditCard className="w-5 h-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900">Customer Support</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Have questions regarding your subscription renewal, invoice discrepancies, or GST certificates?
            </p>
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="font-medium text-slate-700">Billing Helpdesk</div>
              <div className="text-slate-500 mt-0.5">support@loopbill.odoo.internal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

