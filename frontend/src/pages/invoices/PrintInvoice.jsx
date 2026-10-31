import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';
import { TaxRows, SupplyInfo } from '../../components/TaxRows';
import { useCompany } from '../../lib/useCompany';
import { useForceLight } from '../../context/ThemeContext';

export default function PrintInvoice() {
  useForceLight(); // an invoice is paper: always light, whatever theme the app uses
  const { id } = useParams();
  const { data: company } = useCompany();

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice-print', id],
    queryFn: () => api.get(`/invoices/${id}`),
  });

  const snapshot = invoice?.customerSnapshot || invoice?.customer || {};
  const amountDue = invoice ? due(invoice) : 0;

  useEffect(() => {
    if (invoice) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-brand-600 rounded-full mb-2" />
        <p>Loading invoice for printing...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>Failed to load invoice: {error?.message || 'Invoice not found'}</p>
        <Link to="/app/invoices" className="mt-2 inline-block text-sm font-semibold underline">
          Back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen text-slate-900 p-8 sm:p-12 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print flex items-center justify-between pb-6 mb-8 border-b border-slate-200">
        <Link
          to={`/app/invoices/${invoice.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Invoice
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Invoice Document Header */}
      <div className="flex justify-between items-start pb-8 border-b-2 border-slate-900">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-700 tracking-tight">{company?.name || 'Brightloop Software'}</h1>
          <p className="text-xs text-slate-500 mt-1">Subscription Billing & Cloud Management</p>
          <p className="text-xs text-slate-500">{company?.address}</p>
          <p className="text-xs text-slate-500">Email: billing@brightloop.in</p>
          <p className="text-xs font-mono font-semibold text-slate-700 mt-1">GSTIN: {invoice.supplierGstin || company?.gstin}</p>
        </div>

        <div className="text-right">
          <span className="text-xs uppercase tracking-widest font-bold text-slate-400">{invoice.kind === 'ADJUSTMENT' ? 'TAX INVOICE · ADJUSTMENT' : 'TAX INVOICE'}</span>
          <h2 className="text-2xl font-bold font-mono text-slate-900 mt-0.5">{invoice.number}</h2>
          <div className="mt-2 text-xs text-slate-600 space-y-0.5">
            <div><span className="font-semibold text-slate-700">Invoice Date:</span> {date(invoice.invoiceDate)}</div>
            <div><span className="font-semibold text-slate-700">Due Date:</span> {date(invoice.dueDate)}</div>
            {invoice.status === 'PAID' ? (
              <div className="inline-block mt-1 font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                PAID IN FULL
              </div>
            ) : (
              <div className="inline-block mt-1 font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                OUTSTANDING
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Billed To & Subscription Details */}
      <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-200 text-xs">
        <div>
          <span className="uppercase text-[11px] tracking-wider font-bold text-slate-400 block mb-1">
            Billed To
          </span>
          <p className="text-sm font-bold text-slate-900">{snapshot.name || '—'}</p>
          {snapshot.company && <p className="text-slate-700 font-medium">{snapshot.company}</p>}
          {snapshot.address && <p className="text-slate-600 mt-0.5">{snapshot.address}</p>}
          {snapshot.email && <p className="text-slate-600">{snapshot.email}</p>}
          {snapshot.phone && <p className="text-slate-600">{snapshot.phone}</p>}
          {snapshot.gstin && (
            <p className="font-mono text-[11px] text-slate-700 font-semibold mt-1">
              GSTIN: {snapshot.gstin}
            </p>
          )}
          <SupplyInfo invoice={invoice} className="text-[11px] text-slate-600 mt-1" />
        </div>

        <div className="text-right">
          <span className="uppercase text-[11px] tracking-wider font-bold text-slate-400 block mb-1">
            Subscription Details
          </span>
          {invoice.subscription?.number ? (
            <p className="text-sm font-bold font-mono text-slate-900">
              Subscription #{invoice.subscription.number}
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-500">Direct Invoice</p>
          )}
          <p className="text-slate-600 mt-0.5">
            Coverage: {invoice.periodStart ? date(invoice.periodStart) : '—'} to{' '}
            {invoice.periodEnd ? date(invoice.periodEnd) : '—'}
          </p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="py-6 border-b-2 border-slate-900">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-300 font-bold uppercase text-slate-500">
              <th className="py-2.5">Item Description</th>
              <th className="py-2.5 text-center">Qty</th>
              <th className="py-2.5 text-right">Unit Price</th>
              <th className="py-2.5 text-right">Subtotal</th>
              <th className="py-2.5 text-right">Discount</th>
              <th className="py-2.5 text-right">Tax</th>
              <th className="py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.lines?.map((l) => (
              <tr key={l.id}>
                <td className="py-3 font-medium text-slate-900">
                  {l.description}
                  {l.hsnSac && <span className="text-[10px] text-slate-400 block">HSN/SAC {l.hsnSac}</span>}
                </td>
                <td className="py-3 text-center text-slate-700">{l.quantity}</td>
                <td className="py-3 text-right text-slate-700">{inr(l.unitPrice)}</td>
                <td className="py-3 text-right text-slate-700">{inr(l.subtotal)}</td>
                <td className="py-3 text-right text-slate-600">
                  {Number(l.discountAmount) > 0 ? `-${inr(l.discountAmount)}` : '—'}
                </td>
                <td className="py-3 text-right text-slate-700">
                  {inr(l.taxAmount)}
                  {l.taxLabel && <span className="text-[10px] text-slate-400 block">({l.taxLabel})</span>}
                </td>
                <td className="py-3 text-right font-bold text-slate-900">{inr(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Box */}
      <div className="flex justify-end pt-4 pb-8">
        <div className="w-72 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span>{inr(invoice.amountSubtotal)}</span>
          </div>
          {Number(invoice.amountDiscount) > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Total Discount:</span>
              <span>-{inr(invoice.amountDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Untaxed Base:</span>
            <span>{inr(invoice.amountUntaxed)}</span>
          </div>
          <TaxRows invoice={invoice} rowClass="flex justify-between text-slate-600" />
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t-2 border-slate-900">
            <span>Grand Total:</span>
            <span>{inr(invoice.amountTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span>Amount Paid:</span>
            <span className="font-semibold text-emerald-700">{inr(invoice.amountPaid)}</span>
          </div>
          <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-300">
            <span>Balance Due:</span>
            <span className={amountDue > 0 ? 'text-brand-700' : 'text-slate-700'}>
              {inr(amountDue)}
            </span>
          </div>
        </div>
      </div>

      {/* Payments Details if any */}
      {invoice.payments?.length > 0 && (
        <div className="border-t border-slate-200 pt-4 mb-6 text-xs">
          <p className="font-bold text-slate-700 uppercase tracking-wider mb-2">Recorded Payments</p>
          <div className="space-y-1 text-slate-600">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>{date(p.paymentDate)} via {p.method} {p.note ? `(${p.note})` : ''}</span>
                <span className="font-semibold text-emerald-700">{inr(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms & Footer */}
      <div className="border-t border-slate-200 pt-6 text-[11px] text-slate-400 space-y-1">
        <p className="font-bold text-slate-600 uppercase tracking-wider">Payment Terms & Notes</p>
        <p>Payment is due within {invoice.dueDate ? date(invoice.dueDate) : 'the agreed term'}. Thank you for subscribing with Brightloop Software.</p>
        <p>This is a computer-generated tax invoice and requires no physical signature.</p>
      </div>
    </div>
  );
}
