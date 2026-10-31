// Large, realistic data set for performance checks: thousands of subscriptions with their invoices
// and payments, inserted in bulk (no billing engine). Run after `npm run seed`:
//   npm run seed:bulk            -> 3000 subscriptions
//   npm run seed:bulk -- 10000   -> 10000 subscriptions
// Safe to re-run: it stops if bulk data is already there.
import { prisma } from '../src/lib/prisma.js';
import { todayIn, addDays, addPeriods, periodBounds, fmtDate } from '../src/lib/billing-core.js';

const COUNT = Math.max(100, Number(process.argv[2]) || 3000);
const today = todayIn();
const year = today.getUTCFullYear();

// small deterministic generator so every run produces the same data
let seed = 20260101;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const money = (n) => Math.round(n * 100) / 100;

async function main() {
  const t0 = Date.now();
  if ((await prisma.customer.count({ where: { email: { endsWith: '@bulk.example' } } })) > 0) {
    console.log('Bulk data already present, nothing to do.');
    return;
  }

  const plans = await prisma.plan.findMany({
    where: { name: { in: ['CRM Monthly', 'CRM Yearly', 'Analytics Weekly'] } },
    include: { product: { include: { taxes: true } } },
  });
  const terms = await prisma.paymentTerm.findMany();
  if (plans.length < 3 || terms.length === 0) throw new Error('Run `npm run seed` first.');

  // customers: one per two subscriptions
  const customerCount = Math.ceil(COUNT / 2);
  const first = ['Aarav', 'Vivaan', 'Aditya', 'Ananya', 'Diya', 'Ishaan', 'Kavya', 'Meera', 'Rohan', 'Saanvi', 'Arjun', 'Neha', 'Karan', 'Pooja', 'Rahul', 'Sneha', 'Vikram', 'Riya', 'Siddharth', 'Tanvi'];
  const last = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Mishra', 'Tiwari', 'Srivastava', 'Yadav', 'Pandey', 'Agarwal', 'Khan', 'Iyer', 'Nair', 'Reddy', 'Mehta', 'Patel', 'Joshi', 'Kapoor', 'Malhotra', 'Bansal'];
  const kind = ['Traders', 'Retail', 'Logistics', 'Clinics', 'Textiles', 'Foods', 'Tech Solutions', 'Enterprises', 'Studios', 'Hardware'];
  const area = ['Gomti Nagar', 'Hazratganj', 'Indira Nagar', 'Aliganj', 'Aminabad', 'Mahanagar', 'Jankipuram', 'Alambagh'];
  await prisma.customer.createMany({
    data: Array.from({ length: customerCount }, (_, i) => {
      const f = first[i % first.length];
      const l = last[Math.floor(i / first.length) % last.length];
      return {
        name: `${f} ${l}`,
        email: `customer${i + 1}@bulk.example`,
        company: `${l} ${kind[(i * 7) % kind.length]}`,
        phone: `98${String(10000000 + i * 37).slice(-8)}`,
        address: `${10 + (i % 90)}, ${area[i % area.length]}, Lucknow, Uttar Pradesh`,
      };
    }),
    skipDuplicates: true,
  });
  const customers = await prisma.customer.findMany({ where: { email: { endsWith: '@bulk.example' } }, select: { id: true, name: true, email: true } });

  // number blocks (continue the existing yearly sequences)
  const seqFor = async (prefix) => (await prisma.sequence.findUnique({ where: { key: `${prefix}/${year}` } }))?.value ?? 0;
  let subNo = await seqFor('SUB');
  let invNo = await seqFor('INV');
  const num = (prefix, n) => `${prefix}/${year}/${String(n).padStart(5, '0')}`;

  // plan every subscription and its invoices in memory first
  const subs = [];
  const invs = [];
  for (let i = 0; i < COUNT; i++) {
    const plan = pick(plans);
    const customer = customers[i % customers.length];
    const roll = rnd();
    const status = roll < 0.82 ? 'ACTIVE' : roll < 0.87 ? 'DRAFT' : roll < 0.92 ? 'QUOTATION' : 'CLOSED';
    const live = status === 'ACTIVE' || status === 'CLOSED';
    const start = live ? addDays(today, -Math.floor(rnd() * 380)) : addDays(today, Math.floor(rnd() * 30));
    const expiry = addDays(addPeriods(start, 'YEARLY', 1), -1);
    const qty = 1 + Math.floor(rnd() * 9);
    const unit = Number(plan.price);
    const taxRate = plan.product.taxes.reduce((a, t) => a + Number(t.rate), 0);
    const subtotal = money(qty * unit);
    const tax = money((subtotal * taxRate) / 100);
    const term = pick(terms);

    let nextIndex = 0;
    const periods = [];
    if (live) {
      for (let k = 0; k < 24; k++) {
        const p = periodBounds(start, plan.billingPeriod, k, expiry);
        if (p.start > today || p.start > expiry) break;
        periods.push(p);
      }
      nextIndex = periods.length;
    }
    const nextStart = addPeriods(start, plan.billingPeriod, nextIndex);

    subNo += 1;
    const number = num('SUB', subNo);
    subs.push({
      number, customerId: customer.id, planId: plan.id, paymentTermId: term.id, status, startDate: start, expiryDate: expiry,
      quoteValidUntil: status === 'QUOTATION' ? addDays(today, 14) : null,
      nextPeriodIndex: nextIndex, nextInvoiceDate: status === 'ACTIVE' && nextStart <= expiry ? nextStart : null,
      amountSubtotal: subtotal, amountUntaxed: subtotal, amountTax: tax, amountTotal: money(subtotal + tax),
      closedAt: status === 'CLOSED' ? addDays(today, -Math.floor(rnd() * 30)) : null,
      closeReason: status === 'CLOSED' ? 'Customer cancelled' : null,
      _meta: { plan, qty, unit, subtotal, tax, taxRate, term, customer, periods, live },
    });
  }

  // insert subscriptions, lines (+ tax links)
  const subIdByNumber = new Map();
  for (const part of chunks(subs, 1000)) {
    const rows = await prisma.subscription.createManyAndReturn({
      data: part.map(({ _meta, ...s }) => s), select: { id: true, number: true },
    });
    rows.forEach((r) => subIdByNumber.set(r.number, r.id));
  }
  const lineData = subs.map((s) => ({
    subscriptionId: subIdByNumber.get(s.number), productId: s._meta.plan.productId, description: s._meta.plan.product.name,
    quantity: s._meta.qty, unitPrice: s._meta.unit, subtotal: s._meta.subtotal, taxAmount: s._meta.tax, total: money(s._meta.subtotal + s._meta.tax),
  }));
  const taxIdsByPlan = new Map(plans.map((p) => [p.id, p.product.taxes.map((t) => t.id)]));
  for (const part of chunks(lineData, 2000)) {
    const rows = await prisma.subscriptionLine.createManyAndReturn({ data: part, select: { id: true, subscriptionId: true } });
    const links = [];
    const planBySub = new Map(subs.map((s) => [subIdByNumber.get(s.number), s.planId]));
    for (const r of rows) for (const taxId of taxIdsByPlan.get(planBySub.get(r.subscriptionId)) || []) links.push(`(${r.id},${taxId})`);
    if (links.length) await prisma.$executeRawUnsafe(`INSERT INTO "_SubscriptionLineToTax" ("A","B") VALUES ${links.join(',')} ON CONFLICT DO NOTHING`);
  }
  await prisma.subscriptionLog.createMany({
    data: subs.map((s) => ({ subscriptionId: subIdByNumber.get(s.number), action: 'CREATED', toStatus: s.status, note: 'Bulk seed' })),
  });

  // invoices, their lines and payments
  for (const s of subs) {
    const m = s._meta;
    const subId = subIdByNumber.get(s.number);
    m.periods.forEach((p, idx) => {
      const age = Math.round((today - p.start) / 86400000);
      const isLast = idx === m.periods.length - 1;
      let status = 'CONFIRMED';
      if (age > 45 && rnd() < 0.92) status = 'PAID';
      else if (isLast && age < 3 && rnd() < 0.5) status = 'DRAFT';
      else if (rnd() < 0.02) status = 'CANCELLED';
      invNo += 1;
      invs.push({
        number: num('INV', invNo), subscriptionId: subId, customerId: s.customerId, status, invoiceDate: p.start,
        dueDate: addDays(p.start, m.term.dueDays || 15), periodStart: p.start, periodEnd: p.end,
        amountSubtotal: m.subtotal, amountUntaxed: m.subtotal, amountTax: m.tax, amountTotal: money(m.subtotal + m.tax),
        amountPaid: status === 'PAID' ? money(m.subtotal + m.tax) : 0,
        customerSnapshot: { name: m.customer.name, email: m.customer.email },
        confirmedAt: status === 'DRAFT' ? null : p.start, paidAt: status === 'PAID' ? addDays(p.start, 5) : null,
        _line: { productId: m.plan.productId, description: m.plan.product.name, quantity: m.qty, unitPrice: m.unit, subtotal: m.subtotal, taxRate: m.taxRate, taxAmount: m.tax, total: money(m.subtotal + m.tax) },
      });
    });
  }
  const methods = ['UPI', 'BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE'];
  let invoiceCount = 0;
  let paymentCount = 0;
  for (const part of chunks(invs, 2000)) {
    const rows = await prisma.invoice.createManyAndReturn({
      data: part.map(({ _line, ...i }) => i), select: { id: true, number: true },
    });
    const idByNumber = new Map(rows.map((r) => [r.number, r.id]));
    await prisma.invoiceLine.createMany({ data: part.map((i) => ({ invoiceId: idByNumber.get(i.number), ..._lineOf(i) })) });
    const pays = part.filter((i) => i.status === 'PAID').map((i) => ({
      invoiceId: idByNumber.get(i.number), customerId: i.customerId, method: pick(methods), amount: i.amountTotal,
      paymentDate: addDays(i.invoiceDate, 1 + Math.floor(rnd() * 12)), note: 'Bulk seed payment',
    }));
    if (pays.length) await prisma.payment.createMany({ data: pays });
    invoiceCount += rows.length;
    paymentCount += pays.length;
  }
  function _lineOf(i) { return i._line; }

  await prisma.sequence.upsert({ where: { key: `SUB/${year}` }, create: { key: `SUB/${year}`, value: subNo }, update: { value: subNo } });
  await prisma.sequence.upsert({ where: { key: `INV/${year}` }, create: { key: `INV/${year}`, value: invNo }, update: { value: invNo } });
  await prisma.$executeRawUnsafe('ANALYZE');

  console.log(`Bulk seed done in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${customerCount} customers, ${COUNT} subscriptions, ${invoiceCount} invoices, ${paymentCount} payments (through ${fmtDate(today)}).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
