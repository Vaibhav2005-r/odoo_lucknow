import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

// Feature-by-feature check of the Brightloop brief against a real, seeded database.
// A small SMTP sink stands in for Mailpit so the e-mail features can be verified too.
// Everything is skipped when the database is not reachable, so `npm test` still works anywhere.

const mails = [];
const smtp = net.createServer((sock) => {
  let inData = false;
  let buf = '';
  sock.write('220 sink ESMTP\r\n');
  const pump = () => {
    for (;;) {
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        mails.push(buf.slice(0, end));
        buf = buf.slice(end + 5);
        inData = false;
        sock.write('250 queued\r\n');
        continue;
      }
      const i = buf.indexOf('\r\n');
      if (i < 0) return;
      const line = buf.slice(0, i).toUpperCase();
      buf = buf.slice(i + 2);
      if (line.startsWith('EHLO') || line.startsWith('HELO')) sock.write('250 sink\r\n');
      else if (line.startsWith('DATA')) { sock.write('354 go\r\n'); inData = true; }
      else if (line.startsWith('QUIT')) { sock.write('221 bye\r\n'); sock.end(); return; }
      else sock.write('250 OK\r\n');
    }
  };
  sock.on('data', (c) => { buf += c.toString('latin1'); pump(); });
  sock.on('error', () => {});
});
await new Promise((r) => smtp.listen(0, '127.0.0.1', r));
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = String(smtp.address().port);

