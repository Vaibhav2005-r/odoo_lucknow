import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { paramId, paginate } from '../../lib/params.js';
import { validate } from '../../middleware/validate.js';
import { requireRole, ownScope, isInternal } from '../../middleware/auth.js';
import { parseDate } from '../../lib/billing-core.js';
import { recordPayment } from './payments.service.js';

const router = Router();

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER'];

const listQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  invoiceId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be YYYY-MM-DD'),
  note: z.string().trim().max(255).optional().nullable(),
});

// GET /api/payments - List payments with filters & totals row
router.get('/', validate(listQuerySchema, 'query'), async (req, res) => {
  const q = req.valid.query;
  const { page, pageSize, skip, take } = paginate(q);

  const where = {
    ...ownScope(req),
    ...(q.customerId && isInternal(req) ? { customerId: q.customerId } : {}),
    ...(q.invoiceId ? { invoiceId: q.invoiceId } : {}),
    ...(q.method ? { method: q.method } : {}),
    ...(q.from || q.to ? {
      paymentDate: {
        ...(q.from ? { gte: parseDate(q.from) } : {}),
        ...(q.to ? { lte: parseDate(q.to) } : {}),
      },
    } : {}),
  };

  const [rows, total, sumAgg] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { paymentDate: 'desc' },
      include: {
        customer: { select: { id: true, name: true, company: true } },
        invoice: { select: { id: true, number: true, amountTotal: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ]);

  res.json({
    data: rows,
    meta: {
      page,
      pageSize,
      total,
      totalAmount: sumAgg._sum.amount ? Number(sumAgg._sum.amount) : 0,
    },
  });
});

// POST /api/payments/:invoiceId - Direct payment recording route
router.post('/:invoiceId', requireRole('ADMIN', 'STAFF'), validate(paymentSchema), async (req, res) => {
  const invoiceId = paramId(req, 'invoiceId');
  const payment = await recordPayment(invoiceId, req.body, req.user.id);
  res.status(201).json(payment);
});

export default router;
