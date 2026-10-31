import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Landmark, Loader2, Lock, Smartphone, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { inr } from '../lib/format';

let razorpayScript;
const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve();
  razorpayScript ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { razorpayScript = null; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.head.appendChild(s);
  });
  return razorpayScript;
};

const METHODS = [
  { id: 'UPI', label: 'UPI', hint: 'Pay with any UPI app', Icon: Smartphone },
  { id: 'CARD', label: 'Card', hint: 'Credit or debit card', Icon: CreditCard },
  { id: 'BANK_TRANSFER', label: 'Net banking', hint: 'Pay from your bank', Icon: Landmark },
];

/** Built-in test checkout, shown only when the server runs the demo gateway. Nothing real is charged. */
function TestCheckout({ order, invoiceId, onClose, onPaid }) {
  const [method, setMethod] = useState('UPI');
  const [busy, setBusy] = useState(false);
  const finish = async (outcome) => {
    setBusy(true);
    try {
      await api.post(`/invoices/${invoiceId}/checkout/mock-complete`, { orderId: order.orderId, outcome, method });
      if (outcome === 'success') onPaid();
      else {
        toast.error('The test payment was declined. You can try again.');
        onClose();
      }
    } catch (e) {
      toast.error(e.message || 'Payment failed');
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">{order.company}</div>
            <div className="text-xs text-slate-500">Invoice {order.invoiceNumber}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Test mode: no real money is charged.</div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-slate-400">Amount</div>
            <div className="text-3xl font-semibold tracking-tight text-slate-900">{inr(order.amount)}</div>
          </div>
          <div className="space-y-2">
            {METHODS.map(({ id, label, hint, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${method === id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <Icon className="h-5 w-5 text-brand-600" />
                <span className="flex-1"><span className="block text-sm font-medium text-slate-900">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
                {method === id && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish('success')}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Pay {inr(order.amount)}
          </button>
          <button type="button" disabled={busy} onClick={() => finish('failure')} className="w-full text-center text-xs text-slate-400 hover:text-slate-600">
            Simulate a declined payment
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Pay now" for a confirmed invoice. Uses Razorpay when the server has it configured, the built-in test checkout
 * for demos, and renders nothing when online payment is off.
 */
export default function PayNow({ invoice, onPaid, className = '' }) {
  const [gateway, setGateway] = useState(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState(null);

  useEffect(() => {
    api.get('/payments/gateway').then((r) => setGateway(r.data)).catch(() => setGateway({ provider: null }));
  }, []);

  const owed = Number(invoice.amountTotal) - Number(invoice.amountPaid);
  if (!gateway?.provider || invoice.status !== 'CONFIRMED' || owed <= 0) return null;

  const done = () => {
    setTest(null);
    toast.success('Payment received. Thank you!');
    onPaid?.();
  };

  const start = async () => {
    setBusy(true);
    try {
      const order = (await api.post(`/invoices/${invoice.id}/checkout`)).data;
      if (order.provider === 'mock') {
        setTest(order);
      } else {
        await loadRazorpay();
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: order.currency,
          name: order.company,
          description: `Invoice ${order.invoiceNumber}`,
          prefill: order.prefill,
          theme: { color: '#714b67' },
          handler: async (resp) => {
            try {
              await api.post(`/invoices/${invoice.id}/checkout/verify`, {
                orderId: resp.razorpay_order_id,
                paymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              });
              done();
            } catch (e) {
              toast.error(e.message || 'We could not confirm the payment yet. If money left your account it will show up shortly.');
            }
          },
        });
        rzp.on('payment.failed', () => toast.error('The payment did not go through. You can try again.'));
        rzp.open();
      }
    } catch (e) {
      toast.error(e.message || 'Could not start the payment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${className}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Pay {inr(owed)}
      </button>
      {test && <TestCheckout order={test} invoiceId={invoice.id} onClose={() => setTest(null)} onPaid={done} />}
    </>
  );
}
