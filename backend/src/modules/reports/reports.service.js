import { prisma } from '../../lib/prisma.js';
import { fmtDate, todayIn, addDays } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';

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
