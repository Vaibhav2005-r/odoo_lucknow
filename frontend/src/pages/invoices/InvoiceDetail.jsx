import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileCheck,
  XCircle,
  Receipt,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Layers,
  CreditCard,
  Send,
  BellRing,
} from 'lucide-react';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';
import { TaxRows, SupplyInfo } from '../../components/TaxRows';
import RecordPaymentModal from './RecordPaymentModal';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/confirm`),
    onSuccess: () => {
      toast.success('Invoice confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to confirm invoice');
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/send`),
    onSuccess: (res) => {
      toast.success(res.message || 'Invoice sent to customer email');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send invoice');
    },
  });

  const remindMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/remind`),
    onSuccess: (res) => {
      toast.success(res.message || 'Overdue reminder email sent');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send reminder');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/cancel`),
    onSuccess: () => {
      toast.success('Invoice cancelled');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to cancel invoice');
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-brand-600 rounded-full mb-2" />
        <p>Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-600">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Invoice not found</h2>
        <p className="text-sm text-slate-500 mt-1">{error?.message || 'The requested invoice does not exist.'}</p>
        <Link
          to="/app/invoices"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Link>
      </div>
    );
  }

  const isDraft = invoice.status === 'DRAFT';
  const isConfirmed = invoice.status === 'CONFIRMED';
  const isPaid = invoice.status === 'PAID';
  const isCancelled = invoice.status === 'CANCELLED';
  const amountDue = due(invoice);

  const isOverdue =
    isConfirmed && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  const daysOverdue = isOverdue
    ? Math.floor((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24))
    : 0;

  const canCancel = isDraft || (isConfirmed && Number(invoice.amountPaid) === 0);

  const snapshot = invoice.customerSnapshot || invoice.customer || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/app/invoices"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-slate-900">{invoice.number}</h1>
              {invoice.kind === 'ADJUSTMENT' && <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Adjustment</span>}
              {isPaid && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" /> Paid
                </span>
              )}
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> Overdue by {daysOverdue} day{daysOverdue === 1 ? '' : 's'}
                </span>
              )}
              {isConfirmed && !isOverdue && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Clock className="w-3.5 h-3.5" /> Outstanding
                </span>
              )}
              {isDraft && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  Draft
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 line-through">
                  Cancelled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Created on {date(invoice.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              {confirmMutation.isPending ? 'Confirming...' : 'Confirm Invoice'}
            </button>
          )}

          {isConfirmed && amountDue > 0 && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>
          )}

          {(isConfirmed || isPaid) && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4 text-slate-500" />
              {sendMutation.isPending ? 'Sending...' : invoice.sentAt ? 'Resend Invoice' : 'Send Invoice'}
            </button>
          )}

          {isOverdue && (
            <button
              onClick={() => remindMutation.mutate()}
              disabled={remindMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
            >
              <BellRing className="w-4 h-4" />
              {remindMutation.isPending ? 'Sending...' : 'Send Reminder'}
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this invoice? Cancelled periods cannot be re-billed.')) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Invoice'}
            </button>
          )}

          <Link
            to={`/app/invoices/${invoice.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print
          </Link>
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            PDF
          </a>
        </div>
      </div>

      {/* Overdue Banner if applicable */}
      {isOverdue && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold">Payment is {daysOverdue} day{daysOverdue === 1 ? '' : 's'} overdue</p>
              <p className="text-xs text-rose-600 mt-0.5">Due date was {date(invoice.dueDate)}. Amount due: {inr(amountDue)}.</p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Snapshot & Invoice Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information (Snapshot at Invoice Time) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building className="w-4 h-4 text-brand-600" />
            Customer (Billed To)
          </h2>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900 text-base">{snapshot.name || '—'}</p>
            {snapshot.company && (
              <p className="text-xs text-slate-500 font-medium">{snapshot.company}</p>
            )}

            <div className="pt-1 space-y-1.5 text-xs text-slate-600">
              {snapshot.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{snapshot.email}</span>
                </div>
              )}
              {snapshot.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{snapshot.phone}</span>
                </div>
              )}
              {snapshot.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                  <span>{snapshot.address}</span>
                </div>
              )}
              {snapshot.gstin && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    GSTIN: {snapshot.gstin}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
            <Calendar className="w-4 h-4 text-brand-600" />
            Billing Period & Dates
          </h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 font-medium">Invoice Date</p>
              <p className="font-medium text-slate-800 mt-0.5">{date(invoice.invoiceDate)}</p>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-medium">Due Date</p>
              <p className="font-medium text-slate-800 mt-0.5">{date(invoice.dueDate)}</p>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-medium">Coverage Period</p>
              <p className="font-medium text-slate-800 mt-0.5">
                {invoice.periodStart ? date(invoice.periodStart) : '—'}
                {' → '}
                {invoice.periodEnd ? date(invoice.periodEnd) : '—'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-medium">Origin Subscription</p>
              <p className="font-medium mt-0.5 font-mono">
                {invoice.subscription?.number ? (
                  <Link
                    to={`/app/subscriptions/${invoice.subscription.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    {invoice.subscription.number}
                  </Link>
                ) : (
                  <span className="text-slate-400">Direct Invoice</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Line Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/75 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" />
            Invoice Line Items
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right">Tax (Rate)</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines?.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {line.description}
                    {line.hsnSac && <div className="text-[11px] font-normal text-slate-400">HSN/SAC {line.hsnSac}</div>}
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-700">
                    {line.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    {inr(line.unitPrice)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    {inr(line.subtotal)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                    {Number(line.discountAmount) > 0 ? `-${inr(line.discountAmount)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    <div>{inr(line.taxAmount)}</div>
                    {Number(line.taxRate) > 0 && (
                      <span className="text-[11px] text-slate-400">
                        {line.taxLabel || `${line.taxRate}%`}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                    {inr(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200">
          <SupplyInfo invoice={invoice} />
        </div>

        {/* Totals Calculation Summary */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/50 flex flex-col items-end">
          <div className="w-full sm:w-80 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Gross Subtotal:</span>
              <span className="font-medium text-slate-800">{inr(invoice.amountSubtotal)}</span>
            </div>

            {Number(invoice.amountDiscount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount Applied:</span>
                <span>-{inr(invoice.amountDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>Untaxed (Taxable):</span>
              <span className="font-medium text-slate-800">{inr(invoice.amountUntaxed)}</span>
            </div>

            <TaxRows invoice={invoice} rowClass="flex justify-between text-slate-600" />

            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t-2 border-slate-300">
              <span>Total Invoice Amount:</span>
              <span>{inr(invoice.amountTotal)}</span>
            </div>

            <div className="flex justify-between text-sm text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-medium text-emerald-700">{inr(invoice.amountPaid)}</span>
            </div>

            <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
              <span className={amountDue > 0 ? 'text-amber-800' : 'text-slate-800'}>
                Outstanding Balance:
              </span>
              <span className={`text-lg ${amountDue > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                {inr(amountDue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payments Section (if any payments are recorded) */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Recorded Payments ({invoice.payments.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 border-b border-slate-100">
                  <th className="py-2">Date</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Note</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 text-slate-700">{date(p.paymentDate)}</td>
                    <td className="py-2.5 font-medium text-slate-800">{p.method}</td>
                    <td className="py-2.5 text-xs text-slate-500">{p.note || '—'}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-700">{inr(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        invoice={invoice}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['invoice', id] });
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }}
      />
    </div>
  );
}
