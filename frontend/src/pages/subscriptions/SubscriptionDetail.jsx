import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Repeat,
  ArrowLeft,
  Calendar,
  Building,
  User,
  Mail,
  Phone,
  FileText,
  Clock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  DollarSign,
  Receipt,
  History,
  AlertCircle,
  X,
  CreditCard,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { subscriptionService } from '../../services/subscriptionService';
import { productService } from '../../services/productService';
import { inr, date } from '../../lib/format';

export default function SubscriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'lines', 'invoices', 'activity'

  // Modals
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');

  const [showAddAddonModal, setShowAddAddonModal] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [newAddonId, setNewAddonId] = useState('');
  const [newAddonQty, setNewAddonQty] = useState(1);
  const [newAddonPrice, setNewAddonPrice] = useState('');

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const [sub, prods] = await Promise.all([
        subscriptionService.getById(id),
        productService.getAll({ status: 'ACTIVE' }),
      ]);
      setSubscription(sub);

      // Default next expiry for renew modal: one more year
      if (sub.expiryDate) {
        const d = new Date(`${sub.expiryDate}T00:00:00Z`);
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        setNewExpiryDate(d.toISOString().slice(0, 10));
      }

      setAvailableProducts(prods);
      const defaultProd = prods.find((p) => p.type === 'ADDON') || prods[0];
      if (defaultProd) {
        setNewAddonId(defaultProd.id);
        setNewAddonPrice(defaultProd.salesPrice);
      }
    } catch (err) {
      toast.error(err.message || 'Error fetching subscription details');
      if (err.status === 404) navigate('/app/subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [id]);

  // Runs one lifecycle call and swaps in the fresh subscription the server returns.
  const run = async (fn, successMessage, after) => {
    try {
      setSubscription(await fn());
      if (after) after();
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      toast.error(err.message || 'Action failed');
    }
  };

  const handleSendQuotation = () =>
    run(() => subscriptionService.sendQuotation(subscription.id), 'Quotation dispatched to client!');
  const handleConfirm = () => run(() => subscriptionService.confirm(subscription.id), 'Subscription confirmed!');
  const handleActivate = () =>
    run(() => subscriptionService.activate(subscription.id), 'Subscription activated! Initial invoice created.');
  const handlePause = () =>
    run(() => subscriptionService.pause(subscription.id), 'Subscription paused. Billing schedule put on hold.');
  const handleResume = () =>
    run(() => subscriptionService.resume(subscription.id), 'Subscription resumed! Billing schedule re-activated.');

  const handleClose = (e) => {
    e.preventDefault();
    return run(
      () => subscriptionService.close(subscription.id, closeReason || 'Customer requested termination'),
      'Subscription closed.',
      () => {
        setShowCloseModal(false);
        setCloseReason('');
      },
    );
  };

  const handleRenew = (e) => {
    e.preventDefault();
    if (!newExpiryDate) {
      toast.error('Select a valid new expiration date');
      return;
    }
    return run(
      () => subscriptionService.renew(subscription.id, newExpiryDate),
      `Subscription renewed until ${date(newExpiryDate)}!`,
      () => setShowRenewModal(false),
    );
  };

  // Line Items Operations
  const handleToggleAddon = (lineId, currentActive) =>
    run(
      () => subscriptionService.toggleAddon(subscription.id, lineId, !currentActive),
      `Add-on ${!currentActive ? 'enabled' : 'disabled'}`,
    );

  const handleRemoveAddon = (lineId) =>
    run(() => subscriptionService.removeAddon(subscription.id, lineId), 'Add-on removed from subscription');

  const handleAddAddon = (e) => {
    e.preventDefault();
    const prod = availableProducts.find((p) => p.id === Number(newAddonId));
    if (!prod) return;
    const price = Number(newAddonPrice);
    return run(
      () =>
        subscriptionService.addAddon(subscription.id, {
          productId: prod.id,
          quantity: Number(newAddonQty) || 1,
          ...(price >= 0 && price !== prod.salesPrice ? { unitPrice: price } : {}),
        }),
      `Attached "${prod.name}" successfully!`,
      () => setShowAddAddonModal(false),
    );
  };

  if (loading) {
    return (
      <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
        Loading subscription details...
      </div>
    );
  }

  if (!subscription) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Active</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <span>Draft</span>
          </span>
        );
      case 'QUOTATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Quotation</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Confirmed</span>
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <PauseCircle className="h-3.5 w-3.5 text-sky-600" />
            <span>Paused</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5 text-rose-500" />
            <span>Closed</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <Link
          to="/app/subscriptions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Subscriptions</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                {subscription.number}
              </h1>
              {getStatusBadge(subscription.status)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
              <span className="flex items-center gap-1 text-slate-700 font-medium">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>{subscription.customerName}</span>
              </span>
              {subscription.customerCompany && (
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  <span>{subscription.customerCompany}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5 text-slate-400" />
                <span>{subscription.planName}</span>
              </span>
            </div>
          </div>

          {/* Lifecycle Action Buttons based on Status */}
          <div className="flex flex-wrap items-center gap-2">
            {subscription.status === 'DRAFT' && (
              <button
                onClick={handleSendQuotation}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Quotation</span>
              </button>
            )}

            {subscription.status === 'QUOTATION' && (
              <button
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Confirm Subscription</span>
              </button>
            )}

            {subscription.status === 'CONFIRMED' && (
              <button
                onClick={handleActivate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                <span>Activate Subscription</span>
              </button>
            )}

            {subscription.status === 'ACTIVE' && (
              <>
                {subscription.planPausable && (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  <PauseCircle className="h-3.5 w-3.5 text-slate-500" />
                  <span>Pause Billing</span>
                </button>
                )}
                {subscription.planRenewable && (
                <button
                  onClick={() => setShowRenewModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold border border-brand-200 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Renew Term</span>
                </button>
                )}
                {subscription.planClosable && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 transition"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Close</span>
                </button>
                )}
              </>
            )}

            {subscription.status === 'PAUSED' && (
              <>
                <button
                  onClick={handleResume}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span>Resume Subscription</span>
                </button>
                {subscription.planClosable && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 transition"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Close</span>
                </button>
                )}
              </>
            )}

            {subscription.status === 'CLOSED' && (
              <span className="text-xs text-slate-400 italic">
                Contract closed. Historical records preserved.
              </span>
            )}
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <div className="text-slate-400 font-medium">Recurring Rate</div>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5">
              {inr(subscription.recurringAmount)}
              <span className="text-xs font-normal text-slate-400 ml-1">
                /{subscription.billingPeriod.toLowerCase().slice(0, 2)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Contract Start</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{date(subscription.startDate)}</div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Contract Expiry</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{date(subscription.expiryDate)}</div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Next Billing Date</div>
            <div className="text-sm font-bold text-brand-700 mt-0.5">
              {subscription.nextBillingDate ? date(subscription.nextBillingDate) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-sm font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('lines')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'lines'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Repeat className="h-4 w-4" />
          <span>Line Items ({subscription.lines?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'invoices'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Invoice History ({subscription.invoices?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'activity'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Activity Log ({subscription.activityLog?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subscription Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Subscription Specifications
            </h3>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Recurring Plan:</span>
                <strong className="text-slate-800">{subscription.planName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cadence:</span>
                <span className="font-semibold text-slate-800">{subscription.billingPeriod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Terms:</span>
                <strong className="text-slate-800">{subscription.paymentTermName}</strong>
              </div>
              {subscription.discountName && (
                <div className="flex justify-between text-emerald-600">
                  <span>Applied Discount:</span>
                  <span className="font-semibold">{subscription.discountName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Paused State:</span>
                <span className="font-medium text-slate-800">
                  {subscription.isPaused ? `Paused on ${subscription.pausedAt}` : 'No (Active schedule)'}
                </span>
              </div>
              {subscription.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                    {subscription.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Customer & Contact Details
            </h3>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer Name:</span>
                <strong className="text-slate-800">{subscription.customerName}</strong>
              </div>
              {subscription.customerCompany && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Company:</span>
                  <span className="text-slate-800 font-medium">{subscription.customerCompany}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <a href={`mailto:${subscription.customerEmail}`} className="text-brand-600 hover:underline">
                  {subscription.customerEmail}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="text-slate-800">{subscription.customerPhone}</span>
              </div>
              {subscription.customerGstin && (
                <div className="flex justify-between">
                  <span className="text-slate-400">GSTIN:</span>
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {subscription.customerGstin}
                  </span>
                </div>
              )}
              {subscription.customerAddress && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Billing Address:</span>
                  <span className="text-slate-700">{subscription.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Card */}
          <div className="md:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Recurring Price Math (Paise Precision)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Base Plan Rate</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  {inr(subscription.basePlanPrice)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Active Add-ons</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  +{inr(subscription.addonsAmount)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Discount Deduction</span>
                <span className="text-base font-bold text-emerald-600 mt-1 block">
                  -{inr(subscription.discountAmount)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Taxes (18% GST)</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  +{inr(subscription.taxAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Line Items */}
      {activeTab === 'lines' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Line Items & Add-on Attachments</h3>
              <p className="text-xs text-slate-500">
                Manage bundled modules, toggle add-on billings active/inactive, or attach new services.
              </p>
            </div>
            {subscription.status !== 'CLOSED' && (
              <button
                type="button"
                onClick={() => setShowAddAddonModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Attach Add-on</span>
              </button>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Line Item</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-center">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Tax Rate</th>
                  <th className="py-2.5 px-4 text-right">Subtotal</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscription.lines?.map((line) => (
                  <tr key={line.id} className={line.isActive ? 'hover:bg-slate-50/75' : 'bg-slate-50/50 opacity-60'}>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{line.name}</div>
                      {line.isBasePlan && (
                        <span className="text-[10px] text-brand-600 font-normal">Primary Plan Line Item</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {line.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{line.quantity}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      {inr(line.unitPrice)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {line.taxRate}% ({line.taxName})
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {inr(line.unitPrice * line.quantity)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleAddon(line.id, line.isActive)}
                        disabled={line.isBasePlan || subscription.status === 'CLOSED'}
                        className="focus:outline-none disabled:opacity-50"
                        title={line.isBasePlan ? 'Base plan is permanently active' : 'Click to toggle'}
                      >
                        {line.isActive ? (
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
                    <td className="py-3 px-4 text-right">
                      {!line.isBasePlan && subscription.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleRemoveAddon(line.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Remove line item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Invoice History */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Invoices Generated</h3>
              <p className="text-xs text-slate-500">
                Historical invoices issued under this subscription contract.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total: {subscription.invoices?.length || 0} invoice(s)
            </span>
          </div>

          {subscription.invoices?.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Invoice Date</th>
                    <th className="py-2.5 px-4">Due Date</th>
                    <th className="py-2.5 px-4">Billing Period</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscription.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/75">
                      <td className="py-3 px-4 font-mono font-bold text-brand-600">{inv.number}</td>
                      <td className="py-3 px-4 text-slate-700">{date(inv.invoiceDate)}</td>
                      <td className="py-3 px-4 text-slate-700">{date(inv.dueDate)}</td>
                      <td className="py-3 px-4 text-slate-500">{inv.period || '—'}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{inr(inv.amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No invoices generated yet. Invoices generate on activation and on recurring period runs.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Activity Log */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Audit Trail & Event Log</h3>
            <p className="text-xs text-slate-500">
              Chronological ledger of subscription state changes, quotations, renewals, and pause actions.
            </p>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {subscription.activityLog?.map((event) => (
              <div key={event.id} className="relative text-xs space-y-1">
                <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white"></div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{event.action}</span>
                  {event.fromStatus && event.toStatus && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({event.fromStatus} → {event.toStatus})
                    </span>
                  )}
                  <span className="text-slate-400 text-[11px] ml-auto">
                    {new Date(event.timestamp).toLocaleString('en-IN', { timeZone: 'UTC' })}
                  </span>
                </div>
                <div className="text-slate-600">{event.note}</div>
                <div className="text-[10px] text-slate-400">Recorded by: {event.user}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close Subscription Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Close Subscription?</h3>
            </div>
            <p className="text-sm text-slate-600">
              Closing will terminate future recurring billing cycles for this contract.
            </p>
            <form onSubmit={handleClose} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for closure</label>
                <input
                  type="text"
                  required
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="e.g. Upgraded to dedicated enterprise plan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-xs"
                >
                  Confirm Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Subscription Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <div className="p-2 bg-brand-50 rounded-lg">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Renew Subscription</h3>
            </div>
            <p className="text-xs text-slate-600">
              Extend the expiration date. Current expiration is <strong>{date(subscription.expiryDate)}</strong>.
            </p>
            <form onSubmit={handleRenew} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs"
                >
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Add-on Modal */}
      {showAddAddonModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Attach Add-on to Subscription</h3>
              <button
                onClick={() => setShowAddAddonModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAddon} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product *</label>
                <select
                  value={newAddonId}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    setNewAddonId(pid);
                    const prod = availableProducts.find((p) => p.id === pid);
                    if (prod) setNewAddonPrice(prod.salesPrice);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type}) - {inr(p.salesPrice)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newAddonQty}
                    onChange={(e) => setNewAddonQty(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAddonModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs"
                >
                  Attach Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

