import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../lib/prisma.js';

// "With thousands of subscriptions on the books, every page should respond in under two seconds."
// Needs the bulk data set (`npm run seed:bulk`); skipped when the database is small or unreachable.
const LIMIT_MS = 2000;
let server;
let base;
let cookie = '';
let skip = false;
let subId;
let invId;

before(async () => {
  try {
    const n = await prisma.subscription.count();
    if (n < 2000) throw new Error(`only ${n} subscriptions, run npm run seed:bulk first`);
  } catch (e) {
    skip = e.message.split('\n')[0];
    return;
  }
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@brightloop.in', password: 'Admin@12345' }),
  });
  cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  subId = (await prisma.subscription.findFirst({ where: { status: 'ACTIVE' }, orderBy: { id: 'desc' } })).id;
  invId = (await prisma.invoice.findFirst({ where: { status: 'CONFIRMED' } })).id;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
});

const pages = () => [
  ['subscriptions list', '/subscriptions?page=1&pageSize=10'],
  ['subscriptions deep page', '/subscriptions?page=400&pageSize=10'],
  ['subscriptions filtered', '/subscriptions?status=ACTIVE&page=3'],
  ['subscriptions search', '/subscriptions?search=Bulk%20Customer%201234'],
  ['subscription stats', '/subscriptions/stats'],
  ['subscription detail', `/subscriptions/${subId}`],
  ['invoices all', '/invoices?view=ALL&pageSize=20'],
  ['invoices outstanding', '/invoices?view=OUTSTANDING&pageSize=20'],
  ['invoices overdue', '/invoices?view=OVERDUE&pageSize=20'],
  ['invoices paid', '/invoices?view=PAID&pageSize=20'],
  ['invoices search', '/invoices?search=INV%2F2026%2F0123'],
  ['invoice detail', `/invoices/${invId}`],
  ['payments ledger', '/payments?pageSize=20'],
  ['payments by method', '/payments?method=UPI&pageSize=20'],
  ['customers', '/customers?pageSize=20'],
  ['customers search', '/customers?search=Bulk%20Company%2077'],
  ['dashboard summary', '/reports/summary?from=2026-01-01&to=2026-12-31'],
  ['dashboard summary by plan', '/reports/summary?planId=1'],
  ['revenue by month', '/reports/revenue-by-month'],
  ['expiring soon', '/reports/expiring'],
  ['products', '/products'],
  ['plans', '/plans'],
  ['billing status', '/billing/status'],
];

test('every page answers in under two seconds with thousands of subscriptions', async (ctx) => {
  if (skip) return ctx.skip(skip);
  const slow = [];
  const rows = [];
  for (const [name, path] of pages()) {
    await fetch(`${base}/api${path}`, { headers: { Cookie: cookie } }); // warm the connection
    const t0 = performance.now();
    const res = await fetch(`${base}/api${path}`, { headers: { Cookie: cookie } });
    await res.arrayBuffer();
    const ms = Math.round(performance.now() - t0);
    rows.push(`${String(ms).padStart(5)} ms  ${res.status}  ${name}`);
    assert.equal(res.status, 200, `${name} should answer 200, got ${res.status}`);
    if (ms >= LIMIT_MS) slow.push(`${name} took ${ms} ms`);
  }
  console.log(`\n${(await prisma.subscription.count()).toLocaleString()} subscriptions on the books:\n${rows.join('\n')}`);
  assert.deepEqual(slow, [], 'pages slower than 2 seconds');
});
