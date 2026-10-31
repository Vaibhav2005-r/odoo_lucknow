import { env } from '../../config/env.js';
import { fmtDate, todayIn, toRupees, addDays } from '../../lib/billing-core.js';
import { placeOfSupply, taxLabel } from '../../lib/gst.js';
import { lineAmounts, periodContaining, proratedUnit, remainingDays } from '../../lib/proration.js';
import { nextNumber } from '../../lib/sequence.js';

const today = () => todayIn(env.APP_TZ);
const plainTaxes = (taxes = []) => taxes.map((t) => ({ name: t.name, rate: Number(t.rate), kind: t.kind || 'GST' }));

const notApplicable = (reason) => ({ applicable: false, reason });

/**
 * What a change to the lines costs, or gives back, for the rest of the current billing period. Nothing is written.
 *   sub      the subscription with plan, customer, lines (with taxes and product)
 *   changes  [{ line: { description, productId, unitPrice, taxes, hsnSac }, deltaQty }]  (deltaQty > 0 adds, < 0 removes)
 * Not applicable (so the change simply starts with the next invoice) unless billing is running and the current period
 * has already been invoiced.
 */
export function planProration(sub, changes, onDate = today()) {
  const real = changes.filter((c) => c.deltaQty !== 0);
  if (real.length === 0) return notApplicable('Nothing changes in what is billed.');
  if (sub.status !== 'ACTIVE') return notApplicable('This subscription is not active yet, so there is nothing to prorate: the price is on its first invoice.');
  if (sub.isPaused) return notApplicable('Billing is paused. The change applies when billing resumes.');

  const period = periodContaining({ startDate: sub.startDate, billingPeriod: sub.plan.billingPeriod, expiryDate: sub.expiryDate }, onDate);
  if (!period) return notApplicable('The subscription is outside its term, so the change applies from the next invoice.');
  if (sub.nextPeriodIndex <= period.index) return notApplicable('The current period has not been invoiced yet, so the change is on that invoice at full price.');

  const { days, totalDays } = remainingDays(period, onDate);
  const interState = placeOfSupply(sub.customer, env.COMPANY_STATE_CODE) !== env.COMPANY_STATE_CODE;
  const items = real.map(({ line, deltaQty }) => {
    const unitProrated = proratedUnit(line.unitPrice, days, totalDays);
    const taxes = plainTaxes(line.taxes);
    return {
      direction: deltaQty > 0 ? 'CHARGE' : 'CREDIT',
      description: line.description,
      productId: line.productId,
      hsnSac: line.hsnSac || null,
      quantity: Math.abs(deltaQty),
      unitFull: Number(line.unitPrice),
      unitProrated,
      taxes,
      amounts: lineAmounts({ unitPrice: unitProrated, quantity: Math.abs(deltaQty), taxes, interState }),
    };
  });
  const sum = (dir) => items.filter((i) => i.direction === dir).reduce((a, i) => a + i.amounts.total, 0);
  return {
    applicable: true,
    period: { start: period.start, end: period.end, index: period.index },
    from: onDate,
    days,
    totalDays,
    interState,
    items,
    chargePaise: sum('CHARGE'),
    creditPaise: sum('CREDIT'),
  };
}

/** The plan as the API returns it (rupees, ISO dates, no internals). */
export function summarise(plan, extra = {}) {
  if (!plan?.applicable) return { applicable: false, reason: plan?.reason || null, ...extra };
  return {
    applicable: true,
    from: fmtDate(plan.from),
    periodStart: fmtDate(plan.period.start),
    periodEnd: fmtDate(plan.period.end),
    days: plan.days,
    totalDays: plan.totalDays,
    charge: toRupees(plan.chargePaise),
    credit: toRupees(plan.creditPaise),
    items: plan.items.map((i) => ({
      direction: i.direction,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitFull,
      unitPriceProrated: i.unitProrated,
      tax: toRupees(i.amounts.tax),
      total: toRupees(i.amounts.total),
    })),
    ...extra,
  };
}

