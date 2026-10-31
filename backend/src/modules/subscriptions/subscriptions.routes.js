import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { paramId, paginate } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';
import { todayIn, parseDate, canMove, SUBSCRIPTION_FLOW, resumePeriodIndex } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { sendMail } from '../../lib/mailer.js';
import {
  activateDueSubscriptions,
  activateSubscription,
  confirm,
  addLine,
  createSubscription,
  removeLine,
  renewSubscription,
  transition,
  updateLine,
  updateSubscription,
} from './subscriptions.service.js';

const router = Router();
const today = () => todayIn(env.APP_TZ);

const actor = (req) => `${req.user.role.toLowerCase()} #${req.user.id}`;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const id$ = z.coerce.number().int().positive();
const lineInput = z.object({
  productId: id$,
  variantId: id$.nullable().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0).optional(),
});
const createSchema = z.object({
  customerId: id$,
  planId: id$.optional(),
  templateId: id$.optional(),
  paymentTermId: id$.optional(),
  discountId: id$.nullable().optional(),
  startDate: dateStr.optional(),
  expiryDate: dateStr.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(lineInput).max(50).optional(),
  sendQuotation: z.boolean().optional(),
}).refine((d) => d.planId || d.templateId, { message: 'Choose a plan or a quotation template', path: ['planId'] });
const updateSchema = z.object({
  paymentTermId: id$.optional(),
  discountId: id$.nullable().optional(),
  startDate: dateStr.optional(),
  expiryDate: dateStr.optional(),
  quoteValidUntil: dateStr.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const lineUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
}).refine((d) => d.isActive != null || d.quantity != null, { message: 'Nothing to update' });
const renewSchema = z.object({ expiryDate: dateStr.optional() });

const FULL_INCLUDE = {
  customer: { select: { id: true, name: true, email: true, phone: true, company: true, address: true, gstin: true, userId: true } },
  plan: { include: { product: { select: { id: true, name: true, type: true } } } },
  template: { select: { id: true, name: true } },
  paymentTerm: { select: { id: true, name: true, dueDays: true } },
  discount: { select: { id: true, name: true, type: true, value: true } },
  lines: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { id: true, name: true, type: true } },
      variant: { select: { id: true, attribute: true, value: true, extraPrice: true } },
      taxes: { select: { id: true, name: true, rate: true } },
    },
  },
  invoices: {
    orderBy: { invoiceDate: 'desc' },
    select: { id: true, number: true, status: true, invoiceDate: true, dueDate: true, periodStart: true, periodEnd: true, amountTotal: true, amountPaid: true },
  },
  history: { orderBy: { createdAt: 'desc' }, take: 50 },
};
const fetchFull = (id) => prisma.subscription.findUnique({ where: { id }, include: FULL_INCLUDE });

// Customers may only touch their own subscriptions; anyone else gets a plain 404.
async function loadOwned(req, id) {
  const sub = await prisma.subscription.findUnique({ where: { id }, include: { customer: true, plan: true } });
  if (!sub) throw httpError(404, 'Subscription not found');
  if (req.user.role === 'CUSTOMER') {
    const mine = req.user.customerId === sub.customerId || sub.customer?.userId === req.user.id;
    if (!mine) throw httpError(404, 'Subscription not found');
  }
  return sub;
}

