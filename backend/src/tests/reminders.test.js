import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSmtpSink } from './helpers/smtp-sink.js';

// Automatic reminders: due soon, overdue (1/7/14/30 days), renewals. Real database, real e-mail path.
const sink = await startSmtpSink();
const { app } = await import('../app.js');
const { prisma } = await import('../lib/prisma.js');
const { runReminders, withinSendingWindow } = await import('../modules/reminders/reminders.service.js');
const { todayIn, addDays } = await import('../lib/billing-core.js');

const today = todayIn('Asia/Kolkata');
const tag = Date.now().toString(36);
let skip = false;
let server;
let base;
const sess = {};

const call = async (who, method, path, body) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: sess[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (who, email, password) => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  sess[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};

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
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  sink.close();
  await prisma.$disconnect();
});
const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

const customer = (label) => prisma.customer.create({ data: { name: `${label} ${tag}`, email: `${label.toLowerCase()}.${tag}@example.com` } });
let seq = 0;
const invoice = (cust, { dueIn, status = 'CONFIRMED', total = 1000, paid = 0 }) => prisma.invoice.create({
  data: {
    number: `REM/${tag}/${++seq}`, customerId: cust.id, status, invoiceDate: addDays(today, dueIn - 15), dueDate: addDays(today, dueIn),
    amountSubtotal: total, amountUntaxed: total, amountTax: 0, amountTotal: total, amountPaid: paid,
  },
});
const logs = (cust) => prisma.notificationLog.findMany({ where: { customerId: cust.id }, orderBy: { id: 'asc' } });

t('only sends during the day', () => {
  const at = (h) => new Date(`2026-10-31T${String(h).padStart(2, '0')}:30:00+05:30`);
  assert.equal(withinSendingWindow(at(0), 'Asia/Kolkata'), false);
  assert.equal(withinSendingWindow(at(8), 'Asia/Kolkata'), false);
  assert.equal(withinSendingWindow(at(9), 'Asia/Kolkata'), true);
  assert.equal(withinSendingWindow(at(20), 'Asia/Kolkata'), true);
  assert.equal(withinSendingWindow(at(21), 'Asia/Kolkata'), false);
});

t('due-soon and overdue reminders: right stage, right invoices, never twice', async () => {
  const c = await customer('Dunning');
  const soon = await invoice(c, { dueIn: 2 });
  const late8 = await invoice(c, { dueIn: -8 });
  const ancient = await invoice(c, { dueIn: -40 });
  await invoice(c, { dueIn: -10, status: 'PAID', paid: 1000 }); // paid: never
  await invoice(c, { dueIn: -10, status: 'DRAFT' }); //            draft: never
  await invoice(c, { dueIn: -10, status: 'CANCELLED' }); //        cancelled: never
  await invoice(c, { dueIn: -10, paid: 1000 }); //                 nothing left to pay: never
  await invoice(c, { dueIn: 10 }); //                              not near enough: never

  const first = await runReminders(today, { customerId: c.id });
  assert.ok(first.dueSoon >= 1 && first.overdue >= 2);
  const rows = await logs(c);
  assert.equal(rows.length, 3, 'one e-mail per qualifying invoice, nothing for paid/draft/cancelled/settled/far-off');
  const byInv = Object.fromEntries(rows.map((r) => [r.invoiceId, r]));
  assert.equal(byInv[soon.id].kind, 'INVOICE_DUE_SOON');
  assert.equal(byInv[late8.id].stage, 7, '8 days late -> the 7-day stage');
  assert.equal(byInv[ancient.id].stage, 30, '40 days late -> one 30-day e-mail, not four');

  const mail = await sink.wait(c.email, (m) => m.includes(late8.number));
  assert.ok(mail, 'overdue e-mail reached the customer');
  assert.match(mail, /overdue/i);
  assert.match(mail, new RegExp(`/portal/invoices/${late8.id}`), 'links straight to the invoice');
  assert.ok(sink.to(c.email).some((m) => m.includes(soon.number) && /due/i.test(m)));

  const again = await runReminders(today, { customerId: c.id });
  assert.equal(again.dueSoon + again.overdue, 0, 'a second run the same day sends nothing');
  assert.equal((await logs(c)).length, 3);

  // a week later the 8-day-late invoice reaches the 14-day stage, the ancient one is already at the last stage
  const week = await runReminders(addDays(today, 7), { customerId: c.id });
  assert.ok(week.overdue >= 1);
  const stages = (await logs(c)).filter((r) => r.invoiceId === late8.id).map((r) => r.stage).sort((a, b) => a - b);
  assert.deepEqual(stages, [7, 14]);
  assert.equal((await logs(c)).filter((r) => r.invoiceId === ancient.id).length, 1);
});

t('a part-paid invoice mentions only what is still owed', async () => {
  const c = await customer('Partial');
  await invoice(c, { dueIn: -3, total: 5000, paid: 3200 });
  await runReminders(today, { customerId: c.id });
  const mail = await sink.wait(c.email);
  assert.match(mail, /1,800\.00/);
  assert.doesNotMatch(mail, /5,000\.00/);
});

