import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Loader2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { date } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const LABEL = {
  INVOICE_DUE_SOON: ['Due soon', 'bg-amber-50 text-amber-700 border-amber-200'],
  INVOICE_OVERDUE: ['Overdue', 'bg-rose-50 text-rose-700 border-rose-200'],
  RENEWAL_UPCOMING: ['Renewal', 'bg-brand-50 text-brand-700 border-brand-200'],
};
const when = (n) => (n < 0 ? `${-n} days before due` : n === 0 ? 'on the day' : `${n} days after due`);

/** What the system has e-mailed to customers on its own, and a button to send whatever is due right now. */
export default function RemindersCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => api.get('/reminders', { params: { pageSize: 8 } }),
  });

  const run = async () => {
    setRunning(true);
    try {
      const r = (await api.post('/reminders/run')).data;
      const sent = r.dueSoon + r.overdue + r.renewals;
      if (r.mailDown) {
        toast.error('The mail server is not responding, so nothing could be sent. Reminders are kept and will be retried.');
      } else if (sent) {
        toast.success(`Sent ${sent} reminder${sent === 1 ? '' : 's'}${r.deferred ? `; ${r.deferred} more will go out on the next run` : ''}`);
        if (r.failed) toast.error(`${r.failed} could not be sent and will be retried`);
      } else if (r.failed) {
        toast.error(`${r.failed} could not be sent and will be retried`);
      } else {
        toast.success('Nothing is due: every reminder has already gone out');
      }
      qc.invalidateQueries({ queryKey: ['reminders'] });
    } catch (e) {
      toast.error(e.message || 'Could not send reminders');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <BellRing className="w-4 h-4 text-brand-600" /> Automatic reminders
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Customers are e-mailed 3 days before an invoice is due, then 1, 7, 14 and 30 days after it is overdue, and
            30 and 7 days before a subscription expires. Each reminder goes out once, in the daytime.
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={run}
            disabled={running}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send due reminders now
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : !data?.data?.length ? (
        <p className="text-xs text-slate-400">Nothing has been sent yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-xs">
          {data.data.map((n) => {
            const [label, tone] = LABEL[n.kind] || [n.kind, ''];
            return (
              <li key={n.id} className="flex items-center gap-3 py-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{label}</span>
                <span className="font-mono text-slate-700">{n.invoice?.number || n.subscription?.number}</span>
                <span className="hidden sm:inline text-slate-400">{when(n.stage)}</span>
                <span className="ml-auto truncate text-slate-500">{n.recipient}</span>
                <span className="text-slate-400">{date(n.sentAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
