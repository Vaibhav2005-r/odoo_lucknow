import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';
import { parseDate } from '../../lib/billing-core.js';

const router = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const planBase = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  productId: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  billingPeriod: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  minQuantity: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1'),
  startDate: dateStr,
  endDate: dateStr.nullable().optional(),
  autoClose: z.boolean(),
  closable: z.boolean(),
  pausable: z.boolean(),
  renewable: z.boolean(),
  isActive: z.boolean(),
};

const datesOk = (d, ctx) => {
  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    ctx.addIssue({ code: 'custom', message: 'End date must be on or after the start date', path: ['endDate'] });
  }
};

const createSchema = z
  .object({
    ...planBase,
    minQuantity: planBase.minQuantity.default(1),
    autoClose: planBase.autoClose.default(false),
    closable: planBase.closable.default(true),
    pausable: planBase.pausable.default(false),
    renewable: planBase.renewable.default(true),
    isActive: planBase.isActive.default(true),
  })
  .superRefine(datesOk);

const updateSchema = z
  .object(Object.fromEntries(Object.entries(planBase).map(([k, v]) => [k, v.optional()])))
  .superRefine(datesOk);

const listQuery = z.object({
  search: z.string().trim().optional(),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  productId: z.coerce.number().int().positive().optional(),
});

const INCLUDE = {
  product: { select: { id: true, name: true, type: true, salesPrice: true } },
  _count: { select: { subscriptions: true, templates: true } },
};

const toDb = (b) => ({
  ...b,
  ...(b.startDate ? { startDate: parseDate(b.startDate) } : {}),
  ...(b.endDate !== undefined ? { endDate: b.endDate ? parseDate(b.endDate) : null } : {}),
});

async function assertProduct(productId) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!p) throw httpError(422, 'Selected product does not exist');
}

// GET /api/plans - internal staff see everything; customers (portal) only see plans open for sale
router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { search, period, status, productId } = req.valid.query;
  const internal = req.user.role !== 'CUSTOMER';
  const where = {
    ...(period ? { billingPeriod: period } : {}),
    ...(productId ? { productId } : {}),
    ...(internal && status ? { isActive: status === 'ACTIVE' } : {}),
    ...(internal ? {} : { isActive: true }),
    ...(search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { product: { name: { contains: search, mode: 'insensitive' } } }] }
      : {}),
  };
  const data = await prisma.plan.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, take: 500 });
  res.json({ data });
});

// GET /api/plans/stats
router.get('/stats', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const [total, active, monthly, yearly] = await prisma.$transaction([
    prisma.plan.count(),
    prisma.plan.count({ where: { isActive: true } }),
    prisma.plan.count({ where: { billingPeriod: 'MONTHLY' } }),
    prisma.plan.count({ where: { billingPeriod: 'YEARLY' } }),
  ]);
  res.json({ data: { total, active, monthly, yearly } });
});

// GET /api/plans/:id
router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: paramId(req) }, include: INCLUDE });
  if (!plan) throw httpError(404, 'Plan not found');
  res.json({ data: plan });
});

// POST /api/plans - admin decides everything plan by plan
router.post('/', requireRole('ADMIN'), validate(createSchema), async (req, res) => {
  await assertProduct(req.body.productId);
  try {
    const data = await prisma.plan.create({ data: toDb(req.body), include: INCLUDE });
    res.status(201).json({ data });
  } catch (e) {
    if (e.code === 'P2002') throw httpError(409, `A plan named '${req.body.name}' already exists`);
    throw e;
  }
});

// PATCH /api/plans/:id
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), async (req, res) => {
  const id = paramId(req);
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Plan not found');
  if (req.body.productId) await assertProduct(req.body.productId);

  const start = req.body.startDate ?? existing.startDate.toISOString().slice(0, 10);
  const end = req.body.endDate === undefined ? existing.endDate?.toISOString().slice(0, 10) : req.body.endDate;
  if (end && end < start) throw httpError(422, 'End date must be on or after the start date', { endDate: ['Invalid range'] });

  try {
    const data = await prisma.plan.update({ where: { id }, data: toDb(req.body), include: INCLUDE });
    res.json({ data });
  } catch (e) {
    if (e.code === 'P2002') throw httpError(409, `A plan named '${req.body.name}' already exists`);
    throw e;
  }
});

// POST /api/plans/:id/toggle
router.post('/:id/toggle', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  const p = await prisma.plan.findUnique({ where: { id } });
  if (!p) throw httpError(404, 'Plan not found');
  const data = await prisma.plan.update({ where: { id }, data: { isActive: !p.isActive }, include: INCLUDE });
  res.json({ data });
});

// DELETE /api/plans/:id
router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  const p = await prisma.plan.findUnique({ where: { id }, include: { _count: { select: { subscriptions: true, templates: true } } } });
  if (!p) throw httpError(404, 'Plan not found');
  if (p._count.subscriptions + p._count.templates > 0) {
    throw httpError(409, 'This plan is used by subscriptions or quotation templates. Deactivate it instead.');
  }
  await prisma.plan.delete({ where: { id } });
  res.json({ data: { id } });
});

export default router;