// GET /api/subscriptions - List subscriptions / quotations
router.get('/', requireAuth, async (req, res) => {
  const { status, search, page: pageQuery, pageSize: pageSizeQuery } = req.query;
  const { page, pageSize, skip, take } = paginate({ page: pageQuery, pageSize: pageSizeQuery });

  const where = {};

  // Role data isolation: Customers can strictly only view their own subscriptions
  if (req.user.role === 'CUSTOMER') {
    let customerId = req.user.customerId;
    if (!customerId) {
      const cust = await prisma.customer.findFirst({
        where: { OR: [{ userId: req.user.id }, { email: req.user.email }] },
        select: { id: true },
      });
      customerId = cust?.id;
    }
    if (!customerId) {
      return res.json({ data: [], meta: { page: 1, pageSize, total: 0, totalPages: 0 } });
    }
    where.customerId = customerId;
  } else if (req.query.customerId) {
    where.customerId = Number(req.query.customerId);
  }

  // Status filter (e.g. QUOTATION, ACTIVE, etc.)
  if (status === 'PAUSED') {
    where.status = 'ACTIVE';
    where.isPaused = true;
  } else if (status) {
    where.status = status;
    if (status === 'ACTIVE') where.isPaused = false;
  }
  if (req.query.planId) where.planId = Number(req.query.planId);

  // Search by number or plan name
  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { number: { contains: s, mode: 'insensitive' } },
      { plan: { name: { contains: s, mode: 'insensitive' } } },
      { customer: { name: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const [subscriptions, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, email: true, company: true },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            billingPeriod: true,
            closable: true,
            pausable: true,
            renewable: true,
          },
        },
        paymentTerm: { select: { id: true, name: true, dueDays: true } },
        lines: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        _count: { select: { invoices: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  res.json({
    data: subscriptions,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// GET /api/subscriptions/stats - counts per status for the list page
router.get('/stats', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const rows = await prisma.subscription.groupBy({ by: ['status', 'isPaused'], _count: { _all: true } });
  const out = { total: 0, draft: 0, quotation: 0, confirmed: 0, active: 0, paused: 0, closed: 0 };
  for (const r of rows) {
    const n = r._count._all;
    out.total += n;
    if (r.status === 'ACTIVE' && r.isPaused) out.paused += n;
    else out[r.status.toLowerCase()] += n;
  }
  res.json({ data: out });
});

// POST /api/subscriptions - create a draft (or quotation) manually or from a template
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createSchema), async (req, res) => {
  const sub = await createSubscription(req.body, req.user);
  res.status(201).json({ data: await fetchFull(sub.id) });
});

// GET /api/subscriptions/:id - Get detailed subscription/quotation
router.get('/:id', requireAuth, async (req, res) => {
  const id = paramId(req);

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true, company: true, address: true, gstin: true, userId: true },
      },
      plan: {
        select: {
          id: true,
          name: true,
          price: true,
          billingPeriod: true,
          closable: true,
          pausable: true,
          renewable: true,
          autoClose: true,
        },
      },
      paymentTerm: { select: { id: true, name: true, dueDays: true } },
      discount: { select: { id: true, name: true, type: true, value: true } },
      lines: {
        include: {
          product: { select: { id: true, name: true, type: true } },
          taxes: { select: { id: true, name: true, rate: true } },
        },
      },
      invoices: {
        orderBy: { invoiceDate: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          invoiceDate: true,
          dueDate: true,
          amountTotal: true,
          amountPaid: true,
        },
      },
      history: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!subscription) throw httpError(404, 'Subscription not found');

  // Customer data isolation check
  if (req.user.role === 'CUSTOMER') {
    const isOwner =
      req.user.customerId === subscription.customerId ||
      subscription.customer?.userId === req.user.id ||
      subscription.customer?.email === req.user.email;

    if (!isOwner) {
      throw httpError(404, 'Subscription not found');
    }
  }

  res.json({ data: subscription });
});

// POST /api/subscriptions/:id/accept-quote - Customer accepts a quotation
router.post('/:id/accept-quote', requireAuth, async (req, res) => {
  const id = paramId(req);

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { customer: true, plan: true },
  });

  if (!sub) throw httpError(404, 'Quotation not found');

  // Customer ownership validation
  if (req.user.role === 'CUSTOMER') {
    const isOwner =
      req.user.customerId === sub.customerId ||
      sub.customer?.userId === req.user.id ||
      sub.customer?.email === req.user.email;

    if (!isOwner) throw httpError(404, 'Quotation not found');
  }

  // Must be in QUOTATION or DRAFT status to accept
  if (sub.status !== 'QUOTATION' && sub.status !== 'DRAFT') {
    throw httpError(400, `Cannot accept subscription in ${sub.status} status`);
  }

  // Check quotation expiry
  const currentDate = today();
  if (sub.quoteValidUntil && parseDate(sub.quoteValidUntil) < currentDate) {
    throw httpError(400, 'This quotation has expired and can no longer be accepted');
  }

  // Transition to CONFIRMED
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
      },
      include: {
        customer: true,
        plan: true,
        lines: true,
      },
    });

    await tx.subscriptionLog.create({
      data: {
        subscriptionId: id,
        fromStatus: sub.status,
        toStatus: 'CONFIRMED',
        action: 'CONFIRMED',
        note: `Quotation accepted by customer (${actor(req)})`,
        userId: req.user.id,
      },
    });

    return s;
  });

  // If start date is today or in the past, activate immediately and generate first invoice
  try {
    await activateDueSubscriptions(currentDate, [id]);
  } catch (err) {
    console.error('Error activating accepted subscription:', err);
  }

  const finalSub = await prisma.subscription.findUnique({
    where: { id },
    include: { customer: true, plan: true, lines: true },
  });

  res.json({ data: finalSub, message: 'Quotation accepted successfully!' });
});

