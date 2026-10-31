import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSmtpSink } from './helpers/smtp-sink.js';
import { isValidGstin, normaliseGstin, placeOfSupply, splitTaxLine, stateFromGstin, taxLabel, GST_STATES } from '../lib/gst.js';

// ---------------------------------------------------------------- pure rules (no database)

test('GSTIN: format, state code and normalisation', () => {
  for (const ok of ['09AABCB1234C1Z7', '27AAAAA0000A1Z5', '29GGGGG1314R9Z6', '97AAAAA0000A1Z5']) assert.equal(isValidGstin(ok), true, ok);
  for (const bad of ['', 'short', '00AABCB1234C1Z7', '39AABCB1234C1Z7', '09AABCB1234C1X7', '09AABCB1234C0Z7', '09AABC1234C1Z7', '09aabcb1234c1z7 x']) {
    assert.equal(isValidGstin(bad), false, `${bad} must be rejected`);
  }
  assert.equal(normaliseGstin('  09aabcb1234c1z7 '), '09AABCB1234C1Z7');
  assert.equal(normaliseGstin('   '), null);
  assert.equal(stateFromGstin('27AAAAA0000A1Z5'), '27');
  assert.equal(stateFromGstin('nonsense'), null);
  assert.equal(GST_STATES['09'], 'Uttar Pradesh');
});

test('place of supply: explicit state, then the GSTIN state, then our own state', () => {
  assert.equal(placeOfSupply({ stateCode: '29', gstin: '27AAAAA0000A1Z5' }, '09'), '29');
  assert.equal(placeOfSupply({ gstin: '27AAAAA0000A1Z5' }, '09'), '27');
  assert.equal(placeOfSupply({}, '09'), '09');
  assert.equal(placeOfSupply(null, '09'), '09');
});

test('same state splits GST into CGST + SGST, another state is all IGST; the paisa never goes missing', () => {
  assert.deepEqual(splitTaxLine({ taxPaise: 36000, taxRate: 18, gstRate: 18, interState: false }), { cgst: 18000, sgst: 18000, igst: 0, other: 0 });
  assert.deepEqual(splitTaxLine({ taxPaise: 36000, taxRate: 18, gstRate: 18, interState: true }), { cgst: 0, sgst: 0, igst: 36000, other: 0 });
  // odd paisa: SGST takes it, CGST + SGST still equals the tax
  const odd = splitTaxLine({ taxPaise: 12345, taxRate: 18, gstRate: 18, interState: false });
  assert.equal(odd.cgst + odd.sgst, 12345);
  assert.ok(odd.sgst - odd.cgst <= 1);
  // GST 18 + cess 2: the cess is not split
  const mixed = splitTaxLine({ taxPaise: 20000, taxRate: 20, gstRate: 18, interState: false });
  assert.deepEqual(mixed, { cgst: 9000, sgst: 9000, igst: 0, other: 2000 });
  assert.equal(mixed.cgst + mixed.sgst + mixed.igst + mixed.other, 20000);
  // no tax, no split
  assert.deepEqual(splitTaxLine({ taxPaise: 0, taxRate: 0, gstRate: 0, interState: false }), { cgst: 0, sgst: 0, igst: 0, other: 0 });
  // totals hold for many amounts and rates
  for (const rate of [5, 12, 18, 28]) {
    for (let tax = 1; tax < 3000; tax += 7) {
      for (const inter of [true, false]) {
        const s = splitTaxLine({ taxPaise: tax, taxRate: rate, gstRate: rate, interState: inter });
        assert.equal(s.cgst + s.sgst + s.igst + s.other, tax);
      }
    }
  }
});

test('tax labels read like an Indian invoice', () => {
  const gst18 = { rate: 18, kind: 'GST', name: 'GST 18%' };
  const cess = { rate: 2, kind: 'OTHER', name: 'Cess 2%' };
  assert.equal(taxLabel([gst18], false), 'CGST 9% + SGST 9%');
  assert.equal(taxLabel([gst18], true), 'IGST 18%');
  assert.equal(taxLabel([{ rate: 5, kind: 'GST', name: 'GST 5%' }], false), 'CGST 2.5% + SGST 2.5%');
  assert.equal(taxLabel([gst18, cess], true), 'IGST 18% + Cess 2%');
  assert.equal(taxLabel([], false), '');
});