// An adjustment invoice for the charges. A customer who confirmed the price on screen gets it ready to pay;
// when staff make the change it is a draft they review like any other invoice.
async function createAdjustmentInvoice(tx, sub, plan, charges, user) {
  const asOf = plan.from;
  const confirmedNow = user?.role === 'CUSTOMER';
  const sum = (k) => charges.reduce((a, c) => a + c.amounts[k], 0);
  const state = placeOfSupply(sub.customer, env.COMPANY_STATE_CODE);
  const number = await nextNumber(tx, 'INV', asOf.getUTCFullYear());
  return tx.invoice.create({
    data: {
      number,
      kind: 'ADJUSTMENT',
      subscriptionId: sub.id,
      customerId: sub.customerId,
      status: confirmedNow ? 'CONFIRMED' : 'DRAFT',
      confirmedAt: confirmedNow ? new Date() : null,
      invoiceDate: asOf,
      dueDate: addDays(asOf, sub.paymentTerm.dueDays),
      notes: `Prorated for ${plan.days} of ${plan.totalDays} days, ${fmtDate(asOf)} to ${fmtDate(plan.period.end)}.`,
      amountSubtotal: toRupees(sum('subtotal')),
      amountDiscount: 0,
      amountUntaxed: toRupees(sum('subtotal')),
      amountTax: toRupees(sum('tax')),
      amountTotal: toRupees(sum('total')),
      supplierGstin: env.COMPANY_GSTIN,
      placeOfSupply: state,
      interState: plan.interState,
      amountCgst: toRupees(sum('cgst')),
      amountSgst: toRupees(sum('sgst')),
      amountIgst: toRupees(sum('igst')),
      amountOtherTax: toRupees(sum('other')),
      customerSnapshot: {
        name: sub.customer.name, email: sub.customer.email, company: sub.customer.company,
        address: sub.customer.address, gstin: sub.customer.gstin, stateCode: state,
      },
      lines: {
        create: charges.map((c) => ({
          productId: c.productId,
          description: `${c.description} (prorated, ${plan.days} of ${plan.totalDays} days)`,
          quantity: c.quantity,
          unitPrice: c.unitProrated,
          subtotal: toRupees(c.amounts.subtotal),
          discountAmount: 0,
          taxRate: c.amounts.taxRate,
          taxLabel: taxLabel(c.taxes, plan.interState) || null,
          taxAmount: toRupees(c.amounts.tax),
          hsnSac: c.hsnSac,
          cgstAmount: toRupees(c.amounts.cgst),
          sgstAmount: toRupees(c.amounts.sgst),
          igstAmount: toRupees(c.amounts.igst),
          otherTaxAmount: toRupees(c.amounts.other),
          total: toRupees(c.amounts.total),
        })),
      },
    },
  });
}

/** Writes the plan: an adjustment invoice for the charges, pending credits for the refunds. Returns what was created. */
export async function applyProration(tx, sub, plan, user) {
  if (!plan?.applicable) return { invoice: null, credits: 0 };
  const charges = plan.items.filter((i) => i.direction === 'CHARGE');
  const refunds = plan.items.filter((i) => i.direction === 'CREDIT');

  const invoice = charges.length ? await createAdjustmentInvoice(tx, sub, plan, charges, user) : null;
  for (const r of refunds) {
    await tx.subscriptionCredit.create({
      data: {
        subscriptionId: sub.id,
        description: `${r.description} (${r.quantity} unit${r.quantity === 1 ? '' : 's'} removed with ${plan.days} of ${plan.totalDays} days left)`,
        productId: r.productId,
        hsnSac: r.hsnSac,
        quantity: r.quantity,
        unitPrice: r.unitProrated,
        taxes: r.taxes,
        periodStart: plan.from,
        periodEnd: plan.period.end,
        createdById: user?.id ?? null,
      },
    });
  }
  return { invoice, credits: refunds.length };
}
