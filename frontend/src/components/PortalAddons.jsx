import { useEffect, useState } from 'react';
import { Loader2, Plus, Puzzle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { inr } from '../lib/format';
import { describeProration, useProrationFlow } from './ProrationDialog';

const taxRate = (taxes = []) => taxes.reduce((a, t) => a + Number(t.rate), 0);

/**
 * "Your add-ons" for the customer portal: switch the ones on the subscription on and off, and add new ones. Every change
 * shows what it costs for the rest of the current period before anything happens. `sub` is the API subscription.
 */
export default function PortalAddons({ sub, onChanged }) {
  const { ask, dialog } = useProrationFlow('customer');
  const [offer, setOffer] = useState([]);
  const [busy, setBusy] = useState(null);
  const editable = sub.status === 'ACTIVE' || sub.status === 'CONFIRMED';

  useEffect(() => {
    if (editable) api.get('/products/addons').then((r) => setOffer(r.data)).catch(() => {});
  }, [editable, sub.id]);

  const mine = (sub.lines || []).filter((l) => l.product?.type === 'ADDON');
  const have = new Set(mine.map((l) => l.productId));
  const available = offer.filter((p) => !have.has(p.id));
  if (!editable || (mine.length === 0 && available.length === 0)) return dialog;

  const finish = (res, fallback) => {
    toast.success(describeProration(res.proration) || fallback, { duration: 6000 });
    onChanged();
  };

  const toggle = (line) =>
    ask({
      title: `${line.isActive ? 'Switch off' : 'Switch on'} ${line.description}`,
      confirmLabel: line.isActive ? 'Switch off' : 'Switch on',
      getPreview: async () => (await api.post(`/subscriptions/${sub.id}/changes/preview`, { action: 'update', lineId: line.id, isActive: !line.isActive })).data,
      perform: async () => {
        setBusy(line.id);
        try {
          finish(await api.patch(`/subscriptions/${sub.id}/lines/${line.id}`, { isActive: !line.isActive }), `${line.description} is now ${line.isActive ? 'off' : 'on'}`);
        } finally {
          setBusy(null);
        }
      },
    });

  const add = (product) =>
    ask({
      title: `Add ${product.name}`,
      confirmLabel: 'Add to my plan',
      getPreview: async () => (await api.post(`/subscriptions/${sub.id}/changes/preview`, { action: 'add', productId: product.id, quantity: 1 })).data,
      perform: async () => {
        setBusy(`p${product.id}`);
        try {
          finish(await api.post(`/subscriptions/${sub.id}/lines`, { productId: product.id, quantity: 1 }), `${product.name} added`);
        } finally {
          setBusy(null);
        }
      },
    });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 p-4 sm:p-5">
        <Puzzle className="h-4 w-4 text-brand-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Your add-ons</h2>
          <p className="text-xs text-slate-500">Switch optional extras on or off whenever you like. Changes part-way through a period are charged or credited for the days that are left.</p>
        </div>
      </div>

      {mine.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {mine.map((line) => (
            <li key={line.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${line.isActive ? 'text-slate-900' : 'text-slate-400'}`}>{line.description}</div>
                <div className="text-xs text-slate-500">
                  {line.quantity} × {inr(line.unitPrice)} per period{taxRate(line.taxes) ? ` + ${taxRate(line.taxes)}% tax` : ''}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={line.isActive}
                aria-label={`${line.description} ${line.isActive ? 'on' : 'off'}`}
                disabled={busy === line.id}
                onClick={() => toggle(line)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${line.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${line.isActive ? 'translate-x-5' : ''}`} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Available to add</div>
          <ul className="space-y-2">
            {available.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{inr(p.salesPrice)} per period{taxRate(p.taxes) ? ` + ${taxRate(p.taxes)}% tax` : ''}</div>
                </div>
                <button
                  type="button"
                  disabled={busy === `p${p.id}`}
                  onClick={() => add(p)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
                >
                  {busy === `p${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog}
    </div>
  );
}
