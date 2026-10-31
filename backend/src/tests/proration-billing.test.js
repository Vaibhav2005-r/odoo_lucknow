import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Proration through the real app and database: charges on increases, credits on decreases, and the billing engine
// taking credits off the next invoice. Expected figures are worked out here from plain date arithmetic.
const { app } = await import('../app.js');
const { prisma } = await import('../lib/prisma.js');
const { billSubscription } = await import('../modules/billing/billing.service.js');
const { todayIn, addDays, addPeriods, fmtDate } = await import('../lib/billing-core.js');

const today = todayIn('Asia/Kolkata');
const DAY = 86_400_000;
const iso = (n) => fmtDate(addDays(today, n));
const tag = Date.now().toString(36);
let skip = false;
let server;
let base;
const sess = {};
const S = {};

const call = async (who, method, path, body) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: sess[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (who, email, password) => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  sess[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};
const data = (r) => r.body.data ?? r.body;
const n = (v) => Number(v);
const paise = (v) => Math.round(Number(v) * 100);

// A monthly subscription that started `daysAgo` days ago: today is day daysAgo+1 of its first (already invoiced) period.
async function liveSub(customer, { daysAgo = 10, lines, plan = S.plan, qty = 2 } = {}) {
  const start = addDays(today, -daysAgo);
  const r = await call('staff', 'POST', '/subscriptions', {
    customerId: customer.id, planId: plan.id, startDate: fmtDate(start), paymentTermId: S.term.id,
    lines: lines || [{ productId: S.service.id, quantity: qty }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const c = await call('staff', 'POST', `/subscriptions/${data(r).id}/confirm`);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const nextStart = addPeriods(start, 'MONTHLY', 1);
  const totalDays = Math.round((nextStart - start) / DAY);
  return { id: data(r).id, start, nextStart, totalDays, daysLeft: totalDays - daysAgo };
}
const prorated = (price, p) => Math.round((price * 100 * p.daysLeft) / p.totalDays) / 100;
const adjustments = (subId) => prisma.invoice.findMany({ where: { subscriptionId: subId, kind: 'ADJUSTMENT' }, include: { lines: true }, orderBy: { id: 'asc' } });
const credits = (subId, status) => prisma.subscriptionCredit.findMany({ where: { subscriptionId: subId, ...(status ? { status } : {}) }, orderBy: { id: 'asc' } });
const lineOf = async (subId, productId) => (await prisma.subscriptionLine.findFirst({ where: { subscriptionId: subId, productId } }));

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
  await login('staff', 'staff@brightloop.in', 'Staff@12345');
  await login('riya', 'riya@sharmaretail.in', 'Customer@123');

  const gst = await prisma.tax.findFirst({ where: { rate: 18, kind: 'GST' } });
  S.service = await prisma.product.create({ data: { name: `Pr Service ${tag}`, salesPrice: 1000, hsnSac: '998314', taxes: { connect: [{ id: gst.id }] } } });
  S.addon = await prisma.product.create({ data: { name: `Pr Addon ${tag}`, type: 'ADDON', salesPrice: 300, hsnSac: '998315', taxes: { connect: [{ id: gst.id }] } } });
  S.addon2 = await prisma.product.create({ data: { name: `Pr Addon Two ${tag}`, type: 'ADDON', salesPrice: 500, taxes: { connect: [{ id: gst.id }] } } });
  S.plan = await prisma.plan.create({ data: { name: `Pr Plan ${tag}`, productId: S.service.id, price: 1000, billingPeriod: 'MONTHLY', minQuantity: 2, startDate: new Date('2025-01-01'), pausable: true } });
  S.term = await prisma.paymentTerm.findFirst({ where: { dueDays: 0 } });
  S.riya = await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } }); // Maharashtra: IGST
  S.local = await prisma.customer.create({ data: { name: `Local ${tag}`, email: `local.${tag}@example.com`, stateCode: '09' } });
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
});
const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

