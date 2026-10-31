import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Repeat,
  User,
  Package,
  Calendar,
  FileStack,
  Plus,
  Trash2,
  CheckCircle2,
  Percent,
  Clock,
  ArrowLeft,
  FileText,
  HelpCircle,
  Building,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { subscriptionService } from '../../services/subscriptionService';
import { planService } from '../../services/planService';
import { productService } from '../../services/productService';
import { templateService } from '../../services/templateService';
import {
  DEFAULT_CUSTOMERS,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_DISCOUNTS,
  DEFAULT_TAXES,
} from '../../services/dataDefaults';
import { inr } from '../../lib/format';

export default function SubscriptionForm() {
  const navigate = useNavigate();

  // Reference Datasets
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [paymentTermId, setPaymentTermId] = useState(2); // 15 Days
  const [discountId, setDiscountId] = useState('');
  const [notes, setNotes] = useState('');

  // Add-ons array: [{ id, productId, name, unitPrice, quantity, taxRate, isActive }]
  const [addons, setAddons] = useState([]);

  // Addon selection sub-state
  const [newAddonProductId, setNewAddonProductId] = useState('');

  useEffect(() => {
    const allPlans = planService.getAll({ status: 'ACTIVE' });
    setPlans(allPlans);
    if (allPlans.length > 0) setSelectedPlanId(allPlans[0].id);

    const allProducts = productService.getAll({ status: 'ACTIVE' });
    setProducts(allProducts);

    const addonProducts = allProducts.filter((p) => p.type === 'ADDON');
    if (addonProducts.length > 0) setNewAddonProductId(addonProducts[0].id);

    const allTemplates = templateService.getAll({ status: 'ACTIVE' });
    setTemplates(allTemplates);
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === Number(selectedCustomerId)) || customers[0];
  }, [customers, selectedCustomerId]);

  const selectedPlan = useMemo(() => {
    return plans.find((p) => p.id === Number(selectedPlanId)) || plans[0];
  }, [plans, selectedPlanId]);

  const selectedDiscount = useMemo(() => {
    return DEFAULT_DISCOUNTS.find((d) => d.id === Number(discountId)) || null;
  }, [discountId]);

  // Autofill when Template is selected
  const handleTemplateSelect = (e) => {
    const tplId = e.target.value;
    setSelectedTemplateId(tplId);
    if (!tplId) return;

    const tpl = templateService.getById(tplId);
    if (!tpl) return;

    if (tpl.planId) setSelectedPlanId(tpl.planId);
    if (tpl.paymentTermId) setPaymentTermId(tpl.paymentTermId);

    // Populate add-on lines from template
    const addonLines = (tpl.lines || [])
      .filter((l) => l.productId !== tpl.planId)
      .map((l, idx) => ({
        id: Date.now() + idx,
        productId: l.productId,
        name: l.productName,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        taxRate: l.taxRate || 18,
        taxName: 'GST 18%',
        isActive: true,
      }));

    setAddons(addonLines);
    toast.success(`Template "${tpl.name}" loaded into subscription`);
  };

  // Add-on line items handlers
  const handleAddAddonLine = () => {
    if (!newAddonProductId) return;
    const prod = products.find((p) => p.id === Number(newAddonProductId));
    if (!prod) return;

    const newLine = {
      id: Date.now(),
      productId: prod.id,
      name: prod.name,
      unitPrice: prod.salesPrice,
      quantity: 1,
      taxRate: prod.taxes?.[0]?.rate || 18,
      taxName: prod.taxes?.[0]?.name || 'GST 18%',
      isActive: true,
    };

    setAddons([...addons, newLine]);
    toast.success(`Added ${prod.name}`);
  };

  const handleRemoveAddonLine = (id) => {
    setAddons(addons.filter((a) => a.id !== id));
  };

  const handleToggleAddonLine = (id) => {
    setAddons(
      addons.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  };

  const handleUpdateAddonPrice = (id, newPrice) => {
    setAddons(
      addons.map((a) => (a.id === id ? { ...a, unitPrice: Math.max(0, Number(newPrice) || 0) } : a))
    );
  };

  const handleUpdateAddonQuantity = (id, newQty) => {
    setAddons(
      addons.map((a) => (a.id === id ? { ...a, quantity: Math.max(1, Number(newQty) || 1) } : a))
    );
  };

  // Price Calculation Engine
  const priceCalculations = useMemo(() => {
    const basePlanPrice = selectedPlan ? Number(selectedPlan.price) : 0;

    const activeAddons = addons.filter((a) => a.isActive);
    const addonsAmount = activeAddons.reduce(
      (sum, a) => sum + Number(a.unitPrice) * Number(a.quantity),
      0
    );

    const subtotal = basePlanPrice + addonsAmount;

    let discountAmount = 0;
    if (selectedDiscount) {
      if (selectedDiscount.type === 'PERCENTAGE') {
        discountAmount = subtotal * (Number(selectedDiscount.value) / 100);
      } else {
        discountAmount = Math.min(subtotal, Number(selectedDiscount.value));
      }
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxableAmount * 0.18; // GST 18%
    const totalRecurringAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

    return {
      basePlanPrice,
      addonsAmount,
      subtotal,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxableAmount,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalRecurringAmount,
    };
  }, [selectedPlan, addons, selectedDiscount]);

  // Submission handler
  const handleSubmit = (initialStatus = 'DRAFT') => {
    if (!selectedCustomerId) {
      toast.error('Customer selection is required');
      return;
    }
    if (!selectedPlanId || !selectedPlan) {
      toast.error('Subscription plan is required');
      return;
    }

    const selectedTerm = DEFAULT_PAYMENT_TERMS.find((t) => t.id === Number(paymentTermId));

    // Construct main lines
    const mainPlanLine = {
      productId: selectedPlan.productId,
      name: `${selectedPlan.name} (${selectedPlan.billingPeriod})`,
      type: 'SERVICE',
      quantity: 1,
      unitPrice: selectedPlan.price,
      taxRate: 18,
      taxName: 'GST 18%',
      isActive: true,
      isBasePlan: true,
    };

    const payload = {
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerCompany: selectedCustomer.company,
      customerEmail: selectedCustomer.email,
      customerPhone: selectedCustomer.phone,
      customerGstin: selectedCustomer.gstin,
      customerAddress: selectedCustomer.address,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      productName: selectedPlan.productName,
      billingPeriod: selectedPlan.billingPeriod,
      initialStatus,
      startDate,
      expiryDate,
      nextBillingDate: startDate,
      paymentTermId: selectedTerm?.id || 1,
      paymentTermName: selectedTerm?.name || 'Immediate',
      discountId: selectedDiscount?.id || null,
      discountName: selectedDiscount?.name || null,
      discountRate: selectedDiscount?.type === 'PERCENTAGE' ? selectedDiscount.value : 0,
      discountFixed: selectedDiscount?.type === 'FIXED' ? selectedDiscount.value : 0,
      notes: notes.trim(),
      lines: [mainPlanLine, ...addons],
    };

    try {
      const created = subscriptionService.create(payload);
      toast.success(
        initialStatus === 'QUOTATION'
          ? `Quotation ${created.number} created and dispatched!`
          : `Subscription ${created.number} saved as Draft!`
      );
      navigate(`/app/subscriptions/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create subscription');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/app/subscriptions"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Subscriptions</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Subscription Contract</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set up customer recurring billing, customize package items, add attach modules, and define quotation terms.
          </p>
        </div>

        {/* Template Autofill Shortcut */}
        <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
          <FileStack className="h-4 w-4 text-brand-600" />
          <span className="text-xs font-semibold text-slate-700">Autofill Template:</span>
          <select
            value={selectedTemplateId}
            onChange={handleTemplateSelect}
            className="text-xs font-medium text-slate-800 bg-transparent border-0 focus:ring-0 cursor-pointer"
          >
            <option value="">Choose a Template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Customer Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Customer Information</h2>
              <p className="text-xs text-slate-500">Select the subscribing business or individual tenant.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedCustomer.company || selectedCustomer.name}</span>
                  </span>
                  {selectedCustomer.gstin && (
                    <span className="bg-emerald-50 text-emerald-700 font-mono text-[10px] px-2 py-0.5 rounded border border-emerald-200">
                      GSTIN: {selectedCustomer.gstin}
                    </span>
                  )}
                </div>
                <div className="text-slate-500 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span>{selectedCustomer.email}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{selectedCustomer.phone}</span>
                  </span>
                </div>
                {selectedCustomer.address && (
                  <div className="text-slate-400 text-[11px] line-clamp-1">{selectedCustomer.address}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Subscription Plan */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Subscription Plan</h2>
              <p className="text-xs text-slate-500">Choose the core recurring plan that defines renewal cadence.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Recurring Plan *</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.billingPeriod}) - {inr(p.price)}
                  </option>
                ))}
              </select>
            </div>

            {selectedPlan && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Associated Product:</span>
                  <strong className="text-slate-800">{selectedPlan.productName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Billing Cadence:</span>
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                    {selectedPlan.billingPeriod}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Base Recurring Rate:</span>
                  <span className="text-base font-extrabold text-slate-900">{inr(selectedPlan.price)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Subscription Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">3. Contract Dates, Terms & Discounts</h2>
              <p className="text-xs text-slate-500">Contract start, end date, payment terms, and promotional codes.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contract Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry / End Date *</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
              <select
                value={paymentTermId}
                onChange={(e) => setPaymentTermId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              >
                {DEFAULT_PAYMENT_TERMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.dueDays}d due)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Promotion / Discount</label>
              <select
                value={discountId}
                onChange={(e) => setDiscountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              >
                <option value="">None (Standard Rate)</option>
                {DEFAULT_DISCOUNTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contract specifications, special billing instructions, or customer relationship history..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Add-on Products */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">4. Add-on Products & Attachments</h2>
                <p className="text-xs text-slate-500">Attach modular services like 24/7 SLA support, cloud backups, or extra hardware.</p>
              </div>
            </div>

            {/* Add Addon Selector */}
            <div className="flex items-center gap-2">
              <select
                value={newAddonProductId}
                onChange={(e) => setNewAddonProductId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-xs"
              >
                {products
                  .filter((p) => p.type === 'ADDON' || p.type === 'SERVICE')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({inr(p.salesPrice)})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAddAddonLine}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Attach</span>
              </button>
            </div>
          </div>

          {/* Add-ons List Table */}
          {addons.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Add-on Item</th>
                    <th className="py-2.5 px-3 text-center w-20">Qty</th>
                    <th className="py-2.5 px-3 text-right w-28">Price (₹)</th>
                    <th className="py-2.5 px-3 text-right w-28">Line Total</th>
                    <th className="py-2.5 px-3 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {addons.map((a) => (
                    <tr key={a.id} className={a.isActive ? 'hover:bg-slate-50/75' : 'bg-slate-50/50 opacity-60'}>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleAddonLine(a.id)}
                          className="focus:outline-none"
                        >
                          {a.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{a.name}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={a.quantity}
                          onChange={(e) => handleUpdateAddonQuantity(a.id, e.target.value)}
                          className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={a.unitPrice}
                          onChange={(e) => handleUpdateAddonPrice(a.id, e.target.value)}
                          className="w-20 px-1.5 py-1 text-right border border-slate-300 rounded font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {inr(a.unitPrice * a.quantity)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveAddonLine(a.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              No add-ons attached. Select an add-on from the dropdown above to include optional products.
            </div>
          )}
        </div>

        {/* Section 5: Price Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Percent className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">5. Financial Summary & Recurring Rate</h2>
              <p className="text-xs text-slate-500">Calculated recurring rate per billing cycle.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
              <p>
                Recurring bills will generate on the cycle anniversary date ({selectedPlan?.billingPeriod.toLowerCase()}).
              </p>
              <p>
                Invoices inherit payment terms ({DEFAULT_PAYMENT_TERMS.find((t) => t.id === Number(paymentTermId))?.name}).
              </p>
              <p className="text-[11px] text-slate-400">
                Taxes are calculated based on registered state GST rules (18%). All financial computations run with full paise precision.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Base Plan ({selectedPlan?.name}):</span>
                <span className="font-semibold text-slate-900">{inr(priceCalculations.basePlanPrice)}</span>
              </div>

              {priceCalculations.addonsAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Attached Add-ons ({addons.filter((a) => a.isActive).length}):</span>
                  <span className="font-semibold text-slate-900">+{inr(priceCalculations.addonsAmount)}</span>
                </div>
              )}

              {priceCalculations.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount ({selectedDiscount?.name}):</span>
                  <span>-{inr(priceCalculations.discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>GST Taxes (18%):</span>
                <span className="font-semibold text-slate-900">+{inr(priceCalculations.taxAmount)}</span>
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline text-sm font-extrabold text-slate-900">
                <span>Total Recurring Amount:</span>
                <span className="text-xl text-brand-700">
                  {inr(priceCalculations.totalRecurringAmount)}
                  <span className="text-xs font-semibold text-slate-500 ml-1">
                    /{selectedPlan?.billingPeriod.toLowerCase().slice(0, 2)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            to="/app/subscriptions"
            className="w-full sm:w-auto text-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            className="w-full sm:w-auto px-5 py-2 border border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-sm font-semibold transition"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('QUOTATION')}
            className="w-full sm:w-auto px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
          >
            Create Quotation & Send
          </button>
        </div>
      </div>
    </div>
  );
}

