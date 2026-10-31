import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { paramId, paginate } from '../../lib/params.js';
import { validate } from '../../middleware/validate.js';
import { requireRole, ownScope, isInternal } from '../../middleware/auth.js';
import { parseDate } from '../../lib/billing-core.js';
import { recordPayment, reconcileCustomerPayment } from './payments.service.js';

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

const reconcileSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive('Reconciliation amount must be greater than 0'),
  method: z.enum(PAYMENT_METHODS).default('BANK_TRANSFER'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be YYYY-MM-DD'),
  note: z.string().trim().max(255).optional().nullable(),
});

// GET /api/payments/export - CSV Export of payments
router.get('/export', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.valid.query;
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

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        customer: { select: { name: true, company: true } },
        invoice: { select: { number: true } },
      },
    });

    const headers = ['Receipt #', 'Payment Date', 'Customer', 'Company', 'Invoice #', 'Method', 'Amount (INR)', 'Note'];
    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = [headers.join(',')];

    for (const p of payments) {
      const pDate = p.paymentDate ? p.paymentDate.toISOString().slice(0, 10) : '';
      rows.push([
        escape(p.receiptNumber || `PAY-${p.id}`),
        escape(pDate),
        escape(p.customer?.name),
        escape(p.customer?.company || ''),
        escape(p.invoice?.number || ''),
        escape(p.method),
        escape(Number(p.amount).toFixed(2)),
        escape(p.note || ''),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments-ledger.csv"');
    res.send(rows.join('\r\n'));
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/reconcile - Lump sum auto-allocation across oldest unpaid customer invoices
router.post('/reconcile', requireRole('ADMIN', 'STAFF'), validate(reconcileSchema), async (req, res, next) => {
  try {
    const result = await reconcileCustomerPayment(req.valid.body, req.user?.id);
    res.status(201).json({
      message: `Successfully allocated ₹${result.totalAllocated} across ${result.reconciledInvoicesCount} invoices`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
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
    prisma.payment.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  res.json({
    data: rows,
    meta: {
      page,
      pageSize,
      total,
      totalAmount: sumAgg._sum.amount || 0,
    },
  });
});

// POST /api/payments - Record a manual payment against an invoice
router.post('/', requireRole('ADMIN', 'STAFF'), validate(paymentSchema.extend({ invoiceId: z.coerce.number().int().positive() })), async (req, res, next) => {
  try {
    const { invoiceId, ...rest } = req.valid.body;
    const payment = await recordPayment(invoiceId, rest, req.user?.id);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id - Payment detail
router.get('/:id', async (req, res) => {
  const id = paramId(req);
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, company: true } },
      invoice: { select: { id: true, number: true, amountTotal: true, amountPaid: true, status: true } },
    },
  });

  if (!payment) return res.status(404).json({ error: { message: 'Payment not found' } });
  if (req.user.role === 'CUSTOMER' && payment.customerId !== req.user.customerId) {
    return res.status(404).json({ error: { message: 'Payment not found' } });
  }

  res.json(payment);
});

export default router;
