import { computeTotals, todayIn, toRupees, toPaise } from '../../lib/billing-core.js';

export const SUB_INCLUDE = {
  customer: true,
  plan: true,
  paymentTerm: true,
  discount: { include: { products: { select: { id: true } } } },
  lines: { include: { taxes: true, product: { select: { hsnSac: true } } }, orderBy: { id: 'asc' } },
};

export const toRule = (d) => ({
  id: d.id,
  type: d.type,
  value: Number(d.value),
  scope: d.scope,
  productIds: (d.products || []).map((p) => p.id),
  minPurchase: d.minPurchase == null ? null : Number(d.minPurchase),
  minQuantity: d.minQuantity,
  startDate: d.startDate,
  endDate: d.endDate,
  usageLimit: d.usageLimit,
  usedCount: d.usedCount,
  isActive: d.isActive,
});

export const lineInput = (l) => ({
  productId: l.productId,
  quantity: l.quantity,
  unitPrice: Number(l.unitPrice),
  taxRates: (l.taxes || []).map((t) => Number(t.rate)),
  // the GST part of the line's tax (cess and other taxes are charged as they are)
  gstRate: (l.taxes || []).filter((t) => t.kind !== 'OTHER').reduce((a, t) => a + Number(t.rate), 0),
  taxes: l.taxes || [],
  hsnSac: l.product?.hsnSac ?? null,
  isActive: l.isActive,
  description: l.description,
  taxLabel: (l.taxes || []).map((t) => t.name).join(', '),
});

// Product-scope discounts for the products on this subscription + its own whole-subscription discount.
export async function loadDiscountCandidates(db, sub) {
  const productIds = [...new Set((sub.lines || []).map((l) => l.productId))];
  const productRules = await db.discount.findMany({
    where: { scope: 'PRODUCT', isActive: true, products: { some: { id: { in: productIds } } } },
    include: { products: { select: { id: true } } },
  });
  const rules = productRules.map(toRule);
  if (sub.discount && sub.discount.scope === 'SUBSCRIPTION') {
    rules.push(toRule(sub.discount));
  }
  return rules;
}

// Recompute and store line amounts + header totals. Call after any line/discount change.
export async function recalcSubscription(tx, id, asOf = todayIn()) {
  const sub = await tx.subscription.findUnique({ where: { id }, include: SUB_INCLUDE });
  if (!sub) return null;

  const t = computeTotals(sub.lines.map(lineInput), await loadDiscountCandidates(tx, sub), asOf);
  const active = sub.lines.filter((l) => l.isActive);

  for (const [i, l] of active.entries()) {
    const c = t.lines[i];
    await tx.subscriptionLine.update({
      where: { id: l.id },
      data: {
        subtotal: toRupees(c.subtotal),
        discountAmount: toRupees(c.discount),
        taxAmount: toRupees(c.tax),
        total: toRupees(c.total),
      },
    });
  }

  for (const l of sub.lines.filter((x) => !x.isActive)) {
    await tx.subscriptionLine.update({
      where: { id: l.id },
      data: {
        subtotal: toRupees(l.quantity * toPaise(l.unitPrice)),
        discountAmount: 0,
        taxAmount: 0,
        total: 0,
      },
    });
  }

  return tx.subscription.update({
    where: { id },
    data: {
      amountSubtotal: toRupees(t.subtotal),
      amountDiscount: toRupees(t.discount),
      amountUntaxed: toRupees(t.untaxed),
      amountTax: toRupees(t.tax),
      amountTotal: toRupees(t.total),
    },
  });
}
