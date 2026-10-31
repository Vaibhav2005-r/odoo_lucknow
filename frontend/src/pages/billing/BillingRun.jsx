import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  RefreshCw,
  Zap,
  Info,
  Calendar,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function BillingRun() {
  const queryClient = useQueryClient();

  // Poll status every 2 seconds when running, or 5 seconds otherwise
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => api.get('/billing/status'),
    refetchInterval: (query) => (query.state.data?.isRunning ? 2000 : 8000),
  });

  const runMutation = useMutation({
    mutationFn: () => api.post('/billing/run'),
    onSuccess: () => {
      toast.success('Billing engine initiated in background');
      queryClient.invalidateQueries({ queryKey: ['billing-status'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to trigger billing run');
    },
  });

  const isRunning = Boolean(status?.isRunning);
  const dueNow = status?.dueNow ?? 0;
  const processed = status?.processed ?? 0;
  const created = status?.invoicesCreated ?? status?.created ?? 0;
  const failedList = Array.isArray(status?.failed) ? status.failed : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-amber-500" />
            Subscription Billing Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate recurring draft invoices, advance billing cycles, and review pending batches
          </p>
        </div>

        <button
          onClick={() => {
            refetch();
            toast.success('Billing status refreshed');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {/* Main Execution Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pending Subscriptions
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing Run
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                {isLoading ? '...' : dueNow}
              </span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                subscriptions currently due for invoicing
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={isRunning || runMutation.isPending}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-md transition-all ${
                isRunning || runMutation.isPending
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-500/20'
              }`}
            >
              {isRunning || runMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  Billing In Progress...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Run Billing Now
                </>
              )}
            </button>

            <Link
              to="/app/invoices?view=DRAFT"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              Review Draft Invoices
            </Link>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
              <span>Subscriptions Processed</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{processed}</div>
            <p className="text-[11px] text-slate-400 mt-1">Checked against active cycles</p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 bg-emerald-50/30 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs mb-1">
              <span>Draft Invoices Created</span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{created}</div>
            <p className="text-[11px] text-slate-400 mt-1">Ready for confirmation & dispatch</p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 bg-rose-50/30 dark:bg-rose-950/20">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs mb-1">
              <span>Failed / Skipped</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{failedList.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Exceptions logged for inspection</p>
          </div>
        </div>

        {/* Execution timestamp info */}
        {(status?.startedAt || status?.finishedAt) && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-4">
              {status.startedAt && <span>Started: {new Date(status.startedAt).toLocaleString('en-IN')}</span>}
              {status.finishedAt && <span>Finished: {new Date(status.finishedAt).toLocaleString('en-IN')}</span>}
            </div>
            <Link
              to="/app/invoices?view=DRAFT"
              className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Open Draft Invoices List
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Failure breakdown if any */}
        {failedList.length > 0 && (
          <div className="mt-6 p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40">
            <h4 className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4" />
              Failed Invoicing Items ({failedList.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs text-rose-700 dark:text-rose-400">
              {failedList.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-1.5 rounded border border-rose-100 dark:border-rose-900/60">
                  <span>Subscription #{f.subscriptionId || f.id || 'N/A'}</span>
                  <span className="font-mono text-[11px]">{f.error || f.message || 'Unknown billing error'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explanatory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
            <Info className="w-4 h-4 text-indigo-500" />
            How The Billing Engine Works
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            When you run billing, LoopBill scans all active and unpaused subscriptions whose{' '}
            <code className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">
              nextInvoiceDate
            </code>{' '}
            is on or before today (Asia/Kolkata timezone).
          </p>
          <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1 pt-1">
            <li>Calculates recurring line items, add-ons, and applicable discount rules</li>
            <li>Computes GST tax breakdown down to integer paise (no rounding drift)</li>
            <li>Generates draft invoices with chronological sequence numbers</li>
            <li>Safely advances subscription billing periods</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
            <Calendar className="w-4 h-4 text-emerald-500" />
            Automated Daily Cron Job
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            In addition to manual runs, LoopBill includes an automated cron daemon that triggers every day at{' '}
            <strong>02:00 AM IST</strong>.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            All generated invoices are placed in <strong>DRAFT</strong> status so your finance and operations team can
            review totals, apply bespoke adjustments, and confirm them in bulk with one click.
          </p>
          <div className="pt-2">
            <Link
              to="/app/invoices?view=DRAFT"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Go to Draft Invoices &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
