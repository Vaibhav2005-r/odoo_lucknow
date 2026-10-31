import path from 'node:path';
import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { GST_STATES, invoiceTaxRows } from '../../lib/gst.js';
import { amountInWords } from '../../lib/amount-in-words.js';
import { todayIn } from '../../lib/billing-core.js';

// ---------------------------------------------------------------- fonts
// Noto Sans (SIL Open Font License, shipped as an npm package). Its Latin file has the letters and digits, its
// Latin-Extended file has the rupee sign, so a price is drawn as "₹" from one font followed by digits from the other.
const dir = path.join(path.dirname(createRequire(import.meta.url).resolve('@fontsource/noto-sans/package.json')), 'files');
const FONT = {
  regular: path.join(dir, 'noto-sans-latin-400-normal.woff'),
  bold: path.join(dir, 'noto-sans-latin-700-normal.woff'),
  rupee: path.join(dir, 'noto-sans-latin-ext-400-normal.woff'),
  rupeeBold: path.join(dir, 'noto-sans-latin-ext-700-normal.woff'),
};

// ---------------------------------------------------------------- formatting (shared by layout, renderer and tests)
export const fmtMoney = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const METHODS = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', UPI: 'UPI', CARD: 'Card', CHEQUE: 'Cheque', OTHER: 'Other' };
const n = (v) => Number(v) || 0;

export async function loadInvoiceForPdf(id) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { id: 'asc' } },
      payments: { orderBy: { paymentDate: 'asc' } },
      customer: true,
      subscription: { select: { number: true, paymentTerm: { select: { name: true } } } },
    },
  });
}

export const companyDetails = () => ({
  name: env.COMPANY_NAME,
  address: env.COMPANY_ADDRESS,
  gstin: env.COMPANY_GSTIN,
  stateCode: env.COMPANY_STATE_CODE,
  email: env.MAIL_FROM.match(/<(.+)>/)?.[1] || env.MAIL_FROM,
});

/**
 * Everything that will be printed, as plain data. Rendering is a separate step so that what the invoice SAYS can be
 * tested exactly, without parsing a PDF.
 */
export function buildInvoiceDocument(invoice, company = companyDetails(), today = todayIn(env.APP_TZ)) {
  const snap = invoice.customerSnapshot || {};
  const customer = { ...(invoice.customer || {}), ...snap };
  const stateName = (code) => GST_STATES[code] || code;

  let status = 'UNPAID';
  if (invoice.status === 'PAID') status = 'PAID';
  else if (invoice.status === 'DRAFT') status = 'DRAFT';
  else if (invoice.status === 'CANCELLED') status = 'CANCELLED';
  else if (invoice.dueDate && new Date(invoice.dueDate) < today) status = 'OVERDUE';

  const due = Math.round((n(invoice.amountTotal) - n(invoice.amountPaid)) * 100) / 100;
  const totals = [{ label: 'Subtotal', value: n(invoice.amountSubtotal) }];
  if (n(invoice.amountDiscount) > 0) totals.push({ label: 'Discount', value: -n(invoice.amountDiscount), tone: 'discount' });
  totals.push({ label: 'Taxable value', value: n(invoice.amountUntaxed) });
  for (const r of invoiceTaxRows(invoice)) totals.push({ label: r.label, value: r.amount });
  totals.push({ label: 'Total', value: n(invoice.amountTotal), tone: 'total' });
  if (n(invoice.amountPaid) > 0) totals.push({ label: 'Amount paid', value: -n(invoice.amountPaid), tone: 'discount' });
  totals.push({ label: 'Balance due', value: due, tone: 'due' });

  return {
    title: 'TAX INVOICE',
    number: invoice.number,
    status,
    supplier: { name: company.name, address: company.address, gstin: invoice.supplierGstin || company.gstin, email: company.email },
    dates: [
      ['Invoice date', fmtDate(invoice.invoiceDate)],
      ['Due date', fmtDate(invoice.dueDate)],
      ...(invoice.periodStart ? [['Billing period', `${fmtDate(invoice.periodStart)} to ${fmtDate(invoice.periodEnd)}`]] : []),
    ],
    billTo: {
      name: customer.name || '',
      company: customer.company && customer.company !== customer.name ? customer.company : '',
      address: customer.address || '',
      email: customer.email || '',
      phone: customer.phone || '',
      gstin: customer.gstin || '',
    },
    reference: [
      ...(invoice.subscription?.number ? [['Subscription', invoice.subscription.number]] : []),
      ...(invoice.subscription?.paymentTerm?.name ? [['Payment terms', invoice.subscription.paymentTerm.name]] : []),
    ],
    supply: invoice.placeOfSupply
      ? `Place of supply: ${stateName(invoice.placeOfSupply)} (${invoice.placeOfSupply}). ${invoice.interState ? 'Inter-state supply, IGST applies.' : 'Intra-state supply, CGST and SGST apply.'}`
      : '',
    lines: (invoice.lines || []).map((l) => ({
      description: l.description,
      hsnSac: l.hsnSac || '',
      quantity: l.quantity,
      rate: n(l.unitPrice),
      discount: n(l.discountAmount),
      tax: n(l.taxAmount),
      taxLabel: l.taxLabel || (n(l.taxRate) ? `${n(l.taxRate)}%` : ''),
      amount: n(l.total),
    })),
    totals,
    payments: (invoice.payments || []).map((p) => ({ date: fmtDate(p.paymentDate), method: METHODS[p.method] || p.method, amount: n(p.amount), note: p.note || '' })),
    words: amountInWords(n(invoice.amountTotal)),
    footer: 'This is a computer-generated tax invoice and does not need a signature.',
  };
}