const decode = (raw) => raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const mailsTo = (addr) => mails.map(decode).filter((m) => m.toLowerCase().includes(`to: ${addr.toLowerCase()}`) || m.toLowerCase().includes(`<${addr.toLowerCase()}>`));
const waitMail = async (addr, pred = () => true) => {
  for (let i = 0; i < 40; i++) {
    const hit = mailsTo(addr).filter(pred);
    if (hit.length) return hit.at(-1);
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
};

const { app } = await import('../app.js');
const { prisma } = await import('../lib/prisma.js');
const { runBilling, billSubscription } = await import('../modules/billing/billing.service.js');
const { runDailyJobs } = await import('../jobs/daily.js');
const { autoCloseExpired } = await import('../modules/subscriptions/subscriptions.service.js');
const { todayIn, addDays, fmtDate } = await import('../lib/billing-core.js');

let server;
let base;
let skip = false;
const tag = Date.now().toString(36);
const today = todayIn('Asia/Kolkata');
const iso = (n) => fmtDate(addDays(today, n));
const sess = {};
const S = {}; // shared fixtures

async function call(who, method, path, body) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: sess[who] || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json, res };
}
const keep = (who, res) => { sess[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '); };
async function login(who, email, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login ${who}`);
  keep(who, res);
}
const data = (r) => r.body.data ?? r.body;

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

  // Shared catalog: one taxable product with a plan per billing period
  const gst = await prisma.tax.findFirst({ where: { rate: 18 } });
  const cess = await prisma.tax.create({ data: { name: `Cess ${tag}`, rate: 2 } });
  S.gst = gst; S.cess = cess;
  const product = await prisma.product.create({
    data: { name: `Feat Product ${tag}`, type: 'SERVICE', salesPrice: 1000, costPrice: 100, taxes: { connect: [{ id: gst.id }] } },
  });
  const addon = await prisma.product.create({
    data: { name: `Feat Addon ${tag}`, type: 'ADDON', salesPrice: 500, costPrice: 50, taxes: { connect: [{ id: gst.id }, { id: cess.id }] } },
  });
  S.product = product; S.addon = addon;
  const mkPlan = (name, billingPeriod, extra = {}) => prisma.plan.create({
    data: { name: `${name} ${tag}`, productId: product.id, price: 1000, billingPeriod, startDate: new Date('2025-01-01'), ...extra },
  });
  S.monthly = await mkPlan('Monthly', 'MONTHLY', { pausable: true });
  S.daily = await mkPlan('Daily', 'DAILY');
  S.weekly = await mkPlan('Weekly', 'WEEKLY');
  S.yearly = await mkPlan('Yearly', 'YEARLY');
  S.locked = await mkPlan('Locked', 'MONTHLY', { pausable: false, closable: false, renewable: false });
  S.auto = await mkPlan('Auto', 'MONTHLY', { autoClose: true });
  S.windowed = await mkPlan('Windowed', 'MONTHLY', { startDate: new Date(iso(-10)), endDate: new Date(iso(30)) });
  S.terms = {
    now: await prisma.paymentTerm.findFirst({ where: { dueDays: 0 } }),
    d15: await prisma.paymentTerm.findFirst({ where: { dueDays: 15 } }),
  };
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  smtp.close();
  await prisma.$disconnect();
});

const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));
const newCustomer = (label) => prisma.customer.create({
  data: { name: `${label} ${tag}`, email: `${label.toLowerCase().replace(/\W/g, '')}.${tag}@example.com`, company: `${label} Ltd`, address: 'Lucknow', gstin: '09AAAAA0000A1Z5' },
});
// Creates and confirms a subscription through the API, so it goes live and is billed.
async function liveSub(customer, plan, { qty = 1, start = 0, expiry, discountId, term, lines } = {}) {
  const r = await call('staff', 'POST', '/subscriptions', {
    customerId: customer.id, planId: plan.id, startDate: iso(start), ...(expiry != null ? { expiryDate: iso(expiry) } : {}),
    paymentTermId: (term || S.terms.now).id, ...(discountId ? { discountId } : {}),
    lines: lines || [{ productId: S.product.id, quantity: qty }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const c = await call('staff', 'POST', `/subscriptions/${data(r).id}/confirm`);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  return data(c);
}
const invoicesOf = (subId) => prisma.invoice.findMany({ where: { subscriptionId: subId }, orderBy: { periodStart: 'asc' }, include: { lines: true } });

// ---------------------------------------------------------------- accounts and access

t('signup: unique email, password rules (more than 8 chars, upper, lower, special)', async () => {
  const email = `signup.${tag}@example.com`;
  const body = (password, e = email) => ({ name: 'Sign Up', email: e, password, confirmPassword: password });
  for (const [label, pwd] of [
    ['too short', 'Ab1!'], ['exactly 8 chars', 'Abcdef1!'], ['no uppercase', 'abcdefgh1!'],
    ['no lowercase', 'ABCDEFGH1!'], ['no special character', 'Abcdefgh12'],
  ]) {
    const r = await call('anon', 'POST', '/auth/signup', body(pwd));
    assert.equal(r.status, 422, `${label} must be rejected`);
  }
  assert.equal((await call('anon', 'POST', '/auth/signup', { ...body('Abcdefg1!'), confirmPassword: 'different' })).status, 422);

  const ok = await call('anon', 'POST', '/auth/signup', body('Abcdefg1!'));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.role, 'CUSTOMER');
  assert.ok(ok.body.customerId, 'a customer record is created for the new account');
  keep('newbie', ok.res);

  assert.equal((await call('anon', 'POST', '/auth/signup', body('Abcdefg1!'))).status, 409);
  assert.equal((await call('anon', 'POST', '/auth/signup', body('Abcdefg1!', email.toUpperCase()))).status, 409, 'email is case-insensitive');
  S.newbie = ok.body;
});

t('login, session, logout and deactivated accounts', async () => {
  assert.equal((await call('anon', 'POST', '/auth/login', { email: 'admin@brightloop.in', password: 'wrong' })).status, 401);
  assert.equal((await call('admin', 'GET', '/auth/me')).body.role, 'ADMIN');
  assert.equal((await call('anon', 'GET', '/auth/me')).status, 401);

  const out = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: sess.newbie } });
  assert.match(out.headers.get('set-cookie') || '', /token=;/);
});

t('forgot / reset password: link arrives by e-mail, works once', async () => {
  const email = `signup.${tag}@example.com`;
  const unknown = await call('anon', 'POST', '/auth/forgot-password', { email: `nobody.${tag}@example.com` });
  assert.equal(unknown.status, 200, 'does not reveal whether the email exists');

  assert.equal((await call('anon', 'POST', '/auth/forgot-password', { email })).status, 200);
  const mail = await waitMail(email, (m) => /reset-password\?token=/.test(m));
  assert.ok(mail, 'reset e-mail arrived');
  assert.equal(mailsTo(`nobody.${tag}@example.com`).length, 0);
  const token = /token=([0-9a-f]{64})/.exec(mail)[1];

  const weak = await call('anon', 'POST', '/auth/reset-password', { token, password: 'weak', confirmPassword: 'weak' });
  assert.equal(weak.status, 422);
  const done = await call('anon', 'POST', '/auth/reset-password', { token, password: 'Newpass9!x', confirmPassword: 'Newpass9!x' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal((await call('anon', 'POST', '/auth/reset-password', { token, password: 'Another9!x', confirmPassword: 'Another9!x' })).status, 400, 'link works only once');

  assert.equal((await call('anon', 'POST', '/auth/login', { email, password: 'Abcdefg1!' })).status, 401, 'old password stops working');
  await login('newbie', email, 'Newpass9!x');

  await prisma.passwordResetToken.updateMany({ where: { user: { email } }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await call('anon', 'POST', '/auth/forgot-password', { email });
  const stale = await prisma.passwordResetToken.findFirst({ where: { user: { email }, usedAt: null }, orderBy: { id: 'desc' } });
  await prisma.passwordResetToken.update({ where: { id: stale.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const fresh = (await waitMail(email, (m) => m !== mail)) || '';
  const t2 = /token=([0-9a-f]{64})/.exec(fresh)?.[1];
  assert.ok(t2);
  assert.equal((await call('anon', 'POST', '/auth/reset-password', { token: t2, password: 'Newpass9!x', confirmPassword: 'Newpass9!x' })).status, 400, 'expired link is refused');
});

t('roles: only admin adds staff; staff and customers are limited', async () => {
  const user = { name: 'New Staff', email: `staff.${tag}@brightloop.in`, password: 'Staffer1!x', role: 'STAFF' };
  assert.equal((await call('staff', 'POST', '/users', user)).status, 403, 'staff cannot add staff');
  assert.equal((await call('riya', 'POST', '/users', user)).status, 403);
  const created = await call('admin', 'POST', '/users', user);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  await login('staff2', user.email, user.password);

  assert.equal((await call('admin', 'PATCH', `/users/${data(created).id}`, { isActive: false })).status, 200);
  assert.equal((await call('anon', 'POST', '/auth/login', { email: user.email, password: user.password })).status, 401, 'deactivated staff cannot log in');

  // staff: day-to-day work yes, configuration and billing run no
  assert.equal((await call('staff', 'GET', '/customers')).status, 200);
  assert.equal((await call('staff', 'POST', '/taxes', { name: 'No way', rate: 5 })).status, 403);
  assert.equal((await call('staff', 'POST', '/discounts', { name: 'No way', type: 'FIXED', value: 1, scope: 'SUBSCRIPTION' })).status, 403);
  assert.equal((await call('staff', 'POST', '/billing/run')).status, 403);
  // customers: portal only
  for (const path of ['/customers', '/reports/summary', '/users', '/billing/status', '/taxes']) {
    assert.equal((await call('riya', 'GET', path)).status, 403, `customer blocked from ${path}`);
  }
  assert.equal((await call('anon', 'GET', '/subscriptions')).status, 401);
});

// ---------------------------------------------------------------- discounts: only admin, rules

t('discounts: admin-only, fixed or percentage, validation', async () => {
  const base = { name: `Disc ${tag}`, type: 'PERCENTAGE', value: 10, scope: 'SUBSCRIPTION' };
  assert.equal((await call('admin', 'POST', '/discounts', { ...base, value: 150 })).status, 422, '> 100% rejected');
  assert.equal((await call('admin', 'POST', '/discounts', { ...base, startDate: '2026-05-01', endDate: '2026-04-01' })).status, 422);
  assert.equal((await call('admin', 'POST', '/discounts', { ...base, scope: 'PRODUCT' })).status, 422, 'product scope needs products');
  const ok = await call('admin', 'POST', '/discounts', { ...base, minPurchase: 100, minQuantity: 1, usageLimit: 5 });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

// ---------------------------------------------------------------- billing

t('billing: a monthly subscription started months ago is caught up, once, with everything filled in', async () => {
  const cust = await newCustomer('Billing Co');
  const sub = await liveSub(cust, S.monthly, { qty: 2, start: -65, term: S.terms.d15 });
  assert.equal(sub.status, 'ACTIVE');

  const invoices = await invoicesOf(sub.id);
  assert.equal(invoices.length, 3, 'periods starting -65, -35 and -5 days');
  for (const inv of invoices) {
    assert.match(inv.number, /^INV\/\d{4}\/\d{5}$/);
    assert.equal(inv.status, 'DRAFT');
    assert.equal(inv.customerId, cust.id);
    assert.equal(inv.customerSnapshot.name, cust.name, 'customer details are filled in');
    assert.equal(inv.customerSnapshot.gstin, cust.gstin);
    assert.equal(inv.lines.length, 1);
    assert.equal(Number(inv.lines[0].unitPrice), 1000);
    assert.equal(inv.lines[0].quantity, 2);
    assert.equal(Number(inv.amountSubtotal), 2000);
    assert.equal(Number(inv.amountTax), 360, 'GST 18% calculated automatically');
    assert.equal(Number(inv.amountTotal), 2360);
    assert.equal(Math.round((inv.dueDate - inv.invoiceDate) / 86400000), 15, 'payment term sets the due date');
  }
  // consecutive periods, no gaps
  for (let i = 1; i < invoices.length; i++) {
    assert.equal(fmtDate(addDays(invoices[i - 1].periodEnd, 1)), fmtDate(invoices[i].periodStart));
  }

  // nothing is billed twice, even when two runs overlap
  await Promise.all([billSubscription(sub.id), billSubscription(sub.id), runBilling()]);
  await runBilling();
  assert.equal((await invoicesOf(sub.id)).length, 3);
  await assert.rejects(
    prisma.invoice.create({ data: { number: `DUP/${tag}`, subscriptionId: sub.id, customerId: cust.id, invoiceDate: today, dueDate: today, periodStart: invoices[0].periodStart, amountSubtotal: 1, amountUntaxed: 1, amountTax: 0, amountTotal: 1 } }),
    (e) => e.code === 'P2002', 'database refuses a second invoice for the same period',
  );
  S.billing = { cust, sub, invoices };
});

t('billing: daily, weekly and yearly periods', async () => {
  const cust = await newCustomer('Periods Co');
  const daily = await liveSub(cust, S.daily, { start: -3 });
  const weekly = await liveSub(cust, S.weekly, { start: -15 });
  const yearly = await liveSub(cust, S.yearly, { start: -366, expiry: 400 });
  assert.equal((await invoicesOf(daily.id)).length, 4, 'days -3,-2,-1,0');
  assert.equal((await invoicesOf(weekly.id)).length, 3, 'weeks starting -15,-8,-1');
  assert.equal((await invoicesOf(yearly.id)).length, 2, 'year 1 and year 2');
});

t('billing: stops at the expiry date and clips the last period', async () => {
  const cust = await newCustomer('Expiry Co');
  const sub = await liveSub(cust, S.monthly, { start: -40, expiry: 10 });
  const invoices = await invoicesOf(sub.id);
  assert.equal(invoices.length, 2);
  assert.equal(fmtDate(invoices[1].periodEnd), iso(10), 'last period ends on the expiry date');
  assert.equal((await prisma.subscription.findUnique({ where: { id: sub.id } })).nextInvoiceDate, null, 'nothing left to bill');
  await billSubscription(sub.id, addDays(today, 200));
  assert.equal((await invoicesOf(sub.id)).length, 2, 'never billed past expiry');
});

t('pause stops billing; resume skips the paused periods instead of back-billing', async () => {
  const cust = await newCustomer('Pause Co');
  const sub = await liveSub(cust, S.monthly, { start: -65 });
  assert.equal((await call('staff', 'POST', `/subscriptions/${sub.id}/pause`)).status, 200);
  await billSubscription(sub.id, addDays(today, 100));
  assert.equal((await invoicesOf(sub.id)).length, 3, 'paused subscription is not billed');

  await prisma.subscription.update({ where: { id: sub.id }, data: { nextPeriodIndex: 1 } }); // pretend periods 1-2 came due while paused
  const r = await call('staff', 'POST', `/subscriptions/${sub.id}/resume`);
  assert.equal(r.status, 200);
  assert.equal(data(r).isPaused, false);
  assert.equal(data(r).nextPeriodIndex, 3, 'periods that started while paused are skipped');
  await billSubscription(sub.id);
  assert.equal((await invoicesOf(sub.id)).length, 3);
});

t('plan rules: pause / close / renew only where the plan allows, auto-close at expiry', async () => {
  const cust = await newCustomer('Rules Co');
  const locked = await liveSub(cust, S.locked);
  assert.equal((await call('staff', 'POST', `/subscriptions/${locked.id}/pause`)).status, 400);
  assert.equal((await call('staff', 'POST', `/subscriptions/${locked.id}/close`)).status, 400);
  assert.equal((await call('staff', 'POST', `/subscriptions/${locked.id}/renew`, {})).status, 409);

  const auto = await liveSub(cust, S.auto, { start: -45, expiry: -5 });
  assert.equal(auto.status, 'ACTIVE');
  await runDailyJobs();
  assert.equal((await prisma.subscription.findUnique({ where: { id: auto.id } })).status, 'CLOSED', 'plan closes on its own when it ends');
  assert.equal((await autoCloseExpired()), 0, 'idempotent');
  const log = await prisma.subscriptionLog.findFirst({ where: { subscriptionId: auto.id, action: 'AUTO_CLOSED' } });
  assert.ok(log);

  const normal = await liveSub(cust, S.monthly);
  assert.equal((await call('staff', 'POST', `/subscriptions/${normal.id}/close`, { reason: 'because' })).status, 200);
  assert.equal((await prisma.subscription.findUnique({ where: { id: normal.id } })).nextInvoiceDate, null);
});

t('plan availability dates are enforced', async () => {
  const cust = await newCustomer('Window Co');
  const mk = (start) => call('staff', 'POST', '/subscriptions', {
    customerId: cust.id, planId: S.windowed.id, startDate: iso(start), lines: [{ productId: S.product.id, quantity: 1 }],
  });
  assert.equal((await mk(-20)).status, 422, 'before the plan opens');
  assert.equal((await mk(40)).status, 422, 'after the plan closes');
  assert.equal((await mk(0)).status, 201);
});

t('quotation: validity window and customer acceptance from the portal', async () => {
  const riyaCustomer = await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } });
  const tpl = await call('admin', 'POST', '/quotation-templates', {
    name: `Valid ${tag}`, planId: S.monthly.id, validityDays: 5, lines: [{ productId: S.product.id, quantity: 1 }],
  });
  const created = await call('staff', 'POST', '/subscriptions', { customerId: riyaCustomer.id, templateId: data(tpl).id, startDate: iso(0) });
  const id = data(created).id;
  assert.equal(fmtDate(new Date(data(created).quoteValidUntil)), iso(5), 'valid for the template\'s number of days');

  assert.equal((await call('staff', 'POST', `/subscriptions/${id}/send-quotation`)).status, 200);
  const mail = await waitMail('riya@sharmaretail.in', (m) => m.includes('SUB/'));
  assert.ok(mail, 'quotation e-mail reaches the customer');

  // someone else's quotation is invisible
  assert.equal((await call('newbie', 'POST', `/subscriptions/${id}/accept-quote`)).status, 404);

  // an expired quotation can no longer be accepted
  await prisma.subscription.update({ where: { id }, data: { quoteValidUntil: new Date(iso(-1)) } });
  assert.equal((await call('riya', 'POST', `/subscriptions/${id}/accept-quote`)).status, 400);
  await prisma.subscription.update({ where: { id }, data: { quoteValidUntil: new Date(iso(3)) } });
  const ok = await call('riya', 'POST', `/subscriptions/${id}/accept-quote`);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(data(ok).status, 'ACTIVE', 'accepted and started today -> live with first invoice');
  assert.equal((await invoicesOf(id)).length, 1);
});

// ---------------------------------------------------------------- taxes and discounts

t('taxes: several taxes on one product add up and use the admin-defined rates', async () => {
  const cust = await newCustomer('Tax Co');
  const sub = await liveSub(cust, S.monthly, { lines: [{ productId: S.product.id, quantity: 1 }, { productId: S.addon.id, quantity: 2 }] });
  const [inv] = await invoicesOf(sub.id);
  const addonLine = inv.lines.find((l) => l.productId === S.addon.id);
  assert.equal(Number(addonLine.taxRate), 20, 'GST 18% + Cess 2%');
  assert.equal(Number(addonLine.taxAmount), 200, '20% of 2 x 500');
  assert.equal(Number(inv.amountTotal), 1180 + 1200);

  // changing the tax rule changes new subscriptions, not what was already invoiced
  await prisma.tax.update({ where: { id: S.cess.id }, data: { rate: 5 } });
  const again = await liveSub(cust, S.monthly, { lines: [{ productId: S.product.id, quantity: 1 }, { productId: S.addon.id, quantity: 2 }] });
  const [inv2] = await invoicesOf(again.id);
  assert.equal(Number(inv2.lines.find((l) => l.productId === S.addon.id).taxRate), 23);
  await prisma.tax.update({ where: { id: S.cess.id }, data: { rate: 2 } });
});

t('discounts: product rule with minimum quantity, applied automatically', async () => {
  const d = await call('admin', 'POST', '/discounts', {
    name: `Bulk ${tag}`, type: 'PERCENTAGE', value: 10, scope: 'PRODUCT', productIds: [S.addon.id], minQuantity: 5,
  });
  assert.equal(d.status, 201, JSON.stringify(d.body));
  const cust = await newCustomer('Disc Co');
  const small = await liveSub(cust, S.monthly, { lines: [{ productId: S.product.id, quantity: 1 }, { productId: S.addon.id, quantity: 2 }] });
  const big = await liveSub(cust, S.monthly, { lines: [{ productId: S.product.id, quantity: 1 }, { productId: S.addon.id, quantity: 6 }] });
  const [i1] = await invoicesOf(small.id);
  const [i2] = await invoicesOf(big.id);
  assert.equal(Number(i1.amountDiscount), 0, 'below the minimum quantity');
  assert.equal(Number(i2.amountDiscount), 300, '10% of 6 x 500, nobody had to remember it');
  assert.deepEqual(i2.appliedDiscountIds, [data(d).id]);
  assert.equal(Number(i2.lines.find((l) => l.productId === S.addon.id).taxAmount), (3000 - 300) * 0.2, 'tax is charged on the discounted amount');
});

t('discounts: whole-subscription rule, usage limit stops it, expiry and start dates respected', async () => {
  const mk = async (over) => data(await call('admin', 'POST', '/discounts', { type: 'FIXED', value: 100, scope: 'SUBSCRIPTION', minPurchase: 3000, ...over }));
  const limited = await mk({ name: `Limited ${tag}`, usageLimit: 2 });
  const expired = await mk({ name: `Expired ${tag}`, startDate: iso(-60), endDate: iso(-30) });
  const future = await mk({ name: `Future ${tag}`, startDate: iso(30) });
  const cust = await newCustomer('Limit Co');

  const sub = await liveSub(cust, S.monthly, { qty: 4, start: -65, discountId: limited.id });
  const invoices = await invoicesOf(sub.id);
  assert.deepEqual(invoices.map((i) => Number(i.amountDiscount)), [100, 100, 0], 'stops when the usage limit runs out');
  assert.equal((await prisma.discount.findUnique({ where: { id: limited.id } })).usedCount, 2);

  const belowMin = await liveSub(cust, S.monthly, { qty: 2, discountId: limited.id });
  assert.equal(Number((await invoicesOf(belowMin.id))[0].amountDiscount), 0, 'minimum purchase not met');

  for (const dsc of [expired, future]) {
    const s = await liveSub(cust, S.monthly, { qty: 4, discountId: dsc.id });
    assert.equal(Number((await invoicesOf(s.id))[0].amountDiscount), 0, `${dsc.name} must not apply`);
  }

  // cancelling an invoice gives the discount use back
  const [first] = invoices;
  await call('staff', 'POST', `/invoices/${first.id}/confirm`);
  assert.equal((await call('staff', 'POST', `/invoices/${first.id}/cancel`)).status, 200);
  assert.equal((await prisma.discount.findUnique({ where: { id: limited.id } })).usedCount, 1);
});

// ---------------------------------------------------------------- invoices and payments

t('invoices: draft -> confirmed -> paid, cancel rules, bulk confirm', async () => {
  const { sub, invoices, cust } = S.billing;
  const [a, b, c] = invoices;

  assert.equal((await call('staff', 'POST', `/payments`, { invoiceId: a.id, method: 'CASH', amount: 1, paymentDate: iso(0) })).status, 409, 'cannot pay a draft');
  assert.equal((await call('staff', 'POST', `/invoices/${a.id}/confirm`)).status, 200);
  assert.equal((await call('staff', 'POST', `/invoices/${a.id}/confirm`)).status, 409, 'already confirmed');
  const bulk = await call('staff', 'POST', '/invoices/bulk-confirm', { ids: [b.id, c.id, a.id] });
  assert.equal(bulk.body.confirmed, 2);

  // payments: method, amount, date and note against the right invoice
  const over = await call('staff', 'POST', `/invoices/${a.id}/payments`, { method: 'UPI', amount: 2360.01, paymentDate: iso(0) });
  assert.equal(over.status, 422, 'cannot overpay');
  const part = await call('staff', 'POST', `/invoices/${a.id}/payments`, { method: 'UPI', amount: 1000, paymentDate: iso(-1), note: 'first part' });
  assert.equal(part.status, 201, JSON.stringify(part.body));
  let inv = await prisma.invoice.findUnique({ where: { id: a.id } });
  assert.equal(inv.status, 'CONFIRMED');
  assert.equal(Number(inv.amountPaid), 1000);
  assert.equal((await call('staff', 'POST', `/invoices/${a.id}/cancel`)).status, 409, 'invoice with payments cannot be cancelled');

  const rest = await call('staff', 'POST', `/invoices/${a.id}/payments`, { method: 'BANK_TRANSFER', amount: 1360, paymentDate: iso(0), note: 'balance' });
  assert.equal(rest.status, 201);
  inv = await prisma.invoice.findUnique({ where: { id: a.id } });
  assert.equal(inv.status, 'PAID');
  assert.ok(inv.paidAt);
  assert.equal((await call('staff', 'POST', `/invoices/${a.id}/payments`, { method: 'CASH', amount: 1, paymentDate: iso(0) })).status, 409, 'paid invoices take no more payments');

  const pays = await prisma.payment.findMany({ where: { invoiceId: a.id }, orderBy: { id: 'asc' } });
  assert.deepEqual(pays.map((p) => [p.method, Number(p.amount), p.note]), [['UPI', 1000, 'first part'], ['BANK_TRANSFER', 1360, 'balance']]);
  assert.equal(fmtDate(pays[0].paymentDate), iso(-1));
  assert.ok(pays.every((p) => p.customerId === cust.id));

  // a confirmed invoice with no payments can still be cancelled
  const last = (await invoicesOf(sub.id)).at(-1);
  assert.equal(last.id, c.id);
  assert.equal((await call('staff', 'POST', `/invoices/${c.id}/cancel`)).status, 200);
  assert.equal((await prisma.invoice.findUnique({ where: { id: c.id } })).status, 'CANCELLED');
  assert.equal((await call('staff', 'POST', `/invoices/${c.id}/cancel`)).status, 409, 'already cancelled');
});

t('invoices: views (draft, outstanding, overdue, paid, cancelled) and search', async () => {
  const cust = await newCustomer('Views Co');
  const sub = await liveSub(cust, S.monthly, { start: -65 });
  const [p0, p1, p2] = await invoicesOf(sub.id);
  await call('staff', 'POST', '/invoices/bulk-confirm', { ids: [p0.id, p1.id] });
  await prisma.invoice.update({ where: { id: p0.id }, data: { dueDate: new Date(iso(-20)) } }); // overdue
  await call('staff', 'POST', `/invoices/${p1.id}/payments`, { method: 'CASH', amount: 500, paymentDate: iso(0) }); // part paid
  await call('staff', 'POST', `/invoices/${p2.id}/cancel`);
  assert.equal((await prisma.invoice.findUnique({ where: { id: p2.id } })).status, 'CANCELLED');

  const view = async (v) => (await call('staff', 'GET', `/invoices?view=${v}&customerId=${cust.id}&pageSize=100`)).body;
  const ids = async (v) => ((await view(v)).data ?? []).map((i) => i.id);
  assert.deepEqual(await ids('OVERDUE'), [p0.id]);
  assert.deepEqual((await ids('OUTSTANDING')).sort(), [p0.id, p1.id].sort());
  assert.deepEqual(await ids('CANCELLED'), [p2.id]);
  assert.deepEqual(await ids('DRAFT'), []);
  assert.equal((await ids('ALL')).length, 3);
  const search = await call('staff', 'GET', `/invoices?search=${encodeURIComponent(p0.number)}`);
  assert.ok(search.body.data.some((i) => i.id === p0.id));
});

t('invoice e-mail: send and payment reminder reach the customer', async () => {
  const cust = await newCustomer('Mail Co');
  const sub = await liveSub(cust, S.monthly);
  const [inv] = await invoicesOf(sub.id);
  await call('staff', 'POST', `/invoices/${inv.id}/confirm`);
  const sent = await call('staff', 'POST', `/invoices/${inv.id}/send`);
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.ok(await waitMail(cust.email, (m) => m.includes(inv.number)), 'invoice e-mail delivered');
  assert.equal((await call('staff', 'POST', `/invoices/${inv.id}/remind`)).status, 409, 'reminders are for overdue invoices only');
  await prisma.invoice.update({ where: { id: inv.id }, data: { dueDate: new Date(iso(-3)) } });
  const remind = await call('staff', 'POST', `/invoices/${inv.id}/remind`);
  assert.equal(remind.status, 200, JSON.stringify(remind.body));
  assert.ok(await waitMail(cust.email, (m) => /remind|overdue/i.test(m)), 'reminder e-mail delivered');
});

t('customer portal: own invoices only, can pay own invoice, cannot touch others', async () => {
  const riyaCustomer = await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } });
  const mine = await liveSub(riyaCustomer, S.monthly);
  const [inv] = await invoicesOf(mine.id);
  await call('staff', 'POST', `/invoices/${inv.id}/confirm`);

  const list = await call('riya', 'GET', '/invoices?pageSize=100');
  assert.equal(list.status, 200);
  assert.ok(list.body.data.length > 0 && list.body.data.every((i) => i.customerId === riyaCustomer.id || i.customer?.id === riyaCustomer.id));
  assert.equal((await call('riya', 'GET', `/invoices/${inv.id}`)).status, 200);

  const other = S.billing.invoices[0];
  assert.equal((await call('riya', 'GET', `/invoices/${other.id}`)).status, 404, 'other customers\' invoices are invisible');
  assert.equal((await call('riya', 'POST', `/invoices/${other.id}/pay`, { amount: 1 })).status, 404);
  assert.equal((await call('riya', 'POST', `/invoices/${inv.id}/confirm`)).status, 403, 'customers cannot confirm invoices');
  assert.equal((await call('riya', 'POST', `/invoices/${inv.id}/payments`, { method: 'CASH', amount: 1, paymentDate: iso(0) })).status, 403);

  const paid = await call('riya', 'POST', `/invoices/${inv.id}/pay`, { method: 'UPI', amount: Number(inv.amountTotal) });
  assert.equal(paid.status, 201, JSON.stringify(paid.body));
  assert.equal((await prisma.invoice.findUnique({ where: { id: inv.id } })).status, 'PAID');

  const pays = await call('riya', 'GET', '/payments?pageSize=100');
  assert.equal(pays.status, 200);
  assert.ok(pays.body.data.every((p) => p.customerId === riyaCustomer.id || p.customer?.id === riyaCustomer.id));
  const subs = await call('riya', 'GET', '/subscriptions?pageSize=100');
  assert.ok(subs.body.data.every((s) => s.customer.email === 'riya@sharmaretail.in'));
});

t('payments ledger: filter by method and date range', async () => {
  const byMethod = await call('staff', 'GET', '/payments?method=UPI&pageSize=100');
  assert.equal(byMethod.status, 200);
  assert.ok(byMethod.body.data.length > 0 && byMethod.body.data.every((p) => p.method === 'UPI'));
  const range = await call('staff', 'GET', `/payments?from=${iso(0)}&to=${iso(0)}&pageSize=100`);
  assert.ok(range.body.data.every((p) => String(p.paymentDate).slice(0, 10) === iso(0)));
});

// ---------------------------------------------------------------- reports

t('reports: summary figures agree with the underlying records', async () => {
  const r = await call('staff', 'GET', `/reports/summary?from=2000-01-01&to=${iso(0)}`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const s = r.body;

  const active = await prisma.subscription.count({ where: { status: 'ACTIVE', isPaused: false } });
  assert.equal(s.activeSubscriptions, active, 'active subscriptions');
  assert.ok(Math.abs(s.arr - s.mrr * 12) < 0.02, 'ARR = MRR x 12');

  const openInv = await prisma.invoice.findMany({ where: { status: 'CONFIRMED' }, select: { amountTotal: true, amountPaid: true, dueDate: true } });
  const owed = openInv.reduce((a, i) => a + (Number(i.amountTotal) - Number(i.amountPaid)), 0);
  const late = openInv.filter((i) => i.dueDate < today);
  assert.ok(Math.abs(s.outstanding - owed) < 0.02, `outstanding ${s.outstanding} vs ${owed}`);
  assert.equal(s.overdueCount, late.length);
  assert.ok(Math.abs(s.overdueAmount - late.reduce((a, i) => a + (Number(i.amountTotal) - Number(i.amountPaid)), 0)) < 0.02);

  const collected = await prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { lte: today } } });
  assert.ok(Math.abs(s.collected - Number(collected._sum.amount || 0)) < 0.02, 'collected');

  const months = await call('staff', 'GET', '/reports/revenue-by-month');
  assert.equal(months.status, 200);
  assert.ok(Array.isArray(months.body.data ?? months.body));
  assert.equal((await call('staff', 'GET', `/reports/summary?planId=${S.monthly.id}`)).status, 200, 'plan filter');
  assert.equal((await call('staff', 'GET', '/reports/export-summary')).status, 200);
});

t('billing run endpoint and daily job activate due subscriptions', async () => {
  const cust = await newCustomer('Daily Co');
  const r = await call('staff', 'POST', '/subscriptions', {
    customerId: cust.id, planId: S.monthly.id, startDate: iso(0), paymentTermId: S.terms.now.id, lines: [{ productId: S.product.id, quantity: 1 }],
  });
  const id = data(r).id;
  // confirmed but not yet activated (as if its start date was in the future when it was confirmed)
  await prisma.subscription.update({ where: { id }, data: { status: 'CONFIRMED' } });
  assert.equal((await call('admin', 'GET', '/billing/status')).status, 200);
  await runDailyJobs();
  const sub = await prisma.subscription.findUnique({ where: { id } });
  assert.equal(sub.status, 'ACTIVE');
  assert.equal((await invoicesOf(id)).length, 1);
  assert.equal((await call('admin', 'POST', '/billing/run')).status, 202);
});

t('lump-sum payment is spread over the oldest invoices first (reconcile)', async () => {
  const cust = await newCustomer('Reconcile Co');
  const sub = await liveSub(cust, S.monthly, { start: -35 }); // two invoices of 1180
  const [older, newer] = await invoicesOf(sub.id);
  await call('staff', 'POST', '/invoices/bulk-confirm', { ids: [older.id, newer.id] });
  await prisma.invoice.update({ where: { id: older.id }, data: { dueDate: new Date(iso(-10)) } });

  const r = await call('staff', 'POST', '/payments/reconcile', { customerId: cust.id, amount: 1500, method: 'BANK_TRANSFER', paymentDate: iso(0), note: 'lump sum' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const [a, b] = await Promise.all([older, newer].map((i) => prisma.invoice.findUnique({ where: { id: i.id } })));
  assert.equal(a.status, 'PAID', 'oldest invoice settled first');
  assert.equal(Number(b.amountPaid), 320);
  assert.equal(b.status, 'CONFIRMED');
  const extra = await call('staff', 'POST', '/payments/reconcile', { customerId: cust.id, amount: 5000, paymentDate: iso(0) });
  assert.ok(extra.status < 300 && extra.body.unallocatedRemainder === 5000 - 860, 'only what is owed is allocated, the rest is reported back');
  for (const inv of await prisma.invoice.findMany({ where: { customerId: cust.id } })) {
    assert.ok(Number(inv.amountPaid) <= Number(inv.amountTotal), 'no invoice is ever overpaid');
  }
});

t('customers, taxes, payment terms and discount updates', async () => {
  // customers: staff manage, portal customers see and edit only their own profile
  const email = `new.cust.${tag}@example.com`;
  const created = await call('staff', 'POST', '/customers', { name: 'Fresh Customer', email, phone: '9999999999', company: 'Fresh Ltd', gstin: '09AAAAA1111A1Z5' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await call('staff', 'POST', '/customers', { name: 'Fresh Again', email: email.toUpperCase() })).status, 409, 'one customer per email');
  const found = await call('staff', 'GET', '/customers?search=Fresh%20Customer');
  assert.ok(found.body.data.some((c) => c.email === email));
  assert.equal((await call('staff', 'PATCH', `/customers/${data(created).id}`, { phone: '8888888888' })).status, 200);
  assert.equal((await call('riya', 'GET', '/customers/me')).status, 200);
  const mine = await call('riya', 'PATCH', '/customers/me', { phone: '9000000000' });
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  const summary = await call('riya', 'GET', '/customers/portal-summary');
  assert.equal(summary.status, 200);
  assert.ok('outstandingAmount' in data(summary) && 'activeSubscriptions' in data(summary));
  assert.equal((await call('riya', 'GET', `/customers/${data(created).id}`)).status >= 400, true, 'customers cannot open other customers');

  // taxes: admin defines the rules, rate 0-100, unique names
  assert.equal((await call('admin', 'POST', '/taxes', { name: `VAT ${tag}`, rate: 12.5 })).status, 201);
  assert.equal((await call('admin', 'POST', '/taxes', { name: `VAT ${tag}`, rate: 5 })).status, 409);
  assert.equal((await call('admin', 'POST', '/taxes', { name: `Bad ${tag}`, rate: 101 })).status, 422);
  const tax = await prisma.tax.findFirst({ where: { name: `VAT ${tag}` } });
  assert.equal((await call('admin', 'PATCH', `/taxes/${tax.id}`, { isActive: false })).status, 200);
  assert.equal((await call('staff', 'GET', '/taxes?active=true')).body.data.some((x) => x.id === tax.id), false);

  // payment terms
  assert.equal((await call('admin', 'POST', '/payment-terms', { name: `Net ${tag}`, dueDays: 45 })).status, 201);
  assert.equal((await call('admin', 'POST', '/payment-terms', { name: `Neg ${tag}`, dueDays: -1 })).status, 422);
  assert.equal((await call('staff', 'POST', '/payment-terms', { name: `Staff ${tag}`, dueDays: 5 })).status, 403);

  // discounts: admin edits, staff may look but not edit, customers see nothing
  const d = await call('admin', 'POST', '/discounts', { name: `Edit ${tag}`, type: 'FIXED', value: 50, scope: 'SUBSCRIPTION' });
  assert.equal((await call('admin', 'PATCH', `/discounts/${data(d).id}`, { value: 75, isActive: false })).status, 200);
  assert.equal((await call('staff', 'PATCH', `/discounts/${data(d).id}`, { value: 1 })).status, 403);
  assert.equal((await call('staff', 'GET', '/discounts')).status, 200);
  assert.equal((await call('riya', 'GET', '/discounts')).status, 403, 'discount rules are internal');
});
