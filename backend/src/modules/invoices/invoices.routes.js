import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { httpError } from '../../lib/http-error.js';
import { paramId, paginate } from '../../lib/params.js';
import { validate } from '../../middleware/validate.js';
import { requireRole, ownScope, isInternal } from '../../middleware/auth.js';
import { todayIn, parseDate } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { confirmInvoices, cancelInvoice } from './invoices.service.js';

const router = Router();

const listQuerySchema = z.object({
  view: z.enum(['ALL', 'DRAFT', 'OUTSTANDING', 'OVERDUE', 'PAID', 'CANCELLED']).default('ALL'),
  customerId: z.coerce.number().int().positive().optional(),
  subscriptionId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

// GET /api/invoices - List invoices with view tabs and counts
router.get('/', validate(listQuerySchema, 'query'), async (req, res) => {
  const q = req.valid.query;
  const { page, pageSize, skip, take } = paginate(q);
  const today = todayIn(env.APP_TZ);

  const base = {
    ...ownScope(req),
    ...(q.customerId && isInternal(req) ? { customerId: q.customerId } : {}),
    ...(q.subscriptionId ? { subscriptionId: q.subscriptionId } : {}),
    ...(q.from || q.to ? {
      invoiceDate: {
        ...(q.from ? { gte: parseDate(q.from) } : {}),
        ...(q.to ? { lte: parseDate(q.to) } : {}),
      },
    } : {}),
    ...(q.search ? {
      OR: [
        { number: { contains: q.search, mode: 'insensitive' } },
        { customer: { name: { contains: q.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  let viewWhere = {};
  if (q.view === 'DRAFT') viewWhere = { status: 'DRAFT' };
  else if (q.view === 'OUTSTANDING') viewWhere = { status: 'CONFIRMED' };
  else if (q.view === 'OVERDUE') viewWhere = { status: 'CONFIRMED', dueDate: { lt: today } };
  else if (q.view === 'PAID') viewWhere = { status: 'PAID' };
  else if (q.view === 'CANCELLED') viewWhere = { status: 'CANCELLED' };

  const where = { ...base, ...viewWhere };

  const [rows, total, countsByStatus, overdueCount, allCount] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: { invoiceDate: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        invoiceDate: true,
        dueDate: true,
        periodStart: true,
        periodEnd: true,
        amountSubtotal: true,
        amountDiscount: true,
        amountUntaxed: true,
        amountTax: true,
        amountTotal: true,
        amountPaid: true,
        customer: { select: { id: true, name: true, company: true } },
        subscription: { select: { id: true, number: true } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    prisma.invoice.count({ where: { ...base, status: 'CONFIRMED', dueDate: { lt: today } } }),
    prisma.invoice.count({ where: base }),
  ]);

  const statusMap = Object.fromEntries(countsByStatus.map((c) => [c.status, c._count._all]));
  const viewCounts = {
    ALL: allCount,
    DRAFT: statusMap.DRAFT || 0,
    OUTSTANDING: statusMap.CONFIRMED || 0,
    OVERDUE: overdueCount,
    PAID: statusMap.PAID || 0,
    CANCELLED: statusMap.CANCELLED || 0,
  };

  res.json({
    data: rows,
    meta: {
      page,
      pageSize,
      total,
      viewCounts,
    },
  });
});

// GET /api/invoices/:id - Invoice detail view
router.get('/:id', async (req, res) => {
  const id = paramId(req);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { id: 'asc' } },
      payments: { orderBy: { paymentDate: 'desc' } },
      customer: { select: { id: true, name: true, email: true, company: true, phone: true, address: true, gstin: true } },
      subscription: { select: { id: true, number: true } },
    },
  });

  if (!invoice) throw httpError(404, 'Invoice not found');
  if (req.user.role === 'CUSTOMER' && invoice.customerId !== req.user.customerId) {
    throw httpError(404, 'Invoice not found');
  }

  res.json(invoice);
});

// POST /api/invoices/:id/confirm - Confirm a single draft invoice
router.post('/:id/confirm', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const result = await confirmInvoices([id]);
  if (result.confirmed === 0) throw httpError(409, 'Only draft invoices can be confirmed');
  res.json({ message: 'Invoice confirmed successfully' });
});

// POST /api/invoices/bulk-confirm - Bulk confirm selected draft invoices
const bulkConfirmSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, 'Provide at least one invoice ID'),
});

router.post('/bulk-confirm', requireRole('ADMIN', 'STAFF'), validate(bulkConfirmSchema), async (req, res) => {
  const { ids } = req.body;
  const result = await confirmInvoices(ids);
  res.json({ message: `${result.confirmed} draft invoice(s) confirmed successfully`, confirmed: result.confirmed });
});

// POST /api/invoices/:id/cancel - Cancel an invoice
router.post('/:id/cancel', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const cancelled = await cancelInvoice(id);
  res.json({ message: 'Invoice cancelled', invoice: cancelled });
});

export default router;