// POST /api/subscriptions/:id/pause - Pause an active subscription (if plan allows)
router.post('/:id/pause', requireAuth, async (req, res) => {
  const id = paramId(req);
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { customer: true, plan: true },
  });
  if (!sub) throw httpError(404, 'Subscription not found');

  if (req.user.role === 'CUSTOMER') {
    const isOwner =
      req.user.customerId === sub.customerId ||
      sub.customer?.userId === req.user.id ||
      sub.customer?.email === req.user.email;
    if (!isOwner) throw httpError(404, 'Subscription not found');
  }

  if (!sub.plan.pausable) {
    throw httpError(400, 'This plan does not permit pausing subscriptions');
  }
  if (sub.status !== 'ACTIVE') {
    throw httpError(400, 'Only active subscriptions can be paused');
  }
  if (sub.isPaused) {
    throw httpError(400, 'Subscription is already paused');
  }

  const currentDate = today();
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id },
      data: { isPaused: true, pausedAt: currentDate },
    });
    await tx.subscriptionLog.create({
      data: {
        subscriptionId: id,
        action: 'PAUSED',
        note: `Subscription paused by ${actor(req)}`,
        userId: req.user.id,
      },
    });
    return s;
  });

  res.json({ data: updated, message: 'Subscription paused successfully' });
});

// POST /api/subscriptions/:id/resume - Resume a paused subscription
router.post('/:id/resume', requireAuth, async (req, res) => {
  const id = paramId(req);
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { customer: true, plan: true },
  });
  if (!sub) throw httpError(404, 'Subscription not found');

  if (req.user.role === 'CUSTOMER') {
    const isOwner =
      req.user.customerId === sub.customerId ||
      sub.customer?.userId === req.user.id ||
      sub.customer?.email === req.user.email;
    if (!isOwner) throw httpError(404, 'Subscription not found');
  }

  if (!sub.isPaused) {
    throw httpError(400, 'Subscription is not paused');
  }

  const currentDate = today();
  const nextIdx = resumePeriodIndex(
    {
      startDate: sub.startDate,
      billingPeriod: sub.plan.billingPeriod,
      nextPeriodIndex: sub.nextPeriodIndex,
    },
    currentDate
  );

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id },
      data: {
        isPaused: false,
        pausedAt: null,
        nextPeriodIndex: nextIdx,
      },
    });
    await tx.subscriptionLog.create({
      data: {
        subscriptionId: id,
        action: 'RESUMED',
        note: `Subscription resumed by ${actor(req)}`,
        userId: req.user.id,
      },
    });
    return s;
  });

  res.json({ data: updated, message: 'Subscription resumed successfully' });
});

// POST /api/subscriptions/:id/close - Close a subscription (if plan allows)
router.post('/:id/close', requireAuth, async (req, res) => {
  const id = paramId(req);
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { customer: true, plan: true },
  });
  if (!sub) throw httpError(404, 'Subscription not found');

  if (req.user.role === 'CUSTOMER') {
    const isOwner =
      req.user.customerId === sub.customerId ||
      sub.customer?.userId === req.user.id ||
      sub.customer?.email === req.user.email;
    if (!isOwner) throw httpError(404, 'Subscription not found');
  }

  if (!sub.plan.closable) {
    throw httpError(400, 'This plan does not permit early closure');
  }
  if (sub.status === 'CLOSED') {
    throw httpError(400, 'Subscription is already closed');
  }

  const reason = req.body?.reason?.trim() || `Closed by ${actor(req)}`;
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closeReason: reason,
        isPaused: false,
        nextInvoiceDate: null,
      },
    });
    await tx.subscriptionLog.create({
      data: {
        subscriptionId: id,
        fromStatus: sub.status,
        toStatus: 'CLOSED',
        action: 'CLOSED',
        note: reason,
        userId: req.user.id,
      },
    });
    return s;
  });

  res.json({ data: updated, message: 'Subscription closed successfully' });
});

// PATCH /api/subscriptions/:id - edit while still draft or quotation
router.patch('/:id', requireRole('ADMIN', 'STAFF'), validate(updateSchema), async (req, res) => {
  const id = paramId(req);
  await updateSubscription(id, req.body, req.user);
  res.json({ data: await fetchFull(id) });
});

