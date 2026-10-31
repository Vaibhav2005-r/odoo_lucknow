import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';

const router = Router();

const createPaymentTermSchema = z.object({
  name: z.string().trim().min(2, 'Term name must be at least 2 characters').max(50),
  dueDays: z.coerce.number().int('Due days must be an integer').min(0, 'Due days cannot be negative').max(365, 'Due days cannot exceed 365'),
  isActive: z.boolean().default(true),
});

const updatePaymentTermSchema = z.object({
  name: z.string().trim().min(2, 'Term name must be at least 2 characters').max(50).optional(),
  dueDays: z.coerce.number().int('Due days must be an integer').min(0, 'Due days cannot be negative').max(365, 'Due days cannot exceed 365').optional(),
  isActive: z.boolean().optional(),
});

// GET /api/payment-terms - Staff and Admin can view
router.get('/', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const activeOnly = req.query.active === 'true';
  const terms = await prisma.paymentTerm.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { dueDays: 'asc' },
    include: {
      _count: {
        select: { subscriptions: true, templates: true },
      },
    },
  });
  res.json({ data: terms });
});

// GET /api/payment-terms/:id
router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const term = await prisma.paymentTerm.findUnique({
    where: { id },
    include: {
      _count: {
        select: { subscriptions: true, templates: true },
      },
    },
  });
  if (!term) throw httpError(404, 'Payment term not found');
  res.json({ data: term });
});

// POST /api/payment-terms - Admin only creates
router.post('/', requireRole('ADMIN'), validate(createPaymentTermSchema), async (req, res) => {
  const { name, dueDays, isActive } = req.body;

  const existing = await prisma.paymentTerm.findUnique({ where: { name } });
  if (existing) {
    throw httpError(409, `Payment term '${name}' already exists`);
  }

  const term = await prisma.paymentTerm.create({
    data: { name, dueDays, isActive },
  });

  res.status(201).json({ data: term });
});

// PATCH /api/payment-terms/:id - Admin only updates
router.patch('/:id', requireRole('ADMIN'), validate(updatePaymentTermSchema), async (req, res) => {
  const id = paramId(req);

  const existing = await prisma.paymentTerm.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, 'Payment term not found');
  }

  if (req.body.name && req.body.name !== existing.name) {
    const duplicate = await prisma.paymentTerm.findUnique({ where: { name: req.body.name } });
    if (duplicate) throw httpError(409, `Payment term '${req.body.name}' already exists`);
  }

  const term = await prisma.paymentTerm.update({
    where: { id },
    data: req.body,
  });

  res.json({ data: term });
});

export default router;
