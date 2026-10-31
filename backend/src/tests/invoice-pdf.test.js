import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startSmtpSink } from './helpers/smtp-sink.js';
import { amountInWords, numberToWords } from '../lib/amount-in-words.js';
import { invoiceTaxRows } from '../lib/gst.js';

// The mail catcher must be listening before anything that loads the app configuration is imported,
// so the PDF module (which reads the config) is imported dynamically right after it starts.
const sink = await startSmtpSink();
const { buildInvoiceDocument, fmtMoney, pdfFilename, renderInvoicePdf } = await import('../modules/invoices/invoice-pdf.js');

// ---------------------------------------------------------------- amount in words (Indian grouping)

test('amount in words uses lakh and crore and handles paise', () => {
  const cases = [
    [0, 'Rupees Zero Only'],
    [1, 'Rupees One Only'],
    [19, 'Rupees Nineteen Only'],
    [21.5, 'Rupees Twenty One and Fifty Paise Only'],
    [100, 'Rupees One Hundred Only'],
    [1000, 'Rupees One Thousand Only'],
    [100000, 'Rupees One Lakh Only'],
    [6583.22, 'Rupees Six Thousand Five Hundred Eighty Three and Twenty Two Paise Only'],
    [10000000, 'Rupees One Crore Only'],
    [12345678.9, 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only'],
    [0.05, 'Rupees Zero and Five Paise Only'],
  ];
  for (const [n, words] of cases) assert.equal(amountInWords(n), words, String(n));
  assert.equal(numberToWords(99), 'Ninety Nine');
});

// ---------------------------------------------------------------- tax rows

const line = (over) => ({ taxLabel: '', cgstAmount: 0, sgstAmount: 0, igstAmount: 0, otherTaxAmount: 0, ...over });
test('tax rows: one per component, summed across lines, cess kept apart, old invoices fall back to one row', () => {
  const same = { amountTax: 600, lines: [
    line({ taxLabel: 'CGST 9% + SGST 9% + Cess 2%', cgstAmount: 180, sgstAmount: 180, otherTaxAmount: 40 }),
    line({ taxLabel: 'CGST 9% + SGST 9%', cgstAmount: 100, sgstAmount: 100 }),
  ] };
  assert.deepEqual(invoiceTaxRows(same), [
    { label: 'CGST @ 9%', amount: 280 }, { label: 'SGST @ 9%', amount: 280 }, { label: 'Cess 2%', amount: 40 },
  ]);
  assert.deepEqual(invoiceTaxRows({ amountTax: 360, lines: [line({ taxLabel: 'IGST 18%', igstAmount: 360 })] }), [{ label: 'IGST @ 18%', amount: 360 }]);
  assert.deepEqual(invoiceTaxRows({ amountTax: 180, lines: [line({ taxLabel: 'GST 18%' })] }), [{ label: 'Tax (GST)', amount: 180 }], 'issued before the split existed');
  assert.deepEqual(invoiceTaxRows({ amountTax: 0, lines: [line({})] }), []);
});

// ---------------------------------------------------------------- what the document says

const company = { name: 'Brightloop Software', address: 'Gomti Nagar, Lucknow', gstin: '09AABCB1234C1Z7', stateCode: '09', email: 'billing@brightloop.in' };
const sample = (over = {}) => ({
  number: 'INV/2026/00042', status: 'CONFIRMED', invoiceDate: '2026-10-01', dueDate: '2026-10-16', periodStart: '2026-10-01', periodEnd: '2026-10-31',
  supplierGstin: '09AABCB1234C1Z7', placeOfSupply: '27', interState: true,
  amountSubtotal: 5000, amountDiscount: 500, amountUntaxed: 4500, amountTax: 810, amountTotal: 5310, amountPaid: 1000,
  customerSnapshot: { name: 'Riya Sharma', company: 'Sharma Retail Pvt Ltd', address: 'Andheri West, Mumbai', email: 'riya@sharma.in', gstin: '27AAAAA0000A1Z5' },
  subscription: { number: 'SUB/2026/00007', paymentTerm: { name: '15 Days' } },
  lines: [
    { description: 'Brightloop CRM (Brand: Odoo)', hsnSac: '998314', quantity: 5, unitPrice: 1000, discountAmount: 500, taxRate: 18, taxLabel: 'IGST 18%', taxAmount: 810, igstAmount: 810, total: 5310, cgstAmount: 0, sgstAmount: 0, otherTaxAmount: 0 },
  ],
  payments: [{ paymentDate: '2026-10-05', method: 'UPI', amount: 1000, note: '' }],
  ...over,
});

test('the document carries every fact an Indian tax invoice needs', () => {
  const today = new Date('2026-10-31T00:00:00Z');
  const d = buildInvoiceDocument(sample(), company, today);
  assert.equal(d.title, 'TAX INVOICE');
  assert.equal(d.number, 'INV/2026/00042');
  assert.equal(d.status, 'OVERDUE', 'confirmed, unpaid, past its due date');
  assert.equal(d.supplier.gstin, '09AABCB1234C1Z7');
  assert.equal(d.billTo.gstin, '27AAAAA0000A1Z5');
  assert.equal(d.billTo.company, 'Sharma Retail Pvt Ltd');
  assert.match(d.supply, /Maharashtra \(27\).*IGST applies/);
  assert.deepEqual(d.dates.map((x) => x[0]), ['Invoice date', 'Due date', 'Billing period']);
  assert.deepEqual(d.dates[0], ['Invoice date', '01 Oct 2026']);
  assert.deepEqual(d.reference, [['Subscription', 'SUB/2026/00007'], ['Payment terms', '15 Days']]);
  assert.equal(d.lines[0].hsnSac, '998314');
  assert.equal(d.lines[0].taxLabel, 'IGST 18%');
  assert.deepEqual(d.totals.map((t) => [t.label, t.value]), [
    ['Subtotal', 5000], ['Discount', -500], ['Taxable value', 4500], ['IGST @ 18%', 810], ['Total', 5310], ['Amount paid', -1000], ['Balance due', 4310],
  ]);
  assert.equal(d.words, 'Rupees Five Thousand Three Hundred Ten Only');
  assert.deepEqual(d.payments, [{ date: '05 Oct 2026', method: 'UPI', amount: 1000, note: '' }]);
});

test('status follows the invoice, and optional blocks disappear when empty', () => {
  const today = new Date('2026-09-01T00:00:00Z'); // before the due date
  assert.equal(buildInvoiceDocument(sample(), company, today).status, 'UNPAID');
  assert.equal(buildInvoiceDocument(sample({ status: 'PAID', amountPaid: 5310 }), company, today).status, 'PAID');
  assert.equal(buildInvoiceDocument(sample({ status: 'DRAFT' }), company, today).status, 'DRAFT');
  assert.equal(buildInvoiceDocument(sample({ status: 'CANCELLED' }), company, today).status, 'CANCELLED');

  const bare = buildInvoiceDocument(sample({ amountDiscount: 0, amountPaid: 0, payments: [], placeOfSupply: null, subscription: null, periodStart: null, supplierGstin: null }), company, today);
  assert.ok(!bare.totals.some((t) => t.label === 'Discount' || t.label === 'Amount paid'));
  assert.equal(bare.totals.at(-1).value, 5310);
  assert.equal(bare.supply, '');
  assert.deepEqual(bare.reference, []);
  assert.equal(bare.dates.length, 2);
  assert.equal(bare.supplier.gstin, company.gstin, 'falls back to the company GSTIN');
  assert.equal(fmtMoney(1234567.5), '12,34,567.50', 'Indian digit grouping');
  assert.equal(pdfFilename('INV/2026/00001'), 'INV-2026-00001.pdf');
});

// ---------------------------------------------------------------- the PDF file itself

const pages = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

test('renders a valid single-page PDF with the fonts embedded', async () => {
  const pdf = await renderInvoicePdf(buildInvoiceDocument(sample(), company));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.subarray(-8).toString(), /%%EOF/);
  assert.equal(pages(pdf), 1, 'footer text must not spill onto extra pages');
  assert.match(pdf.toString('latin1'), /NotoSans/, 'the font with the rupee sign is embedded');
  assert.ok(pdf.length > 8000 && pdf.length < 200_000);
});

