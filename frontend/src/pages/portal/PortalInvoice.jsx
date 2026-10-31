import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';
import { TaxRows, SupplyInfo } from '../../components/TaxRows';
import PayNow from '../../components/PayNow';
import { useCompany } from '../../lib/useCompany';
import {
  ArrowLeft,
  Printer,
  Download,
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
  const [reload, setReload] = useState(0);
  const { data: company } = useCompany();

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
  }, [id, reload]);

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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-100 ">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {invoice.number}
              </h1>
              {invoice.kind === 'ADJUSTMENT' && <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Adjustment</span>}
              {invoice.status === 'PAID' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 ">
                  PAID
                </span>
              ) : isOverdue ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 ">
                  OVERDUE
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 ">
                  OUTSTANDING
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Issued: {date(invoice.invoiceDate)} • Due: {date(invoice.dueDate)}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-400">Amount Due</div>
            <div className="text-2xl font-extrabold text-slate-900 ">
              {unpaid > 0 ? inr(unpaid) : '₹0.00'}
            </div>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </a>
          </div>
        </div>

        {/* Addresses Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px] mb-2">Billed To</h4>
            <div className="font-bold text-slate-900 text-sm">
              {invoice.customer?.name}
            </div>
            {invoice.customer?.company && (
              <div className="text-slate-600 ">{invoice.customer.company}</div>
            )}
            {invoice.customer?.address && (
              <div className="text-slate-500 mt-1">{invoice.customer.address}</div>
            )}
            {invoice.customer?.gstin && (
              <div className="text-slate-500 mt-0.5">GSTIN: {invoice.customer.gstin}</div>
            )}
          </div>

          <div className="sm:text-right">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px] mb-2">Issued By</h4>
            <div className="font-bold text-slate-900 text-sm">{company?.name || 'Brightloop Software'}</div>
            <div className="text-slate-500 ">{company?.address}</div>
            <div className="text-slate-500 ">GSTIN: {invoice.supplierGstin || company?.gstin}</div>
            {invoice.periodStart && invoice.periodEnd && (
              <div className="mt-2 text-indigo-600 font-medium">
                Billing Cycle: {date(invoice.periodStart)} – {date(invoice.periodEnd)}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {invoice.lines?.map((line, idx) => (
                <tr key={idx}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 ">{line.description}</div>
                    {line.hsnSac && <div className="text-[11px] text-slate-400">HSN/SAC {line.hsnSac}</div>}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700 ">{line.quantity}</td>
                  <td className="py-3 px-4 text-right text-slate-700 ">{inr(line.unitPrice)}</td>
                  <td className="py-3 px-4 text-right text-slate-700 ">
                    {line.taxRate ? inr(line.taxAmount) : '₹0.00'}
                    {line.taxLabel && <div className="text-[10px] text-slate-400">{line.taxLabel}</div>}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 ">
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
            <div className="flex justify-between text-slate-500 ">
              <span>Subtotal</span>
              <span>{inr(invoice.amountSubtotal)}</span>
            </div>
            {Number(invoice.amountDiscount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 ">
                <span>Discount</span>
                <span>-{inr(invoice.amountDiscount)}</span>
              </div>
            )}
            <TaxRows invoice={invoice} rowClass="flex justify-between text-slate-500 " />
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-sm">
              <span>Total Invoice Amount</span>
              <span>{inr(invoice.amountTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500 ">
              <span>Amount Paid</span>
              <span>{inr(invoice.amountPaid)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-indigo-600 text-sm">
              <span>Balance Remaining</span>
              <span>{inr(unpaid)}</span>
            </div>
            <PayNow invoice={invoice} onPaid={() => setReload((n) => n + 1)} className="w-full mt-2" />
          </div>
        </div>
        <SupplyInfo invoice={invoice} className="text-[11px] text-slate-400 text-right" />

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="pt-6 border-t border-slate-100 ">
            <h4 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Recorded Payments
            </h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {invoice.payments.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/50 ">
                  <div>
                    <span className="font-semibold text-slate-900 ">{p.method}</span>
                    <span className="text-slate-400 ml-2">({date(p.paymentDate)})</span>
                    {p.note && <div className="text-[11px] text-slate-500 mt-0.5">{p.note}</div>}
                  </div>
                  <div className="font-bold text-emerald-600 ">{inr(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
