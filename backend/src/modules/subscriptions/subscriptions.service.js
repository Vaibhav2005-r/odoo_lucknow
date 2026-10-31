import { prisma } from '../../lib/prisma.js';
import { todayIn, addDays, addMonthsClamped, addPeriods, parseDate, toPaise, toRupees } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { httpError } from '../../lib/http-error.js';
import { nextNumber } from '../../lib/sequence.js';
import { billSubscription } from '../billing/billing.service.js';
import { SUB_INCLUDE, recalcSubscription } from '../billing/pricing.js';
import { applyProration, planProration, summarise } from './proration.service.js';

const today = () => todayIn(env.APP_TZ);

// ---------- Lines ----------

// Price rule from the PDF: plan price for the plan's own product, list price for add-ons,
// and a chosen variant (e.g. brand = Odoo) adds its extra price on top.
export async function buildLine(db, plan, { productId, variantId = null, quantity, unitPrice }) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { taxes: { where: { isActive: true }, select: { id: true } }, variants: true },
  });
  if (!product) throw httpError(422, `Product ${productId} does not exist`);
  if (!product.isActive) throw httpError(422, `${product.name} is inactive and cannot be sold`);

  let variant = null;
  if (variantId) {
    variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw httpError(422, `Variant ${variantId} does not belong to ${product.name}`);
    if (!variant.isActive) throw httpError(422, `Variant ${variant.attribute}: ${variant.value} is inactive`);
  }

  const base = product.id === plan.productId ? Number(plan.price) : Number(product.salesPrice);
  const price = unitPrice != null ? Number(unitPrice) : toRupees(toPaise(base) + toPaise(variant?.extraPrice ?? 0));
  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    description: variant ? `${product.name} (${variant.attribute}: ${variant.value})` : product.name,
    quantity,
    unitPrice: price,
    taxes: { connect: product.taxes.map((t) => ({ id: t.id })) },
  };
}

// The line that carries the plan itself can be resized but never switched off or removed.
export const isBaseLine = (line, plan) => line.productId === plan.productId;

function assertPlanOpen(plan, startDate) {
  if (!plan.isActive) throw httpError(422, 'This plan is not open for new subscriptions');
  if (startDate < parseDate(plan.startDate)) throw httpError(422, 'The plan is not available yet on that start date');
  if (plan.endDate && startDate > parseDate(plan.endDate)) throw httpError(422, 'The plan is no longer available on that start date');
}

function assertBaseQuantity(plan, lines) {
  const base = lines.find((l) => l.productId === plan.productId);
  if (!base) throw httpError(422, 'The subscription must include the plan product');
  if (base.quantity < plan.minQuantity) {
    throw httpError(422, `This plan needs a minimum quantity of ${plan.minQuantity}`);
  }
}

async function assertDiscount(db, discountId) {
  if (!discountId) return;
  const d = await db.discount.findUnique({ where: { id: discountId } });
  if (!d) throw httpError(422, 'Selected discount does not exist');
  if (d.scope !== 'SUBSCRIPTION') throw httpError(422, 'Only whole-subscription discounts can be attached here');
}

export const defaultExpiry = (start) => addDays(addMonthsClamped(start, 12), -1);

// ---------- Create ----------

/**
 * input: { customerId, planId, templateId?, paymentTermId?, startDate?, expiryDate?, discountId?, notes?,
 *          lines?: [{ productId, variantId?, quantity, unitPrice? }], sendQuotation? }
 * A template supplies plan, payment term, validity and lines unless the input overrides them.
 */