// ---------------------------------------------------------------- through the real app and database

const sink = await startSmtpSink();
const { app } = await import('../app.js');
const { prisma } = await import('../lib/prisma.js');
const { env } = await import('../config/env.js');
const { todayIn, addDays, fmtDate } = await import('../lib/billing-core.js');

const today = todayIn('Asia/Kolkata');
const iso = (n) => fmtDate(addDays(today, n));
const tag = Date.now().toString(36);
let skip = false;
let server;
let base;
const sess = {};
const S = {};

const call = async (who, method, path, body) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: sess[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json, res };
};
const login = async (who, email, password) => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200);
  sess[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};
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

  const gst18 = await prisma.tax.findFirst({ where: { rate: 18, kind: 'GST' } });
  S.cess = await prisma.tax.create({ data: { name: `Cess ${tag}`, rate: 2, kind: 'OTHER' } });
  S.service = await prisma.product.create({ data: { name: `GST Service ${tag}`, salesPrice: 1000, hsnSac: '998314', taxes: { connect: [{ id: gst18.id }] } } });
  S.withCess = await prisma.product.create({ data: { name: `GST Cess ${tag}`, salesPrice: 500, hsnSac: '998313', taxes: { connect: [{ id: gst18.id }, { id: S.cess.id }] } } });
  S.plan = await prisma.plan.create({ data: { name: `GST Plan ${tag}`, productId: S.service.id, price: 1000, billingPeriod: 'MONTHLY', startDate: new Date('2025-01-01') } });
  S.term = await prisma.paymentTerm.findFirst({ where: { dueDays: 0 } });
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  sink.close();
  await prisma.$disconnect();
});
const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

