import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSmtpSink } from './helpers/smtp-sink.js';
import { methodFromRazorpay, safeEqual, signCheckout, signWebhook, verifyCheckoutSignature, verifyWebhookSignature } from '../modules/payments/gateway.js';

// ---------------------------------------------------------------- signatures (no database)

test('checkout and webhook signatures: valid passes, tampered or missing fails', () => {
  const secret = 'test_secret_123';
  const sig = signCheckout('order_A', 'pay_B', secret);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sig }, secret), true);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_C', signature: sig }, secret), false, 'different payment');
  assert.equal(verifyCheckoutSignature({ orderId: 'order_X', paymentId: 'pay_B', signature: sig }, secret), false, 'different order');
  assert.equal(verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sig }, 'other_secret'), false, 'different secret');
  assert.equal(verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: 'short' }, secret), false);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: '' }, secret), false);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sig }, ''), false, 'no secret configured never verifies');

  const body = JSON.stringify({ event: 'payment.captured' });
  const wsig = signWebhook(body, 'whsec');
  assert.equal(verifyWebhookSignature(body, wsig, 'whsec'), true);
  assert.equal(verifyWebhookSignature(`${body} `, wsig, 'whsec'), false, 'one extra byte breaks it');
  assert.equal(verifyWebhookSignature(body, wsig, 'wrong'), false);
  assert.equal(verifyWebhookSignature(body, undefined, 'whsec'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('abc', 'abc'), true);
});

test('Razorpay payment methods map onto ours', () => {
  assert.equal(methodFromRazorpay('upi'), 'UPI');
  assert.equal(methodFromRazorpay('CARD'), 'CARD');
  assert.equal(methodFromRazorpay('netbanking'), 'BANK_TRANSFER');
  assert.equal(methodFromRazorpay('wallet'), 'OTHER');
  assert.equal(methodFromRazorpay(undefined), 'OTHER');
});

// ---------------------------------------------------------------- the real app and database

const sink = await startSmtpSink();
const { app } = await import('../app.js');
const { prisma } = await import('../lib/prisma.js');
const { env } = await import('../config/env.js');
const { settleIntent } = await import('../modules/payments/checkout.service.js');
const { todayIn, addDays } = await import('../lib/billing-core.js');

const today = todayIn('Asia/Kolkata');
const tag = Date.now().toString(36);
let skip = false;
let server;
let base;
let riyaCustomer;
const sess = {};
let seq = 0;

const call = async (who, method, path, body) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: sess[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (who, email, password) => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  sess[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};
const data = (r) => r.body.data ?? r.body;
const invoiceFor = (customerId, { total = 1180, paid = 0, status = 'CONFIRMED' } = {}) => prisma.invoice.create({
  data: {
    number: `CHK/${tag}/${++seq}`, customerId, status, invoiceDate: today, dueDate: addDays(today, 7),
    amountSubtotal: total, amountUntaxed: total, amountTax: 0, amountTotal: total, amountPaid: paid,
  },
});
const paymentsOf = (invoiceId) => prisma.payment.findMany({ where: { invoiceId }, orderBy: { id: 'asc' } });

before(async () => {
  try {
    await prisma.user.count();
    if (!(await prisma.user.findUnique({ where: { email: 'admin@brightloop.in' } }))) throw new Error('database not seeded');
  } catch (e) {
    skip = `database not ready (${e.message.split('\n')[0]})`;
    return;
  }
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  await login('admin', 'admin@brightloop.in', 'Admin@12345');
  await login('staff', 'staff@brightloop.in', 'Staff@12345');
  await login('riya', 'riya@sharmaretail.in', 'Customer@123');
  riyaCustomer = await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } });
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  sink.close();
  await prisma.$disconnect();
});
const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