export async function createSubscription(input, user) {
  const asOf = today();
  const template = input.templateId
    ? await prisma.quotationTemplate.findUnique({ where: { id: input.templateId }, include: { lines: true } })
    : null;
  if (input.templateId && !template) throw httpError(422, 'Selected quotation template does not exist');
  if (template && !template.isActive) throw httpError(422, 'That quotation template is inactive');

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw httpError(422, 'Selected customer does not exist');

  const planId = input.planId ?? template?.planId;
  const plan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null;
  if (!plan) throw httpError(422, 'A plan is required');

  const paymentTermId = input.paymentTermId ?? template?.paymentTermId;
  const term = paymentTermId
    ? await prisma.paymentTerm.findUnique({ where: { id: paymentTermId } })
    : await prisma.paymentTerm.findFirst({ where: { isActive: true }, orderBy: { dueDays: 'asc' } });
  if (!term) throw httpError(422, 'A payment term is required');

  const startDate = input.startDate ? parseDate(input.startDate) : asOf;
  assertPlanOpen(plan, startDate);
  const expiryDate = input.expiryDate ? parseDate(input.expiryDate) : defaultExpiry(startDate);
  if (expiryDate < startDate) throw httpError(422, 'Expiry date must be on or after the start date');
  await assertDiscount(prisma, input.discountId);

  let rawLines = input.lines?.length
    ? input.lines
    : (template?.lines || []).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
  if (!rawLines.some((l) => l.productId === plan.productId)) {
    rawLines = [{ productId: plan.productId, quantity: plan.minQuantity }, ...rawLines];
  }
  assertBaseQuantity(plan, rawLines);

  const validityDays = template?.validityDays ?? 30;
  const status = input.sendQuotation ? 'QUOTATION' : 'DRAFT';

  return prisma.$transaction(async (tx) => {
    const lines = [];
    for (const l of rawLines) lines.push(await buildLine(tx, plan, l));

    const sub = await tx.subscription.create({
      data: {
        number: await nextNumber(tx, 'SUB', asOf.getUTCFullYear()),
        customerId: customer.id,
        planId: plan.id,
        templateId: template?.id ?? null,
        paymentTermId: term.id,
        discountId: input.discountId ?? null,
        status,
        startDate,
        expiryDate,
        quoteValidUntil: addDays(asOf, validityDays),
        notes: input.notes ?? template?.notes ?? null,
        lines: { create: lines },
        history: {
          create: {
            action: 'CREATED',
            toStatus: status,
            note: template ? `Created from template "${template.name}"` : 'Created manually',
            userId: user?.id ?? null,
          },
        },
      },
    });
    await recalcSubscription(tx, sub.id, asOf);
    return sub;
  });
}

// ---------- Edit (before the customer has agreed) ----------

export async function updateSubscription(id, input, user) {
  const sub = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!sub) throw httpError(404, 'Subscription not found');
  if (!['DRAFT', 'QUOTATION'].includes(sub.status)) {
    throw httpError(409, 'Only draft or quotation subscriptions can be edited');
  }
  const startDate = input.startDate ? parseDate(input.startDate) : sub.startDate;
  const expiryDate = input.expiryDate ? parseDate(input.expiryDate) : sub.expiryDate;
  if (expiryDate < startDate) throw httpError(422, 'Expiry date must be on or after the start date');
  if (input.startDate) assertPlanOpen(sub.plan, startDate);
  if (input.discountId) await assertDiscount(prisma, input.discountId);
  if (input.paymentTermId && !(await prisma.paymentTerm.findUnique({ where: { id: input.paymentTermId } }))) {
    throw httpError(422, 'Selected payment term does not exist');
  }

  return prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: {
        startDate,
        expiryDate,
        ...(input.paymentTermId ? { paymentTermId: input.paymentTermId } : {}),
        ...(input.discountId !== undefined ? { discountId: input.discountId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.quoteValidUntil ? { quoteValidUntil: parseDate(input.quoteValidUntil) } : {}),
        history: { create: { action: 'UPDATED', note: 'Subscription details edited', userId: user?.id ?? null } },
      },
    });
    return recalcSubscription(tx, id, today());
  });
}

// ---------- Lifecycle ----------

export async function transition(id, from, to, action, { note, userId = null, data = {} } = {}) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.subscription.findUnique({ where: { id } });
    if (!s) throw httpError(404, 'Subscription not found');
    if (!from.includes(s.status)) {
      throw httpError(409, `A ${s.status.toLowerCase()} subscription cannot move to ${to.toLowerCase()}`);
    }
    const updated = await tx.subscription.update({ where: { id }, data: { status: to, ...data } });
    await tx.subscriptionLog.create({
      data: { subscriptionId: id, fromStatus: s.status, toStatus: to, action, note: note ?? null, userId },
    });
    return updated;
  });
}

