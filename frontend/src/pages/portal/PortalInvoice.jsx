import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';
import {
  ArrowLeft,
  Printer,
  Receipt,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalInvoice() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/invoices/${id}`);
        setInvoice(res);
      } catch (err) {
        toast.error(err.message || 'Failed to load invoice details');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-400">
        Loading invoice details...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
        Invoice not found.
      </div>
    );
  }

  const unpaid = due(invoice);
  const isOverdue = invoice.status === 'CONFIRMED' && new Date(invoice.dueDate) < new Date();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/portal/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to My Invoices
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/portal/invoices/${invoice.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Download PDF
          </Link>
        </div>
      </div>

      {/* Invoice Document Box */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden p-6 sm:p-8 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                {invoice.number}
              </h1>
              {invoice.status === 'PAID' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  PAID
                </span>
              ) : isOverdue ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  OVERDUE
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  OUTSTANDING
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Issued: {date(invoice.invoiceDate)} • Due: {date(invoice.dueDate)}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-400">Amount Due</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
              {unpaid > 0 ? inr(unpaid) : '₹0.00'}
            </div>
          </div>
        </div>

        {/* Addresses Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px] mb-2">Billed To</h4>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {invoice.customer?.name}
            </div>
            {invoice.customer?.company && (
              <div className="text-slate-600 dark:text-slate-300">{invoice.customer.company}</div>
            )}
            {invoice.customer?.address && (
              <div className="text-slate-500 dark:text-slate-400 mt-1">{invoice.customer.address}</div>
            )}
            {invoice.customer?.gstin && (
              <div className="text-slate-500 dark:text-slate-400 mt-0.5">GSTIN: {invoice.customer.gstin}</div>
            )}
          </div>

          <div className="sm:text-right">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px] mb-2">Issued By</h4>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Brightloop Software Pvt. Ltd.</div>
            <div className="text-slate-500 dark:text-slate-400">Cyber City, DLF Phase II, Gurugram, Haryana</div>
            <div className="text-slate-500 dark:text-slate-400">GSTIN: 06AAAAA0000A1Z5</div>
            {invoice.periodStart && invoice.periodEnd && (
              <div className="mt-2 text-indigo-600 dark:text-indigo-400 font-medium">
                Billing Cycle: {date(invoice.periodStart)} – {date(invoice.periodEnd)}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {invoice.lines?.map((line, idx) => (
                <tr key={idx}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{line.description}</div>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">{line.quantity}</td>
                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{inr(line.unitPrice)}</td>
                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                    {line.taxRate ? `${line.taxRate}% (${inr(line.taxAmount)})` : '0%'}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {inr(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end text-xs">
          <div className="w-full sm:w-72 space-y-2">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span>{inr(invoice.amountSubtotal)}</span>
            </div>
            {Number(invoice.amountDiscount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount</span>
                <span>-{inr(invoice.amountDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Tax (GST)</span>
              <span>{inr(invoice.amountTax)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-slate-50 text-sm">
              <span>Total Invoice Amount</span>
              <span>{inr(invoice.amountTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Amount Paid</span>
              <span>{inr(invoice.amountPaid)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-indigo-600 dark:text-indigo-400 text-sm">
              <span>Balance Remaining</span>
              <span>{inr(unpaid)}</span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="pt-6 border-t border-slate-100 dark:border-slate-700/60">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-3 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Recorded Payments
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
              {invoice.payments.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/30">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{p.method}</span>
                    <span className="text-slate-400 ml-2">({date(p.paymentDate)})</span>
                    {p.note && <div className="text-[11px] text-slate-500 mt-0.5">{p.note}</div>}
                  </div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{inr(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