test('a long invoice continues on further pages, each with its own footer', async () => {
  const many = Array.from({ length: 70 }, (_, i) => ({
    description: `Seat licence number ${i + 1}, annual plan with premium support included`, hsnSac: '998314', quantity: 1, unitPrice: 100, discountAmount: 0,
    taxRate: 18, taxLabel: 'CGST 9% + SGST 9%', taxAmount: 18, cgstAmount: 9, sgstAmount: 9, otherTaxAmount: 0, igstAmount: 0, total: 118,
  }));
  const pdf = await renderInvoicePdf(buildInvoiceDocument(sample({ lines: many, interState: false, placeOfSupply: '09', amountSubtotal: 7000, amountDiscount: 0, amountUntaxed: 7000, amountTax: 1260, amountTotal: 8260, amountPaid: 0, payments: [] }), company));
  const n = pages(pdf);
  assert.ok(n >= 3 && n <= 6, `expected a few pages, got ${n}`);

  const hasPdftotext = spawnSync('pdftotext', ['-v']).error === undefined;
  if (hasPdftotext) {
    const file = path.join(os.tmpdir(), `loopbill-${Date.now()}.pdf`);
    fs.writeFileSync(file, pdf);
    const text = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).stdout;
    fs.unlinkSync(file);
    for (let i = 1; i <= n; i++) assert.match(text, new RegExp(`Page ${i} of ${n}`), `footer on page ${i}`);
    assert.equal((text.match(/Seat licence number/g) || []).length, 70, 'every line appears exactly once');
    assert.match(text, /ITEM[\s\S]*ITEM/, 'the table header repeats on the next page');
    assert.match(text, /Balance due/);
  }
});