// CONFIRMED -> ACTIVE and bill the first period(s) that are already due. Idempotent.
export async function activateSubscription(id, asOf = today(), userId = null) {
  await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.findUnique({ where: { id } });
    if (!s) throw httpError(404, 'Subscription not found');
    if (s.status !== 'CONFIRMED') throw httpError(409, 'Only confirmed subscriptions can be activated');
    await tx.subscription.update({
      where: { id },
      data: { status: 'ACTIVE', nextPeriodIndex: 0, nextInvoiceDate: s.startDate },
    });
    await tx.subscriptionLog.create({
      data: { subscriptionId: id, action: 'ACTIVATED', fromStatus: 'CONFIRMED', toStatus: 'ACTIVE', userId },
    });
  });
  return billSubscription(id, asOf);
}

// QUOTATION/DRAFT -> CONFIRMED, then go live at once if the start date has arrived.
export async function confirm(id, userId = null, note = null) {
  await transition(id, ['DRAFT', 'QUOTATION'], 'CONFIRMED', 'CONFIRMED', { note, userId });
  await activateDueSubscriptions(today(), [id]);
}

export async function activateDueSubscriptions(asOf = today(), onlyIds = null) {
  const due = await prisma.subscription.findMany({
    where: { status: 'CONFIRMED', startDate: { lte: asOf }, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    select: { id: true },
  });
  for (const { id } of due) {
    try {
      await activateSubscription(id, asOf);
    } catch (e) {
      if (e.status !== 409) throw e; // another worker got there first
    }
  }
  return due.length;
}

// Extend an active subscription. Default: one more year past the current expiry.
export async function renewSubscription(id, newExpiry, userId = null) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!s) throw httpError(404, 'Subscription not found');
    if (s.status !== 'ACTIVE') throw httpError(409, 'Only active subscriptions can be renewed');
    if (!s.plan.renewable) throw httpError(409, 'This plan does not allow renewal');

    const expiry = newExpiry ? parseDate(newExpiry) : addMonthsClamped(s.expiryDate, 12);
    if (expiry <= s.expiryDate) throw httpError(422, 'The new expiry date must be after the current one');

    const nextStart = addPeriods(s.startDate, s.plan.billingPeriod, s.nextPeriodIndex);
    await tx.subscription.update({
      where: { id },
      data: { expiryDate: expiry, nextInvoiceDate: nextStart <= expiry ? nextStart : null },
    });
    await tx.subscriptionLog.create({
      data: {
        subscriptionId: id,
        action: 'RENEWED',
        fromStatus: 'ACTIVE',
        toStatus: 'ACTIVE',
        note: `Expiry extended from ${s.expiryDate.toISOString().slice(0, 10)} to ${expiry.toISOString().slice(0, 10)}`,
        userId,
      },
    });
    return tx.subscription.findUnique({ where: { id } });
  });
}

export async function autoCloseExpired(asOf = today()) {
  const subs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', expiryDate: { lt: asOf }, plan: { autoClose: true } },
    select: { id: true },
  });

  for (const { id } of subs) {
    await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findUnique({ where: { id } });
      if (!s || s.status !== 'ACTIVE') return;
      await tx.subscription.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closeReason: 'Expired (auto-close plan)',
          nextInvoiceDate: null,
          isPaused: false,
        },
      });
      await tx.subscriptionLog.create({
        data: {
          subscriptionId: id,
          action: 'AUTO_CLOSED',
          fromStatus: 'ACTIVE',
          toStatus: 'CLOSED',
          note: 'Plan closes automatically at expiry',
        },
      });
    });
  }
  return subs.length;
}

// ---------- Lines on an existing subscription ----------
//
// Changing the lines of a subscription that is already being billed is prorated: more units cost the remaining
// part of the current period now (an adjustment invoice), fewer units give the unused part back (a credit taken off
// the next invoice). Pass { dryRun: true } to see the figures without changing anything.

