import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { computeTotals, duePeriods, addPeriods, addDays, toRupees, todayIn } from '../../lib/billing-core.js';
import { nextNumber } from '../../lib/sequence.js';
import { placeOfSupply, splitTaxLine, taxLabel } from '../../lib/gst.js';
import { lineAmounts, negate } from '../../lib/proration.js';
import { SUB_INCLUDE, lineInput, loadDiscountCandidates } from './pricing.js';

const state = { running: false, startedAt: null, finishedAt: null, processed: 0, invoicesCreated: 0, failed: [] };
export const billingStatus = () => ({ ...state, failed: [...state.failed] });

// Creates the invoice for the next due period of one subscription. Returns true if one was created.
async function billNextPeriod(tx, subscriptionId, asOf) {
  // Serialise with seat / add-on changes (which prorate): one of them finishes before the other starts.
  await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${subscriptionId} FOR UPDATE`;
  const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, include: SUB_INCLUDE });
  if (!sub || sub.status !== 'ACTIVE' || sub.isPaused) return false;

  const [period] = duePeriods({
    startDate: sub.startDate,
    billingPeriod: sub.plan.billingPeriod,
    nextPeriodIndex: sub.nextPeriodIndex,
    expiryDate: sub.expiryDate,
  }, asOf, 1);
  if (!period) return false;

  const lines = sub.lines.filter((l) => l.isActive);
  const totals = computeTotals(lines.map(lineInput), await loadDiscountCandidates(tx, sub), asOf);
  const number = await nextNumber(tx, 'INV', asOf.getUTCFullYear());

  // GST: same state as us -> CGST + SGST, another state -> IGST. Computed per line so the invoice can show each.
  const supplyState = placeOfSupply(sub.customer, env.COMPANY_STATE_CODE);
  const interState = supplyState !== env.COMPANY_STATE_CODE;
  const split = totals.lines.map((l) =>
    splitTaxLine({ taxPaise: l.tax, taxRate: l.taxRate, gstRate: l.gstRate, interState }));
  const sumOf = (k) => split.reduce((a, x) => a + x[k], 0);

  // Money owed back for seats or add-ons removed mid-period comes off this invoice, oldest first, as negative lines
  // with their own tax. A credit that would push the invoice below zero waits (with everything after it) for the next one.
  const pendingCredits = await tx.subscriptionCredit.findMany({ where: { subscriptionId: sub.id, status: 'PENDING' }, orderBy: { id: 'asc' } });
  const creditLines = [];
  let running = totals.total;
  for (const credit of pendingCredits) {
    const amounts = negate(lineAmounts({ unitPrice: Number(credit.unitPrice), quantity: credit.quantity, taxes: credit.taxes, interState }));
    if (running + amounts.total < 0) break;
    running += amounts.total;
    creditLines.push({ credit, amounts });
  }
  const creditSum = (k) => creditLines.reduce((a, { amounts }) => a + amounts[k], 0);

  const invoice = await tx.invoice.create({
    data: {
      number,
      subscriptionId: sub.id,
      customerId: sub.customerId,
      status: 'DRAFT',
      invoiceDate: asOf,
      dueDate: addDays(asOf, sub.paymentTerm.dueDays),
      periodStart: period.start,
      periodEnd: period.end,
      amountSubtotal: toRupees(totals.subtotal + creditSum('subtotal')),
      amountDiscount: toRupees(totals.discount),
      amountUntaxed: toRupees(totals.untaxed + creditSum('subtotal')),
      amountTax: toRupees(totals.tax + creditSum('tax')),
      amountTotal: toRupees(totals.total + creditSum('total')),
      supplierGstin: env.COMPANY_GSTIN,
      placeOfSupply: supplyState,
      interState,
      amountCgst: toRupees(sumOf('cgst') + creditSum('cgst')),
      amountSgst: toRupees(sumOf('sgst') + creditSum('sgst')),
      amountIgst: toRupees(sumOf('igst') + creditSum('igst')),
      amountOtherTax: toRupees(sumOf('other') + creditSum('other')),
      appliedDiscountIds: totals.appliedDiscountIds,
      customerSnapshot: {
        name: sub.customer.name,
        email: sub.customer.email,
        company: sub.customer.company,
        address: sub.customer.address,
        gstin: sub.customer.gstin,
        stateCode: supplyState,
      },
      lines: {
        create: totals.lines.map((l, i) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotal: toRupees(l.subtotal),
          discountAmount: toRupees(l.discount),
          taxRate: l.taxRate,
          taxLabel: taxLabel(l.taxes, interState) || l.taxLabel || null,
          taxAmount: toRupees(l.tax),
          hsnSac: l.hsnSac,
          cgstAmount: toRupees(split[i].cgst),
          sgstAmount: toRupees(split[i].sgst),
          igstAmount: toRupees(split[i].igst),
          otherTaxAmount: toRupees(split[i].other),
          total: toRupees(l.total),
        })).concat(creditLines.map(({ credit, amounts }) => ({
          productId: credit.productId,
          description: `Credit: ${credit.description}`,
          quantity: credit.quantity,
          unitPrice: -Number(credit.unitPrice),
          subtotal: toRupees(amounts.subtotal),
          discountAmount: 0,
          taxRate: amounts.taxRate,
          taxLabel: taxLabel(credit.taxes, interState) || null,
          taxAmount: toRupees(amounts.tax),
          hsnSac: credit.hsnSac,
          cgstAmount: toRupees(amounts.cgst),
          sgstAmount: toRupees(amounts.sgst),
          igstAmount: toRupees(amounts.igst),
          otherTaxAmount: toRupees(amounts.other),
          total: toRupees(amounts.total),
        }))),
      },
    },
  });
  if (creditLines.length) {
    await tx.subscriptionCredit.updateMany({
      where: { id: { in: creditLines.map((c) => c.credit.id) } },
      data: { status: 'APPLIED', invoiceId: invoice.id, appliedAt: new Date() },
    });
  }

  // One use per invoice; refuse to go over the limit even if two invoices race.
  for (const id of totals.appliedDiscountIds) {
    const n = await tx.$executeRaw`UPDATE "Discount" SET "usedCount" = "usedCount" + 1
      WHERE id = ${id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (n === 0) throw new Error(`Discount ${id} ran out during billing; the next run will bill without it`);
  }

  const nextIndex = period.index + 1;
  const nextStart = addPeriods(sub.startDate, sub.plan.billingPeriod, nextIndex);
  await tx.subscription.update({
    where: { id: sub.id, nextPeriodIndex: period.index }, // optimistic guard against a parallel run
    data: { nextPeriodIndex: nextIndex, nextInvoiceDate: nextStart > sub.expiryDate ? null : nextStart },
  });
  return true;
}

