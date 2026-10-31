import { prisma } from '../../lib/prisma.js';
import { fmtDate, todayIn, addDays } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { httpError } from '../../lib/http-error.js';

// from / to are 'YYYY-MM-DD' strings (validated by zod). planId is a number or null.
// ::int casts avoid BigInt (COUNT) in JSON; ::float8 turns NUMERIC into plain numbers.
export async function getSummary({ from, to, planId = null }) {
  const today = fmtDate(todayIn(env.APP_TZ));
  const p = planId ?? null;
  const [row] = await prisma.$queryRaw`
    SELECT
      (SELECT count(*)::int FROM "Subscription" s
         WHERE s.status = 'ACTIVE' AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "activeSubscriptions",
      (SELECT coalesce(sum(pay.amount), 0)::float8 FROM "Payment" pay
         JOIN "Invoice" i ON i.id = pay."invoiceId" LEFT JOIN "Subscription" s ON s.id = i."subscriptionId"
         WHERE pay."paymentDate" BETWEEN ${from}::date AND ${to}::date
           AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "collected",
      (SELECT coalesce(sum(i."amountTotal"), 0)::float8 FROM "Invoice" i LEFT JOIN "Subscription" s ON s.id = i."subscriptionId"
         WHERE i.status IN ('CONFIRMED', 'PAID') AND i."invoiceDate" BETWEEN ${from}::date AND ${to}::date
           AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "invoiced",
      (SELECT coalesce(sum(i."amountTotal" - i."amountPaid"), 0)::float8 FROM "Invoice" i LEFT JOIN "Subscription" s ON s.id = i."subscriptionId"
         WHERE i.status = 'CONFIRMED' AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "outstanding",
      (SELECT count(*)::int FROM "Invoice" i LEFT JOIN "Subscription" s ON s.id = i."subscriptionId"
         WHERE i.status = 'CONFIRMED' AND i."dueDate" < ${today}::date
           AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "overdueCount",
      (SELECT coalesce(sum(i."amountTotal" - i."amountPaid"), 0)::float8 FROM "Invoice" i LEFT JOIN "Subscription" s ON s.id = i."subscriptionId"
         WHERE i.status = 'CONFIRMED' AND i."dueDate" < ${today}::date
           AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "overdueAmount",
      (SELECT coalesce(sum(s."amountUntaxed" * CASE pl."billingPeriod"
                WHEN 'DAILY' THEN 365.0 / 12 WHEN 'WEEKLY' THEN 52.0 / 12
                WHEN 'MONTHLY' THEN 1 ELSE 1.0 / 12 END), 0)::float8
         FROM "Subscription" s JOIN "Plan" pl ON pl.id = s."planId"
         WHERE s.status = 'ACTIVE' AND s."isPaused" = false
           AND (${p}::int IS NULL OR s."planId" = ${p}::int)) AS "mrr"`;

  const mrr = row?.mrr || 0;
  return {
    activeSubscriptions: row?.activeSubscriptions || 0,
    collected: row?.collected || 0,
    invoiced: row?.invoiced || 0,
    outstanding: row?.outstanding || 0,
    overdueCount: row?.overdueCount || 0,
    overdueAmount: row?.overdueAmount || 0,
    mrr,
    arr: mrr * 12,
  };
}

// Invoiced vs collected per month. The grouped form below runs in ~30 ms on 34k invoices
export async function revenueByMonth({ months = 12 } = {}) {
  const end = fmtDate(todayIn(env.APP_TZ));
  const back = months - 1;
  return prisma.$queryRaw`
    WITH months AS (
      SELECT generate_series(date_trunc('month', ${end}::date) - make_interval(months => ${back}::int),
                             date_trunc('month', ${end}::date), interval '1 month') AS m
    ), inv AS (
      SELECT date_trunc('month', "invoiceDate") AS m, sum("amountTotal") AS v
      FROM "Invoice"
      WHERE status IN ('CONFIRMED', 'PAID')
        AND "invoiceDate" >= date_trunc('month', ${end}::date) - make_interval(months => ${back}::int)
      GROUP BY 1
    ), pay AS (
      SELECT date_trunc('month', "paymentDate") AS m, sum(amount) AS v
      FROM "Payment"
      WHERE "paymentDate" >= date_trunc('month', ${end}::date) - make_interval(months => ${back}::int)
      GROUP BY 1
    )
    SELECT to_char(months.m, 'YYYY-MM') AS month,
           coalesce(inv.v, 0)::float8 AS invoiced,
           coalesce(pay.v, 0)::float8 AS collected
    FROM months LEFT JOIN inv USING (m) LEFT JOIN pay USING (m)
    ORDER BY 1`;
}

// Expiring subscriptions in next N days
export async function getExpiringSoon({ days = 30 } = {}) {
  const today = todayIn(env.APP_TZ);
  const cutoff = addDays(today, days);
  return prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      expiryDate: { gte: today, lte: cutoff },
    },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      plan: { select: { id: true, name: true, renewable: true } },
    },
    orderBy: { expiryDate: 'asc' },
    take: 10,
  });
}