// ---------------------------------------------------------------- rendering
const BRAND = '#714b67';
const INK = '#1d1d1f';
const GRAY = '#6e6e73';
const LINE = '#d2d2d7';
const TONES = { PAID: '#15803d', UNPAID: '#b45309', OVERDUE: '#b91c1c', DRAFT: '#6e6e73', CANCELLED: '#6e6e73' };
const PAGE = { w: 595.28, h: 841.89, m: 40 };
const COLS = { desc: [40, 170], qty: [210, 30], rate: [240, 62], disc: [302, 55], tax: [357, 98], amt: [455, 100.28] };
const BOTTOM = PAGE.h - 70; // keep clear of the footer

/** Draws "-₹1,234.00": minus (Latin font), then "₹" (extended font), then the digits; right-aligned to xRight. */
function money(doc, value, xRight, y, { size = 9, bold = false, color = INK } = {}) {
  const digits = fmtMoney(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  const latin = bold ? 'bold' : 'regular';
  const ext = bold ? 'rupeeBold' : 'rupee';
  doc.font(latin).fontSize(size);
  const wSign = sign ? doc.widthOfString(sign) : 0;
  const wDigits = doc.widthOfString(digits);
  doc.font(ext).fontSize(size);
  const wRupee = doc.widthOfString('₹');
  let x = xRight - wSign - wRupee - 1 - wDigits;
  doc.fillColor(color);
  if (sign) {
    doc.font(latin).text(sign, x, y, { lineBreak: false });
    x += wSign;
  }
  doc.font(ext).text('₹', x, y, { lineBreak: false });
  doc.font(latin).text(digits, x + wRupee + 1, y, { lineBreak: false });
}

function tableHeader(doc, y) {
  doc.rect(PAGE.m, y, PAGE.w - 2 * PAGE.m, 20).fill('#f5f5f7');
  doc.fillColor(GRAY).font('bold').fontSize(7.5);
  const h = (label, [x, w], align) => doc.text(label, x + (align === 'left' ? 6 : 0), y + 6.5, { width: w - (align === 'left' ? 6 : 6), align, lineBreak: false });
  h('ITEM', COLS.desc, 'left');
  h('QTY', COLS.qty, 'right');
  h('RATE', COLS.rate, 'right');
  h('DISCOUNT', COLS.disc, 'right');
  h('TAX', COLS.tax, 'right');
  h('AMOUNT', COLS.amt, 'right');
  return y + 20;
}

export function renderInvoicePdf(d) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.m, bottom: PAGE.m, left: PAGE.m, right: PAGE.m },
    bufferPages: true,
    info: { Title: `Tax invoice ${d.number}`, Author: d.supplier.name, Subject: `Invoice ${d.number} for ${d.billTo.name}`, Creator: 'LoopBill' },
  });
  for (const [name, file] of Object.entries(FONT)) doc.registerFont(name, file);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ---- header: who we are (left), the document (right)
  doc.fillColor(BRAND).font('bold').fontSize(19).text(d.supplier.name, PAGE.m, 40, { lineBreak: false });
  doc.fillColor(GRAY).font('regular').fontSize(8.5);
  doc.text(d.supplier.address, PAGE.m, 66, { width: 260 });
  doc.fillColor(INK).font('bold').fontSize(8.5).text(`GSTIN: ${d.supplier.gstin}`, PAGE.m, doc.y + 2, { lineBreak: false });
  if (d.supplier.email) doc.fillColor(GRAY).font('regular').text(d.supplier.email, PAGE.m, doc.y + 12, { lineBreak: false });

  doc.fillColor(GRAY).font('bold').fontSize(8).text(d.title, 330, 42, { width: 225.28, align: 'right', characterSpacing: 1.2, lineBreak: false });
  doc.fillColor(INK).font('bold').fontSize(17).text(d.number, 330, 55, { width: 225.28, align: 'right', lineBreak: false });
  let ry = 80;
  for (const [k, v] of d.dates) {
    doc.fillColor(GRAY).font('regular').fontSize(8.5).text(`${k}: `, 330, ry, { width: 130, align: 'left', lineBreak: false });
    doc.fillColor(INK).font('bold').text(v, 400, ry, { width: 155.28, align: 'right', lineBreak: false });
    ry += 13;
  }
  const tone = TONES[d.status] || GRAY;
  doc.font('bold').fontSize(8);
  const badgeW = doc.widthOfString(d.status) + 16;
  doc.roundedRect(PAGE.w - PAGE.m - badgeW, ry + 3, badgeW, 17, 8.5).lineWidth(0.8).stroke(tone);
  doc.fillColor(tone).text(d.status, PAGE.w - PAGE.m - badgeW, ry + 8, { width: badgeW, align: 'center', lineBreak: false });

  let y = Math.max(doc.y, ry + 30) + 14;
  doc.moveTo(PAGE.m, y).lineTo(PAGE.w - PAGE.m, y).lineWidth(1.4).stroke(INK);
  y += 16;

  // ---- billed to / reference
  doc.fillColor(GRAY).font('bold').fontSize(7.5).text('BILLED TO', PAGE.m, y, { characterSpacing: 1, lineBreak: false });
  let by = y + 13;
  doc.fillColor(INK).font('bold').fontSize(10.5).text(d.billTo.name, PAGE.m, by, { width: 250 });
  by = doc.y + 1;
  doc.font('regular').fontSize(8.5).fillColor(INK);
  for (const t of [d.billTo.company, d.billTo.address, d.billTo.email, d.billTo.phone]) {
    if (!t) continue;
    doc.fillColor(t === d.billTo.company ? INK : GRAY).text(t, PAGE.m, by, { width: 250 });
    by = doc.y + 1;
  }
  if (d.billTo.gstin) {
    doc.fillColor(INK).font('bold').fontSize(8.5).text(`GSTIN: ${d.billTo.gstin}`, PAGE.m, by + 2, { lineBreak: false });
    by += 14;
  }
  let ay = y;
  if (d.reference.length) {
    doc.fillColor(GRAY).font('bold').fontSize(7.5).text('DETAILS', 330, ay, { characterSpacing: 1, lineBreak: false });
    ay += 13;
    for (const [k, v] of d.reference) {
      doc.fillColor(GRAY).font('regular').fontSize(8.5).text(`${k}: `, 330, ay, { lineBreak: false });
      doc.fillColor(INK).font('bold').text(v, 400, ay, { width: 155.28, align: 'right', lineBreak: false });
      ay += 13;
    }
  }
  y = Math.max(by, ay) + 8;
  if (d.supply) {
    doc.fillColor(GRAY).font('regular').fontSize(8).text(d.supply, PAGE.m, y, { width: PAGE.w - 2 * PAGE.m });
    y = doc.y + 8;
  }

  // ---- line items (the header repeats on every page)
  y = tableHeader(doc, y + 4);
  for (const l of d.lines) {
    doc.font('regular').fontSize(9);
    const descH = doc.heightOfString(l.description, { width: COLS.desc[1] - 12 });
    doc.fontSize(7);
    const taxH = l.taxLabel ? doc.heightOfString(l.taxLabel, { width: COLS.tax[1] - 6 }) + 11 : 11;
    const rowH = Math.max(descH + (l.hsnSac ? 11 : 0), taxH, 12) + 14;
    if (y + rowH > BOTTOM) {
      doc.addPage();
      y = tableHeader(doc, PAGE.m);
    }
    doc.fillColor(INK).font('regular').fontSize(9).text(l.description, COLS.desc[0] + 6, y + 7, { width: COLS.desc[1] - 12 });
    if (l.hsnSac) doc.fillColor(GRAY).fontSize(7).text(`HSN/SAC ${l.hsnSac}`, COLS.desc[0] + 6, y + 8 + descH, { lineBreak: false });
    doc.fillColor(INK).font('regular').fontSize(9).text(String(l.quantity), COLS.qty[0], y + 7, { width: COLS.qty[1] - 6, align: 'right', lineBreak: false });
    money(doc, l.rate, COLS.rate[0] + COLS.rate[1] - 6, y + 7);
    if (l.discount > 0) money(doc, -l.discount, COLS.disc[0] + COLS.disc[1] - 6, y + 7, { color: TONES.PAID });
    else doc.fillColor(GRAY).text('—', COLS.disc[0], y + 7, { width: COLS.disc[1] - 6, align: 'right', lineBreak: false });
    money(doc, l.tax, COLS.tax[0] + COLS.tax[1] - 6, y + 7);
    if (l.taxLabel) doc.fillColor(GRAY).font('regular').fontSize(7).text(l.taxLabel, COLS.tax[0], y + 19, { width: COLS.tax[1] - 6, align: 'right' });
    money(doc, l.amount, COLS.amt[0] + COLS.amt[1] - 6, y + 7, { bold: true });
    y += rowH;
    doc.moveTo(PAGE.m, y).lineTo(PAGE.w - PAGE.m, y).lineWidth(0.5).stroke(LINE);
  }

  // ---- totals (right), payments + amount in words (left)
  const needed = d.totals.length * 17 + 60;
  if (y + needed > BOTTOM) {
    doc.addPage();
    y = PAGE.m;
  }
  let ty = y + 14;
  for (const t of d.totals) {
    const strong = t.tone === 'total' || t.tone === 'due';
    if (t.tone === 'total') {
      doc.moveTo(330, ty - 4).lineTo(PAGE.w - PAGE.m, ty - 4).lineWidth(1).stroke(INK);
      ty += 2;
    }
    doc.fillColor(strong ? INK : GRAY).font(strong ? 'bold' : 'regular').fontSize(strong ? 10 : 9).text(t.label, 330, ty, { lineBreak: false });
    money(doc, t.value, PAGE.w - PAGE.m, ty, { size: strong ? 10.5 : 9, bold: strong, color: t.tone === 'discount' ? TONES.PAID : t.tone === 'due' && t.value > 0 ? TONES.OVERDUE : INK });
    ty += t.tone === 'total' ? 20 : 17;
  }

  let ly = y + 14;
  if (d.payments.length) {
    doc.fillColor(GRAY).font('bold').fontSize(7.5).text('PAYMENTS RECEIVED', PAGE.m, ly, { characterSpacing: 1, lineBreak: false });
    ly += 13;
    for (const p of d.payments) {
      doc.fillColor(INK).font('regular').fontSize(8.5).text(`${p.date}  ·  ${p.method}`, PAGE.m, ly, { lineBreak: false });
      money(doc, p.amount, 270, ly, { size: 8.5 });
      ly += 13;
    }
    ly += 6;
  }
  const wordsY = Math.max(ty, ly) + 8;
  doc.fillColor(GRAY).font('bold').fontSize(7.5).text('AMOUNT IN WORDS', PAGE.m, wordsY, { characterSpacing: 1, lineBreak: false });
  doc.fillColor(INK).font('regular').fontSize(9).text(d.words, PAGE.m, wordsY + 12, { width: PAGE.w - 2 * PAGE.m });

  // ---- footer and page numbers on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // text this low would otherwise make PDFKit start a new page
    doc.moveTo(PAGE.m, PAGE.h - 52).lineTo(PAGE.w - PAGE.m, PAGE.h - 52).lineWidth(0.5).stroke(LINE);
    doc.fillColor(GRAY).font('regular').fontSize(7.5);
    doc.text(d.footer, PAGE.m, PAGE.h - 44, { width: 400, lineBreak: false });
    doc.text(`${d.number}  ·  Page ${i + 1} of ${range.count}`, 330, PAGE.h - 44, { width: PAGE.w - PAGE.m - 330, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}

/** The finished PDF for an invoice id, or null if there is no such invoice. */
export async function invoicePdf(id) {
  const invoice = await loadInvoiceForPdf(id);
  if (!invoice) return null;
  return { invoice, pdf: await renderInvoicePdf(buildInvoiceDocument(invoice)) };
}

export const pdfFilename = (number) => `${String(number).replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`;
