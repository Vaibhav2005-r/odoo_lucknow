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
import { referenceService } from '../../services/referenceService';
import CustomerPicker from '../../components/CustomerPicker';
import { inr } from '../../lib/format';

export default function SubscriptionForm() {
  const navigate = useNavigate();

  // Reference Datasets (all from the API)
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [terms, setTerms] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [baseQuantity, setBaseQuantity] = useState(1);
  const [baseVariantId, setBaseVariantId] = useState('');

  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [paymentTermId, setPaymentTermId] = useState('');
  const [discountId, setDiscountId] = useState('');
  const [notes, setNotes] = useState('');

  // Add-ons array: [{ id, productId, variantId, name, unitPrice, quantity, taxRate, isActive }]
  const [addons, setAddons] = useState([]);

  // Addon selection sub-state
  const [newAddonProductId, setNewAddonProductId] = useState('');

  useEffect(() => {
    Promise.all([
      planService.getAll({ status: 'ACTIVE' }),
      productService.getAll({ status: 'ACTIVE' }),
      templateService.getAll({ status: 'ACTIVE' }),
      referenceService.paymentTerms(),
      referenceService.subscriptionDiscounts(),
      referenceService.customers(),
    ])
      .then(([allPlans, allProducts, allTemplates, allTerms, allDiscounts, allCustomers]) => {
        setPlans(allPlans);
        if (allPlans.length > 0) {
          setSelectedPlanId(allPlans[0].id);
          setBaseQuantity(allPlans[0].minQuantity || 1);
        }
        setProducts(allProducts);
        const addonProducts = allProducts.filter((p) => p.type === 'ADDON');
        if (addonProducts.length > 0) setNewAddonProductId(addonProducts[0].id);
        setTemplates(allTemplates);
        setTerms(allTerms);
        setPaymentTermId((allTerms.find((t) => t.dueDays === 15) || allTerms[0])?.id || '');
        setDiscounts(allDiscounts);
        setCustomers(allCustomers);
        if (allCustomers.length > 0) setSelectedCustomerId(allCustomers[0].id);
      })
      .catch((err) => toast.error(err.message || 'Failed to load form data'));
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === Number(selectedCustomerId)) || customers[0];
  }, [customers, selectedCustomerId]);

  const selectedPlan = useMemo(() => {
    return plans.find((p) => p.id === Number(selectedPlanId)) || plans[0];
  }, [plans, selectedPlanId]);

  const basePlanProduct = useMemo(
    () => products.find((p) => p.id === selectedPlan?.productId) || null,
    [products, selectedPlan],
  );
  const baseVariants = (basePlanProduct?.variants || []).filter((v) => v.isActive);
  const baseVariant = baseVariants.find((v) => v.id === Number(baseVariantId)) || null;

  const selectedDiscount = useMemo(() => {
    return discounts.find((d) => d.id === Number(discountId)) || null;
  }, [discounts, discountId]);

  const handlePlanChange = (e) => {
    const plan = plans.find((p) => p.id === Number(e.target.value));
    setSelectedPlanId(e.target.value);
    setBaseVariantId('');
    if (plan) setBaseQuantity((q) => Math.max(Number(q) || 1, plan.minQuantity || 1));
  };

  // Autofill when Template is selected
  const handleTemplateSelect = async (e) => {
    const tplId = e.target.value;
    setSelectedTemplateId(tplId);
    if (!tplId) return;

    const tpl = templates.find((t) => t.id === Number(tplId));
    if (!tpl) return;

    const plan = plans.find((p) => p.id === tpl.planId);
    if (tpl.planId) setSelectedPlanId(tpl.planId);
    if (tpl.paymentTermId) setPaymentTermId(tpl.paymentTermId);

    const baseLine = (tpl.lines || []).find((l) => l.productId === plan?.productId);
    setBaseQuantity(baseLine?.quantity || plan?.minQuantity || 1);
    setBaseVariantId(baseLine?.variantId || '');

    // Every other template line becomes an add-on row
    const addonLines = (tpl.lines || [])
      .filter((l) => l !== baseLine)
      .map((l, idx) => {
        const prod = products.find((p) => p.id === l.productId);
        return {
          id: Date.now() + idx,
          productId: l.productId,
          variantId: l.variantId || null,
          name: l.productName,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          taxRate: l.taxRate,
          taxName: prod?.taxes?.map((t) => t.name).join(', ') || '',
          isActive: true,
        };
      });

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
      variantId: null,
      taxRate: prod.taxes.reduce((a, t) => a + t.rate, 0),
      taxName: prod.taxes.map((t) => t.name).join(', '),
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

  // Live estimate shown while editing. The server recalculates everything when the subscription is saved.
  const priceCalculations = useMemo(() => {
    const baseRate = selectedPlan ? Number(selectedPlan.price) + Number(baseVariant?.extraPrice || 0) : 0;
    const basePlanPrice = baseRate * (Number(baseQuantity) || 1);
    const baseTaxRate = (basePlanProduct?.taxes || []).reduce((a, t) => a + t.rate, 0);

    const activeAddons = addons.filter((a) => a.isActive);
    const addonsAmount = activeAddons.reduce((sum, a) => sum + Number(a.unitPrice) * Number(a.quantity), 0);

    const subtotal = basePlanPrice + addonsAmount;

    let discountAmount = 0;
    if (selectedDiscount && subtotal > 0) {
      const minOk = selectedDiscount.minPurchase == null || subtotal >= Number(selectedDiscount.minPurchase);
      if (minOk) {
        discountAmount =
          selectedDiscount.type === 'PERCENTAGE'
            ? subtotal * (Number(selectedDiscount.value) / 100)
            : Math.min(subtotal, Number(selectedDiscount.value));
      }
    }

    const keep = subtotal > 0 ? 1 - discountAmount / subtotal : 1;
    const taxAmount =
      (basePlanPrice * baseTaxRate + activeAddons.reduce((sum, a) => sum + Number(a.unitPrice) * Number(a.quantity) * Number(a.taxRate || 0), 0)) *
      keep /
      100;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
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
  }, [selectedPlan, basePlanProduct, baseVariant, baseQuantity, addons, selectedDiscount]);

  // Submission handler
  const handleSubmit = async (initialStatus = 'DRAFT') => {
    if (!selectedCustomer) {
      toast.error('Customer selection is required');
      return;
    }
    if (!selectedPlan) {
      toast.error('Subscription plan is required');
      return;
    }
    if (Number(baseQuantity) < (selectedPlan.minQuantity || 1)) {
      toast.error(`This plan needs a minimum quantity of ${selectedPlan.minQuantity}`);
      return;
    }
    if (expiryDate < startDate) {
      toast.error('Expiry date must be on or after the start date');
      return;
    }

    const payload = {
      customerId: selectedCustomer.id,
      planId: selectedPlan.id,
      templateId: selectedTemplateId || null,
      initialStatus,
      startDate,
      expiryDate,
      paymentTermId,
      discountId: selectedDiscount?.id || null,
      notes: notes.trim(),
      lines: [
        {
          productId: selectedPlan.productId,
          variantId: baseVariant?.id || null,
          quantity: Number(baseQuantity) || 1,
          isBasePlan: true,
        },
        ...addons.filter((a) => a.isActive),
      ],
    };

    try {
      setSaving(true);
      const created = await subscriptionService.create(payload);
      toast.success(
        initialStatus === 'QUOTATION'
          ? `Quotation ${created.number} created and dispatched!`
          : `Subscription ${created.number} saved as Draft!`
      );
      navigate(`/app/subscriptions/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create subscription');
    } finally {
      setSaving(false);
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
              <CustomerPicker
                selected={selectedCustomer}
                initial={customers}
                onSelect={(c) => {
                  setCustomers((list) => (list.some((x) => x.id === c.id) ? list : [c, ...list]));
                  setSelectedCustomerId(c.id);
                }}
              />
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
                onChange={handlePlanChange}
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
                <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Quantity (min {selectedPlan.minQuantity || 1}):</span>
                  <input
                    type="number"
                    min={selectedPlan.minQuantity || 1}
                    value={baseQuantity}
                    onChange={(e) => setBaseQuantity(e.target.value)}
                    className="w-20 px-2 py-1 text-center border border-slate-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                {baseVariants.length > 0 && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-slate-500">Variant:</span>
                    <select
                      value={baseVariantId}
                      onChange={(e) => setBaseVariantId(e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Standard</option>
                      {baseVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attribute}: {v.value}
                          {v.extraPrice ? ` (+${inr(v.extraPrice)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Base Recurring Rate (per unit):</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {inr(selectedPlan.price + Number(baseVariant?.extraPrice || 0))}
                  </span>
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
                {terms.map((t) => (
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
                {discounts.map((d) => (
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
                Invoices inherit payment terms ({terms.find((t) => t.id === Number(paymentTermId))?.name}).
              </p>
              <p className="text-[11px] text-slate-400">
                This is an estimate. Taxes and discounts are recalculated on the server using the product tax rules and discount conditions when you save.
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
            disabled={saving}
            onClick={() => handleSubmit('DRAFT')}
            className="w-full sm:w-auto px-5 py-2 border border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-sm font-semibold transition"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={saving}
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

