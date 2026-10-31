import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Wallet, Filter, Calendar, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { inr, date } from '../../lib/format';

const METHODS = ['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER'];

export default function PaymentList() {
  const [methodFilter, setMethodFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['payments', { methodFilter, from, to, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });
      if (methodFilter) params.append('method', methodFilter);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      return api.get(`/payments?${params.toString()}`);
    },
  });

  const payments = response?.data || [];
  const meta = response?.meta || { total: 0, page: 1, pageSize: 20, totalAmount: 0 };
  const totalPages = Math.ceil((meta.total || 0) / meta.pageSize) || 1;

  const getMethodBadge = (m) => {
    const styles = {
      UPI: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      BANK_TRANSFER: 'bg-blue-50 text-blue-700 border-blue-200',
      CARD: 'bg-purple-50 text-purple-700 border-purple-200',
      CASH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      CHEQUE: 'bg-amber-50 text-amber-700 border-amber-200',
      OTHER: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${styles[m] || styles.OTHER}`}>
        {m.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete ledger of recorded customer collections and receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams();
            if (methodFilter) params.append('method', methodFilter);
            if (from) params.append('from', from);
            if (to) params.append('to', to);
            window.open(`/api/payments/export?${params.toString()}`, '_blank');
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
          title="Download Payments CSV"
        >
          <Download className="w-3.5 h-3.5" />
          Export Payments CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Payment Methods</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">From:</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">To:</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {(methodFilter || from || to) && (
          <button
            onClick={() => {
              setMethodFilter('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-brand-600 rounded-full mb-2" />
            <p>Loading payments ledger...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            <p>Failed to load payments: {error.message}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Wallet className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No payment records found</p>
            <p className="text-sm mt-1 text-slate-400">
              Payments recorded against confirmed invoices will appear in this ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Reference / Note</th>
                  <th className="py-3.5 px-4 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{date(p.paymentDate)}</td>
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {p.invoice ? (
                        <Link to={`/app/invoices/${p.invoice.id}`} className="text-brand-600 hover:underline">
                          {p.invoice.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{p.customer?.name}</div>
                      {p.customer?.company && (
                        <div className="text-xs text-slate-400">{p.customer.company}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{getMethodBadge(p.method)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{p.note || '—'}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                      {inr(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Aggregate Totals Row */}
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                  <td colSpan={5} className="py-3 px-4 text-right">
                    Total Collections in View:
                  </td>
                  <td className="py-3 px-4 text-right text-base text-emerald-700">
                    {inr(meta.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-sm">
            <div className="text-xs text-slate-500">
              Showing {(page - 1) * meta.pageSize + 1} to{' '}
              {Math.min(page * meta.pageSize, meta.total)} of {meta.total} payments
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
