import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  FileText,
  CreditCard,
  Clock,
  Search,
  RefreshCw,
  Printer,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('ALL');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState({ total: 0, viewCounts: {} });

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/invoices', {
        params: {
          view: view === 'ALL' ? 'ALL' : view,
          search: search.trim() || undefined,
          page: 1,
          pageSize: 50,
        },
      });
      setInvoices(res.data || []);
      setMeta(res.meta || { total: 0, viewCounts: {} });
    } catch (err) {
      toast.error(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 200);
    return () => clearTimeout(timer);
  }, [view, search]);

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

  // Calculate high-level financial summary
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amountTotal || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
  const totalDue = Math.max(0, totalInvoiced - totalPaid);

  const getStatusBadge = (inv) => {
    const isOverdue = inv.status === 'CONFIRMED' && new Date(inv.dueDate) < new Date();
    if (inv.status === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    }
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3" /> Overdue
        </span>
      );
    }
    if (inv.status === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Payment Due
        </span>
      );
    }
    if (inv.status === 'DRAFT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
          Draft
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
        {inv.status}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your statements, download PDF receipts, and make online payments.
          </p>
        </div>
        <button
          onClick={fetchInvoices}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-2xs self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalInvoiced)}</div>
          <div className="text-xs text-slate-500 mt-1">Across all issued statements</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-slate-500 mt-1">Successfully settled payments</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Due</span>
            <CreditCard className="w-4 h-4 text-brand-600" />
          </div>
          <div className={`text-2xl font-extrabold ${totalDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatCurrency(totalDue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalDue > 0 ? 'Pending invoice payments' : 'All accounts settled in full'}
          </div>
        </div>
      </div>

      {/* Invoices List Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'OUTSTANDING', label: 'Payment Due' },
              { id: 'OVERDUE', label: 'Overdue' },
              { id: 'PAID', label: 'Paid' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  view === tab.id
                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-full sm:w-56 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Clock className="w-7 h-7 animate-spin text-brand-600 mb-2" />
            <p className="text-xs">Loading invoice records...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No invoices found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || view !== 'ALL'
                ? 'Try adjusting your search query or filter options.'
                : 'You do not have any invoices yet. Invoices are generated automatically on your plan renewal dates.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Invoice Number</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Balance Due</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const balanceDue = Number(inv.amountTotal) - Number(inv.amountPaid);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/portal/invoices/${inv.id}`}
                          className="font-mono font-bold text-brand-700 hover:text-brand-900 hover:underline"
                        >
                          {inv.number}
                        </Link>
                        {inv.subscription?.number && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            Sub: {inv.subscription.number}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(inv.amountTotal)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">
                        <span className={balanceDue > 0 ? 'text-amber-600' : 'text-slate-400'}>
                          {formatCurrency(balanceDue)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">{getStatusBadge(inv)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.status === 'CONFIRMED' && balanceDue > 0 ? (
                            <Link
                              to={`/portal/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Pay Now
                            </Link>
                          ) : (
                            <Link
                              to={`/portal/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              View
                            </Link>
                          )}
                          <Link
                            to={`/portal/invoices/${inv.id}/print`}
                            target="_blank"
                            title="Print Invoice"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
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

