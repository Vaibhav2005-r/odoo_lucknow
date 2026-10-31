import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  CreditCard,
  FileCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Calendar,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MySubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load your subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleAcceptQuotation = async (subId, subNumber) => {
    if (!window.confirm(`Are you sure you want to accept quotation ${subNumber}? This will activate your subscription.`)) {
      return;
    }

    try {
      setAcceptingId(subId);
      await api.post(`/subscriptions/${subId}/accept-quote`);
      toast.success(`Quotation ${subNumber} accepted successfully!`);
      await fetchSubscriptions();
    } catch (err) {
      toast.error(err.message || 'Failed to accept quotation');
    } finally {
      setAcceptingId(null);
    }
  };

  // Separate quotations from regular subscriptions
  const quotations = subscriptions.filter(
    (s) => s.status === 'QUOTATION' || (s.status === 'DRAFT' && s.quoteValidUntil)
  );

  const activeAndPast = subscriptions.filter(
    (s) => s.status !== 'QUOTATION' && !(s.status === 'DRAFT' && s.quoteValidUntil)
  );

  const filteredSubs = activeAndPast.filter((s) => {
    const matchesStatus =
      filterStatus === 'ALL' ||
      s.status === filterStatus ||
      (filterStatus === 'ACTIVE' && (s.status === 'ACTIVE' || s.status === 'CONFIRMED'));

    const sTerm = search.toLowerCase();
    const matchesSearch =
      !sTerm ||
      s.number.toLowerCase().includes(sTerm) ||
      (s.plan?.name && s.plan.name.toLowerCase().includes(sTerm));

    return matchesStatus && matchesSearch;
  });

  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'CONFIRMED').length;
  const quoteCount = quotations.length;
  const totalMonthlySpend = subscriptions
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + Number(s.amountTotal || 0), 0);

  const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Confirmed
          </span>
        );
      case 'QUOTATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Quotation Pending
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Clock className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-sm font-medium">Loading your subscriptions & quotations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your active service plans, billing schedules, and pending quotations.
          </p>
        </div>
        <button
          onClick={fetchSubscriptions}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-2xs self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Plans</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-1">Currently billing services</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Quotations Waiting</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{quoteCount}</div>
          <div className="text-xs text-slate-500 mt-1">Awaiting your acceptance</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Current Period Value</span>
            <CreditCard className="w-4 h-4 text-brand-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalMonthlySpend)}</div>
          <div className="text-xs text-slate-500 mt-1">Active recurring commitment</div>
        </div>
      </div>

      {/* Section 1: Quotations Waiting for You */}
      {quotations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900">Quotations Waiting for You</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {quotations.length} Action Needed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotations.map((q) => {
              const isExpired = q.quoteValidUntil && new Date(q.quoteValidUntil) < new Date();
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border-2 border-amber-200/80 p-5 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 bg-amber-50 rounded-full pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {q.number}
                      </span>
                      {isExpired ? (
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Expired
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Valid until {formatDate(q.quoteValidUntil)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      {q.plan?.name || 'Custom Subscription Plan'}
                    </h3>

                    <div className="text-xs text-slate-600 mb-3">
                      Billing interval: <strong className="text-slate-800 capitalize">{q.plan?.billingPeriod?.toLowerCase() || 'Monthly'}</strong>
                    </div>

                    {q.lines && q.lines.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-2.5 mb-4 text-xs text-slate-600 space-y-1">
                        <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Includes:</div>
                        {q.lines.slice(0, 3).map((l) => (
                          <div key={l.id} className="flex justify-between text-slate-600">
                            <span className="truncate pr-2">• {l.description}</span>
                            <span className="font-medium text-slate-800 shrink-0">x{l.quantity}</span>
                          </div>
                        ))}
                        {q.lines.length > 3 && (
                          <div className="text-[11px] text-slate-400 italic">+{q.lines.length - 3} more items</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Price</div>
                      <div className="text-lg font-extrabold text-slate-900">{formatCurrency(q.amountTotal)}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/portal/subscriptions/${q.id}`}
                        className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleAcceptQuotation(q.id, q.number)}
                        disabled={isExpired || acceptingId === q.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        {acceptingId === q.id ? 'Accepting...' : 'Accept Quotation'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Subscriptions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">Active & Historical Subscriptions</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Status Tabs */}
            <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
              {['ALL', 'ACTIVE', 'PAUSED', 'CLOSED'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab)}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    filterStatus === tab
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search number or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-full sm:w-48 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {filteredSubs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No subscriptions found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || filterStatus !== 'ALL'
                ? 'Try adjusting your search query or filter options.'
                : 'You do not have any active subscriptions right now. When quotations are confirmed, they will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSubs.map((sub) => (
              <div
                key={sub.id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900">{sub.number}</span>
                    {getStatusBadge(sub.status)}
                    {sub.isPaused && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-slate-800">
                    {sub.plan?.name || 'Subscription Plan'}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Started: {formatDate(sub.startDate)}
                    </span>
                    <span>Valid until: {formatDate(sub.expiryDate)}</span>
                    {sub.nextInvoiceDate && (
                      <span className="text-brand-700 font-medium">
                        Next Invoice: {formatDate(sub.nextInvoiceDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <div className="text-base font-bold text-slate-900">{formatCurrency(sub.amountTotal)}</div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider capitalize">
                      {sub.plan?.billingPeriod?.toLowerCase() || 'Monthly'}
                    </div>
                  </div>

                  <Link
                    to={`/portal/subscriptions/${sub.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Manage
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

