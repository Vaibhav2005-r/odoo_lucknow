import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentTerms() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [dueDays, setDueDays] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payment-terms');
      setTerms(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load payment terms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const openCreateModal = () => {
    setEditingTerm(null);
    setName('');
    setDueDays('0');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (term) => {
    setEditingTerm(term);
    setName(term.name);
    setDueDays(String(term.dueDays));
    setIsActive(term.isActive);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const days = parseInt(dueDays, 10);
    if (isNaN(days) || days < 0 || days > 365) {
      toast.error('Due days must be a whole number between 0 and 365');
      return;
    }

    setSubmitting(true);
    try {
      if (editingTerm) {
        await api.patch(`/payment-terms/${editingTerm.id}`, {
          name,
          dueDays: days,
          isActive,
        });
        toast.success(`Payment term '${name}' updated successfully!`);
      } else {
        await api.post('/payment-terms', {
          name,
          dueDays: days,
          isActive,
        });
        toast.success(`Payment term '${name}' created successfully!`);
      }
      setModalOpen(false);
      fetchTerms();
    } catch (err) {
      toast.error(err.message || 'Failed to save payment term');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (term) => {
    try {
      await api.patch(`/payment-terms/${term.id}`, { isActive: !term.isActive });
      toast.success(`${term.name} is now ${!term.isActive ? 'Active' : 'Archived'}`);
      fetchTerms();
    } catch (err) {
      toast.error(err.message || 'Failed to update term status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Terms</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define invoice payment due windows (e.g. Immediate, 15 Days, 30 Days) used by subscriptions.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Payment Term</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading payment terms...</div>
        ) : terms.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No payment terms defined yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Term Name</th>
                  <th className="py-3 px-4">Due Window</th>
                  <th className="py-3 px-4">Subscriptions Linked</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terms.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand-600" />
                      <span>{t.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {t.dueDays === 0 ? '0 days (Due immediately)' : `${t.dueDays} days after invoice date`}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {t._count?.subscriptions || 0} subscription(s)
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          t.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {t.isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-slate-400" />
                            <span>Archived</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isAdmin && (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 transition"
                            title="Edit Term"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(t)}
                            className={`text-xs font-medium px-2 py-1 rounded transition ${
                              t.isActive
                                ? 'text-slate-500 hover:bg-slate-100'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {t.isActive ? 'Archive' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingTerm ? 'Edit Payment Term' : 'New Payment Term'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Term Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 15 Days or Net 30"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Days (from Invoice Date)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="365"
                    required
                    value={dueDays}
                    onChange={(e) => setDueDays(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">days</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Use 0 for Immediate Payment. Invoices will set dueDate = invoiceDate + dueDays.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="termActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="termActive" className="text-sm font-medium text-slate-700">
                  Active (available for selection on subscriptions and templates)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingTerm ? 'Save Changes' : 'Create Term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