const lockSubscription = (tx, id) => tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${id} FOR UPDATE`;
const effectiveQty = (l) => (l.isActive ? l.quantity : 0);

async function loadForChange(tx, id) {
  await lockSubscription(tx, id); // changes, billing runs and other changes take turns
  const sub = await tx.subscription.findUnique({ where: { id }, include: SUB_INCLUDE });
  if (!sub) throw httpError(404, 'Subscription not found');
  if (sub.status === 'CLOSED') throw httpError(409, 'Closed subscriptions cannot be changed');
  return sub;
}

const asLine = (l) => ({ description: l.description, productId: l.productId, unitPrice: l.unitPrice, taxes: l.taxes, hsnSac: l.product?.hsnSac ?? null });
const invoiceInfo = (inv) => (inv ? { id: inv.id, number: inv.number, status: inv.status } : undefined);

export async function addLine(id, input, user, { dryRun = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const sub = await loadForChange(tx, id);
    const line = await buildLine(tx, sub.plan, input);
    const taxes = await tx.tax.findMany({ where: { id: { in: line.taxes.connect.map((t) => t.id) } } });
    const product = await tx.product.findUnique({ where: { id: line.productId }, select: { hsnSac: true } });
    const plan = planProration(sub, [{ line: { description: line.description, productId: line.productId, unitPrice: line.unitPrice, taxes, hsnSac: product?.hsnSac }, deltaQty: line.quantity }]);
    if (dryRun) return { proration: summarise(plan) };

    await tx.subscriptionLine.create({ data: { ...line, subscriptionId: id } });
    await tx.subscriptionLog.create({ data: { subscriptionId: id, action: 'ADDON_ADDED', note: line.description, userId: user?.id ?? null } });
    const subscription = await recalcSubscription(tx, id, today());
    const done = await applyProration(tx, sub, plan, user);
    return { subscription, proration: summarise(plan, { invoice: invoiceInfo(done.invoice) }) };
  });
}

export async function updateLine(id, lineId, input, user, { dryRun = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const sub = await loadForChange(tx, id);
    const line = sub.lines.find((l) => l.id === lineId);
    if (!line) throw httpError(404, 'Line not found');

    const base = isBaseLine(line, sub.plan);
    if (base && input.isActive === false) throw httpError(409, 'The plan line cannot be switched off');
    if (base && input.quantity != null && input.quantity < sub.plan.minQuantity) {
      throw httpError(422, `This plan needs a minimum quantity of ${sub.plan.minQuantity}`);
    }

    const nextActive = input.isActive ?? line.isActive;
    const nextQty = input.quantity ?? line.quantity;
    const plan = planProration(sub, [{ line: asLine(line), deltaQty: (nextActive ? nextQty : 0) - effectiveQty(line) }]);
    if (dryRun) return { proration: summarise(plan) };

    await tx.subscriptionLine.update({ where: { id: lineId }, data: { ...(input.isActive != null ? { isActive: input.isActive } : {}), ...(input.quantity != null ? { quantity: input.quantity } : {}) } });
    const action = input.isActive == null ? 'LINE_UPDATED' : input.isActive ? 'ADDON_ON' : 'ADDON_OFF';
    await tx.subscriptionLog.create({ data: { subscriptionId: id, action, note: line.description, userId: user?.id ?? null } });
    const subscription = await recalcSubscription(tx, id, today());
    const done = await applyProration(tx, sub, plan, user);
    return { subscription, proration: summarise(plan, { invoice: invoiceInfo(done.invoice) }) };
  });
}

export async function removeLine(id, lineId, user, { dryRun = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const sub = await loadForChange(tx, id);
    const line = sub.lines.find((l) => l.id === lineId);
    if (!line) throw httpError(404, 'Line not found');
    if (isBaseLine(line, sub.plan)) throw httpError(409, 'The plan line cannot be removed');

    const plan = planProration(sub, [{ line: asLine(line), deltaQty: -effectiveQty(line) }]);
    if (dryRun) return { proration: summarise(plan) };

    await tx.subscriptionLine.delete({ where: { id: lineId } });
    await tx.subscriptionLog.create({ data: { subscriptionId: id, action: 'ADDON_REMOVED', note: line.description, userId: user?.id ?? null } });
    const subscription = await recalcSubscription(tx, id, today());
    const done = await applyProration(tx, sub, plan, user);
    return { subscription, proration: summarise(plan, { invoice: invoiceInfo(done.invoice) }) };
  });
}
