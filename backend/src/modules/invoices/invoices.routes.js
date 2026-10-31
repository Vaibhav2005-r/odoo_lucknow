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
import { recordPayment } from '../payments/payments.service.js';
import { sendMail } from '../../lib/mailer.js';
import { esc } from '../../lib/email.js';
import { buildInvoiceDocument, loadInvoiceForPdf, pdfFilename, renderInvoicePdf } from './invoice-pdf.js';
import { createCheckout, failIntent, settleIntent } from '../payments/checkout.service.js';
import { gatewayName, getProvider, verifyCheckoutSignature } from '../payments/gateway.js';

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

// GET /api/invoices/export - Export filtered invoices as CSV
router.get('/export', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.valid.query;
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

    const rows = await prisma.invoice.findMany({
      where: { ...base, ...viewWhere },
      orderBy: { invoiceDate: 'desc' },
      include: {
        customer: { select: { name: true, company: true } },
      },
    });

    const headers = [
      'Invoice Number',
      'Customer',
      'Company',
      'Status',
      'Invoice Date',
      'Due Date',
      'Subtotal',
      'Discount',
      'Untaxed',
      'Tax',
      'Total',
      'Paid',
      'Balance Due',
    ];

    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      const invDate = r.invoiceDate ? r.invoiceDate.toISOString().slice(0, 10) : '';
      const dueDate = r.dueDate ? r.dueDate.toISOString().slice(0, 10) : '';
      const due = (Number(r.amountTotal) - Number(r.amountPaid)).toFixed(2);

      csvRows.push([
        escape(r.number),
        escape(r.customer?.name),
        escape(r.customer?.company || ''),
        escape(r.status),
        escape(invDate),
        escape(dueDate),
        escape(Number(r.amountSubtotal).toFixed(2)),
        escape(Number(r.amountDiscount).toFixed(2)),
        escape(Number(r.amountUntaxed).toFixed(2)),
        escape(Number(r.amountTax).toFixed(2)),
        escape(Number(r.amountTotal).toFixed(2)),
        escape(Number(r.amountPaid).toFixed(2)),
        escape(due),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(csvRows.join('\r\n'));
  } catch (err) {
    next(err);
  }
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

// POST /api/invoices/:id/payments - Record a payment against an invoice (Staff / Admin)
const paymentSchema = z.object({
  method: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER']),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be YYYY-MM-DD'),
  note: z.string().trim().max(255).optional().nullable(),
});

router.post('/:id/payments', requireRole('ADMIN', 'STAFF'), validate(paymentSchema), async (req, res) => {
  const invoiceId = paramId(req);
  const payment = await recordPayment(invoiceId, req.body, req.user.id);
  res.status(201).json(payment);
});

// POST /api/invoices/:id/pay - Customer pays own confirmed invoice via portal
const portalPaySchema = z.object({
  method: z.enum(['UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('CARD'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  note: z.string().trim().max(255).optional().nullable(),
});

router.post('/:id/pay', validate(portalPaySchema), async (req, res) => {
  // This shortcut records a payment without any money moving, so it only exists for demos on the test gateway.
  if (gatewayName() !== 'mock') throw httpError(403, 'Please use online checkout to pay this invoice');
  const invoiceId = paramId(req);
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      customerId: true,
      status: true,
      customer: { select: { userId: true, email: true } },
    },
  });

  if (!inv) throw httpError(404, 'Invoice not found');

  // Customer role ownership check
  if (req.user.role === 'CUSTOMER') {
    const isOwner =
      req.user.customerId === inv.customerId ||
      inv.customer?.userId === req.user.id ||
      inv.customer?.email === req.user.email;
    if (!isOwner) throw httpError(404, 'Invoice not found');
  }

  const today = todayIn(env.APP_TZ);
  const paymentPayload = {
    method: req.body.method,
    amount: req.body.amount,
    paymentDate: today.toISOString().slice(0, 10),
    note: req.body.note || `Customer online payment via Portal (${req.body.method})`,
  };

  const payment = await recordPayment(invoiceId, paymentPayload, req.user.id);
  res.status(201).json({ payment, message: 'Payment recorded successfully' });
});

// ---------- online checkout (customer pays their own invoice; staff may start one on a customer's behalf)

// POST /api/invoices/:id/checkout - create a payment order for what is still owed
router.post('/:id/checkout', async (req, res) => {
  res.status(201).json({ data: await createCheckout(paramId(req), req.user) });
});

const verifySchema = z.object({
  orderId: z.string().min(5).max(80),
  paymentId: z.string().min(5).max(80),
  signature: z.string().min(10).max(200),
});

// POST /api/invoices/:id/checkout/verify - the browser reports a finished Razorpay payment; we check the signature
router.post('/:id/checkout/verify', validate(verifySchema), async (req, res) => {
  const invoiceId = paramId(req);
  if (gatewayName() !== 'razorpay') throw httpError(404, 'Not found');
  const { orderId, paymentId, signature } = req.body;
  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) throw httpError(400, 'Payment signature could not be verified');
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { customerId: true } });
  if (!inv || (req.user.role === 'CUSTOMER' && req.user.customerId !== inv.customerId)) throw httpError(404, 'Invoice not found');

  let method = 'OTHER';
  try {
    method = (await getProvider().fetchPayment(paymentId)).method;
  } catch {
    /* the payment is already verified; the method is only a label */
  }
  res.json({ data: await settleIntent({ orderId, paymentId, method, invoiceId }) });
});