t('test gateway: pay an invoice online, once', async () => {
  const gw = await call('riya', 'GET', '/payments/gateway');
  assert.equal(data(gw).provider, 'mock');

  const inv = await invoiceFor(riyaCustomer.id);
  const order = await call('riya', 'POST', `/invoices/${inv.id}/checkout`);
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(data(order).provider, 'mock');
  assert.equal(data(order).amount, 1180);
  assert.equal(data(order).amountPaise, 118000);
  assert.match(data(order).orderId, /^order_mock_/);
  assert.equal((await prisma.paymentIntent.findUnique({ where: { providerOrderId: data(order).orderId } })).status, 'CREATED');

  // a declined attempt changes nothing, and the customer can simply try again
  const orderId1 = data(order).orderId;
  const declined = await call('riya', 'POST', `/invoices/${inv.id}/checkout/mock-complete`, { orderId: orderId1, outcome: 'failure' });
  assert.equal(data(declined).status, 'FAILED');
  assert.equal((await paymentsOf(inv.id)).length, 0);
  assert.equal((await prisma.invoice.findUnique({ where: { id: inv.id } })).status, 'CONFIRMED');

  const second = data(await call('riya', 'POST', `/invoices/${inv.id}/checkout`));
  const paid = await call('riya', 'POST', `/invoices/${inv.id}/checkout/mock-complete`, { orderId: second.orderId, outcome: 'success', method: 'UPI' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(data(paid).status, 'PAID');
  const after = await prisma.invoice.findUnique({ where: { id: inv.id } });
  assert.equal(after.status, 'PAID');
  assert.equal(Number(after.amountPaid), 1180);
  const pays = await paymentsOf(inv.id);
  assert.equal(pays.length, 1);
  assert.equal(pays[0].method, 'UPI');
  assert.equal(Number(pays[0].amount), 1180);
  assert.match(pays[0].note, /Online payment pay_mock_/);

  // completing the same order again is harmless
  const again = await call('riya', 'POST', `/invoices/${inv.id}/checkout/mock-complete`, { orderId: second.orderId, outcome: 'success' });
  assert.equal(data(again).already, true);
  assert.equal((await paymentsOf(inv.id)).length, 1);
  assert.equal((await call('riya', 'POST', `/invoices/${inv.id}/checkout`)).status, 409, 'nothing left to pay');
});

t('only what is still owed is charged, and only on your own confirmed invoice', async () => {
  const part = await invoiceFor(riyaCustomer.id, { total: 5000, paid: 3200 });
  assert.equal(data(await call('riya', 'POST', `/invoices/${part.id}/checkout`)).amount, 1800);

  const draft = await invoiceFor(riyaCustomer.id, { status: 'DRAFT' });
  assert.equal((await call('riya', 'POST', `/invoices/${draft.id}/checkout`)).status, 409);

  const other = await prisma.customer.create({ data: { name: `Other ${tag}`, email: `other.${tag}@example.com` } });
  const theirs = await invoiceFor(other.id);
  assert.equal((await call('riya', 'POST', `/invoices/${theirs.id}/checkout`)).status, 404, 'cannot open a payment for someone else');
  const order = data(await call('staff', 'POST', `/invoices/${theirs.id}/checkout`)); // staff may start one for a customer
  assert.equal(order.amount, 1180);
  assert.equal((await call('riya', 'POST', `/invoices/${theirs.id}/checkout/mock-complete`, { orderId: order.orderId, outcome: 'success' })).status, 404);
  assert.equal((await call('riya', 'POST', '/invoices/999999/checkout')).status, 404);
});

t('two completions at the same instant still record one payment', async () => {
  const inv = await invoiceFor(riyaCustomer.id);
  const { orderId } = data(await call('riya', 'POST', `/invoices/${inv.id}/checkout`));
  const results = await Promise.all([1, 2, 3].map((i) => settleIntent({ orderId, paymentId: `pay_race_${i}`, method: 'UPI' })));
  assert.equal(results.filter((r) => !r.already).length, 1, 'exactly one of them did the work');
  assert.equal((await paymentsOf(inv.id)).length, 1);
  assert.equal((await prisma.invoice.findUnique({ where: { id: inv.id } })).status, 'PAID');
});

t('money that arrives for an invoice already settled by hand is flagged for review, not lost or doubled', async () => {
  const inv = await invoiceFor(riyaCustomer.id);
  const { orderId } = data(await call('riya', 'POST', `/invoices/${inv.id}/checkout`));
  const manual = await call('staff', 'POST', `/invoices/${inv.id}/payments`, { method: 'CASH', amount: 1180, paymentDate: new Date().toISOString().slice(0, 10) });
  assert.equal(manual.status, 201);

  const r = await call('riya', 'POST', `/invoices/${inv.id}/checkout/mock-complete`, { orderId, outcome: 'success' });
  assert.equal(r.status, 200);
  assert.equal(data(r).status, 'REVIEW');
  assert.equal((await paymentsOf(inv.id)).length, 1, 'no second payment on the invoice');
  const intent = await prisma.paymentIntent.findUnique({ where: { providerOrderId: orderId } });
  assert.equal(intent.status, 'REVIEW');
  assert.ok(intent.providerPaymentId && intent.note);

  const list = await call('staff', 'GET', '/payments/intents?status=REVIEW');
  assert.ok(data(list).some((x) => x.providerOrderId === orderId), 'staff can see it');
  assert.equal((await call('riya', 'GET', '/payments/intents')).status, 403);
});

t('online payment is off in production unless a real gateway is configured', async () => {
  const saved = env.PAYMENT_GATEWAY;
  env.PAYMENT_GATEWAY = 'none';
  try {
    const inv = await invoiceFor(riyaCustomer.id);
    assert.equal(data(await call('riya', 'GET', '/payments/gateway')).provider, null);
    assert.equal((await call('riya', 'POST', `/invoices/${inv.id}/checkout`)).status, 503);
    // the no-money shortcut is closed too
    assert.equal((await call('riya', 'POST', `/invoices/${inv.id}/pay`, { amount: 1180, method: 'UPI' })).status, 403);
    assert.equal((await prisma.invoice.findUnique({ where: { id: inv.id } })).status, 'CONFIRMED');
  } finally {
    env.PAYMENT_GATEWAY = saved;
  }
});

// ---------------------------------------------------------------- Razorpay (its HTTP API is replaced by a stub)

t('Razorpay: order, signed browser confirmation, and signed webhook all agree and never double-pay', async () => {
  const saved = { id: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET, hook: env.RAZORPAY_WEBHOOK_SECRET };
  env.RAZORPAY_KEY_ID = 'rzp_test_abc';
  env.RAZORPAY_KEY_SECRET = 'key_secret_xyz';
  env.RAZORPAY_WEBHOOK_SECRET = 'hook_secret_xyz';
  const realFetch = globalThis.fetch;
  const razorpayCalls = [];
  let orderSeq = 0;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.razorpay.com')) return realFetch(url, init);
    razorpayCalls.push({ url: String(url), init });
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (String(url).endsWith('/orders')) return json({ id: `order_RZP${tag}${++orderSeq}` });
    return json({ id: 'pay_x', method: 'upi', status: 'captured' });
  };
  const webhook = (event, secret = env.RAZORPAY_WEBHOOK_SECRET) => {
    const raw = JSON.stringify(event);
    return realFetch(`${base}/api/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': signWebhook(raw, secret) }, body: raw });
  };
  try {
    assert.equal(data(await call('riya', 'GET', '/payments/gateway')).provider, 'razorpay');
    assert.equal(data(await call('riya', 'GET', '/payments/gateway')).keyId, 'rzp_test_abc');
    assert.equal(JSON.stringify(await call('riya', 'GET', '/payments/gateway')).includes('key_secret_xyz'), false, 'the secret never leaves the server');

    // 1. create the order: the amount sent to Razorpay is in paise, with Basic auth
    const inv = await invoiceFor(riyaCustomer.id, { total: 2360 });
    const order = data(await call('riya', 'POST', `/invoices/${inv.id}/checkout`));
    assert.equal(order.provider, 'razorpay');
    assert.equal(order.keyId, 'rzp_test_abc');
    const sent = JSON.parse(razorpayCalls.find((c) => c.url.endsWith('/orders')).init.body);
    assert.equal(sent.amount, 236000);
    assert.equal(sent.currency, 'INR');
    assert.equal(sent.receipt, inv.number);
    assert.match(razorpayCalls[0].init.headers.Authorization, /^Basic /);

    // 2. the browser reports success; a wrong signature is refused and records nothing
    const bad = await call('riya', 'POST', `/invoices/${inv.id}/checkout/verify`, { orderId: order.orderId, paymentId: 'pay_Z1', signature: 'f'.repeat(64) });
    assert.equal(bad.status, 400);
    assert.equal((await paymentsOf(inv.id)).length, 0);
    const good = await call('riya', 'POST', `/invoices/${inv.id}/checkout/verify`, { orderId: order.orderId, paymentId: 'pay_Z1', signature: signCheckout(order.orderId, 'pay_Z1', 'key_secret_xyz') });
    assert.equal(good.status, 200, JSON.stringify(good.body));
    assert.equal(data(good).status, 'PAID');
    const pays = await paymentsOf(inv.id);
    assert.equal(pays.length, 1);
    assert.equal(pays[0].method, 'UPI', 'method comes from Razorpay');
    assert.equal(Number(pays[0].amount), 2360);

    // 3. the webhook for the same payment arrives afterwards: acknowledged, nothing doubled
    const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_Z1', order_id: order.orderId, method: 'upi' } } } };
    assert.equal((await webhook(event)).status, 200);
    assert.equal((await webhook(event)).status, 200, 'Razorpay retries are safe');
    assert.equal((await paymentsOf(inv.id)).length, 1);

    // 4. webhook first (browser closed before confirming), then the browser call: still one payment
    const inv2 = await invoiceFor(riyaCustomer.id, { total: 700 });
    const o2 = data(await call('riya', 'POST', `/invoices/${inv2.id}/checkout`));
    const hook = await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_W2', order_id: o2.orderId, method: 'card' } } } });
    assert.equal(hook.status, 200);
    assert.equal((await prisma.invoice.findUnique({ where: { id: inv2.id } })).status, 'PAID', 'the webhook alone completes the payment');
    assert.equal((await paymentsOf(inv2.id))[0].method, 'CARD');
    const late = await call('riya', 'POST', `/invoices/${inv2.id}/checkout/verify`, { orderId: o2.orderId, paymentId: 'pay_W2', signature: signCheckout(o2.orderId, 'pay_W2', 'key_secret_xyz') });
    assert.equal(data(late).already, true);
    assert.equal((await paymentsOf(inv2.id)).length, 1);

    // 5. forged and unrelated webhooks
    const inv3 = await invoiceFor(riyaCustomer.id, { total: 500 });
    const o3 = data(await call('riya', 'POST', `/invoices/${inv3.id}/checkout`));
    const forged = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_F', order_id: o3.orderId, method: 'upi' } } } };
    assert.equal((await webhook(forged, 'attacker_secret')).status, 400, 'wrong signature');
    const raw = JSON.stringify(forged);
    assert.equal((await realFetch(`${base}/api/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw })).status, 400, 'no signature');
    assert.equal((await prisma.invoice.findUnique({ where: { id: inv3.id } })).status, 'CONFIRMED', 'a forged webhook pays nothing');
    assert.equal((await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_U', order_id: 'order_unknown', method: 'upi' } } } })).status, 200, 'unknown orders are acknowledged and ignored');

    // 6. a failed payment is recorded as failed and leaves the invoice payable
    assert.equal((await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_N', order_id: o3.orderId, error_description: 'Card declined' } } } })).status, 200);
    const failed = await prisma.paymentIntent.findUnique({ where: { providerOrderId: o3.orderId } });
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.note, 'Card declined');
    assert.equal(data(await call('riya', 'POST', `/invoices/${inv3.id}/checkout`)).amount, 500, 'can try again');

    // the verify endpoint only exists for the real gateway
    env.RAZORPAY_KEY_ID = '';
    env.RAZORPAY_KEY_SECRET = '';
    assert.equal((await call('riya', 'POST', `/invoices/${inv3.id}/checkout/verify`, { orderId: o3.orderId, paymentId: 'pay_Q1', signature: 'a'.repeat(64) })).status, 404);
  } finally {
    globalThis.fetch = realFetch;
    env.RAZORPAY_KEY_ID = saved.id;
    env.RAZORPAY_KEY_SECRET = saved.secret;
    env.RAZORPAY_WEBHOOK_SECRET = saved.hook;
  }
});
