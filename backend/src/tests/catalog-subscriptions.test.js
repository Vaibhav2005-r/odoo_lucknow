import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { runBilling } from '../modules/billing/billing.service.js';

// API-level checks against a real database. Skipped when no database is reachable or not seeded,
// so `npm test` still works on a machine without Postgres.
let server;
let base;
let skip = false;
const tag = Date.now();
const sessions = {};
const ids = {};

async function call(who, method, path, body) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: sessions[who] || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
}

async function login(who, email, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login ${who}`);
  sessions[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

before(async () => {
  try {
    await prisma.user.count();
    if (!(await prisma.user.findUnique({ where: { email: 'admin@brightloop.in' } }))) throw new Error('not seeded');
  } catch (e) {
    skip = `database not ready (${e.message.split('\n')[0]})`;
    return;
  }
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  await login('admin', 'admin@brightloop.in', 'Admin@12345');
  await login('staff', 'staff@brightloop.in', 'Staff@12345');
  await login('riya', 'riya@sharmaretail.in', 'Customer@123');
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
});

const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

t('admin creates a product whose Odoo brand variant adds 560', async () => {
  const gst = await prisma.tax.findFirst({ where: { rate: 18 } });
  const r = await call('admin', 'POST', '/products', {
    name: `Test Suite ${tag}`,
    type: 'SERVICE',
    salesPrice: 1000,
    costPrice: 200,
    notes: 'integration test',
    taxIds: [gst.id],
    variants: [{ attribute: 'Brand', value: 'Odoo', extraPrice: 560 }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(Number(r.body.data.variants[0].extraPrice), 560);
  ids.product = r.body.data.id;
  ids.variant = r.body.data.variants[0].id;

  const dup = await call('admin', 'POST', '/products', {
    name: `Dup ${tag}`,
    salesPrice: 1,
    variants: [{ attribute: 'Brand', value: 'X' }, { attribute: 'brand', value: 'x' }],
  });
  assert.equal(dup.status, 422);

  const addon = await call('admin', 'POST', '/products', {
    name: `Test Addon ${tag}`, type: 'ADDON', salesPrice: 100, taxIds: [gst.id],
  });
  ids.addon = addon.body.data.id;
});

t('only admin may write the catalog; customers cannot read it', async () => {
  const staffWrite = await call('staff', 'POST', '/products', { name: 'Nope nope', salesPrice: 1 });
  assert.equal(staffWrite.status, 403);
  assert.equal((await call('staff', 'GET', '/products')).status, 200);
  assert.equal((await call('riya', 'GET', '/products')).status, 403);
  assert.equal((await call('staff', 'POST', '/plans', {})).status, 403);
});

t('plan validation: dates and minimum quantity', async () => {
  const bad = await call('admin', 'POST', '/plans', {
    name: `Bad ${tag}`, productId: ids.product, price: 10, billingPeriod: 'MONTHLY',
    startDate: '2026-05-01', endDate: '2026-04-01',
  });
  assert.equal(bad.status, 422);

  const r = await call('admin', 'POST', '/plans', {
    name: `Plan ${tag}`, productId: ids.product, price: 1000, billingPeriod: 'MONTHLY',
    minQuantity: 2, startDate: '2025-01-01', pausable: true, renewable: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  ids.plan = r.body.data.id;
  assert.equal((await call('admin', 'POST', '/plans', { ...r.body.data, name: `Plan ${tag}`, startDate: '2025-01-01' })).status, 409);
});

t('quotation template carries plan, payment term, validity and lines', async () => {
  const term = await prisma.paymentTerm.findFirst({ where: { name: '15 Days' } });
  const r = await call('admin', 'POST', '/quotation-templates', {
    name: `Tpl ${tag}`, planId: ids.plan, paymentTermId: term.id, validityDays: 10,
    lines: [{ productId: ids.product, variantId: ids.variant, quantity: 3 }, { productId: ids.addon, quantity: 1 }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.lines.length, 2);
  ids.template = r.body.data.id;
  ids.term = term.id;
});

t('subscription from template: prices, taxes, minimum quantity, whole lifecycle', async () => {
  const customer = await prisma.customer.create({ data: { name: `Cust ${tag}`, email: `c${tag}@example.com` } });
  ids.customer = customer.id;

  const tooFew = await call('staff', 'POST', '/subscriptions', {
    customerId: customer.id, planId: ids.plan, lines: [{ productId: ids.product, quantity: 1 }],
  });
  assert.equal(tooFew.status, 422);

  const created = await call('staff', 'POST', '/subscriptions', { customerId: customer.id, templateId: ids.template });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const sub = created.body.data;
  ids.sub = sub.id;
  assert.equal(sub.status, 'DRAFT');
  assert.match(sub.number, /^SUB\/\d{4}\/\d{5}$/);
  assert.equal(sub.paymentTermId, ids.term);

  // plan price 1000 + Odoo 560 = 1560 x 3, add-on 100 x 1 => 4780; GST 18% => 5640.40
  const base = sub.lines.find((l) => l.productId === ids.product);
  assert.equal(Number(base.unitPrice), 1560);
  assert.equal(Number(sub.amountSubtotal), 4780);
  assert.equal(Number(sub.amountTax), 860.4);
  assert.equal(Number(sub.amountTotal), 5640.4);

  // Draft -> Quotation -> Confirmed -> Active, all by the book
  assert.equal((await call('staff', 'POST', `/subscriptions/${sub.id}/activate`)).status, 409);
  assert.equal((await call('staff', 'POST', `/subscriptions/${sub.id}/send-quotation`)).body.data.status, 'QUOTATION');
  assert.equal((await call('staff', 'POST', `/subscriptions/${sub.id}/send-quotation`)).status, 409);
  const confirmed = await call('staff', 'POST', `/subscriptions/${sub.id}/confirm`);
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.data.status, 'ACTIVE'); // start date is today -> goes live at once

  // billing created exactly one invoice for the first period, and a re-run does not bill twice
  assert.equal(confirmed.body.data.invoices.length, 1);
  await runBilling();
  await runBilling();
  const after = await call('staff', 'GET', `/subscriptions/${sub.id}`);
  assert.equal(after.body.data.invoices.length, 1);
  assert.equal(after.body.data.plan.productId, ids.product); // pages tell the plan line from add-ons by this
  assert.equal(Number(after.body.data.invoices[0].amountTotal), 5640.4);
});

t('add-ons: switch off, the plan line is protected, totals follow', async () => {
  const detail = (await call('staff', 'GET', `/subscriptions/${ids.sub}`)).body.data;
  const addon = detail.lines.find((l) => l.productId === ids.addon);
  const plan = detail.lines.find((l) => l.productId === ids.product);

  assert.equal((await call('staff', 'PATCH', `/subscriptions/${ids.sub}/lines/${plan.id}`, { isActive: false })).status, 409);
  assert.equal((await call('staff', 'DELETE', `/subscriptions/${ids.sub}/lines/${plan.id}`)).status, 409);

  const off = await call('staff', 'PATCH', `/subscriptions/${ids.sub}/lines/${addon.id}`, { isActive: false });
  assert.equal(off.status, 200);
  assert.equal(Number(off.body.data.amountSubtotal), 4680);

  const on = await call('staff', 'PATCH', `/subscriptions/${ids.sub}/lines/${addon.id}`, { isActive: true });
  assert.equal(Number(on.body.data.amountSubtotal), 4780);
  assert.ok(on.body.data.history.some((h) => h.action === 'ADDON_OFF'));
});

t('customers only see their own subscriptions', async () => {
  const list = await call('riya', 'GET', '/subscriptions');
  assert.equal(list.status, 200);
  assert.ok(list.body.data.every((s) => s.customer.email === 'riya@sharmaretail.in'));
  assert.equal((await call('riya', 'GET', `/subscriptions/${ids.sub}`)).status, 404);
  assert.equal((await call('riya', 'POST', `/subscriptions/${ids.sub}/lines`, { productId: ids.addon, quantity: 1 })).status, 404);
  assert.equal((await call('riya', 'POST', '/subscriptions', { customerId: 1, planId: ids.plan })).status, 403);
});

t('pause, resume, renew and close respect the plan rules', async () => {
  assert.equal((await call('staff', 'POST', `/subscriptions/${ids.sub}/pause`)).status, 200);
  assert.equal((await call('staff', 'GET', '/subscriptions?status=PAUSED')).body.data.some((s) => s.id === ids.sub), true);
  assert.equal((await call('staff', 'POST', `/subscriptions/${ids.sub}/resume`)).status, 200);

  const before = (await call('staff', 'GET', `/subscriptions/${ids.sub}`)).body.data;
  const renewed = await call('staff', 'POST', `/subscriptions/${ids.sub}/renew`, {});
  assert.equal(renewed.status, 200, JSON.stringify(renewed.body));
  assert.ok(new Date(renewed.body.data.expiryDate) > new Date(before.expiryDate));
  assert.equal((await call('staff', 'POST', `/subscriptions/${ids.sub}/renew`, { expiryDate: '2000-01-01' })).status, 422);

  const closed = await call('staff', 'POST', `/subscriptions/${ids.sub}/close`, { reason: 'test' });
  assert.equal(closed.body.data.status, 'CLOSED');
  assert.equal((await call('staff', 'POST', `/subscriptions/${ids.sub}/renew`, {})).status, 409);
});

t('in-use catalog rows cannot be deleted, only deactivated', async () => {
  assert.equal((await call('admin', 'DELETE', `/products/${ids.product}`)).status, 409);
  assert.equal((await call('admin', 'DELETE', `/plans/${ids.plan}`)).status, 409);
  const off = await call('admin', 'POST', `/products/${ids.product}/toggle`);
  assert.equal(off.body.data.isActive, false);
  const blocked = await call('staff', 'POST', '/subscriptions', { customerId: ids.customer, planId: ids.plan });
  assert.equal(blocked.status, 422); // inactive product can no longer be sold
  assert.equal((await call('admin', 'DELETE', `/quotation-templates/${ids.template}`)).status, 200);
});
