import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { paramId, paginate } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';
import { todayIn, parseDate, canMove, SUBSCRIPTION_FLOW, resumePeriodIndex } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { activateDueSubscriptions } from './subscriptions.service.js';

const router = Router();
const today = () => todayIn(env.APP_TZ);

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
  if (status) {
    where.status = status;
  }

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
        note: `Quotation accepted by customer (${req.user.name})`,
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
        note: `Subscription paused by ${req.user.name}`,
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
        note: `Subscription resumed by ${req.user.name}`,
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

  const reason = req.body?.reason?.trim() || `Closed by ${req.user.name}`;
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

export default router;
