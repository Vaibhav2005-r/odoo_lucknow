import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { httpError } from '../../lib/http-error.js';
import { toPaise } from '../../lib/billing-core.js';

// Which provider is active: Razorpay when keys are configured, the built-in test checkout when asked for
// (default outside production), otherwise none and online payment is simply switched off.
export function gatewayName() {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return 'razorpay';
  return env.PAYMENT_GATEWAY === 'mock' ? 'mock' : null;
}

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');
export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Razorpay Checkout returns (order_id, payment_id, signature); the signature is HMAC-SHA256(order_id|payment_id).
export const verifyCheckoutSignature = ({ orderId, paymentId, signature }, secret = env.RAZORPAY_KEY_SECRET) =>
  Boolean(secret && orderId && paymentId && signature) && safeEqual(hmac(secret, `${orderId}|${paymentId}`), signature);

// Webhooks are signed over the raw request body with the webhook secret.
export const verifyWebhookSignature = (rawBody, signature, secret = env.RAZORPAY_WEBHOOK_SECRET) =>
  Boolean(secret && rawBody && signature) && safeEqual(hmac(secret, rawBody), signature);

export const signCheckout = (orderId, paymentId, secret) => hmac(secret, `${orderId}|${paymentId}`); // tests + mock
export const signWebhook = (rawBody, secret) => hmac(secret, rawBody);

const METHODS = { card: 'CARD', upi: 'UPI', netbanking: 'BANK_TRANSFER', wallet: 'OTHER', emi: 'CARD' };
export const methodFromRazorpay = (m) => METHODS[String(m || '').toLowerCase()] || 'OTHER';

async function razorpay(path, init = {}) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, `The payment provider refused the request: ${body?.error?.description || res.status}`);
  return body;
}

// ---- the two providers behind one small interface
const providers = {
  razorpay: {
    async createOrder({ amountRupees, receipt, notes }) {
      const o = await razorpay('/orders', {
        method: 'POST',
        body: JSON.stringify({ amount: toPaise(amountRupees), currency: 'INR', receipt, notes }),
      });
      return { orderId: o.id };
    },
    async fetchPayment(paymentId) {
      const p = await razorpay(`/payments/${encodeURIComponent(paymentId)}`);
      return { method: methodFromRazorpay(p.method), status: p.status, amountPaise: p.amount, orderId: p.order_id };
    },
  },
  mock: {
    async createOrder() {
      return { orderId: `order_mock_${crypto.randomBytes(9).toString('hex')}` };
    },
  },
};

export const getProvider = (name = gatewayName()) => (name ? providers[name] : null);
