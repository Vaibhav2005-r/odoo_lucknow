import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  XCircle,
  Shield,
  RefreshCw,
  Printer,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PortalAddons from '../../components/PortalAddons';

export default function PortalSubscription() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Close modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/subscriptions/${id}`);
      setSub(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchSubscription();
  }, [id]);

  const handleRenew = async () => {
    const next = new Date(`${String(sub.expiryDate).slice(0, 10)}T00:00:00Z`);
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    if (!window.confirm(`Renew your subscription for another year, until ${formatDate(next)}? Billing continues on the same schedule.`)) return;
    try {
      setActionLoading(true);
      await api.post(`/subscriptions/${id}/renew`, {});
      toast.success(`Renewed until ${formatDate(next)}`);
      await fetchSubscription();
    } catch (err) {
      toast.error(err.message || 'Could not renew the subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!window.confirm('Are you sure you want to pause your subscription? Billing will be temporarily held.')) {
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/subscriptions/${id}/pause`);
      toast.success('Subscription paused successfully');
      await fetchSubscription();
    } catch (err) {
      toast.error(err.message || 'Failed to pause subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await api.post(`/subscriptions/${id}/resume`);
      toast.success('Subscription resumed successfully');
      await fetchSubscription();
    } catch (err) {
      toast.error(err.message || 'Failed to resume subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.post(`/subscriptions/${id}/close`, { reason: closeReason.trim() || undefined });
      toast.success('Subscription closed');
      setShowCloseModal(false);
      await fetchSubscription();
    } catch (err) {
      toast.error(err.message || 'Failed to close subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptQuotation = async () => {
    try {
      setActionLoading(true);
      await api.post(`/subscriptions/${id}/accept-quote`);
      toast.success('Quotation accepted! Your subscription is now confirmed.');
      await fetchSubscription();
    } catch (err) {
      toast.error(err.message || 'Failed to accept quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amt) =>
    `₹${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Confirmed
          </span>
        );
      case 'QUOTATION':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Quotation Pending
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Clock className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-sm font-medium">Loading subscription details...</p>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-slate-900">Subscription not found</h2>
        <p className="text-sm text-slate-500 mt-1">This subscription may have been removed or you do not have permission to view it.</p>
        <Link to="/portal" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Subscriptions
        </Link>
      </div>
    );
  }

  const isQuotation = sub.status === 'QUOTATION' || (sub.status === 'DRAFT' && sub.quoteValidUntil);
  const isQuoteExpired = sub.quoteValidUntil && new Date(sub.quoteValidUntil) < new Date();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/portal"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Subscriptions
        </Link>

        <button
          onClick={fetchSubscription}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{sub.number}</h1>
            {getStatusBadge(sub.status)}
            {sub.isPaused && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                <PauseCircle className="w-3.5 h-3.5" /> Paused
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 font-medium">
            Plan: <strong className="text-slate-900">{sub.plan?.name}</strong> •{' '}
            <span className="capitalize">{sub.plan?.billingPeriod?.toLowerCase()}</span> billing
          </p>

          {/* Plan Capability Indicators */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {sub.plan?.closable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                <Shield className="w-3 h-3 text-slate-500" /> Early Closable
              </span>
            )}
            {sub.plan?.pausable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                <PauseCircle className="w-3 h-3 text-slate-500" /> Pausable Plan
              </span>
            )}
            {sub.plan?.renewable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                <RefreshCw className="w-3 h-3 text-slate-500" /> Renewable
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quotation Acceptance Action */}
          {isQuotation && (
            <button
              onClick={handleAcceptQuotation}
              disabled={isQuoteExpired || actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {actionLoading ? 'Accepting...' : 'Accept Quotation'}
            </button>
          )}

          {/* Pause / Resume Actions based on plan capabilities */}
          {sub.status === 'ACTIVE' && sub.plan?.pausable && (
            <>
              {sub.isPaused ? (
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <PlayCircle className="w-4 h-4" />
                  Resume Plan
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <PauseCircle className="w-4 h-4" />
                  Pause Plan
                </button>
              )}
            </>
          )}

          {sub.status === 'ACTIVE' && sub.plan?.renewable && (
            <button
              onClick={handleRenew}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-brand-200 bg-brand-50 text-brand-700 text-xs font-bold rounded-lg hover:bg-brand-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Renew for a year
            </button>
          )}

          {/* Close Action based on plan capabilities */}
          {sub.plan?.closable && sub.status !== 'CLOSED' && (
            <button
              onClick={() => setShowCloseModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              Close Subscription
            </button>
          )}
        </div>
      </div>

      {/* Expiry / Quotation Warning Banner */}
      {isQuotation && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${isQuoteExpired ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 shrink-0" />
            <div className="text-xs">
              <strong>{isQuoteExpired ? 'Quotation Expired' : 'Pending Customer Confirmation'}</strong>
              <div className="mt-0.5">
                {isQuoteExpired
                  ? 'This quotation has expired. Please contact support to request a refreshed quote.'
                  : `Please review and accept before ${formatDate(sub.quoteValidUntil)} to activate your service.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Billing Interval</div>
          <div className="text-base font-bold text-slate-900 capitalize">{sub.plan?.billingPeriod?.toLowerCase()}</div>
          <div className="text-xs text-slate-500 mt-1">Payment term: {sub.paymentTerm?.name || 'Immediate'}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Coverage Period</div>
          <div className="text-sm font-bold text-slate-900">
            {formatDate(sub.startDate)} → {formatDate(sub.expiryDate)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Inclusive active span</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Next Invoice</div>
          <div className="text-base font-bold text-brand-600">
            {sub.nextInvoiceDate ? formatDate(sub.nextInvoiceDate) : 'Fully Billed'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Period index #{sub.nextPeriodIndex}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Commitment Value</div>
          <div className="text-base font-extrabold text-slate-900">{formatCurrency(sub.amountTotal)}</div>
          <div className="text-xs text-slate-500 mt-1">Includes applicable taxes</div>
        </div>
      </div>

      {sub.credits?.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You have credit from changes made part-way through this period. It is taken off your next invoice automatically.
        </div>
      )}

      <PortalAddons sub={sub} onChanged={fetchSubscription} />

      {/* Itemized Order Lines Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Itemized Plan Services & Products</h2>
          <span className="text-xs text-slate-500 font-medium">{sub.lines?.length || 0} line items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3 text-right">Taxes</th>
                <th className="px-5 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sub.lines?.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    <div>{line.description}</div>
                    {line.product?.name && (
                      <div className="text-xs text-slate-400 font-normal">{line.product.name}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-800">{line.quantity}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-800">{formatCurrency(line.unitPrice)}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                    {line.taxes?.map((t) => `${t.name} (${t.rate}%)`).join(', ') || '0%'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-900 font-mono">
                    {formatCurrency(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Untaxed Subtotal:</span>
              <span className="font-mono font-medium text-slate-900">{formatCurrency(sub.amountUntaxed)}</span>
            </div>
            {Number(sub.amountDiscount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discounts Applied:</span>
                <span className="font-mono">- {formatCurrency(sub.amountDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Taxes:</span>
              <span className="font-mono font-medium text-slate-900">{formatCurrency(sub.amountTax)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-base font-extrabold text-brand-700">{formatCurrency(sub.amountTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Invoices Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">Billing History & Invoices</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">{sub.invoices?.length || 0} Invoices</span>
        </div>

        {!sub.invoices || sub.invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No invoices generated for this subscription yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Invoice Number</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sub.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{inv.number}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5 text-right font-bold font-mono text-slate-900">
                      {formatCurrency(inv.amountTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : inv.status === 'CONFIRMED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/portal/invoices/${inv.id}/print`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print / PDF
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      {sub.history && sub.history.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Subscription Timeline</h2>
          <div className="space-y-3 pt-2">
            {sub.history.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs">
                <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[11px] text-slate-400">{formatDate(log.createdAt)}</span>
                  </div>
                  {log.note && <div className="text-slate-500 mt-0.5">{log.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Close Subscription */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <XCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Close Subscription</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to close subscription <strong>{sub.number}</strong>? Future automated billing cycles will stop immediately.
            </p>
            <form onSubmit={handleClose} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows={3}
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="e.g. Project finished, switching plans, etc."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-2xs disabled:opacity-60 cursor-pointer"
                >
                  {actionLoading ? 'Closing...' : 'Confirm Closure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