test('the printed text is right (checked with pdftotext when it is installed)', async (ctx) => {
  if (spawnSync('pdftotext', ['-v']).error) return ctx.skip('pdftotext is not installed');
  const pdf = await renderInvoicePdf(buildInvoiceDocument(sample({ interState: false, placeOfSupply: '09', lines: [{ ...sample().lines[0], taxLabel: 'CGST 9% + SGST 9%', igstAmount: 0, cgstAmount: 405, sgstAmount: 405 }] }), company));
  const file = path.join(os.tmpdir(), `loopbill-text-${Date.now()}.pdf`);
  fs.writeFileSync(file, pdf);
  const text = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).stdout;
  fs.unlinkSync(file);
  for (const needle of ['INV/2026/00042', 'Brightloop Software', 'GSTIN: 09AABCB1234C1Z7', 'GSTIN: 27AAAAA0000A1Z5', 'HSN/SAC 998314',
    'CGST @ 9%', 'SGST @ 9%', '₹', '5,310.00', '4,310.00', 'Rupees Five Thousand Three Hundred Ten Only', 'Intra-state supply', 'Page 1 of 1']) {
    assert.ok(text.includes(needle), `missing "${needle}"`);
  }
  assert.ok(!/-₹\s*1,000\.00|₹\s*-1,000/.test(text) || text.includes('-₹'), 'the minus comes before the rupee sign');
});

// ---------------------------------------------------------------- through the app

const { app } = await import('../app.js');
const { prisma } = await import('../lib/prisma.js');
const { todayIn, addDays } = await import('../lib/billing-core.js');

const today = todayIn('Asia/Kolkata');
const tag = Date.now().toString(36);
let skip = false;
let server;
let base;
let riya;
const sess = {};
let seq = 0;

