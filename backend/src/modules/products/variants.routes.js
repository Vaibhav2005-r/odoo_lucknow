import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';

const router = Router();

const createSchema = z.object({
  productId: z.coerce.number().int().positive(),
  attribute: z.string().trim().min(1, 'Attribute is required').max(60),
  value: z.string().trim().min(1, 'Value is required').max(60),
  extraPrice: z.coerce.number().min(0, 'Extra price cannot be negative').default(0),
  isActive: z.boolean().optional(),
});
const updateSchema = z.object({
  attribute: createSchema.shape.attribute.optional(),
  value: createSchema.shape.value.optional(),
  extraPrice: z.coerce.number().min(0, 'Extra price cannot be negative').optional(),
  isActive: z.boolean().optional(),
});

const conflict = (e) => e.code === 'P2002' && httpError(409, 'That variant already exists on this product');

// GET /api/variants?productId=1
router.get('/', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const data = await prisma.productVariant.findMany({ where: { productId }, orderBy: { id: 'asc' } });
  res.json({ data });
});

// POST /api/variants
router.post('/', requireRole('ADMIN'), validate(createSchema), async (req, res) => {
  if (!(await prisma.product.findUnique({ where: { id: req.body.productId }, select: { id: true } }))) {
    throw httpError(404, 'Product not found');
  }
  try {
    res.status(201).json({ data: await prisma.productVariant.create({ data: req.body }) });
  } catch (e) {
    throw conflict(e) || e;
  }
});

// PATCH /api/variants/:id
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), async (req, res) => {
  const id = paramId(req);
  try {
    res.json({ data: await prisma.productVariant.update({ where: { id }, data: req.body }) });
  } catch (e) {
    if (e.code === 'P2025') throw httpError(404, 'Variant not found');
    throw conflict(e) || e;
  }
});

// DELETE /api/variants/:id - used variants are switched off instead
router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  const v = await prisma.productVariant.findUnique({
    where: { id },
    include: { _count: { select: { subscriptionLines: true, templateLines: true } } },
  });
  if (!v) throw httpError(404, 'Variant not found');
  if (v._count.subscriptionLines + v._count.templateLines > 0) {
    const data = await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
    return res.json({ data, deactivated: true });
  }
  await prisma.productVariant.delete({ where: { id } });
  return res.json({ data: { id } });
});

export default router;
