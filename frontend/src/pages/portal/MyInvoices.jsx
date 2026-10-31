import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';
import {
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Printer,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        view: filterView,
        pageSize: '50',
      });
      if (search.trim()) params.append('search', search.trim());
      const res = await api.get(`/invoices?${params.toString()}`);
      setInvoices(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [filterView]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInvoices();
  };

  // Metrics
  const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.amountTotal || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => {
    if (inv.status === 'CONFIRMED') {
      return sum + due(inv);
    }
    return sum;
  }, 0);
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-indigo-600" />
            My Invoices & Billing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View billing history, outstanding amounts, and download payment receipts
          </p>
        </div>

        <button
          onClick={fetchInvoices}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Billed</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{inr(totalBilled)}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Outstanding Balance</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inr(totalOutstanding)}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Settled Invoices</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{paidCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* View Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: 'All Invoices' },
            { key: 'OUTSTANDING', label: 'Outstanding' },
            { key: 'OVERDUE', label: 'Overdue' },
            { key: 'PAID', label: 'Paid' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterView(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filterView === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </form>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading your invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            No invoices found in this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700/80 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Invoice Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {invoices.map((inv) => {
                  const unpaid = due(inv);
                  const isOverdue = inv.status === 'CONFIRMED' && new Date(inv.dueDate) < new Date();

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {inv.status}
                    </span>
                  );

                  if (inv.status === 'PAID') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        PAID
                      </span>
                    );
                  } else if (isOverdue) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        OVERDUE
                      </span>
                    );
                  } else if (inv.status === 'CONFIRMED') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        OUTSTANDING
                      </span>
                    );
                  }

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <Link
                          to={`/portal/invoices/${inv.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{date(inv.invoiceDate)}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{date(inv.dueDate)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {inr(inv.amountTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {unpaid > 0 ? (
                          <span className={isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}>
                            {inr(unpaid)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">{statusBadge}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/portal/invoices/${inv.id}/print`}
                            target="_blank"
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            title="Print / PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/portal/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition"
                          >
                            Details
                            <ChevronRight className="w-3 h-3" />
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
      </div>
    </div>
  );
}