const get = async (who, p) => fetch(`${base}/api${p}`, { headers: { Cookie: sess[who] || '' } });
const post = async (who, p) => fetch(`${base}/api${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sess[who] || '' }, body: '{}' });
const login = async (who, email, password) => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  sess[who] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};
const makeInvoice = (customerId, status = 'CONFIRMED') => prisma.invoice.create({
  data: {
    number: `PDF/${tag}/${++seq}`, customerId, status, invoiceDate: today, dueDate: addDays(today, 7), supplierGstin: '09AABCB1234C1Z7',
    placeOfSupply: '09', interState: false, amountSubtotal: 1000, amountUntaxed: 1000, amountTax: 180, amountTotal: 1180, amountCgst: 90, amountSgst: 90,
    customerSnapshot: { name: 'PDF Customer', email: 'pdf@example.com' },
    lines: { create: [{ description: 'PDF line', hsnSac: '998314', quantity: 1, unitPrice: 1000, subtotal: 1000, taxRate: 18, taxLabel: 'CGST 9% + SGST 9%', taxAmount: 180, cgstAmount: 90, sgstAmount: 90, total: 1180 }] },
  },
});

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
  riya = await prisma.customer.findFirst({ where: { email: 'riya@sharmaretail.in' } });
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  sink.close();
  await prisma.$disconnect();
});
const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

t('download: customers get their own invoices, staff get any, nobody else gets anything', async () => {
  const mine = await makeInvoice(riya.id);
  const res = await get('riya', `/invoices/${mine.id}/pdf`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.match(res.headers.get('content-disposition'), new RegExp(`^attachment; filename="PDF-${tag}-\\d+\\.pdf"$`));
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(body.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pages(body), 1);

  const inline = await get('riya', `/invoices/${mine.id}/pdf?inline=1`);
  assert.match(inline.headers.get('content-disposition'), /^inline;/);

  assert.equal((await get('staff', `/invoices/${mine.id}/pdf`)).status, 200);
  assert.equal((await get('anon', `/invoices/${mine.id}/pdf`)).status, 401);
  assert.equal((await get('riya', '/invoices/99999999/pdf')).status, 404);

  const other = await prisma.customer.create({ data: { name: `Other ${tag}`, email: `other.pdf.${tag}@example.com` } });
  const theirs = await makeInvoice(other.id);
  assert.equal((await get('riya', `/invoices/${theirs.id}/pdf`)).status, 404, "someone else's invoice");

  const draft = await makeInvoice(riya.id, 'DRAFT');
  assert.equal((await get('riya', `/invoices/${draft.id}/pdf`)).status, 404, 'drafts are internal until confirmed');
  assert.equal((await get('staff', `/invoices/${draft.id}/pdf`)).status, 200);
});

t('"send invoice" e-mails the PDF as an attachment', async () => {
  const cust = await prisma.customer.create({ data: { name: `Attach ${tag}`, email: `attach.${tag}@example.com` } });
  const inv = await makeInvoice(cust.id);
  const sent = await post('staff', `/invoices/${inv.id}/send`);
  assert.equal(sent.status, 200, await sent.text());
  assert.ok(await sink.wait(cust.email, (m) => m.includes(inv.number)));

  const raw = sink.mails.find((m) => m.includes(`filename="${pdfFilename(inv.number)}"`) || m.includes(pdfFilename(inv.number)));
  assert.ok(raw, 'the e-mail has a PDF named after the invoice');
  assert.match(raw, /Content-Type: application\/pdf/i);
  const b64 = /Content-Transfer-Encoding: base64\r?\n(?:[A-Za-z-]+:[^\r\n]*\r?\n)*\r?\n([A-Za-z0-9+/=\r\n]+)/i.exec(raw.slice(raw.search(/Content-Type: application\/pdf/i)))[1];
  const attached = Buffer.from(b64.replace(/\s/g, ''), 'base64');
  assert.equal(attached.subarray(0, 5).toString(), '%PDF-', 'the attachment is a real PDF');
  assert.equal(pages(attached), 1);
});
