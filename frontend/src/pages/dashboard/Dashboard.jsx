import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  Repeat,
  Users,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  ArrowRight,
  ExternalLink,
  Calendar,
  Layers,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../lib/api';
import { inr, date, due } from '../../lib/format';

function getPresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // This Month: 1st to last day of this month
  const thisMonthStart = fmt(new Date(y, m, 1));
  const thisMonthEnd = fmt(new Date(y, m + 1, 0));

  // Last Month: 1st to last day of previous month
  const lastMonthStart = fmt(new Date(y, m - 1, 1));
  const lastMonthEnd = fmt(new Date(y, m, 0));

  // This Quarter
  const qStartMonth = Math.floor(m / 3) * 3;
  const thisQuarterStart = fmt(new Date(y, qStartMonth, 1));
  const thisQuarterEnd = fmt(new Date(y, qStartMonth + 3, 0));

  // This Year: Jan 1 to Dec 31
  const thisYearStart = fmt(new Date(y, 0, 1));
  const thisYearEnd = fmt(new Date(y, 11, 31));

  return {
    THIS_MONTH: { label: 'This Month', from: thisMonthStart, to: thisMonthEnd },
    LAST_MONTH: { label: 'Last Month', from: lastMonthStart, to: lastMonthEnd },
    THIS_QUARTER: { label: 'This Quarter', from: thisQuarterStart, to: thisQuarterEnd },
    THIS_YEAR: { label: 'This Year', from: thisYearStart, to: thisYearEnd },
  };
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const presets = useMemo(() => getPresets(), []);
  const [activePreset, setActivePreset] = useState('THIS_MONTH');
  const [customRange, setCustomRange] = useState({
    from: presets.THIS_MONTH.from,
    to: presets.THIS_MONTH.to,
  });
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // Plans dropdown options
  const { data: plansData } = useQuery({
    queryKey: ['plans-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/plans');
        return Array.isArray(res) ? res : res?.data || [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const plans = plansData || [];

  // Summary KPIs query
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['reports-summary', { from: customRange.from, to: customRange.to, planId: selectedPlanId }],
    queryFn: () => {
      const p = new URLSearchParams({
        from: customRange.from,
        to: customRange.to,
      });
      if (selectedPlanId) p.append('planId', selectedPlanId);
      return api.get(`/reports/summary?${p.toString()}`);
    },
  });

  // 12-Month revenue chart query
  const { data: chartData = [], isLoading: isChartLoading } = useQuery({
    queryKey: ['reports-revenue-by-month'],
    queryFn: () => api.get('/reports/revenue-by-month?months=12'),
  });

  // Top overdue invoices
  const { data: overdueResponse, isLoading: isOverdueLoading } = useQuery({
    queryKey: ['dashboard-overdue-invoices'],
    queryFn: () => api.get('/invoices?view=OVERDUE&pageSize=5'),
  });
  const overdueInvoices = overdueResponse?.data || [];

  // Expiring soon subscriptions
  const { data: expiringSoon = [], isLoading: isExpiringLoading } = useQuery({
    queryKey: ['reports-expiring'],
    queryFn: () => api.get('/reports/expiring?days=30'),
  });

  // Send reminder mutation
  const reminderMutation = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/remind`),
    onSuccess: (res) => {
      toast.success(res?.message || 'Payment reminder sent successfully');
      queryClient.invalidateQueries({ queryKey: ['dashboard-overdue-invoices'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to send reminder');
    },
  });

  const handlePresetChange = (key) => {
    setActivePreset(key);
    setCustomRange({
      from: presets[key].from,
      to: presets[key].to,
    });
  };

  const handleCustomDateChange = (field, val) => {
    setActivePreset('CUSTOM');
    setCustomRange((prev) => ({ ...prev, [field]: val }));
  };

  const kpis = [
    {
      label: 'Active Subscriptions',
      value: summary?.activeSubscriptions ?? 0,
      format: (v) => v.toLocaleString('en-IN'),
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
      badge: 'Live',
    },
    {
      label: 'Monthly Recurring (MRR)',
      value: summary?.mrr ?? 0,
      format: inr,
      icon: TrendingUp,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900',
      badge: 'Normalized',
    },
    {
      label: 'Annual Run-Rate (ARR)',
      value: summary?.arr ?? 0,
      format: inr,
      icon: Repeat,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900',
      badge: 'MRR × 12',
    },
    {
      label: 'Collected in Period',
      value: summary?.collected ?? 0,
      format: inr,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
      badge: 'Realized',
    },
    {
      label: 'Invoiced in Period',
      value: summary?.invoiced ?? 0,
      format: inr,
      icon: Receipt,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900',
      badge: 'Billed',
    },
    {
      label: 'Outstanding Balance',
      value: summary?.outstanding ?? 0,
      format: inr,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
      badge: 'Pending',
    },
    {
      label: 'Overdue Amount',
      value: summary?.overdueAmount ?? 0,
      format: inr,
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
      badge: `${summary?.overdueCount ?? 0} invoices`,
      highlight: (summary?.overdueCount ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Financial Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time subscription metrics, revenue trends, and cashflow health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchSummary();
              queryClient.invalidateQueries({ queryKey: ['reports-revenue-by-month'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-overdue-invoices'] });
              queryClient.invalidateQueries({ queryKey: ['reports-expiring'] });
              toast.success('Dashboard refreshed');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
            title="Refresh metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              const p = new URLSearchParams({
                from: customRange.from,
                to: customRange.to,
              });
              if (selectedPlanId) p.append('planId', selectedPlanId);
              window.open(`/api/reports/export-summary?${p.toString()}`, '_blank');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <Link
            to="/app/billing"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Run Billing Engine
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Period:
          </span>
          {Object.entries(presets).map(([key, item]) => {
            const isSelected = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetChange(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Custom date range & Plan filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customRange.from}
              onChange={(e) => handleCustomDateChange('from', e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customRange.to}
              onChange={(e) => handleCustomDateChange('to', e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Plan Selector */}
          {plans.length > 0 && (
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Plans</option>
              {plans.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 bg-white dark:bg-slate-800 shadow-sm transition-all hover:shadow-md ${
                kpi.highlight
                  ? 'border-rose-300 dark:border-rose-800 ring-1 ring-rose-200 dark:ring-rose-900/30'
                  : 'border-slate-200 dark:border-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <div className={`p-2 rounded-lg border ${kpi.bg}`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  {isSummaryLoading ? (
                    <span className="inline-block w-20 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
                  ) : (
                    kpi.format(kpi.value)
                  )}
                </div>
                {kpi.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      kpi.highlight
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {kpi.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 12-Month Revenue & Cashflow Bar Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              12-Month Invoiced vs Collected
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total invoiced volume versus collected payments month over month
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
              <span className="text-slate-600 dark:text-slate-300">Invoiced</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
              <span className="text-slate-600 dark:text-slate-300">Collected</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {isChartLoading ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              Loading revenue chart...
            </div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              No revenue history available yet. Run billing to generate data!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val, name) => [inr(val), name === 'invoiced' ? 'Invoiced' : 'Collected']}
                  labelFormatter={(lbl) => `Month: ${lbl}`}
                  contentStyle={{
                    borderRadius: '8px',
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />
                <Bar dataKey="invoiced" name="Invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two Column Section: Overdue Invoices & Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Invoices Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Critical Overdue Invoices
                </h3>
              </div>
              <Link
                to="/app/invoices?view=OVERDUE"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                View all ({summary?.overdueCount ?? 0})
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {isOverdueLoading ? (
              <div className="text-xs text-slate-400 py-6 text-center">Loading overdue invoices...</div>
            ) : overdueInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                All invoices are fully paid or on schedule!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {overdueInvoices.slice(0, 5).map((inv) => {
                  const unpaid = due(inv);
                  return (
                    <div key={inv.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/app/invoices/${inv.id}`}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                          >
                            {inv.number}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                          <span className="text-[10px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                            Due {date(inv.dueDate)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {inv.customer?.name} {inv.customer?.company ? `(${inv.customer.company})` : ''}
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{inr(unpaid)}</div>
                          <div className="text-[10px] text-slate-400">Total: {inr(inv.amountTotal)}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => reminderMutation.mutate(inv.id)}
                          disabled={reminderMutation.isPending}
                          className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 shadow-sm"
                          title="Send email reminder to customer"
                        >
                          <Mail className="w-3 h-3" />
                          Remind
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 text-right">
            <Link
              to="/app/invoices?view=OVERDUE"
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Manage collection workflows &rarr;
            </Link>
          </div>
        </div>

        {/* Expiring Soon Subscriptions Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Expiring in Next 30 Days
                </h3>
              </div>
              <Link
                to="/app/subscriptions"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                All Subscriptions
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {isExpiringLoading ? (
              <div className="text-xs text-slate-400 py-6 text-center">Loading expiring subscriptions...</div>
            ) : expiringSoon.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                No subscriptions expiring within the next 30 days!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {expiringSoon.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/app/subscriptions/${sub.id}`}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                        >
                          {sub.customer?.name}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                          Expires {date(sub.expiryDate)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Plan: {sub.plan?.name || 'Custom'} {sub.customer?.company ? `• ${sub.customer.company}` : ''}
                      </div>
                    </div>

                    <Link
                      to={`/app/subscriptions/${sub.id}`}
                      className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      Inspect
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 text-right">
            <Link
              to="/app/subscriptions"
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Manage subscription renewals &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
