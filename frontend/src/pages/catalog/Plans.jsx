import { useState, useEffect } from 'react';
import {
  CalendarClock,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Repeat,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  X,
  AlertCircle,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { planService } from '../../services/planService';
import { productService } from '../../services/productService';
import { inr } from '../../lib/format';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, monthly: 0, yearly: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('CARDS'); // 'CARDS' or 'TABLE'

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    productId: '',
    price: '',
    billingPeriod: 'MONTHLY',
    minQuantity: 1,
    description: '',
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    isActive: true,
  });

  const loadData = () => {
    try {
      setLoading(true);
      const data = planService.getAll({
        search,
        period: periodFilter,
        status: statusFilter,
      });
      setPlans(data);
      setStats(planService.getStats());

      const allProducts = productService.getAll();
      setProducts(allProducts);
      if (!formData.productId && allProducts.length > 0) {
        setFormData((prev) => ({ ...prev, productId: allProducts[0].id }));
      }
    } catch {
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, periodFilter, statusFilter]);

  const resetForm = () => {
    setFormData({
      name: '',
      productId: products[0]?.id || '',
      price: '',
      billingPeriod: 'MONTHLY',
      minQuantity: 1,
      description: '',
      autoClose: false,
      closable: true,
      pausable: true,
      renewable: true,
      isActive: true,
    });
    setEditingPlan(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      productId: plan.productId,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      minQuantity: plan.minQuantity || 1,
      description: plan.description || '',
      autoClose: Boolean(plan.autoClose),
      closable: Boolean(plan.closable),
      pausable: Boolean(plan.pausable),
      renewable: Boolean(plan.renewable),
      isActive: Boolean(plan.isActive),
    });
    setShowModal(true);
  };

  const handleProductChange = (e) => {
    const prodId = Number(e.target.value);
    const prod = products.find((p) => p.id === prodId);
    setFormData((prev) => ({
      ...prev,
      productId: prodId,
      price: prev.price ? prev.price : prod?.salesPrice || '',
    }));
  };

  const handleSavePlan = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (Number(formData.price) <= 0 || formData.price === '') {
      toast.error('Valid price is required');
      return;
    }

    const prod = products.find((p) => p.id === Number(formData.productId)) || products[0];

    const payload = {
      name: formData.name.trim(),
      productId: prod?.id || 1,
      productName: prod?.name || 'Custom Product',
      price: Number(formData.price),
      billingPeriod: formData.billingPeriod,
      minQuantity: Number(formData.minQuantity) || 1,
      description: formData.description.trim(),
      autoClose: formData.autoClose,
      closable: formData.closable,
      pausable: formData.pausable,
      renewable: formData.renewable,
      isActive: formData.isActive,
    };

    try {
      if (editingPlan) {
        planService.update(editingPlan.id, payload);
        toast.success(`Plan "${payload.name}" updated successfully`);
      } else {
        planService.create(payload);
        toast.success(`Plan "${payload.name}" created successfully`);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error saving plan');
    }
  };

  const handleToggleStatus = (id, name) => {
    try {
      const updated = planService.toggleActive(id);
      toast.success(`"${name}" is now ${updated.isActive ? 'Active' : 'Inactive'}`);
      loadData();
    } catch {
      toast.error('Failed to change plan status');
    }
  };

  const handleDeletePlan = (id) => {
    try {
      planService.delete(id);
      toast.success('Subscription plan removed');
      setDeleteConfirmId(null);
      loadData();
    } catch {
      toast.error('Failed to delete plan');
    }
  };

  const getPeriodLabel = (period) => {
    switch (period) {
      case 'DAILY':
        return 'Daily (24h)';
      case 'WEEKLY':
        return 'Weekly (7d)';
      case 'MONTHLY':
        return 'Monthly';
      case 'YEARLY':
        return 'Yearly';
      default:
        return period;
    }
  };

  const getPeriodBadge = (period) => {
    switch (period) {
      case 'DAILY':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'WEEKLY':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'MONTHLY':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'YEARLY':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscription Plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure recurring billing frequency, term pricing, renewal behaviors, and pause permissions.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Plan</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Plans</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-1">Recurring tiers defined</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active Plans</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</div>
          <div className="text-xs text-slate-400 mt-1">Available for sale</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Monthly Cycles</div>
          <div className="text-2xl font-bold text-brand-700 mt-1">{stats.monthly}</div>
          <div className="text-xs text-slate-400 mt-1">Core monthly billing</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Annual Cycles</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{stats.yearly}</div>
          <div className="text-xs text-slate-400 mt-1">Long-term commitments</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans by name, product or description..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Period:</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Periods</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50 text-xs font-medium">
            <button
              onClick={() => setViewMode('CARDS')}
              className={`px-2.5 py-1 rounded-md transition ${
                viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-2.5 py-1 rounded-md transition ${
                viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading subscription plans...
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          <CalendarClock className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <div className="font-semibold text-slate-700">No subscription plans found</div>
          <div className="text-sm text-slate-400 mt-1">Try clearing filters or add your first plan.</div>
        </div>
      ) : viewMode === 'CARDS' ? (
        /* Card Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden ${
                plan.isActive ? 'border-slate-200' : 'border-slate-200 opacity-75 bg-slate-50/50'
              }`}
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getPeriodBadge(
                        plan.billingPeriod
                      )}`}
                    >
                      {getPeriodLabel(plan.billingPeriod)}
                    </span>
                    <h3 className="font-bold text-slate-900 text-lg mt-2">{plan.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span>{plan.productName}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(plan.id, plan.name)}
                    className="focus:outline-none"
                    title="Click to toggle status"
                  >
                    {plan.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        <XCircle className="h-3 w-3 text-slate-400" />
                        <span>Inactive</span>
                      </span>
                    )}
                  </button>
                </div>

                {/* Price Display */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <div className="text-xs text-slate-500 font-medium">Recurring Rate</div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-extrabold text-slate-900">{inr(plan.price)}</span>
                    <span className="text-xs text-slate-500 font-semibold">
                      / {plan.billingPeriod.toLowerCase().replace('ly', '')}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {plan.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {plan.description}
                  </p>
                )}

                {/* Policy Badges */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <ShieldCheck
                      className={`h-3.5 w-3.5 ${plan.closable ? 'text-emerald-600' : 'text-slate-400'}`}
                    />
                    <span>{plan.closable ? 'Closable' : 'Fixed Term'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600">
                    <PauseCircle
                      className={`h-3.5 w-3.5 ${plan.pausable ? 'text-indigo-600' : 'text-slate-400'}`}
                    />
                    <span>{plan.pausable ? 'Pausable' : 'Non-pausable'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600">
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${plan.renewable ? 'text-brand-600' : 'text-slate-400'}`}
                    />
                    <span>{plan.renewable ? 'Renewable' : 'Non-renewable'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock
                      className={`h-3.5 w-3.5 ${plan.autoClose ? 'text-amber-600' : 'text-slate-400'}`}
                    />
                    <span>{plan.autoClose ? 'Auto-closes' : 'Indefinite'}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">ID #{plan.id}</span>
                <div className="inline-flex gap-2">
                  <button
                    onClick={() => handleOpenEditModal(plan)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(plan.id)}
                    className="inline-flex items-center p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                    title="Delete Plan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table Layout */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Plan Name</th>
                  <th className="py-3 px-4">Associated Product</th>
                  <th className="py-3 px-4">Price / Term</th>
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4">Policies</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-slate-500 font-normal line-clamp-1 max-w-xs">{p.description}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 text-xs">{p.productName}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {inr(p.price)}
                      <span className="text-xs text-slate-400 font-normal ml-1">
                        /{p.billingPeriod.toLowerCase().slice(0, 2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getPeriodBadge(
                          p.billingPeriod
                        )}`}
                      >
                        {p.billingPeriod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 space-x-1">
                      {p.pausable && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Pausable</span>}
                      {p.renewable && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Renewable</span>}
                      {p.autoClose && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[11px]">AutoClose</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <button onClick={() => handleToggleStatus(p.id, p.name)}>
                        {p.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                          title="Edit Plan"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Plan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Delete Plan?</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove this recurring plan? Subscriptions currently active on this plan won't be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlan(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 my-8 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingPlan ? 'Edit Subscription Plan' : 'Create Recurring Plan'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define cadence, price point, linked catalog product, and lifecycle policies.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. ERP Professional Monthly"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Associated Product *
                    </label>
                    <select
                      value={formData.productId}
                      onChange={handleProductChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Billing Period *
                    </label>
                    <select
                      value={formData.billingPeriod}
                      onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                    >
                      <option value="DAILY">DAILY (Every 24 hours)</option>
                      <option value="WEEKLY">WEEKLY (Every 7 days)</option>
                      <option value="MONTHLY">MONTHLY (Same date each month)</option>
                      <option value="YEARLY">YEARLY (Annual renewal)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Price per Billing Period (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="45000.00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Label: {inr(formData.price || 0)} / {getPeriodLabel(formData.billingPeriod)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Minimum Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.minQuantity}
                      onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Details about SLA, features included, and quotation terms..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Policies & Lifecycle Toggles */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Plan Policies & Controls
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.closable}
                        onChange={(e) => setFormData({ ...formData, closable: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Closable Early</div>
                        <div className="text-[11px] text-slate-500">Allow cancel before contract expiry</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.pausable}
                        onChange={(e) => setFormData({ ...formData, pausable: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Pausable</div>
                        <div className="text-[11px] text-slate-500">Allow temporarily pausing invoices</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.renewable}
                        onChange={(e) => setFormData({ ...formData, renewable: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Renewable</div>
                        <div className="text-[11px] text-slate-500">Permit term extension at end date</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.autoClose}
                        onChange={(e) => setFormData({ ...formData, autoClose: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Auto Close at Expiry</div>
                        <div className="text-[11px] text-slate-500">Automatically set status to Closed</div>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center pt-2">
                    <label className="relative flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      <span className="text-xs font-semibold text-slate-700">
                        {formData.isActive ? 'Plan is Active for Subscriptions' : 'Plan is Inactive'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