const mockSchema = z.object({
  orderId: z.string().min(5).max(80),
  outcome: z.enum(['success', 'failure']),
  method: z.enum(['UPI', 'CARD', 'BANK_TRANSFER']).default('UPI'),
});

// POST /api/invoices/:id/checkout/mock-complete - finish a test-gateway payment (demo mode only)
router.post('/:id/checkout/mock-complete', validate(mockSchema), async (req, res) => {
  if (gatewayName() !== 'mock') throw httpError(404, 'Not found');
  const invoiceId = paramId(req);
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { customerId: true } });
  if (!inv || (req.user.role === 'CUSTOMER' && req.user.customerId !== inv.customerId)) throw httpError(404, 'Invoice not found');
  const { orderId, outcome, method } = req.body;
  if (outcome === 'failure') {
    await failIntent(orderId, 'Test payment declined');
    return res.json({ data: { status: 'FAILED' } });
  }
  return res.json({ data: await settleIntent({ orderId, paymentId: `pay_mock_${Date.now().toString(36)}`, method, invoiceId }) });
});

// GET /api/invoices/:id/pdf - the tax invoice as a PDF (?inline=1 shows it in the browser instead of downloading)
router.get('/:id/pdf', async (req, res) => {
  const invoice = await loadInvoiceForPdf(paramId(req));
  // customers get their own invoices only, and not drafts (those are still internal)
  const hidden = !invoice || (req.user.role === 'CUSTOMER' && (invoice.customerId !== req.user.customerId || invoice.status === 'DRAFT'));
  if (hidden) throw httpError(404, 'Invoice not found');
  const pdf = await renderInvoicePdf(buildInvoiceDocument(invoice));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${pdfFilename(invoice.number)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

// POST /api/invoices/:id/send - Send invoice email to customer
router.post('/:id/send', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: true,
    },
  });

  if (!invoice) throw httpError(404, 'Invoice not found');
  if (invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') {
    throw httpError(409, 'Only confirmed or paid invoices can be emailed to customers');
  }

  const linesHtml = invoice.lines
    .map(
      (l) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${esc(l.description)}</td>
          <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">${l.quantity}</td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">₹${Number(l.total).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  const link = `${env.CLIENT_URL}/portal/invoices/${invoice.id}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #714b67;">Invoice ${esc(invoice.number)} from ${env.COMPANY_NAME}</h2>
      <p>Dear ${esc(invoice.customer.name)},</p>
      <p>Here is your invoice for the billing period.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background: #f8fafc; text-align: left; font-size: 13px;">
            <th style="padding: 8px;">Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml}
        </tbody>
      </table>
      <p style="font-size: 16px; font-weight: bold;">
        Total: ₹${Number(invoice.amountTotal).toFixed(2)} |
        Balance Due: ₹${(Number(invoice.amountTotal) - Number(invoice.amountPaid)).toFixed(2)}
      </p>
      <p>Due Date: ${invoice.dueDate.toISOString().slice(0, 10)}</p>
      <p><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #714b67; color: white; text-decoration: none; border-radius: 6px;">View & Pay in Portal</a></p>
    </div>
  `;

  // the invoice itself, as a PDF; if it cannot be produced the e-mail still goes out with the link
  let attachments;
  try {
    const pdf = await renderInvoicePdf(buildInvoiceDocument(await loadInvoiceForPdf(id)));
    attachments = [{ filename: pdfFilename(invoice.number), content: pdf, contentType: 'application/pdf' }];
  } catch (e) {
    console.error('[invoice pdf]', e);
  }

  await sendMail({
    to: invoice.customer.email,
    attachments,
    subject: `Invoice ${invoice.number} from ${env.COMPANY_NAME}`,
    html,
  });

  const updated = await prisma.invoice.update({
    where: { id },
    data: { sentAt: new Date() },
  });

  res.json({ message: 'Invoice sent to customer email', sentAt: updated.sentAt });
});

// POST /api/invoices/:id/remind - Send overdue reminder email
router.post('/:id/remind', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: true },
  });

  if (!invoice) throw httpError(404, 'Invoice not found');
  const today = todayIn(env.APP_TZ);
  if (invoice.status !== 'CONFIRMED' || invoice.dueDate >= today) {
    throw httpError(409, 'Payment reminders can only be sent for confirmed overdue invoices');
  }

  const days = Math.floor((today - invoice.dueDate) / (1000 * 60 * 60 * 24));
  const dueAmt = Number(invoice.amountTotal) - Number(invoice.amountPaid);
  const link = `${env.CLIENT_URL}/portal/invoices/${invoice.id}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #b91c1c;">Payment Reminder: Invoice ${esc(invoice.number)} is Overdue</h2>
      <p>Dear ${esc(invoice.customer.name)},</p>
      <p>This is a friendly reminder that invoice <strong>${esc(invoice.number)}</strong> was due on <strong>${invoice.dueDate.toISOString().slice(0, 10)}</strong> and is now <strong>${days} day(s) overdue</strong>.</p>
      <p style="font-size: 16px; font-weight: bold; color: #b91c1c;">Outstanding Balance: ₹${dueAmt.toFixed(2)}</p>
      <p><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #714b67; color: white; text-decoration: none; border-radius: 6px;">Review Invoice in Portal</a></p>
      <p>If you have already made this payment, please disregard this email.</p>
    </div>
  `;

  await sendMail({
    to: invoice.customer.email,
    subject: `Overdue Payment Reminder: Invoice ${invoice.number} (${days} days overdue)`,
    html,
  });

  res.json({ message: `Reminder email sent (${days} days overdue)` });
});

export default router;
