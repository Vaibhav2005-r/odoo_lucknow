import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Receipt,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';

const TABS = [
  { key: 'ALL', label: 'All Invoices' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'OUTSTANDING', label: 'Outstanding' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'PAID', label: 'Paid' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function InvoiceList() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['invoices', { view, search, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        view,
        page: String(page),
        pageSize: '20',
      });
      if (search.trim()) params.append('search', search.trim());
      return api.get(`/invoices?${params.toString()}`);
    },
  });

  const invoices = response?.data || [];
  const meta = response?.meta || { total: 0, page: 1, pageSize: 20, viewCounts: {} };
  const viewCounts = meta.viewCounts || {};

  const bulkConfirmMutation = useMutation({
    mutationFn: (ids) => api.post('/invoices/bulk-confirm', { ids }),
    onSuccess: (res) => {
      toast.success(res.message || 'Invoices confirmed');
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to confirm invoices');
    },
  });

  const singleConfirmMutation = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/confirm`),
    onSuccess: () => {
      toast.success('Invoice confirmed');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to confirm invoice');
    },
  });

  const toggleSelectAllDrafts = () => {
    const draftIds = invoices.filter((i) => i.status === 'DRAFT').map((i) => i.id);
    if (selectedIds.length === draftIds.length && draftIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(draftIds);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const totalPages = Math.ceil((meta.total || 0) / meta.pageSize) || 1;

  const getStatusBadge = (inv) => {
    const isOverdue = inv.status === 'CONFIRMED' && new Date(inv.dueDate) < new Date();

    if (inv.status === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle className="w-3 h-3" /> Paid
        </span>
      );
    }
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
          <AlertTriangle className="w-3 h-3" /> Overdue
        </span>
      );
    }
    if (inv.status === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
          <Clock className="w-3 h-3" /> Outstanding
        </span>
      );
    }
    if (inv.status === 'DRAFT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          Draft
        </span>
      );
    }
    if (inv.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 line-through">
          Cancelled
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review billing runs, track collections, confirm drafts, and chase overdue payments.
          </p>
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={() => bulkConfirmMutation.mutate(selectedIds)}
            disabled={bulkConfirmMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
          >
            <FileCheck className="w-4 h-4" />
            {bulkConfirmMutation.isPending
              ? 'Confirming...'
              : `Confirm Selected (${selectedIds.length})`}
          </button>
        )}
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-sm">
        {TABS.map((tab) => {
          const count = viewCounts[tab.key] ?? 0;
          const isActive = view === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setView(tab.key);
                setPage(1);
                setSelectedIds([]);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 font-medium whitespace-nowrap border-b-2 transition-all ${
                isActive
                  ? 'border-brand-600 text-brand-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-brand-100 text-brand-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice number (e.g. INV/2026/00001) or customer name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams({ view });
            if (search.trim()) params.append('search', search.trim());
            window.open(`/api/invoices/export?${params.toString()}`, '_blank');
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
          title="Export current view to CSV"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-brand-600 rounded-full mb-2" />
            <p>Loading invoices...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            <p>Failed to load invoices: {error.message}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No invoices found</p>
            <p className="text-sm mt-1 text-slate-400">
              {search
                ? 'Try a different search query.'
                : 'Invoices will appear here when a billing run executes or subscriptions generate billing.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAllDrafts}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {selectedIds.length > 0 &&
                      selectedIds.length === invoices.filter((i) => i.status === 'DRAFT').length ? (
                        <CheckSquare className="w-4 h-4 text-brand-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Subscription</th>
                  <th className="py-3.5 px-4">Invoice Date</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-right">Amount Due</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isDraft = inv.status === 'DRAFT';
                  const amountDue = due(inv);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isSelected ? 'bg-brand-50/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() => toggleSelect(inv.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-brand-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 h-4 block" />
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium">
                        <Link
                          to={`/app/invoices/${inv.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {inv.number}
                        </Link>
                        {inv.kind === 'ADJUSTMENT' && <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Adjustment</span>}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{inv.customer?.name}</div>
                        {inv.customer?.company && (
                          <div className="text-xs text-slate-400">{inv.customer.company}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        {inv.subscription?.number ? (
                          <Link
                            to={`/app/subscriptions/${inv.subscription.id}`}
                            className="hover:underline text-brand-700"
                          >
                            {inv.subscription.number}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {date(inv.invoiceDate)}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {date(inv.dueDate)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        {inr(inv.amountTotal)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold">
                        <span className={amountDue > 0 ? 'text-amber-700' : 'text-slate-500'}>
                          {inr(amountDue)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(inv)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDraft && (
                            <button
                              onClick={() => singleConfirmMutation.mutate(inv.id)}
                              disabled={singleConfirmMutation.isPending}
                              title="Confirm draft invoice"
                              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                            >
                              Confirm
                            </button>
                          )}
                          <Link
                            to={`/app/invoices/${inv.id}`}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                            title="View invoice details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-sm">
            <div className="text-xs text-slate-500">
              Showing {(page - 1) * meta.pageSize + 1} to{' '}
              {Math.min(page * meta.pageSize, meta.total)} of {meta.total} invoices
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
