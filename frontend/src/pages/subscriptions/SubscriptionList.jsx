import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Repeat,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  XCircle,
  ExternalLink,
  PauseCircle,
  Calendar,
  Building,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { subscriptionService } from '../../services/subscriptionService';
import { planService } from '../../services/planService';
import { inr, date } from '../../lib/format';

export default function SubscriptionList() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, quotation: 0, confirmed: 0, paused: 0, closed: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 10 });

  const loadData = () => {
    try {
      setLoading(true);
      const res = subscriptionService.getAll({
        search,
        status: statusFilter,
        planId: planFilter,
        page,
        pageSize: 10,
      });
      setSubscriptions(res.data);
      setMeta(res.meta);
      setStats(subscriptionService.getStats());

      const allPlans = planService.getAll();
      setPlans(allPlans);
    } catch {
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, planFilter, page]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Active</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="h-3 w-3 text-slate-400" />
            <span>Draft</span>
          </span>
        );
      case 'QUOTATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-600" />
            <span>Quotation</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckCircle2 className="h-3 w-3 text-indigo-600" />
            <span>Confirmed</span>
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <PauseCircle className="h-3 w-3 text-sky-600" />
            <span>Paused</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3 text-rose-500" />
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track recurring contracts, customer subscription lifecycle, automated billing schedules, and add-ons.
          </p>
        </div>
        <Link
          to="/app/subscriptions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Subscription</span>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          onClick={() => { setStatusFilter('ALL'); setPage(1); }}
          className={`bg-white p-4 rounded-xl border cursor-pointer transition shadow-xs hover:border-slate-300 ${
            statusFilter === 'ALL' ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Subscriptions</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-1">Contracts across all states</div>
        </div>

        <div
          onClick={() => { setStatusFilter('ACTIVE'); setPage(1); }}
          className={`bg-white p-4 rounded-xl border cursor-pointer transition shadow-xs hover:border-slate-300 ${
            statusFilter === 'ACTIVE' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</div>
          <div className="text-xs text-slate-400 mt-1">Currently billing recurring</div>
        </div>

        <div
          onClick={() => { setStatusFilter('DRAFT'); setPage(1); }}
          className={`bg-white p-4 rounded-xl border cursor-pointer transition shadow-xs hover:border-slate-300 ${
            statusFilter === 'DRAFT' ? 'border-slate-500 ring-2 ring-slate-100' : 'border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Drafts</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{stats.draft}</div>
          <div className="text-xs text-slate-400 mt-1">Internal draft proposals</div>
        </div>

        <div
          onClick={() => { setStatusFilter('QUOTATION'); setPage(1); }}
          className={`bg-white p-4 rounded-xl border cursor-pointer transition shadow-xs hover:border-slate-300 ${
            statusFilter === 'QUOTATION' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Quotations Sent</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{stats.quotation}</div>
          <div className="text-xs text-slate-400 mt-1">Awaiting client approval</div>
        </div>

        <div
          onClick={() => { setStatusFilter('CLOSED'); setPage(1); }}
          className={`bg-white p-4 rounded-xl border cursor-pointer transition shadow-xs hover:border-slate-300 col-span-2 lg:col-span-1 ${
            statusFilter === 'CLOSED' ? 'border-rose-500 ring-2 ring-rose-100' : 'border-slate-200'
          }`}
        >
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Closed / Expired</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{stats.closed}</div>
          <div className="text-xs text-slate-400 mt-1">Non-renewed or cancelled</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by number, customer, or plan name..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="QUOTATION">Quotation</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PAUSED">Paused</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[180px] truncate"
            >
              <option value="ALL">All Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {(search || statusFilter !== 'ALL' || planFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPlanFilter('ALL');
                setPage(1);
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Repeat className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <div className="font-semibold text-slate-700">No subscriptions found</div>
            <div className="text-sm text-slate-400 mt-1">Try adjusting your filters or create a new quotation.</div>
            <div className="mt-4">
              <Link
                to="/app/subscriptions/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Subscription</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Subscription #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Recurring Plan</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Next Billing</th>
                  <th className="py-3 px-4">Recurring Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/app/subscriptions/${sub.id}`}
                        className="font-mono text-xs font-bold text-brand-600 hover:text-brand-800 hover:underline"
                      >
                        {sub.number}
                      </Link>
                      <div className="text-[11px] text-slate-400">{sub.lines?.length || 1} line item(s)</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{sub.customerName}</div>
                      {sub.customerCompany && (
                        <div className="text-xs text-slate-500 font-normal line-clamp-1">
                          {sub.customerCompany}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 text-xs">{sub.planName}</div>
                      <span className="text-[11px] text-slate-400 capitalize">
                        {sub.billingPeriod.toLowerCase()} cycle
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {date(sub.startDate)}
                    </td>

                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      {sub.nextBillingDate ? (
                        <span className="font-medium text-slate-800 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-brand-500" />
                          <span>{date(sub.nextBillingDate)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {inr(sub.recurringAmount)}
                      <span className="text-[11px] font-normal text-slate-400 block">
                        incl. taxes & add-ons
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(sub.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/app/subscriptions/${sub.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 border border-brand-200 transition"
                      >
                        <span>Manage</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {meta.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Showing page <strong className="text-slate-800">{page}</strong> of{' '}
              <strong className="text-slate-800">{meta.totalPages}</strong> ({meta.total} records total)
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 font-medium transition"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 font-medium transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

