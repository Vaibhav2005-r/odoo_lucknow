import { failIntent, settleIntent } from './checkout.service.js';
import { methodFromRazorpay, verifyWebhookSignature } from './gateway.js';

// POST /api/webhooks/razorpay. The body must arrive RAW (mounted before express.json) because the signature
// covers the exact bytes Razorpay sent. Always answers 200 once the signature is good, so Razorpay stops retrying
// events we do not care about; a real failure answers 500 so it retries.
export async function razorpayWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!verifyWebhookSignature(raw, req.get('x-razorpay-signature'))) {
    return res.status(400).json({ error: { message: 'Invalid signature' } });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: { message: 'Invalid payload' } });
  }

  const payment = event?.payload?.payment?.entity;
  const orderId = payment?.order_id || event?.payload?.order?.entity?.id;
  try {
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && orderId && payment?.id) {
      await settleIntent({ orderId, paymentId: payment.id, method: methodFromRazorpay(payment.method) });
    } else if (event.event === 'payment.failed' && orderId) {
      await failIntent(orderId, payment?.error_description || 'Payment failed');
    }
  } catch (e) {
    if (e.status === 404) return res.json({ ok: true, ignored: 'unknown order' }); // not one of ours
    console.error('[razorpay webhook]', e);
    return res.status(500).json({ error: { message: 'Could not process the event' } });
  }
  return res.json({ ok: true });
}