// Customer statement of account with chronological running balance and aging breakdown
export async function getCustomerStatement(customerId) {
  const cId = Number(customerId);
  const today = todayIn(env.APP_TZ);

  const [customer, invoices, payments] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: cId },
      select: { id: true, name: true, email: true, company: true, gstin: true, address: true },
    }),
    prisma.invoice.findMany({
      where: { customerId: cId, status: { in: ['CONFIRMED', 'PAID'] } },
      orderBy: { invoiceDate: 'asc' },
      select: {
        id: true,
        number: true,
        invoiceDate: true,
        dueDate: true,
        amountTotal: true,
        amountPaid: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      where: { invoice: { customerId: cId } },
      orderBy: { paymentDate: 'asc' },
      select: {
        id: true,
        receiptNumber: true,
        paymentDate: true,
        method: true,
        amount: true,
        invoice: { select: { id: true, number: true } },
      },
    }),
  ]);

  if (!customer) throw httpError(404, 'Customer not found');

  // Build combined ledger
  const transactions = [];
  for (const inv of invoices) {
    transactions.push({
      date: inv.invoiceDate,
      type: 'INVOICE',
      ref: inv.number,
      invoiceId: inv.id,
      dueDate: inv.dueDate,
      debit: Number(inv.amountTotal),
      credit: 0,
      status: inv.status,
    });
  }
  for (const pay of payments) {
    transactions.push({
      date: pay.paymentDate,
      type: 'PAYMENT',
      ref: pay.receiptNumber || `PAY-${pay.id}`,
      invoiceRef: pay.invoice?.number,
      method: pay.method,
      debit: 0,
      credit: Number(pay.amount),
    });
  }

  // Sort chronologically
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  for (const tx of transactions) {
    runningBalance += (tx.debit - tx.credit);
    tx.runningBalance = Math.round(runningBalance * 100) / 100;
  }

  // Calculate aging buckets for unpaid invoices
  let current = 0;
  let aging1to30 = 0;
  let aging31to60 = 0;
  let aging60Plus = 0;

  for (const inv of invoices) {
    const due = Number(inv.amountTotal) - Number(inv.amountPaid);
    if (due <= 0) continue;

    const diffDays = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      current += due;
    } else if (diffDays <= 30) {
      aging1to30 += due;
    } else if (diffDays <= 60) {
      aging31to60 += due;
    } else {
      aging60Plus += due;
    }
  }

  return {
    customer,
    totalInvoiced: invoices.reduce((s, i) => s + Number(i.amountTotal), 0),
    totalPaid: payments.reduce((s, p) => s + Number(p.amount), 0),
    outstandingBalance: Math.max(0, runningBalance),
    aging: {
      current: Math.round(current * 100) / 100,
      aging1to30: Math.round(aging1to30 * 100) / 100,
      aging31to60: Math.round(aging31to60 * 100) / 100,
      aging60Plus: Math.round(aging60Plus * 100) / 100,
    },
    ledger: transactions,
  };
}

// ---------- GST summary (what has to be reported to the tax office) ----------

const num = (v) => Number(v ?? 0);
const r2 = (v) => Math.round(num(v) * 100) / 100;

/**
 * Tax collected on invoices that are confirmed or paid (drafts and cancelled invoices are not tax events),
 * by month and by rate. `unsplit` is tax on older invoices that were issued before CGST/SGST/IGST were recorded.
 */
export async function getGstSummary({ from, to }) {
  const months = await prisma.$queryRaw`
    SELECT to_char("invoiceDate", 'YYYY-MM') AS month,
           COUNT(*)::int AS invoices,
           COALESCE(SUM("amountUntaxed"), 0) AS taxable,
           COALESCE(SUM("amountCgst"), 0) AS cgst,
           COALESCE(SUM("amountSgst"), 0) AS sgst,
           COALESCE(SUM("amountIgst"), 0) AS igst,
           COALESCE(SUM("amountOtherTax"), 0) AS other,
           COALESCE(SUM("amountTax"), 0) AS tax
    FROM "Invoice"
    WHERE status IN ('CONFIRMED', 'PAID') AND "invoiceDate" BETWEEN ${from}::date AND ${to}::date
    GROUP BY 1 ORDER BY 1`;

  const rates = await prisma.$queryRaw`
    SELECT l."taxRate" AS rate,
           COALESCE(SUM(l.subtotal - l."discountAmount"), 0) AS taxable,
           COALESCE(SUM(l."cgstAmount"), 0) AS cgst,
           COALESCE(SUM(l."sgstAmount"), 0) AS sgst,
           COALESCE(SUM(l."igstAmount"), 0) AS igst,
           COALESCE(SUM(l."otherTaxAmount"), 0) AS other,
           COALESCE(SUM(l."taxAmount"), 0) AS tax
    FROM "InvoiceLine" l JOIN "Invoice" i ON i.id = l."invoiceId"
    WHERE i.status IN ('CONFIRMED', 'PAID') AND i."invoiceDate" BETWEEN ${from}::date AND ${to}::date
    GROUP BY l."taxRate" ORDER BY l."taxRate"`;

  const shape = (r) => {
    const row = {
      taxable: r2(r.taxable), cgst: r2(r.cgst), sgst: r2(r.sgst), igst: r2(r.igst), other: r2(r.other), tax: r2(r.tax),
    };
    row.unsplit = r2(row.tax - row.cgst - row.sgst - row.igst - row.other);
    return row;
  };
  const byMonth = months.map((m) => ({ month: m.month, invoices: m.invoices, ...shape(m) }));
  const byRate = rates.map((x) => ({ rate: num(x.rate), ...shape(x) }));
  const sum = (rows, k) => r2(rows.reduce((a, x) => a + x[k], 0));
  const totals = Object.fromEntries(['taxable', 'cgst', 'sgst', 'igst', 'other', 'tax', 'unsplit'].map((k) => [k, sum(byMonth, k)]));
  totals.invoices = byMonth.reduce((a, x) => a + x.invoices, 0);

  return { from, to, supplier: { name: env.COMPANY_NAME, gstin: env.COMPANY_GSTIN, stateCode: env.COMPANY_STATE_CODE }, totals, byMonth, byRate };
}
