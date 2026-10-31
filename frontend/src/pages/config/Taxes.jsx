import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit2, Percent, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Taxes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTaxes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/taxes');
      setTaxes(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load taxes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxes();
  }, []);

  const openCreateModal = () => {
    setEditingTax(null);
    setName('');
    setRate('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (tax) => {
    setEditingTax(tax);
    setName(tax.name);
    setRate(String(tax.rate));
    setIsActive(tax.isActive);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numRate = Number(rate);
    if (isNaN(numRate) || numRate < 0 || numRate > 100) {
      toast.error('Tax rate must be between 0% and 100%');
      return;
    }

    setSubmitting(true);
    try {
      if (editingTax) {
        await api.patch(`/taxes/${editingTax.id}`, {
          name,
          rate: numRate,
          isActive,
        });
        toast.success(`Tax rate ${name} updated successfully!`);
      } else {
        await api.post('/taxes', {
          name,
          rate: numRate,
          isActive,
        });
        toast.success(`Tax rate ${name} created successfully!`);
      }
      setModalOpen(false);
      fetchTaxes();
    } catch (err) {
      toast.error(err.message || 'Failed to save tax rate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (tax) => {
    try {
      await api.patch(`/taxes/${tax.id}`, { isActive: !tax.isActive });
      toast.success(`${tax.name} is now ${!tax.isActive ? 'Active' : 'Archived'}`);
      fetchTaxes();
    } catch (err) {
      toast.error(err.message || 'Failed to update tax status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax Rates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure GST and other taxes applied automatically to products and subscription lines.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Tax Rate</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading tax rates...</div>
        ) : taxes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No tax rates defined yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Tax Name</th>
                  <th className="py-3 px-4">Rate (%)</th>
                  <th className="py-3 px-4">Products Linked</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taxes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <Percent className="h-4 w-4 text-brand-600" />
                      <span>{t.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{Number(t.rate)}%</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {t._count?.products || 0} product(s)
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
                            title="Edit Tax"
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

      {/* Tax Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingTax ? 'Edit Tax Rate' : 'New Tax Rate'}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Label / Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GST 18%"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate Percentage (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="18"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="taxActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="taxActive" className="text-sm font-medium text-slate-700">
                  Active (available for products and quotes)
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
                  {submitting ? 'Saving...' : editingTax ? 'Save Changes' : 'Create Tax Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
