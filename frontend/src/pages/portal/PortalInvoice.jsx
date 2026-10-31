import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  RefreshCw,
  Building2,
  User,
  ShieldCheck,
  ChevronRight,
  Send,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalInvoice() {
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CARD');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res);
      const due = Number(res.amountTotal) - Number(res.amountPaid);
      setPayAmount(due > 0 ? due.toFixed(2) : '0.00');
    } catch (err) {
      toast.error(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    const amt = Number(payAmount);
    const balanceDue = Number(invoice.amountTotal) - Number(invoice.amountPaid);

    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    if (amt > balanceDue) {
      toast.error(`Amount cannot exceed the remaining balance of ₹${balanceDue.toFixed(2)}`);
      return;
    }

    try {
      setPaying(true);
      await api.post(`/invoices/${id}/pay`, {
        method: payMethod,
        amount: amt,
        note: payNote.trim() || undefined,
      });

      toast.success('Payment recorded successfully! Thank you.');
      setShowPayModal(false);
      setPayNote('');
      await fetchInvoice();
    } catch (err) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setPaying(false);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Clock className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-sm font-medium">Loading invoice statement...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-slate-900">Invoice not found</h2>
        <p className="text-sm text-slate-500 mt-1">This invoice does not exist or you do not have permission to view it.</p>
        <Link to="/portal/invoices" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Link>
      </div>
    );
  }

  const balanceDue = Math.max(0, Number(invoice.amountTotal) - Number(invoice.amountPaid));
  const isOverdue = invoice.status === 'CONFIRMED' && new Date(invoice.dueDate) < new Date();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Controls */}
      <div className="flex items-center justify-between">
        <Link
          to="/portal/invoices"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Invoices
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/portal/invoices/${invoice.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Print / PDF
          </Link>
          <button
            onClick={fetchInvoice}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Invoice Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">{invoice.number}</h1>
            {invoice.status === 'PAID' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Paid in Full
              </span>
            ) : isOverdue ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5" /> Overdue
              </span>
            ) : invoice.status === 'CONFIRMED' ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" /> Payment Due
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {invoice.status}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Issue Date: <strong>{formatDate(invoice.invoiceDate)}</strong></span>
            <span>Due Date: <strong>{formatDate(invoice.dueDate)}</strong></span>
            {invoice.subscription?.number && (
              <span>
                Subscription:{' '}
                <Link
                  to={`/portal/subscriptions/${invoice.subscription.id}`}
                  className="font-mono font-bold text-brand-600 hover:underline"
                >
                  {invoice.subscription.number}
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* Payment Action Box */}
        {invoice.status === 'CONFIRMED' && balanceDue > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-amber-50/60 border border-amber-200/80 p-4 rounded-xl">
            <div>
              <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Amount Due</div>
              <div className="text-xl font-extrabold text-amber-900 font-mono">{formatCurrency(balanceDue)}</div>
            </div>
            <button
              onClick={() => setShowPayModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Pay Invoice Now
            </button>
          </div>
        )}
      </div>

      {/* Customer & Billing Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Billed To */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-1 text-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Billed To</div>
          <div className="text-sm font-bold text-slate-900">{invoice.customer?.name}</div>
          {invoice.customer?.company && (
            <div className="text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {invoice.customer.company}
            </div>
          )}
          <div className="text-slate-500">{invoice.customer?.email}</div>
          {invoice.customer?.phone && <div className="text-slate-500">{invoice.customer.phone}</div>}
          {invoice.customer?.address && <div className="text-slate-500 pt-1 border-t border-slate-100">{invoice.customer.address}</div>}
          {invoice.customer?.gstin && (
            <div className="pt-1 font-mono text-[11px] text-slate-600">GSTIN: {invoice.customer.gstin}</div>
          )}
        </div>

        {/* Billing Period & Payment Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-2 text-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Billing Coverage</div>
          <div className="flex justify-between text-slate-600">
            <span>Period Coverage:</span>
            <span className="font-semibold text-slate-900">
              {formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Statement Value:</span>
            <span className="font-mono font-bold text-slate-900">{formatCurrency(invoice.amountTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Amount Paid to Date:</span>
            <span className="font-mono font-semibold text-emerald-600">{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
            <span>Remaining Balance:</span>
            <span className={`font-mono text-sm ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatCurrency(balanceDue)}
            </span>
          </div>
        </div>
      </div>

      {/* Itemized Lines Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Itemized Statement Lines</h2>
          <span className="text-xs text-slate-500">{invoice.lines?.length || 0} items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3 text-right">Tax Rate</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines?.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{line.description}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-800">{line.quantity}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-800">{formatCurrency(line.unitPrice)}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-slate-500 font-mono">
                    {line.taxLabel || `${line.taxRate}%`}
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
              <span className="font-mono font-medium text-slate-900">{formatCurrency(invoice.amountUntaxed)}</span>
            </div>
            {Number(invoice.amountDiscount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discounts:</span>
                <span className="font-mono">- {formatCurrency(invoice.amountDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Taxes (GST):</span>
              <span className="font-mono font-medium text-slate-900">{formatCurrency(invoice.amountTax)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>Total Invoice Amount:</span>
              <span className="font-mono text-base font-extrabold text-brand-700">{formatCurrency(invoice.amountTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-mono text-emerald-600 font-bold">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-200">
              <span className="text-slate-800">Balance Due:</span>
              <span className={`font-mono text-sm ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">Payments Recorded</h2>
          </div>
          <span className="text-xs text-slate-500">{invoice.payments?.length || 0} Transactions</span>
        </div>

        {!invoice.payments || invoice.payments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No payments have been recorded against this invoice yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Payment Date</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Note / Reference</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-xs text-slate-900 font-medium">{formatDate(p.paymentDate)}</td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 capitalize">
                      {p.method.replace('_', ' ')}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{p.note || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Settled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Online Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600" />
                <h3 className="text-base font-bold text-slate-900">Make Online Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CARD', label: 'Credit/Debit Card' },
                    { id: 'UPI', label: 'UPI / QR Code' },
                    { id: 'BANK_TRANSFER', label: 'Net Banking' },
                    { id: 'OTHER', label: 'Other Gateway' },
                  ].map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-colors cursor-pointer ${
                        payMethod === m.id
                          ? 'border-brand-600 bg-brand-50/60 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balanceDue}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Full balance due: {formatCurrency(balanceDue)}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transaction Ref / UTR"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="px-5 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {paying ? 'Processing Payment...' : `Pay ₹${Number(payAmount || 0).toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
