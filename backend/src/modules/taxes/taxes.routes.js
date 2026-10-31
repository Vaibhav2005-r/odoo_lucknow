import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';

const router = Router();

const createTaxSchema = z.object({
  name: z.string().trim().min(2, 'Tax name must be at least 2 characters').max(50),
  rate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  isActive: z.boolean().default(true),
});

const updateTaxSchema = z.object({
  name: z.string().trim().min(2, 'Tax name must be at least 2 characters').max(50).optional(),
  rate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%').optional(),
  isActive: z.boolean().optional(),
});

// GET /api/taxes - staff and admin can view taxes
router.get('/', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const activeOnly = req.query.active === 'true';
  const taxes = await prisma.tax.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { rate: 'asc' },
    include: {
      _count: {
        select: { products: true, subscriptionLines: true },
      },
    },
  });
  res.json({ data: taxes });
});

// GET /api/taxes/:id
router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const tax = await prisma.tax.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true, subscriptionLines: true },
      },
    },
  });
  if (!tax) throw httpError(404, 'Tax rate not found');
  res.json({ data: tax });
});

// POST /api/taxes - Admin only creates tax rules
router.post('/', requireRole('ADMIN'), validate(createTaxSchema), async (req, res) => {
  const { name, rate, isActive } = req.body;

  const existing = await prisma.tax.findUnique({ where: { name } });
  if (existing) {
    throw httpError(409, `A tax rate named '${name}' already exists`);
  }

  const tax = await prisma.tax.create({
    data: { name, rate, isActive },
  });

  res.status(201).json({ data: tax });
});

// PATCH /api/taxes/:id - Admin only updates tax rules
router.patch('/:id', requireRole('ADMIN'), validate(updateTaxSchema), async (req, res) => {
  const id = paramId(req);

  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, 'Tax rate not found');
  }

  if (req.body.name && req.body.name !== existing.name) {
    const duplicate = await prisma.tax.findUnique({ where: { name: req.body.name } });
    if (duplicate) throw httpError(409, `A tax rate named '${req.body.name}' already exists`);
  }

  const tax = await prisma.tax.update({
    where: { id },
    data: req.body,
  });

  res.json({ data: tax });
});

export default router;