t('a failed send is retried on the next run instead of being lost', async () => {
  const c = await customer('Flaky');
  const inv = await invoice(c, { dueIn: -2 });
  const failing = await runReminders(today, { send: async () => false, customerId: c.id });
  assert.ok(failing.failed >= 1);
  assert.equal((await logs(c)).length, 0, 'the reservation is given back when sending fails');
  const ok = await runReminders(today, { customerId: c.id });
  assert.ok(ok.overdue >= 1);
  assert.equal((await logs(c)).length, 1);
  assert.ok(await sink.wait(c.email, (m) => m.includes(inv.number)));
});

t('renewal reminders: 30 and 7 days before expiry, only for renewable plans, once per expiry date', async () => {
  const c = await customer('Renewing');
  const product = await prisma.product.create({ data: { name: `Rem Product ${tag}`, salesPrice: 100 } });
  const mkPlan = (name, renewable) => prisma.plan.create({ data: { name: `${name} ${tag}`, productId: product.id, price: 100, billingPeriod: 'MONTHLY', startDate: new Date('2025-01-01'), renewable } });
  const renewable = await mkPlan('Rn', true);
  const fixed = await mkPlan('Fixed', false);
  const term = await prisma.paymentTerm.findFirst();
  const mkSub = (plan, expiry, n) => prisma.subscription.create({
    data: { number: `SUB/REM/${tag}/${n}`, customerId: c.id, planId: plan.id, paymentTermId: term.id, status: 'ACTIVE', startDate: addDays(today, -300), expiryDate: addDays(today, expiry), nextInvoiceDate: null },
  });
  const in20 = await mkSub(renewable, 20, 1);
  const in5 = await mkSub(renewable, 5, 2);
  await mkSub(fixed, 5, 3); //   plan cannot be renewed: no reminder
  await mkSub(renewable, 90, 4); // too far away

  const r = await runReminders(today, { customerId: c.id });
  assert.ok(r.renewals >= 2);
  const rows = (await logs(c)).filter((x) => x.kind === 'RENEWAL_UPCOMING');
  assert.equal(rows.length, 2);
  assert.equal(rows.find((x) => x.subscriptionId === in20.id).stage, 30);
  assert.equal(rows.find((x) => x.subscriptionId === in5.id).stage, 7);
  const mail = await sink.wait(c.email, (m) => m.includes(in5.number));
  assert.match(mail, /renew/i);
  assert.match(mail, new RegExp(`/portal/subscriptions/${in5.id}`));

  assert.equal((await runReminders(today, { customerId: c.id })).renewals, 0, 'not twice');
  // 15 days later the first one is inside the 7-day window and gets its second reminder
  assert.ok((await runReminders(addDays(today, 15), { customerId: c.id })).renewals >= 1);
  // after a renewal the expiry moves, so the next cycle can be reminded again
  await prisma.subscription.update({ where: { id: in5.id }, data: { expiryDate: addDays(today, 400) } });
  assert.equal((await logs(c)).filter((x) => x.subscriptionId === in5.id).length, 1);
});

t('a run can be limited to one customer, and the per-run cap defers the rest instead of dropping them', async () => {
  const c = await customer('Capped');
  await invoice(c, { dueIn: -3 });
  await invoice(c, { dueIn: -9 });
  await invoice(c, { dueIn: -20 });
  const other = await customer('Bystander');
  await invoice(other, { dueIn: -3 });

  const first = await runReminders(today, { customerId: c.id, limit: 2 });
  assert.equal(first.overdue, 2);
  assert.equal(first.deferred, 1, 'one is kept for the next run');
  assert.equal((await logs(other)).length, 0, 'other customers are not touched');
  const second = await runReminders(today, { customerId: c.id, limit: 2 });
  assert.equal(second.overdue, 1);
  assert.equal(second.deferred, 0);
  assert.equal((await logs(c)).length, 3);
});

t('when the mail server is down a run gives up after a few failures instead of grinding through everything', async () => {
  const c = await customer('Outage');
  for (let i = 1; i <= 12; i++) await invoice(c, { dueIn: -i });
  let attempts = 0;
  const down = await runReminders(today, { customerId: c.id, send: async () => { attempts += 1; return false; } });
  assert.equal(attempts, 5, 'stops after five failures in a row');
  assert.equal(down.mailDown, true);
  assert.equal(down.failed, 5);
  assert.equal(down.deferred, 7, 'the rest are left for the next run');
  assert.equal((await logs(c)).length, 0, 'nothing is marked as sent');
  const back = await runReminders(today, { customerId: c.id });
  assert.equal(back.mailDown, false);
  assert.equal(back.overdue, 12, 'once mail works, all twelve go out');
});

t('reminder API: staff can read the log, only admin can trigger a run, customers are locked out', async () => {
  const riyaId = (await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } })).id;
  assert.equal((await call('staff', 'GET', '/reminders')).status, 200);
  const list = await call('admin', 'GET', '/reminders?pageSize=5');
  assert.ok(list.body.data.length > 0 && list.body.meta.total >= list.body.data.length);
  assert.equal((await call('staff', 'POST', '/reminders/run')).status, 403);
  const run = await call('admin', 'POST', '/reminders/run', { customerId: riyaId });
  assert.equal(run.status, 200);
  for (const k of ['dueSoon', 'overdue', 'renewals', 'failed']) assert.equal(typeof run.body.data[k], 'number');
  assert.equal((await call('riya', 'GET', '/reminders')).status, 403);
});