t('a customer adds an add-on mid-period: sees the prorated price first, then is invoiced exactly that', async () => {
  const p = await liveSub(S.riya);
  const unit = prorated(300, p);
  const sub = p.id;

  const preview = await call('riya', 'POST', `/subscriptions/${sub}/changes/preview`, { action: 'add', productId: S.addon.id, quantity: 2 });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  const pv = data(preview);
  assert.equal(pv.applicable, true);
  assert.equal(pv.days, p.daysLeft);
  assert.equal(pv.totalDays, p.totalDays);
  assert.equal(pv.periodEnd, fmtDate(addDays(p.nextStart, -1)));
  const subtotal = paise(unit) * 2;
  const tax = Math.round(subtotal * 0.18);
  assert.equal(paise(pv.charge), subtotal + tax, 'the preview shows the tax-inclusive charge');
  assert.equal(pv.credit, 0);
  assert.equal(pv.items[0].unitPriceProrated, unit);
  assert.equal((await adjustments(sub)).length, 0, 'a preview creates nothing');
  assert.equal(await lineOf(sub, S.addon.id), null);

  const done = await call('riya', 'POST', `/subscriptions/${sub}/lines`, { productId: S.addon.id, quantity: 2 });
  assert.equal(done.status, 201, JSON.stringify(done.body));
  assert.equal(done.body.proration.invoice.status, 'CONFIRMED', 'a customer confirmed the price, so it is ready to pay');
  assert.deepEqual(done.body.proration.items.map((i) => i.total), pv.items.map((i) => i.total), 'what was shown is what was charged');

  const [adj] = await adjustments(sub);
  assert.equal(adj.status, 'CONFIRMED');
  assert.equal(adj.interState, true, 'Maharashtra customer: IGST');
  assert.equal(paise(adj.amountSubtotal), subtotal);
  assert.equal(paise(adj.amountTax), tax);
  assert.equal(paise(adj.amountIgst), tax);
  assert.equal(paise(adj.amountCgst) + paise(adj.amountSgst), 0);
  assert.equal(paise(adj.amountTotal), subtotal + tax);
  assert.equal(adj.periodStart, null, 'an adjustment is not a billing period, so it can never clash with one');
  assert.match(adj.notes, new RegExp(`${p.daysLeft} of ${p.totalDays} days`));
  assert.equal(adj.lines.length, 1);
  assert.equal(adj.lines[0].quantity, 2);
  assert.equal(n(adj.lines[0].unitPrice), unit);
  assert.equal(adj.lines[0].hsnSac, '998315');
  assert.equal(adj.lines[0].taxLabel, 'IGST 18%');
  assert.match(adj.lines[0].description, /prorated/);

  // the subscription's recurring price now includes the add-on, and the NEXT regular invoice charges it in full
  const detail = data(await call('staff', 'GET', `/subscriptions/${sub}`));
  assert.equal(detail.lines.length, 2);
  assert.equal(n(detail.amountSubtotal), 2 * 1000 + 2 * 300);
  await billSubscription(sub, p.nextStart);
  const regular = await prisma.invoice.findFirst({ where: { subscriptionId: sub, kind: 'RECURRING', periodStart: p.nextStart }, include: { lines: true } });
  assert.ok(regular, 'the next period was billed');
  assert.equal(n(regular.amountSubtotal), 2600);
  assert.equal(regular.lines.find((l) => l.productId === S.addon.id).quantity, 2);
  assert.equal(n(regular.lines.find((l) => l.productId === S.addon.id).unitPrice), 300, 'the next period is at the full price');
});

t('staff make the same change: the adjustment is a draft for review, with CGST + SGST for a local customer', async () => {
  const p = await liveSub(S.local);
  const done = await call('staff', 'POST', `/subscriptions/${p.id}/lines`, { productId: S.addon.id, quantity: 1 });
  assert.equal(done.status, 201);
  assert.equal(done.body.proration.invoice.status, 'DRAFT');
  const [adj] = await adjustments(p.id);
  assert.equal(adj.status, 'DRAFT');
  assert.equal(adj.interState, false);
  const unit = prorated(300, p);
  const tax = Math.round(paise(unit) * 0.18);
  assert.equal(paise(adj.amountCgst) + paise(adj.amountSgst), tax);
  assert.ok(Math.abs(paise(adj.amountCgst) - paise(adj.amountSgst)) <= 1);
  assert.equal(adj.lines[0].taxLabel, 'CGST 9% + SGST 9%');
});

