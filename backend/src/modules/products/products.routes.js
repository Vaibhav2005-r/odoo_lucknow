import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';

const router = Router();

export const PRODUCT_INCLUDE = {
  taxes: { select: { id: true, name: true, rate: true } },
  variants: { orderBy: { id: 'asc' } },
};

const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  attribute: z.string().trim().min(1, 'Attribute is required').max(60),
  value: z.string().trim().min(1, 'Value is required').max(60),
  extraPrice: z.coerce.number().min(0, 'Extra price cannot be negative').default(0),
  isActive: z.boolean().optional(),
});

const productBase = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  type: z.enum(['SERVICE', 'GOODS', 'ADDON']),
  salesPrice: z.coerce.number().min(0, 'Sales price cannot be negative'),
  costPrice: z.coerce.number().min(0, 'Cost price cannot be negative'),
  hsnSac: z.string().trim().regex(/^\d{4,8}$/, 'HSN/SAC is 4 to 8 digits').nullable().optional().or(z.literal('').transform(() => null)),
  notes: z.string().trim().max(2000).nullable().optional(),
  taxIds: z.array(z.coerce.number().int().positive()).optional(),
  variants: z.array(variantSchema).optional(),
  isActive: z.boolean().optional(),
};

const createSchema = z.object({
  ...productBase,
  type: productBase.type.default('SERVICE'),
  costPrice: productBase.costPrice.default(0),
});
const updateSchema = z.object(
  Object.fromEntries(Object.entries(productBase).map(([k, v]) => [k, v.optional()])),
);

const listQuery = z.object({
  search: z.string().trim().optional(),
  type: z.enum(['SERVICE', 'GOODS', 'ADDON']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

function assertUniqueVariants(variants = []) {
  const seen = new Set();
  for (const v of variants) {
    const key = `${v.attribute.toLowerCase()}::${v.value.toLowerCase()}`;
    if (seen.has(key)) throw httpError(422, `Duplicate variant "${v.attribute}: ${v.value}"`);
    seen.add(key);
  }
}

async function assertTaxesExist(db, taxIds = []) {
  if (!taxIds.length) return;
  const n = await db.tax.count({ where: { id: { in: taxIds } } });
  if (n !== new Set(taxIds).size) throw httpError(422, 'One or more selected taxes do not exist');
}

// Make the stored variants equal to the submitted list: update by id, create new, drop the rest.
// A variant already used on a subscription or template is switched off instead of deleted.
async function syncVariants(tx, productId, variants) {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    include: { _count: { select: { subscriptionLines: true, templateLines: true } } },
  });
  const keep = new Set(variants.filter((v) => v.id).map((v) => v.id));

  for (const old of existing) {
    if (keep.has(old.id)) continue;
    if (old._count.subscriptionLines + old._count.templateLines > 0) {
      await tx.productVariant.update({ where: { id: old.id }, data: { isActive: false } });
    } else {
      await tx.productVariant.delete({ where: { id: old.id } });
    }
  }
  for (const v of variants) {
    const data = {
      attribute: v.attribute,
      value: v.value,
      extraPrice: v.extraPrice,
      ...(v.isActive === undefined ? {} : { isActive: v.isActive }),
    };
    if (v.id && existing.some((e) => e.id === v.id)) {
      await tx.productVariant.update({ where: { id: v.id }, data });
    } else {
      await tx.productVariant.create({ data: { ...data, productId } });
    }
  }
}

// GET /api/products
router.get('/', requireRole('ADMIN', 'STAFF'), validate(listQuery, 'query'), async (req, res) => {
  const { search, type, status } = req.valid.query;
  const where = {
    ...(type ? { type } : {}),
    ...(status ? { isActive: status === 'ACTIVE' } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const data = await prisma.product.findMany({
    where,
    include: PRODUCT_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ data });
});

// GET /api/products/stats
router.get('/stats', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const [total, active, services, goods, addons] = await prisma.$transaction([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { type: 'SERVICE' } }),
    prisma.product.count({ where: { type: 'GOODS' } }),
    prisma.product.count({ where: { type: 'ADDON' } }),
  ]);
  res.json({ data: { total, active, services, goods, addons } });
});

// GET /api/products/:id
router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: paramId(req) }, include: PRODUCT_INCLUDE });
  if (!product) throw httpError(404, 'Product not found');
  res.json({ data: product });
});

// POST /api/products - admin only
router.post('/', requireRole('ADMIN'), validate(createSchema), async (req, res) => {
  const { taxIds = [], variants = [], ...rest } = req.body;
  assertUniqueVariants(variants);
  await assertTaxesExist(prisma, taxIds);

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: { ...rest, taxes: { connect: [...new Set(taxIds)].map((id) => ({ id })) } },
    });
    await syncVariants(tx, p.id, variants);
    return tx.product.findUnique({ where: { id: p.id }, include: PRODUCT_INCLUDE });
  });
  res.status(201).json({ data: product });
});

// PATCH /api/products/:id - admin only
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), async (req, res) => {
  const id = paramId(req);
  const { taxIds, variants, ...rest } = req.body;
  if (!(await prisma.product.findUnique({ where: { id }, select: { id: true } }))) {
    throw httpError(404, 'Product not found');
  }
  if (variants) assertUniqueVariants(variants);
  if (taxIds) await assertTaxesExist(prisma, taxIds);

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: { ...rest, ...(taxIds ? { taxes: { set: [...new Set(taxIds)].map((t) => ({ id: t })) } } : {}) },
    });
    if (variants) await syncVariants(tx, id, variants);
    return tx.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  });
  res.json({ data: product });
});

// POST /api/products/:id/toggle - flip active flag
router.post('/:id/toggle', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw httpError(404, 'Product not found');
  const data = await prisma.product.update({
    where: { id },
    data: { isActive: !p.isActive },
    include: PRODUCT_INCLUDE,
  });
  res.json({ data });
});

// DELETE /api/products/:id - only when nothing references it; otherwise deactivate instead
router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = paramId(req);
  const p = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { plans: true, subscriptionLines: true, templateLines: true, invoiceLines: true } } },
  });
  if (!p) throw httpError(404, 'Product not found');
  if (Object.values(p._count).some((n) => n > 0)) {
    throw httpError(409, 'This product is used by plans, templates or subscriptions. Deactivate it instead.');
  }
  await prisma.product.delete({ where: { id } });
  res.json({ data: { id } });
});

export default router;