// DELETE /api/subscriptions/:id - drafts only; anything customer-facing is closed instead
router.delete('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const sub = await prisma.subscription.findUnique({ where: { id }, select: { status: true } });
  if (!sub) throw httpError(404, 'Subscription not found');
  if (sub.status !== 'DRAFT') throw httpError(409, 'Only drafts can be deleted. Close the subscription instead.');
  await prisma.subscription.delete({ where: { id } });
  res.json({ data: { id } });
});

// POST /api/subscriptions/:id/send-quotation - DRAFT -> QUOTATION, emailed to the customer
router.post('/:id/send-quotation', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const sub = await prisma.subscription.findUnique({ where: { id }, include: { customer: true, lines: true } });
  if (!sub) throw httpError(404, 'Subscription not found');
  if (!sub.lines.some((l) => l.isActive)) throw httpError(422, 'Add at least one line before sending the quotation');
  await transition(id, ['DRAFT'], 'QUOTATION', 'QUOTATION_SENT', {
    note: `Quotation sent to ${sub.customer.email}`,
    userId: req.user.id,
  });
  await sendMail({
    to: sub.customer.email,
    subject: `Quotation ${sub.number} from ${env.COMPANY_NAME}`,
    html: `<p>Hello ${sub.customer.name},</p><p>Your quotation <b>${sub.number}</b> (total ${sub.amountTotal}) is ready. `
      + `Please log in to ${env.CLIENT_URL} to review and accept it.</p>`,
  });
  res.json({ data: await fetchFull(id), message: 'Quotation sent' });
});

// POST /api/subscriptions/:id/confirm - staff confirm on the customer's behalf (QUOTATION/DRAFT -> CONFIRMED)
router.post('/:id/confirm', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  await confirm(id, req.user.id, `Confirmed by ${actor(req)}`); // already started? goes live and bills
  res.json({ data: await fetchFull(id), message: 'Subscription confirmed' });
});

// POST /api/subscriptions/:id/activate - CONFIRMED -> ACTIVE, creates the first invoice
router.post('/:id/activate', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  await activateSubscription(id, today(), req.user.id);
  res.json({ data: await fetchFull(id), message: 'Subscription activated' });
});

// POST /api/subscriptions/:id/renew - extend the expiry (default +1 year)
router.post('/:id/renew', validate(renewSchema), async (req, res) => {
  const id = paramId(req);
  await loadOwned(req, id);
  await renewSubscription(id, req.body.expiryDate, req.user.id);
  res.json({ data: await fetchFull(id), message: 'Subscription renewed' });
});

// POST /api/subscriptions/:id/lines - add a product / add-on
router.post('/:id/lines', validate(lineInput), async (req, res) => {
  const id = paramId(req);
  const sub = await loadOwned(req, id);
  if (req.user.role === 'CUSTOMER') {
    const product = await prisma.product.findUnique({ where: { id: req.body.productId }, select: { type: true } });
    if (product?.type !== 'ADDON') throw httpError(403, 'Customers can only add optional add-ons');
    if (req.body.unitPrice != null) throw httpError(403, 'Customers cannot set prices');
  }
  if (sub.status === 'CLOSED') throw httpError(409, 'Closed subscriptions cannot be changed');
  await addLine(id, req.body, req.user);
  res.status(201).json({ data: await fetchFull(id) });
});

// PATCH /api/subscriptions/:id/lines/:lineId - switch an add-on on/off or change its quantity
router.patch('/:id/lines/:lineId', validate(lineUpdateSchema), async (req, res) => {
  const id = paramId(req);
  await loadOwned(req, id);
  if (req.user.role === 'CUSTOMER') {
    const line = await prisma.subscriptionLine.findFirst({ where: { id: paramId(req, 'lineId'), subscriptionId: id }, include: { product: true } });
    if (line?.product.type !== 'ADDON') throw httpError(403, 'Customers can only manage optional add-ons');
  }
  await updateLine(id, paramId(req, 'lineId'), req.body, req.user);
  res.json({ data: await fetchFull(id) });
});

// DELETE /api/subscriptions/:id/lines/:lineId
router.delete('/:id/lines/:lineId', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  await removeLine(id, paramId(req, 'lineId'), req.user);
  res.json({ data: await fetchFull(id) });
});

export default router;