const newCustomer = (label, extra = {}) => prisma.customer.create({ data: { name: `${label} ${tag}`, email: `${label.toLowerCase()}.${tag}@example.com`, ...extra } });
async function liveInvoice(customer, lines = [{ productId: S.service.id, quantity: 2 }], extra = {}) {
  const r = await call('staff', 'POST', '/subscriptions', { customerId: customer.id, planId: S.plan.id, startDate: iso(0), paymentTermId: S.term.id, lines, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const c = await call('staff', 'POST', `/subscriptions/${data(r).id}/confirm`);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  return prisma.invoice.findFirst({ where: { subscriptionId: data(r).id }, include: { lines: { orderBy: { id: 'asc' } } } });
}
const n = (v) => Number(v);

t('company details and the state list are served for invoices and forms', async () => {
  const r = await call('riya', 'GET', '/company');
  assert.equal(r.status, 200);
  assert.equal(data(r).gstin, env.COMPANY_GSTIN);
  assert.equal(data(r).stateCode, env.COMPANY_STATE_CODE);
  assert.equal(data(r).states['27'], 'Maharashtra');
  assert.equal((await call('anon', 'GET', '/company')).status, 401);
});

t('customer in our own state: invoice shows CGST + SGST, with HSN/SAC and both GSTINs', async () => {
  const cust = await newCustomer('Local', { stateCode: env.COMPANY_STATE_CODE });
  const inv = await liveInvoice(cust);
  assert.equal(inv.interState, false);
  assert.equal(inv.placeOfSupply, env.COMPANY_STATE_CODE);
  assert.equal(inv.supplierGstin, env.COMPANY_GSTIN);
  assert.equal(n(inv.amountTax), 360); // 2 x 1000 at 18%
  assert.equal(n(inv.amountCgst), 180);
  assert.equal(n(inv.amountSgst), 180);
  assert.equal(n(inv.amountIgst), 0);
  const [l] = inv.lines;
  assert.equal(l.taxLabel, 'CGST 9% + SGST 9%');
  assert.equal(l.hsnSac, '998314');
  assert.equal(n(l.cgstAmount) + n(l.sgstAmount) + n(l.igstAmount) + n(l.otherTaxAmount), n(l.taxAmount));
  assert.equal(inv.customerSnapshot.stateCode, env.COMPANY_STATE_CODE);
});

t('customer in another state (from their GSTIN): all IGST', async () => {
  const r = await call('staff', 'POST', '/customers', { name: `Far ${tag}`, email: `far.${tag}@example.com`, gstin: '27aaaaa0000a1z5' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(data(r).gstin, '27AAAAA0000A1Z5', 'stored in upper case');
  assert.equal(data(r).stateCode, '27', 'state taken from the GSTIN');
  const inv = await liveInvoice(data(r));
  assert.equal(inv.interState, true);
  assert.equal(inv.placeOfSupply, '27');
  assert.equal(n(inv.amountIgst), 360);
  assert.equal(n(inv.amountCgst) + n(inv.amountSgst), 0);
  assert.equal(inv.lines[0].taxLabel, 'IGST 18%');
  assert.equal(n(inv.lines[0].igstAmount), 360);
});

t('a customer with no state is treated as local, and a cess is charged as it is', async () => {
  const cust = await newCustomer('NoState');
  const inv = await liveInvoice(cust, [{ productId: S.service.id, quantity: 1 }, { productId: S.withCess.id, quantity: 4 }]);
  assert.equal(inv.interState, false);
  const cessLine = inv.lines.find((l) => l.productId === S.withCess.id);
  assert.equal(cessLine.taxLabel, `CGST 9% + SGST 9% + Cess ${tag}`);
  // 4 x 500 = 2000: GST 18% = 360 (180 + 180), cess 2% = 40
  assert.equal(n(cessLine.cgstAmount), 180);
  assert.equal(n(cessLine.sgstAmount), 180);
  assert.equal(n(cessLine.otherTaxAmount), 40);
  assert.equal(cessLine.hsnSac, '998313');
  // the invoice header is the sum of its lines, and the parts add up to the tax
  const parts = (k) => inv.lines.reduce((a, l) => a + n(l[k]), 0);
  assert.equal(n(inv.amountCgst), parts('cgstAmount'));
  assert.equal(n(inv.amountSgst), parts('sgstAmount'));
  assert.equal(n(inv.amountOtherTax), parts('otherTaxAmount'));
  assert.equal(Math.round((n(inv.amountCgst) + n(inv.amountSgst) + n(inv.amountIgst) + n(inv.amountOtherTax)) * 100), Math.round(n(inv.amountTax) * 100));
});

t('tax is split on the discounted amount', async () => {
  const d = await call('admin', 'POST', '/discounts', { name: `GST Disc ${tag}`, type: 'FIXED', value: 500, scope: 'SUBSCRIPTION', minPurchase: 1000 });
  const cust = await newCustomer('Discounted', { stateCode: '27' });
  const inv = await liveInvoice(cust, [{ productId: S.service.id, quantity: 4 }], { discountId: data(d).id });
  assert.equal(n(inv.amountDiscount), 500);
  assert.equal(n(inv.amountUntaxed), 3500);
  assert.equal(n(inv.amountTax), 630); // 18% of 3500
  assert.equal(n(inv.amountIgst), 630);
  assert.equal(n(inv.amountTotal), 4130);
});

t('GSTIN and state are validated; customers cannot change their own tax identity', async () => {
  const base = { name: `Valid ${tag}`, email: `valid.${tag}@example.com` };
  assert.equal((await call('staff', 'POST', '/customers', { ...base, gstin: 'NOT-A-GSTIN' })).status, 422);
  assert.equal((await call('staff', 'POST', '/customers', { ...base, stateCode: '99X' })).status, 422);
  const clash = await call('staff', 'POST', '/customers', { ...base, gstin: '27AAAAA0000A1Z5', stateCode: '09' });
  assert.equal(clash.status, 422, 'GSTIN says Maharashtra, form says Uttar Pradesh');
  const blank = await call('staff', 'POST', '/customers', { ...base, gstin: '  ', stateCode: '' });
  assert.equal(blank.status, 201);
  assert.equal(data(blank).gstin, null);
  assert.equal(data(blank).stateCode, null);
  const upd = await call('staff', 'PATCH', `/customers/${data(blank).id}`, { stateCode: '29' });
  assert.equal(data(upd).stateCode, '29');
  assert.equal((await call('staff', 'PATCH', `/customers/${data(blank).id}`, { gstin: '27AAAAA0000A1Z5' })).status, 422, 'GSTIN state 27 vs saved state 29');

  // updating something else leaves the saved GSTIN and state alone
  const keep = await call('staff', 'POST', '/customers', { name: `Keeper ${tag}`, email: `keeper.${tag}@example.com`, gstin: '27AAAAA0000A1Z5' });
  await call('staff', 'PATCH', `/customers/${data(keep).id}`, { phone: '9111111111' });
  const kept = await prisma.customer.findUnique({ where: { id: data(keep).id } });
  assert.equal(kept.gstin, '27AAAAA0000A1Z5');
  assert.equal(kept.stateCode, '27');
  assert.equal(kept.phone, '9111111111');

  const before = await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } });
  const mine = await call('riya', 'PATCH', '/customers/me', { phone: '9000000001', gstin: '27AAAAA0000A1Z5', stateCode: '27' });
  assert.equal(mine.status, 200);
  const after = await prisma.customer.findUnique({ where: { id: before.id } });
  assert.equal(after.phone, '9000000001');
  assert.equal(after.gstin, before.gstin, 'customers cannot edit their GSTIN');
  assert.equal(after.stateCode, before.stateCode, 'or their state');
});

t('products take an HSN/SAC code; taxes have a kind', async () => {
  const mk = (extra) => call('admin', 'POST', '/products', { name: `HSN ${tag} ${Math.random()}`, salesPrice: 10, ...extra });
  assert.equal((await mk({ hsnSac: '12' })).status, 422);
  assert.equal((await mk({ hsnSac: 'abcd' })).status, 422);
  const ok = await mk({ hsnSac: '998314' });
  assert.equal(ok.status, 201);
  assert.equal(data(ok).hsnSac, '998314');
  assert.equal(data(await mk({ hsnSac: '' })).hsnSac, null);

  const tax = await call('admin', 'POST', '/taxes', { name: `Kind ${tag}`, rate: 3, kind: 'OTHER' });
  assert.equal(tax.status, 201);
  assert.equal(data(tax).kind, 'OTHER');
  assert.equal(data(await call('admin', 'PATCH', `/taxes/${data(tax).id}`, { kind: 'GST' })).kind, 'GST');
  assert.equal((await call('admin', 'POST', '/taxes', { name: `Bad ${tag}`, rate: 3, kind: 'VAT' })).status, 422);
});

t('GST summary: totals add up, drafts and cancelled invoices are left out, CSV export works, customers are locked out', async () => {
  // 1. the whole history up to 100 days ago: nothing in the other test files writes invoices that old, so the
  //    report can be compared with the raw records exactly
  const upTo = iso(-100);
  const r = await call('staff', 'GET', `/reports/gst-summary?from=2000-01-01&to=${upTo}`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.supplier.gstin, env.COMPANY_GSTIN);

  const rows = await prisma.invoice.findMany({ where: { status: { in: ['CONFIRMED', 'PAID'] }, invoiceDate: { lte: addDays(today, -100) } } });
  assert.ok(rows.length > 100, 'plenty of history to compare with');
  const sum = (k) => rows.reduce((a, i) => a + n(i[k]), 0);
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, `${msg}: ${a} vs ${b}`);
  near(r.body.totals.cgst, sum('amountCgst'), 'CGST');
  near(r.body.totals.sgst, sum('amountSgst'), 'SGST');
  near(r.body.totals.igst, sum('amountIgst'), 'IGST');
  near(r.body.totals.tax, sum('amountTax'), 'total tax');
  near(r.body.totals.taxable, sum('amountUntaxed'), 'taxable value');
  assert.equal(r.body.totals.invoices, rows.length);
  near(r.body.byMonth.reduce((a, m) => a + m.tax, 0), r.body.totals.tax, 'months add up to the total');
  near(r.body.byRate.reduce((a, x) => a + x.tax, 0), r.body.totals.tax, 'rates add up to the total');
  assert.ok(r.body.byRate.some((x) => x.rate === 18));

  // 2. one made-up day with known invoices. The day is random per run and before the window above (1980-1999),
  //    so repeated runs never collide, and the invoices are removed again afterwards.
  const seed = parseInt(tag, 36);
  const dayDate = new Date(Date.UTC(1980 + (seed % 20), (seed >> 5) % 12, 1 + ((seed >> 9) % 28)));
  const day = dayDate.toISOString().slice(0, 10);
  const cust = await newCustomer('GstReport');
  const mk = (status, tax, parts) => prisma.invoice.create({
    data: {
      number: `GSTR/${tag}/${status}`, customerId: cust.id, status, invoiceDate: dayDate, dueDate: dayDate,
      amountSubtotal: 1000, amountUntaxed: 1000, amountTax: tax, amountTotal: 1000 + tax, ...parts,
      lines: { create: [{ description: 'Fixture', quantity: 1, unitPrice: 1000, subtotal: 1000, taxRate: 18, taxAmount: tax, total: 1000 + tax, cgstAmount: parts.amountCgst ?? 0, sgstAmount: parts.amountSgst ?? 0, igstAmount: parts.amountIgst ?? 0 }] },
    },
  });
  try {
    await mk('CONFIRMED', 100, { amountCgst: 50, amountSgst: 50 });
    await mk('PAID', 36, { amountIgst: 36 });
    await mk('DRAFT', 999, { amountCgst: 999 });
    await mk('CANCELLED', 777, { amountIgst: 777 });
    const one = await call('staff', 'GET', `/reports/gst-summary?from=${day}&to=${day}`);
    assert.deepEqual(
      [one.body.totals.invoices, one.body.totals.taxable, one.body.totals.cgst, one.body.totals.sgst, one.body.totals.igst, one.body.totals.tax],
      [2, 2000, 50, 50, 36, 136],
      'single day, first day of the range included',
    );
    assert.equal(one.body.byMonth.length, 1);
    assert.equal(one.body.byMonth[0].month, day.slice(0, 7));
    const after = new Date(dayDate.getTime() + 86_400_000).toISOString().slice(0, 10);
    const before = new Date(dayDate.getTime() - 86_400_000).toISOString().slice(0, 10);
    assert.equal((await call('staff', 'GET', `/reports/gst-summary?from=${after}&to=${after}`)).body.totals.invoices, 0, 'the next day is outside the range');
    assert.equal((await call('staff', 'GET', `/reports/gst-summary?from=${before}&to=${before}`)).body.totals.invoices, 0, 'the day before is outside too');

    // 3. CSV for the accountant, and access rules
    const csv = await fetch(`${base}/api/reports/export-gst?from=${day}&to=${day}`, { headers: { Cookie: sess.staff } });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.headers.get('content-disposition'), new RegExp(`gst-summary-${day}-to-${day}\\.csv`));
    const body = await csv.text();
    assert.match(body, /GST summary/);
    assert.match(body, new RegExp(env.COMPANY_GSTIN));
    assert.match(body, /"Month","Invoices","Taxable value","CGST","SGST","IGST"/);
    assert.match(body, new RegExp(`"${day.slice(0, 7)}","2","2000.00","50.00","50.00","36.00"`));
  } finally {
    await prisma.invoice.deleteMany({ where: { number: { startsWith: `GSTR/${tag}/` } } });
  }
  assert.equal((await call('riya', 'GET', '/reports/gst-summary')).status, 403);
  assert.equal((await call('staff', 'GET', '/reports/gst-summary')).status, 200, 'defaults to the current financial year');
});

