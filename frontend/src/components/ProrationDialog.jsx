import { useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2, Receipt, Undo2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { date, inr } from '../lib/format';

/** The money side of a mid-period change, shown before it is made. `audience` is 'customer' or 'staff'. */
function ProrationDialog({ title, preview, confirmLabel, busy, audience, onConfirm, onCancel }) {
  const own = audience === 'customer';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              {preview.days} of {preview.totalDays} days left in this billing period ({date(preview.from)} to {date(preview.periodEnd)})
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <ul className="space-y-2">
            {preview.items.map((i, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <span className={`mt-0.5 rounded-full p-1 ${i.direction === 'CHARGE' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {i.direction === 'CHARGE' ? <Receipt className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{i.description}</span>
                  <span className="block text-xs text-slate-500">
                    {i.quantity} × {inr(i.unitPriceProrated)} for the rest of the period (full price {inr(i.unitPrice)}), tax {inr(i.tax)}
                  </span>
                </span>
                <span className={`font-semibold ${i.direction === 'CHARGE' ? 'text-slate-900' : 'text-emerald-700'}`}>
                  {i.direction === 'CHARGE' ? inr(i.total) : `-${inr(i.total)}`}
                </span>
              </li>
            ))}
          </ul>

          {preview.charge > 0 && (
            <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{own ? 'You pay now' : 'Charged now'}</span>
                <span className="text-lg font-semibold">{inr(preview.charge)}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">
                {own
                  ? 'Only for the days that are left, tax included. An invoice is created and ready to pay straight away.'
                  : 'Only for the days that are left, tax included. A draft invoice is created for you to review and confirm.'}
              </p>
            </div>
          )}
          {preview.credit > 0 && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{own ? 'You get back' : 'Credit to the customer'}</span>
                <span className="text-lg font-semibold">{inr(preview.credit)}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">The unused part of the period, tax included. It is taken off the next invoice automatically.</p>
            </div>
          )}
          <p className="text-xs text-slate-500">From the next billing period the recurring price simply changes; nothing is prorated again.</p>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} disabled={busy} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ask({ title, getPreview, perform, confirmLabel }) fetches the cost of a change; if money moves it shows the dialog
 * and performs the change only after a click, otherwise it just performs it. Render {dialog} somewhere in the page.
 */
export function useProrationFlow(audience = 'staff') {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const ask = async ({ title, getPreview, perform, confirmLabel = 'Confirm' }) => {
    try {
      const preview = await getPreview();
      if (!preview?.applicable || (preview.charge === 0 && preview.credit === 0)) {
        await perform();
        return;
      }
      setPending({ title, preview, perform, confirmLabel });
    } catch (e) {
      toast.error(e.message || 'Could not work out the price of this change');
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await pending.perform();
    } catch (e) {
      toast.error(e.message || 'The change could not be made');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const dialog = pending ? (
    <ProrationDialog {...pending} busy={busy} audience={audience} onConfirm={confirm} onCancel={() => !busy && setPending(null)} />
  ) : null;
  return { ask, dialog };
}

/** One sentence for a toast after a change went through. */
export function describeProration(p) {
  if (!p?.applicable) return null;
  const parts = [];
  if (p.charge > 0) parts.push(p.invoice ? `Invoice ${p.invoice.number} for ${inr(p.charge)} created` : `${inr(p.charge)} charged`);
  if (p.credit > 0) parts.push(`${inr(p.credit)} will be taken off the next invoice`);
  return parts.join('. ');
}

export default ProrationDialog;