// Bills every due period of one subscription (catch-up), one transaction per period.
export async function billSubscription(id, asOf = todayIn(env.APP_TZ)) {
  let created = 0;
  for (let i = 0; i < 400; i++) {
    const made = await prisma.$transaction((tx) => billNextPeriod(tx, id, asOf));
    if (!made) break;
    created += 1;
  }
  return created;
}

// Bills everything that is due. Safe to call twice: the second call finds nothing to do.
export async function runBilling(asOf = todayIn(env.APP_TZ)) {
  if (state.running) return billingStatus();
  Object.assign(state, {
    running: true,
    startedAt: new Date(),
    finishedAt: null,
    processed: 0,
    invoicesCreated: 0,
    failed: [],
  });

  try {
    let cursor = 0;
    for (;;) {
      const batch = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', isPaused: false, nextInvoiceDate: { lte: asOf }, id: { gt: cursor } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 200,
      });
      if (batch.length === 0) break;
      for (const { id } of batch) {
        try {
          state.invoicesCreated += await billSubscription(id, asOf);
        } catch (e) {
          if (e.code !== 'P2002' && e.code !== 'P2025') {
            state.failed.push({ subscriptionId: id, error: e.message });
          }
        }
        state.processed += 1;
      }
      cursor = batch[batch.length - 1].id;
    }
  } finally {
    state.running = false;
    state.finishedAt = new Date();
  }
  return billingStatus();
}