t('switching an add-on off gives the unused part back as a credit that the next invoice deducts', async () => {
  const p = await liveSub(S.riya, { lines: [{ productId: S.service.id, quantity: 2 }, { productId: S.addon.id, quantity: 3 }] });
  const sub = p.id;
  const addonLine = await lineOf(sub, S.addon.id);
  const unit = prorated(300, p);
  const creditSubtotal = paise(unit) * 3;
  const creditTax = Math.round(creditSubtotal * 0.18);

  const off = await call('riya', 'PATCH', `/subscriptions/${sub}/lines/${addonLine.id}`, { isActive: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(paise(off.body.proration.credit), creditSubtotal + creditTax);
  assert.equal(off.body.proration.charge, 0);
  assert.equal(off.body.proration.invoice, undefined, 'money owed to the customer is not an invoice');
  assert.equal((await adjustments(sub)).length, 0);

  const [credit] = await credits(sub, 'PENDING');
  assert.equal(credit.quantity, 3);
  assert.equal(n(credit.unitPrice), unit);
  assert.equal(credit.taxes[0].rate, 18);
  assert.equal(fmtDate(credit.periodEnd), fmtDate(addDays(p.nextStart, -1)));
  const detail = data(await call('riya', 'GET', `/subscriptions/${sub}`));
  assert.equal(detail.credits.length, 1, 'the customer can see what is waiting to be deducted');
  assert.equal(n(detail.amountSubtotal), 2000, 'the recurring price drops straight away');

  await billSubscription(sub, p.nextStart);
  const inv = await prisma.invoice.findFirst({ where: { subscriptionId: sub, kind: 'RECURRING', periodStart: p.nextStart }, include: { lines: true } });
  const creditLine = inv.lines.find((l) => l.description.startsWith('Credit: '));
  assert.ok(creditLine, 'a credit line is on the invoice');
  assert.equal(creditLine.quantity, 3);
  assert.equal(n(creditLine.unitPrice), -unit);
  assert.equal(paise(creditLine.subtotal), -creditSubtotal);
  assert.equal(paise(creditLine.taxAmount), -creditTax);
  assert.equal(paise(creditLine.total), -(creditSubtotal + creditTax));
  assert.equal(paise(creditLine.igstAmount), -creditTax, 'the credit reverses IGST, not CGST/SGST');
  assert.equal(creditLine.taxLabel, 'IGST 18%');

  // the invoice is the regular charge minus the credit, and its parts still add up
  assert.equal(paise(inv.amountTotal), 236000 - (creditSubtotal + creditTax));
  assert.equal(paise(inv.amountSubtotal), 200000 - creditSubtotal);
  assert.equal(paise(inv.amountTax), 36000 - creditTax);
  assert.equal(paise(inv.amountIgst), paise(inv.amountTax));
  assert.equal(inv.lines.reduce((a, l) => a + paise(l.total), 0), paise(inv.amountTotal));
  const done = await credits(sub);
  assert.equal(done[0].status, 'APPLIED');
  assert.equal(done[0].invoiceId, inv.id);
  assert.ok(done[0].appliedAt);

  await billSubscription(sub, addPeriods(p.start, 'MONTHLY', 2));
  const third = await prisma.invoice.findFirst({ where: { subscriptionId: sub, periodStart: addPeriods(p.start, 'MONTHLY', 2) }, include: { lines: true } });
  assert.ok(!third.lines.some((l) => l.description.startsWith('Credit: ')), 'a credit is deducted once');
  assert.equal(paise(third.amountTotal), 236000);
});

t('a change and its reversal on the same day cancel out to the paisa', async () => {
  const p = await liveSub(S.local, { daysAgo: 7 });
  const added = await call('staff', 'POST', `/subscriptions/${p.id}/lines`, { productId: S.addon.id, quantity: 4 });
  const charged = paise(added.body.proration.charge);
  const line = await lineOf(p.id, S.addon.id);
  const removed = await call('staff', 'DELETE', `/subscriptions/${p.id}/lines/${line.id}`);
  assert.equal(removed.status, 200);
  assert.equal(paise(removed.body.proration.credit), charged, 'the credit equals the charge');
  assert.equal((await credits(p.id, 'PENDING')).length, 1);
});

t('seats go up and down with a charge or a credit, and the plan minimum still holds', async () => {
  const p = await liveSub(S.local, { qty: 2 });
  const seats = await lineOf(p.id, S.service.id);
  const up = await call('staff', 'PATCH', `/subscriptions/${p.id}/lines/${seats.id}`, { quantity: 5 });
  assert.equal(up.status, 200);
  const unit = prorated(1000, p);
  assert.equal(paise(up.body.proration.charge), 3 * paise(unit) + Math.round(3 * paise(unit) * 0.18), 'three extra seats');
  assert.equal(up.body.proration.items[0].quantity, 3);

  const down = await call('staff', 'PATCH', `/subscriptions/${p.id}/lines/${seats.id}`, { quantity: 3 });
  assert.equal(paise(down.body.proration.credit), 2 * paise(unit) + Math.round(2 * paise(unit) * 0.18), 'two seats given back');
  assert.equal((await call('staff', 'PATCH', `/subscriptions/${p.id}/lines/${seats.id}`, { quantity: 1 })).status, 422, 'below the plan minimum');

  const same = await call('staff', 'PATCH', `/subscriptions/${p.id}/lines/${seats.id}`, { quantity: 3 });
  assert.equal(same.body.proration.applicable, false, 'no change, nothing to prorate');
});

t('where nothing is billed yet there is nothing to prorate', async () => {
  // paused
  const paused = await liveSub(S.local);
  assert.equal((await call('staff', 'POST', `/subscriptions/${paused.id}/pause`)).status, 200);
  const a = await call('staff', 'POST', `/subscriptions/${paused.id}/lines`, { productId: S.addon.id, quantity: 1 });
  assert.equal(a.body.proration.applicable, false);
  assert.match(a.body.proration.reason, /paused/i);
  assert.equal((await adjustments(paused.id)).length, 0);

  // not active yet (quotation)
  const quote = await call('staff', 'POST', '/subscriptions', { customerId: S.local.id, planId: S.plan.id, startDate: iso(0), lines: [{ productId: S.service.id, quantity: 2 }] });
  const q = await call('staff', 'POST', `/subscriptions/${data(quote).id}/lines`, { productId: S.addon.id, quantity: 1 });
  assert.equal(q.status, 201);
  assert.equal(q.body.proration.applicable, false);
  assert.equal((await adjustments(data(quote).id)).length, 0);
  assert.equal(n(data(await call('staff', 'GET', `/subscriptions/${data(quote).id}`)).amountSubtotal), 2300, 'the price is simply part of the offer');

  // the period has not been invoiced yet
  const fresh = await liveSub(S.local);
  await prisma.subscription.update({ where: { id: fresh.id }, data: { nextPeriodIndex: 0 } });
  const f = await call('staff', 'POST', `/subscriptions/${fresh.id}/lines`, { productId: S.addon.id, quantity: 1 });
  assert.equal(f.body.proration.applicable, false);
  assert.match(f.body.proration.reason, /not been invoiced/);
});

t('a credit too big for the next invoice waits, in order, instead of making an invoice negative', async () => {
  const p = await liveSub(S.local, { qty: 2 }); // regular invoices are 2 x 1000 + 18% = 2360
  const mk = (unit, description) => prisma.subscriptionCredit.create({ data: { subscriptionId: p.id, description, quantity: 1, unitPrice: unit, taxes: [{ name: 'GST 18%', rate: 18, kind: 'GST' }] } });
  const c1 = await mk(1000, 'first');   // 1180
  const c2 = await mk(1000, 'second');  // 1180  (fits next to the first: 2360 - 2360 = 0)
  const c3 = await mk(500, 'third');    // 590   (would go below zero)
  await billSubscription(p.id, p.nextStart);
  const inv = await prisma.invoice.findFirst({ where: { subscriptionId: p.id, periodStart: p.nextStart }, include: { lines: true } });
  assert.equal(paise(inv.amountTotal), 0, 'two credits bring this invoice to exactly zero');
  assert.ok(paise(inv.amountTotal) >= 0);
  const state = Object.fromEntries((await credits(p.id)).map((c) => [c.description, c.status]));
  assert.deepEqual(state, { first: 'APPLIED', second: 'APPLIED', third: 'PENDING' });

  await billSubscription(p.id, addPeriods(p.start, 'MONTHLY', 2));
  const next = await prisma.invoice.findFirst({ where: { subscriptionId: p.id, periodStart: addPeriods(p.start, 'MONTHLY', 2) }, include: { lines: true } });
  assert.equal(paise(next.amountTotal), 236000 - 59000, 'the leftover credit is used next time');
  assert.ok((await credits(p.id)).every((c) => c.status === 'APPLIED'));
  void [c1, c2, c3];
});

t('customers may add and switch add-ons but nothing else, and only on their own subscription', async () => {
  const p = await liveSub(S.riya);
  const seats = await lineOf(p.id, S.service.id);
  assert.equal((await call('riya', 'POST', `/subscriptions/${p.id}/lines`, { productId: S.service.id, quantity: 1 })).status, 403, 'not a product, an add-on');
  assert.equal((await call('riya', 'POST', `/subscriptions/${p.id}/lines`, { productId: S.addon.id, quantity: 1, unitPrice: 1 })).status, 403, 'no custom price');
  assert.equal((await call('riya', 'PATCH', `/subscriptions/${p.id}/lines/${seats.id}`, { quantity: 9 })).status, 403, 'the plan line is staff only');
  assert.equal((await call('riya', 'DELETE', `/subscriptions/${p.id}/lines/${seats.id}`)).status, 403);
  assert.equal((await call('riya', 'POST', `/subscriptions/${p.id}/changes/preview`, { action: 'remove', lineId: seats.id })).status, 403);
  assert.equal((await call('riya', 'POST', `/subscriptions/${p.id}/changes/preview`, { action: 'update', lineId: seats.id, quantity: 9 })).status, 403);

  const theirs = await liveSub(S.local);
  assert.equal((await call('riya', 'POST', `/subscriptions/${theirs.id}/changes/preview`, { action: 'add', productId: S.addon.id, quantity: 1 })).status, 404);
  assert.equal((await call('riya', 'POST', `/subscriptions/${theirs.id}/lines`, { productId: S.addon.id, quantity: 1 })).status, 404);
  assert.equal((await adjustments(theirs.id)).length, 0);
  assert.equal((await call('anon', 'POST', `/subscriptions/${p.id}/changes/preview`, { action: 'add', productId: S.addon.id, quantity: 1 })).status, 401);
  assert.equal((await call('riya', 'POST', `/subscriptions/${p.id}/changes/preview`, { action: 'nonsense' })).status, 422);
});

t('a double click cannot be charged twice', async () => {
  const p = await liveSub(S.local, { lines: [{ productId: S.service.id, quantity: 2 }, { productId: S.addon.id, quantity: 1 }] });
  const line = await lineOf(p.id, S.addon.id);
  await prisma.subscriptionLine.update({ where: { id: line.id }, data: { isActive: false } });
  const [a, b] = await Promise.all([1, 2].map(() => call('staff', 'PATCH', `/subscriptions/${p.id}/lines/${line.id}`, { isActive: true })));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal((await adjustments(p.id)).length, 1, 'switched on once, charged once');
  assert.equal([a, b].filter((r) => r.body.proration.applicable).length, 1);
});

t('customers can list the add-ons on offer; invoice lists and PDFs mark prorated adjustments', async () => {
  const list = await call('riya', 'GET', '/products/addons');
  assert.equal(list.status, 200);
  const mine = data(list).find((a) => a.id === S.addon.id);
  assert.ok(mine, 'an active add-on is on offer');
  assert.equal(n(mine.salesPrice), 300);
  assert.equal(mine.taxes[0].rate && n(mine.taxes[0].rate), 18);
  assert.ok(data(list).every((a) => 'name' in a && !('costPrice' in a)), 'cost price is not exposed');
  assert.ok(!data(list).some((a) => a.id === S.service.id), 'only add-ons');
  assert.equal((await call('anon', 'GET', '/products/addons')).status, 401);

  const p = await liveSub(S.riya);
  const added = await call('riya', 'POST', `/subscriptions/${p.id}/lines`, { productId: S.addon.id, quantity: 1 });
  const invId = added.body.proration.invoice.id;
  const inv = data(await call('riya', 'GET', `/invoices/${invId}`));
  assert.equal(inv.kind, 'ADJUSTMENT');
  const rows = data(await call('riya', 'GET', `/invoices?pageSize=20&subscriptionId=${p.id}`));
  assert.ok(rows.some((r) => r.id === invId && r.kind === 'ADJUSTMENT'));
  assert.ok(rows.some((r) => r.kind === 'RECURRING'));

  const pdf = await fetch(`${base}/api/invoices/${invId}/pdf`, { headers: { Cookie: sess.riya } });
  assert.equal(pdf.status, 200);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
});
