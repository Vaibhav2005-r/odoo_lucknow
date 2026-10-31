import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole, ownScope, isInternal } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId, paginate } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().max(20).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  gstin: z.string().trim().max(20).optional().nullable(),
});

const updateCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  gstin: z.string().trim().max(20).optional().nullable(),
});

const listQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

// GET /api/customers - Staff & Admin can list/search customers
router.get('/', requireRole('ADMIN', 'STAFF'), validate(listQuerySchema, 'query'), async (req, res) => {
  const q = req.valid.query;
  const { page, pageSize, skip, take } = paginate(q);

  const where = q.search
    ? {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
          { company: { contains: q.search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        address: true,
        gstin: true,
        userId: true,
        createdAt: true,
        _count: {
          select: { subscriptions: true, invoices: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({
    data: customers,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// GET /api/customers/:id - Admin/Staff or Customer viewing own profile
router.get('/:id', async (req, res) => {
  const id = paramId(req);

  // Customer role can only view own record
  if (req.user.role === 'CUSTOMER' && req.user.customerId !== id) {
    throw httpError(404, 'Customer not found');
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, isActive: true },
      },
      subscriptions: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          startDate: true,
          expiryDate: true,
          plan: { select: { id: true, name: true, billingPeriod: true } },
        },
      },
      invoices: {
        take: 10,
        orderBy: { invoiceDate: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          amountPaid: true,
          invoiceDate: true,
          dueDate: true,
        },
      },
      payments: {
        take: 10,
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          amount: true,
          method: true,
          paymentDate: true,
          invoice: { select: { id: true, number: true } },
        },
      },
      _count: {
        select: { subscriptions: true, invoices: true, payments: true },
      },
    },
  });

  if (!customer) throw httpError(404, 'Customer not found');

  // Compute total outstanding balance from confirmed invoices
  const outstandingInvoices = await prisma.invoice.findMany({
    where: { customerId: id, status: 'CONFIRMED' },
    select: { amountTotal: true, amountPaid: true },
  });

  const outstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (Number(inv.amountTotal) - Number(inv.amountPaid)),
    0
  );

  res.json({
    data: {
      ...customer,
      outstandingAmount: Math.max(0, Math.round(outstanding * 100) / 100),
    },
  });
});

// POST /api/customers - Staff & Admin can create customers
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createCustomerSchema), async (req, res) => {
  const { name, email, phone, company, address, gstin } = req.body;

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    throw httpError(409, 'A customer with this email already exists');
  }

  // Check if a user account with this email already exists
  const matchingUser = await prisma.user.findUnique({ where: { email } });

  const customer = await prisma.customer.create({
    data: {
      name,
      email,
      phone: phone || null,
      company: company || null,
      address: address || null,
      gstin: gstin || null,
      userId: matchingUser?.id || null,
    },
  });

  res.status(201).json({ data: customer });
});

// PATCH /api/customers/:id - Admin, Staff or Customer (restricted fields)
router.patch('/:id', validate(updateCustomerSchema), async (req, res) => {
  const id = paramId(req);

  // Customer role restriction
  if (req.user.role === 'CUSTOMER') {
    if (req.user.customerId !== id) throw httpError(404, 'Customer not found');
    // Customers can only update name, phone, company, address
    delete req.body.email;
    delete req.body.gstin;
  }

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Customer not found');

  if (req.body.email && req.body.email !== existing.email) {
    const duplicate = await prisma.customer.findUnique({ where: { email: req.body.email } });
    if (duplicate) throw httpError(409, 'A customer with this email already exists');
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: req.body,
  });

  res.json({ data: customer });
});

export default router;
