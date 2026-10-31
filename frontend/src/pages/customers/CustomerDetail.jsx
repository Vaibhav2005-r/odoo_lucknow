import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { inr, date } from '../../lib/format';
import { ArrowLeft, Edit2, Mail, Phone, MapPin, Building, KeyRound, Repeat, Receipt, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
      setName(res.data.name || '');
      setPhone(res.data.phone || '');
      setCompany(res.data.company || '');
      setAddress(res.data.address || '');
      setGstin(res.data.gstin || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/customers/${id}`, {
        name,
        phone: phone || null,
        company: company || null,
        address: address || null,
        gstin: gstin || null,
      });
      toast.success('Customer profile updated successfully!');
      setShowEditModal(false);
      fetchCustomer();
    } catch (err) {
      toast.error(err.message || 'Failed to update customer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-sm">Loading customer details...</div>;
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div>Customer not found.</div>
        <Link to="/app/customers" className="text-brand-600 text-sm underline mt-2 inline-block">
          Return to Customers directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation breadcrumb */}
      <div>
        <Link
          to="/app/customers"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 font-medium transition mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Customers</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
            <p className="text-sm text-slate-500">{customer.company || 'Individual Client'}</p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <Edit2 className="h-4 w-4" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Repeat className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subscriptions</div>
            <div className="text-2xl font-bold text-slate-900">{customer._count?.subscriptions || 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Invoices</div>
            <div className="text-2xl font-bold text-slate-900">{customer._count?.invoices || 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Outstanding Balance</div>
            <div className="text-2xl font-bold text-slate-900">{inr(customer.outstandingAmount || 0)}</div>
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Contact & Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{customer.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{customer.phone || 'No phone recorded'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <Building className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{customer.company || 'Individual Client'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5 text-slate-700">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{customer.address || 'No billing address recorded'}</span>
            </div>
            <div className="text-slate-700 pl-6.5">
              <span className="text-xs text-slate-400 uppercase font-semibold">GSTIN: </span>
              <span className="font-mono">{customer.gstin || 'Not provided'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Portal Account:</span>
              {customer.userId ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <KeyRound className="h-3 w-3" />
                  <span>Enabled ({customer.user?.email})</span>
                </span>
              ) : (
                <span className="text-xs text-slate-500 italic">No portal login linked yet</span>
              )}
            </div>
            <div className="text-xs text-slate-400 pl-0">
              Client since: <span className="text-slate-600 font-medium">{date(customer.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-3 px-4 font-medium text-sm border-b-2 transition -mb-px ${
              activeTab === 'subscriptions'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Subscriptions ({customer.subscriptions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-3 px-4 font-medium text-sm border-b-2 transition -mb-px ${
              activeTab === 'invoices'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Invoices ({customer.invoices?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-4 font-medium text-sm border-b-2 transition -mb-px ${
              activeTab === 'payments'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Payments ({customer.payments?.length || 0})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'subscriptions' && (
            <div>
              {customer.subscriptions?.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No subscriptions yet for this customer.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 pb-2">
                      <th className="py-2">Number</th>
                      <th className="py-2">Plan</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Dates</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.subscriptions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-medium text-brand-600">{s.number}</td>
                        <td className="py-3">{s.plan?.name}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 text-xs">
                          {date(s.startDate)} → {date(s.expiryDate)}
                        </td>
                        <td className="py-3 text-right font-semibold">{inr(s.amountTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              {customer.invoices?.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No invoices recorded yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 pb-2">
                      <th className="py-2">Invoice #</th>
                      <th className="py-2">Date</th>
                      <th className="py-2">Due Date</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.invoices.map((inv) => {
                      const balance = Number(inv.amountTotal) - Number(inv.amountPaid);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-medium text-brand-600">{inv.number}</td>
                          <td className="py-3 text-slate-500 text-xs">{date(inv.invoiceDate)}</td>
                          <td className="py-3 text-slate-500 text-xs">{date(inv.dueDate)}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 text-right font-medium">{inr(inv.amountTotal)}</td>
                          <td className="py-3 text-right font-semibold text-slate-900">{inr(balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {customer.payments?.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No payments recorded yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 pb-2">
                      <th className="py-2">Payment Date</th>
                      <th className="py-2">Invoice #</th>
                      <th className="py-2">Method</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 text-slate-600">{date(p.paymentDate)}</td>
                        <td className="py-3 font-medium text-brand-600">{p.invoice?.number || '—'}</td>
                        <td className="py-3 font-medium text-slate-700">{p.method}</td>
                        <td className="py-3 text-right font-semibold text-emerald-700">{inr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit Customer Profile</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
