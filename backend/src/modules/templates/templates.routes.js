import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';

const router = Router();

const lineSchema = z.object({
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
});

const base = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  planId: z.coerce.number().int().positive(),
  paymentTermId: z.coerce.number().int().positive().nullable().optional(),
  validityDays: z.coerce.number().int().min(1, 'Validity must be at least 1 day').max(365),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  lines: z.array(lineSchema).max(50),
};

const createSchema = z.object({ ...base, validityDays: base.validityDays.default(30), lines: base.lines.default([]) });
const updateSchema = z.object(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.optional()])));
const listQuery = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const TEMPLATE_INCLUDE = {
  plan: { select: { id: true, name: true, price: true, billingPeriod: true, minQuantity: true, productId: true } },
  paymentTerm: { select: { id: true, name: true, dueDays: true } },
  lines: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { id: true, name: true, type: true, salesPrice: true, taxes: { select: { id: true, name: true, rate: true } } } },
      variant: { select: { id: true, attribute: true, value: true, extraPrice: true } },
    },
  },
};

async function validateRefs({ planId, paymentTermId, lines }) {
  if (planId && !(await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } }))) {
    throw httpError(422, 'Selected plan does not exist');
  }
  if (paymentTermId && !(await prisma.paymentTerm.findUnique({ where: { id: paymentTermId }, select: { id: true } }))) {
    throw httpError(422, 'Selected payment term does not exist');
  }
  for (const l of lines || []) {
    const p = await prisma.product.findUnique({ where: { id: l.productId }, include: { variants: { select: { id: true } } } });
    if (!p) throw httpError(422, `Product ${l.productId} does not exist`);
    if (l.variantId && !p.variants.some((v) => v.id === l.variantId)) {
      throw httpError(422, `Variant ${l.variantId} does not belong to ${p.name}`);
    }
  }
}

const lineData = (l) => ({ productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity });

// GET /api/quotation-templates
router.get('/', requireRole('ADMIN', 'STAFF'), validate(listQuery, 'query'), async (req, res) => {
  const { search, status } = req.valid.query;
  const where = {
    ...(status ? { isActive: status === 'ACTIVE' } : {}),
    ...(search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { plan: { name: { contains: search, mode: 'insensitive' } } }] }
      : {}),
  };
  const data = await prisma.quotationTemplate.findMany({
    where,
    include: TEMPLATE_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ data });
});

// GET /api/quotation-templates/:id
router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const t = await prisma.quotationTemplate.findUnique({ where: { id: paramId(req) }, include: TEMPLATE_INCLUDE });
  if (!t) throw httpError(404, 'Template not found');
  res.json({ data: t });
});

// POST /api/quotation-templates - admin only
router.post('/', requireRole('ADMIN'), validate(createSchema), async (req, res) => {
  await validateRefs(req.body);
  const { lines, ...rest } = req.body;
  try {
    const data = await prisma.quotationTemplate.create({
      data: { ...rest, lines: { create: lines.map(lineData) } },
      include: TEMPLATE_INCLUDE,
    });
    res.status(201).json({ data });
  } catch (e) {
    if (e.code === 'P2002') throw httpError(409, `A template named '${req.body.name}' already exists`);
    throw e;
  }
});

// PATCH /api/quotation-templates/:id - lines, when sent, replace the existing ones
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), async (req, res) => {
  const id = paramId(req);
  if (!(await prisma.quotationTemplate.findUnique({ where: { id }, select: { id: true } }))) {
    throw httpError(404, 'Template not found');
  }
  await validateRefs(req.body);
  const { lines, ...rest } = req.body;
  try {
    const data = await prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.templateLine.deleteMany({ where: { templateId: id } });
        await tx.templateLine.createMany({ data: lines.map((l) => ({ ...lineData(l), templateId: id })) });
      }
      return tx.quotationTemplate.update({ where: { id }, data: rest, include: TEMPLATE_INCLUDE });
    });
    res.json({ data });
  } catch (e) {
    if (e.code === 'P2002') throw httpError(409, `A template named '${req.body.name}' already exists`);
    throw e;
  }
});

// POST /api/quotation-templates/:id/toggle
router.post('/:id/toggle', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  const t = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!t) throw httpError(404, 'Template not found');
  const data = await prisma.quotationTemplate.update({
    where: { id },
    data: { isActive: !t.isActive },
    include: TEMPLATE_INCLUDE,
  });
  res.json({ data });
});

// DELETE /api/quotation-templates/:id - subscriptions keep their own copy of the lines, so this is safe
router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  try {
    await prisma.$transaction([
      prisma.subscription.updateMany({ where: { templateId: id }, data: { templateId: null } }),
      prisma.quotationTemplate.delete({ where: { id } }),
    ]);
  } catch (e) {
    if (e.code === 'P2025') throw httpError(404, 'Template not found');
    throw e;
  }
  res.json({ data: { id } });
});

export default router;
