import { useState, useEffect, useMemo } from 'react';
import {
  FileStack,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Layers,
  Percent,
  Calculator,
  Eye,
  X,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { templateService, calculateLineTotals } from '../../services/templateService';
import { planService } from '../../services/planService';
import { productService } from '../../services/productService';
import { referenceService } from '../../services/referenceService';
import { inr } from '../../lib/format';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    planId: '',
    paymentTermId: 2,
    validityDays: 30,
    isActive: true,
    lines: [],
  });

  const [terms, setTerms] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, allPlans, allProducts, allTerms] = await Promise.all([
        templateService.getAll({ search, status: statusFilter }),
        planService.getAll({ status: 'ACTIVE' }),
        productService.getAll({ status: 'ACTIVE' }),
        referenceService.paymentTerms(),
      ]);
      setTemplates(data);
      setPlans(allPlans);
      setProducts(allProducts);
      setTerms(allTerms);
    } catch (err) {
      toast.error(err.message || 'Failed to load quotation templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  // Same rule the server uses: plan price for the plan's own product, list price otherwise, plus the variant extra.
  const linePrice = (line) => {
    const prod = products.find((p) => p.id === Number(line.productId));
    if (!prod) return Number(line.unitPrice) || 0;
    const plan = plans.find((p) => p.id === Number(formData.planId));
    const base = plan && plan.productId === prod.id ? plan.price : prod.salesPrice;
    const extra = prod.variants?.find((v) => v.id === Number(line.variantId))?.extraPrice || 0;
    return Math.round((base + extra) * 100) / 100;
  };
  const lineTaxRate = (line) => {
    const prod = products.find((p) => p.id === Number(line.productId));
    return prod ? prod.taxes.reduce((a, t) => a + t.rate, 0) : Number(line.taxRate) || 0;
  };
  const blankLine = (prod) => ({
    id: Date.now() + Math.random(),
    productId: prod.id,
    variantId: null,
    productName: prod.name,
    quantity: 1,
    discountPercent: 0,
  });

  const resetForm = () => {
    const firstPlan = plans[0];
    const firstProd = products[0];

    const initialLine = firstProd ? [blankLine(firstProd)] : [];

    setFormData({
      name: '',
      description: '',
      planId: firstPlan?.id || '',
      paymentTermId: terms.find((t) => t.dueDays === 15)?.id || terms[0]?.id || '',
      validityDays: 30,
      isActive: true,
      lines: initialLine,
    });
    setEditingTemplate(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (tpl) => {
    setEditingTemplate(tpl);
    setFormData({
      name: tpl.name,
      description: tpl.description || '',
      planId: tpl.planId,
      paymentTermId: tpl.paymentTermId || terms[0]?.id || '',
      validityDays: tpl.validityDays || 30,
      isActive: tpl.isActive,
      lines: tpl.lines ? JSON.parse(JSON.stringify(tpl.lines)) : [],
    });
    setShowModal(true);
  };

  // Line item manipulation
  const handleAddLine = () => {
    if (!products[0]) {
      toast.error('Create a product first');
      return;
    }
    setFormData({ ...formData, lines: [...formData.lines, blankLine(products[0])] });
  };

  const handleRemoveLine = (index) => {
    if (formData.lines.length <= 1) {
      toast.error('Template must have at least one line item');
      return;
    }
    const updated = formData.lines.filter((_, idx) => idx !== index);
    setFormData({ ...formData, lines: updated });
  };

  const handleLineProductChange = (index, productId) => {
    const numId = Number(productId);
    const prod = products.find((p) => p.id === numId);
    if (!prod) return;

    const updated = [...formData.lines];
    updated[index] = { ...updated[index], productId: numId, variantId: null, productName: prod.name };
    setFormData({ ...formData, lines: updated });
  };

  const handleLineVariantChange = (index, variantId) => {
    const updated = [...formData.lines];
    updated[index] = { ...updated[index], variantId: variantId ? Number(variantId) : null };
    setFormData({ ...formData, lines: updated });
  };

  const handleLineFieldChange = (index, field, value) => {
    const updated = [...formData.lines];
    updated[index] = {
      ...updated[index],
      [field]: Math.max(1, Number(value) || 1),
    };
    setFormData({ ...formData, lines: updated });
  };

  // Real-time calculated totals for modal and preview
  const pricedLines = useMemo(
    () => formData.lines.map((l) => ({ ...l, unitPrice: linePrice(l), taxRate: lineTaxRate(l) })),
    [formData.lines, formData.planId, products, plans],
  );
  const liveTotals = useMemo(() => calculateLineTotals(pricedLines), [pricedLines]);

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.planId) {
      toast.error('Default plan selection is required');
      return;
    }
    if (!formData.lines.length) {
      toast.error('Add at least one line item');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      planId: Number(formData.planId),
      paymentTermId: formData.paymentTermId ? Number(formData.paymentTermId) : null,
      validityDays: Number(formData.validityDays) || 30,
      isActive: formData.isActive,
      lines: formData.lines,
    };

    try {
      if (editingTemplate) {
        await templateService.update(editingTemplate.id, payload);
        toast.success(`Template "${payload.name}" updated successfully`);
      } else {
        await templateService.create(payload);
        toast.success(`Template "${payload.name}" created successfully`);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error saving template');
    }
  };

  const handleToggleStatus = async (id, name) => {
    try {
      const updated = await templateService.toggleActive(id);
      toast.success(`"${name}" is now ${updated.isActive ? 'Active' : 'Inactive'}`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update template status');
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await templateService.delete(id);
      toast.success('Quotation template deleted');
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err.message || 'Failed to delete template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quotation Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Preconfigure subscription packages, add-on bundles, payment terms, and validity periods for sales reps.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Template</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, plan, or line items..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Template Listings */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading quotation templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          <FileStack className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <div className="font-semibold text-slate-700">No quotation templates found</div>
          <div className="text-sm text-slate-400 mt-1">Create predefined packages to speed up quote drafting.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {templates.map((tpl) => {
            const totals = calculateLineTotals(tpl.lines);

            return (
              <div
                key={tpl.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-lg">{tpl.name}</h3>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {tpl.validityDays}d validity
                        </span>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleStatus(tpl.id, tpl.name)}
                      className="focus:outline-none shrink-0"
                      title="Click to toggle status"
                    >
                      {tpl.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="h-3 w-3 text-slate-400" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Plan & Term Info Pills */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Default Plan:</span>
                      <span className="font-semibold text-slate-800">{tpl.planName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Payment Terms:</span>
                      <span className="font-semibold text-slate-800">{tpl.paymentTermName}</span>
                    </div>
                  </div>

                  {/* Preconfigured Lines Breakdown */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Package Line Items ({tpl.lines?.length || 0})</span>
                      <span className="font-semibold text-slate-800">Est. Total: {inr(totals.grandTotal)}</span>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-xs divide-y divide-slate-100">
                      {tpl.lines?.slice(0, 3).map((l, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 text-[11px]">{l.quantity}x</span>
                            <span className="font-medium text-slate-800 line-clamp-1">{l.productName}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-semibold text-slate-900">{inr(l.unitPrice * l.quantity)}</span>
                            {l.discountPercent > 0 && (
                              <span className="text-[10px] text-emerald-600 ml-1">(-{l.discountPercent}%)</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {tpl.lines?.length > 3 && (
                        <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50">
                          +{tpl.lines.length - 3} more item(s) included in this template
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => setPreviewTemplate(tpl)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Quotation Preview</span>
                  </button>

                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(tpl)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(tpl.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition"
                      title="Delete Template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quotation Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-lg">Quotation Preview</h3>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                  <div className="text-xl font-extrabold text-slate-900">{previewTemplate.name}</div>
                  <div className="text-xs text-slate-500 mt-1 max-w-md">{previewTemplate.description}</div>
                </div>
                <div className="text-right text-xs text-slate-500 space-y-0.5">
                  <div>Validity: <strong className="text-slate-800">{previewTemplate.validityDays} Days</strong></div>
                  <div>Payment Term: <strong className="text-slate-800">{previewTemplate.paymentTermName}</strong></div>
                  <div>Default Plan: <strong className="text-slate-800">{previewTemplate.planName}</strong></div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Item & Description</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Disc %</th>
                      <th className="py-2.5 px-3 text-right">Tax</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculateLineTotals(previewTemplate.lines).lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{l.productName}</div>
                          {l.description && (
                            <div className="text-[11px] text-slate-400">{l.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{l.quantity}</td>
                        <td className="py-2.5 px-3 text-right">{inr(l.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600">
                          {l.discountPercent > 0 ? `${l.discountPercent}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{l.taxRate}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {inr(l.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculation Summary Block */}
              {(() => {
                const totals = calculateLineTotals(previewTemplate.lines);
                return (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-end space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between w-64">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-800">{inr(totals.subtotal)}</span>
                    </div>
                    {totals.discountAmount > 0 && (
                      <div className="flex justify-between w-64 text-emerald-600">
                        <span>Discount Applied:</span>
                        <span className="font-semibold">-{inr(totals.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between w-64">
                      <span>Estimated Taxes:</span>
                      <span className="font-semibold text-slate-800">+{inr(totals.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between w-64 pt-2 border-t border-slate-300 text-sm font-bold text-slate-900">
                      <span>Total Quotation:</span>
                      <span className="text-base text-brand-700">{inr(totals.grandTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
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
              <h3 className="font-bold text-slate-900 text-base">Delete Template?</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this template? Existing quotations generated with it won't be modified.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTemplate(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Template Modal (with Line Item Builder) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 my-8 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingTemplate ? 'Edit Quotation Template' : 'Create Quotation Template'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure predefined plans, payment terms, and default itemized lines.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Standard ERP Enterprise Deployment"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Subscription Plan *
                  </label>
                  <select
                    value={formData.planId}
                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.billingPeriod}) - {inr(p.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Payment Term *
                  </label>
                  <select
                    value={formData.paymentTermId}
                    onChange={(e) => setFormData({ ...formData, paymentTermId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.dueDays} days due)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quote Validity (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={formData.validityDays}
                    onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="flex items-center pt-4">
                  <label className="relative flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="text-xs font-semibold text-slate-700">Template is Active</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description explaining which customer profiles should use this quotation bundle..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Template Line Item Builder */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Line Item Builder</h3>
                    <p className="text-xs text-slate-500">
                      Choose products, optional variants (such as brand) and quantities. Prices and taxes come from the catalog.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-56">Product</th>
                        <th className="py-2.5 px-3">Variant</th>
                        <th className="py-2.5 px-2 text-center w-16">Qty</th>
                        <th className="py-2.5 px-3 text-right w-24">Price (₹)</th>
                        <th className="py-2.5 px-3 text-right w-24">Total</th>
                        <th className="py-2.5 px-2 text-right w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pricedLines.map((line, idx) => {
                        const lineSub = line.quantity * line.unitPrice;
                        const lineTax = lineSub * (line.taxRate / 100);
                        const lineTotal = lineSub + lineTax;
                        const prodVariants = (products.find((p) => p.id === Number(line.productId))?.variants || []).filter(
                          (v) => v.isActive,
                        );

                        return (
                          <tr key={line.id || idx} className="hover:bg-slate-50/75">
                            <td className="py-2 px-3">
                              <select
                                value={line.productId}
                                onChange={(e) => handleLineProductChange(idx, e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500"
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.type})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={line.variantId || ''}
                                onChange={(e) => handleLineVariantChange(idx, e.target.value)}
                                disabled={prodVariants.length === 0}
                                className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                <option value="">{prodVariants.length ? 'No variant' : 'None available'}</option>
                                {prodVariants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.attribute}: {v.value}
                                    {v.extraPrice ? ` (+${v.extraPrice})` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => handleLineFieldChange(idx, 'quantity', e.target.value)}
                                className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="font-semibold text-slate-700">{inr(line.unitPrice)}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {inr(lineTotal)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Remove line"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Calculation Summary Footer */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{formData.lines.length} item(s)</span> in this
                    template bundle. Taxes calculated at standard GST rates.
                  </div>

                  <div className="w-full sm:w-auto space-y-1 text-xs text-right">
                    <div className="text-slate-500">
                      Subtotal: <span className="font-semibold text-slate-800">{inr(liveTotals.subtotal)}</span>
                    </div>
                    {liveTotals.discountAmount > 0 && (
                      <div className="text-emerald-600">
                        Discount: <span className="font-semibold">-{inr(liveTotals.discountAmount)}</span>
                      </div>
                    )}
                    <div className="text-slate-500">
                      Taxes: <span className="font-semibold text-slate-800">+{inr(liveTotals.taxAmount)}</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                      Grand Total: <span className="text-brand-700">{inr(liveTotals.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions: stays visible while the form scrolls */}
              <div className="sticky -bottom-6 -mx-6 -mb-6 px-6 py-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 flex items-center justify-end gap-3">
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
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