t('a staff-created customer is only attached to a login whose e-mail is verified', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const mkUser = async (label, verified) => prisma.user.create({
    data: { name: label, email: `${label}.${tag}@example.com`, role: 'CUSTOMER', passwordHash: await bcrypt.hash('Passw0rd!x', 10), emailVerifiedAt: verified ? new Date() : null },
  });
  const unverified = await mkUser('unverified', false);
  const verified = await mkUser('verified', true);
  const a = await call('staff', 'POST', '/customers', { name: 'Unverified Co', email: unverified.email });
  const b = await call('staff', 'POST', '/customers', { name: 'Verified Co', email: verified.email });
  assert.equal(data(a).userId, null, 'an unproven login must not inherit the customer');
  assert.equal(data(b).userId, verified.id);
});

t('invoice e-mails escape customer and product text, so a name cannot inject markup', async () => {
  const evil = `<img src=x onerror=alert(1)>${tag}`;
  const cust = await newCustomer('Evil', { name: evil });
  const inv = await liveInvoice(cust);
  await call('staff', 'POST', `/invoices/${inv.id}/confirm`);
  assert.equal((await call('staff', 'POST', `/invoices/${inv.id}/send`)).status, 200);
  const mail = await sink.wait(cust.email, (m) => m.includes(inv.number));
  assert.ok(mail, 'invoice e-mail arrived');
  assert.ok(!mail.includes('<img src=x'), 'raw markup must not appear');
  assert.ok(mail.includes('&lt;img src=x'), 'it appears escaped instead');
});
